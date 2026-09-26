import { useEffect, useRef, useState, useCallback } from 'react';
import { audioEngine } from '../utils/audioEngine';

export interface PeerInfo {
  peerId: string;
  name: string;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'paired';

const STUN_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

// Preset standard PMR446 radio frequencies
export const CHANNELS = [
  { id: 'CH-01', name: 'KANAŁ 01', freq: '446.00625 MHz', subcode: 'CTCSS 01' },
  { id: 'CH-02', name: 'KANAŁ 02', freq: '446.01875 MHz', subcode: 'CTCSS 04' },
  { id: 'CH-03', name: 'KANAŁ 03', freq: '446.03125 MHz', subcode: 'CTCSS 08' },
  { id: 'CH-04', name: 'KANAŁ 04', freq: '446.04375 MHz', subcode: 'CTCSS 12' },
  { id: 'CH-05', name: 'KANAŁ 05', freq: '446.05625 MHz', subcode: 'CTCSS 16' },
  { id: 'CH-06', name: 'KANAŁ 06', freq: '446.06875 MHz', subcode: 'CTCSS 20' },
  { id: 'CH-07', name: 'KANAŁ 07', freq: '446.08125 MHz', subcode: 'CTCSS 24' },
  { id: 'CH-08', name: 'KANAŁ 08', freq: '446.09375 MHz', subcode: 'CTCSS 28' },
];

export function useWalkieTalkie(initialChannel = 'CH-01') {
  const [channel, setChannel] = useState(initialChannel);
  const [peerId] = useState(() => 'WT-' + Math.random().toString(36).substring(2, 7).toUpperCase());
  const [deviceName, setDeviceName] = useState(() => {
    const saved = localStorage.getItem('wt_device_name');
    if (saved) return saved;
    const isAndroid = /android/i.test(navigator.userAgent);
    const defaultName = isAndroid ? `Android-${Math.floor(10 + Math.random() * 90)}` : `Radio-${Math.floor(10 + Math.random() * 90)}`;
    localStorage.setItem('wt_device_name', defaultName);
    return defaultName;
  });

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [isP2PDirect, setIsP2PDirect] = useState(false);
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [isReceiving, setIsReceiving] = useState(false);
  const [remotePeer, setRemotePeer] = useState<PeerInfo | null>(null);
  const [micAllowed, setMicAllowed] = useState<boolean | null>(null);
  const [txLevel, setTxLevel] = useState(0);
  const [rxLevel, setRxLevel] = useState(0);
  const [callAlertIncoming, setCallAlertIncoming] = useState(false);
  const [volume, setVolume] = useState(85); // 0 to 100
  const [squelch, setSquelch] = useState(50); // 0 to 100

  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const isTransmittingRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  // Hidden audio element for WebRTC remote sound
  useEffect(() => {
    const audio = new Audio();
    audio.autoplay = true;
    remoteAudioRef.current = audio;

    return () => {
      audio.srcObject = null;
      audio.remove();
    };
  }, []);

  // Update volume
  useEffect(() => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.volume = volume / 100;
    }
  }, [volume]);

  // Read URL query parameter for instant channel pairing
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const chParam = urlParams.get('ch') || urlParams.get('channel');
    if (chParam) {
      const match = CHANNELS.find(c => c.id.toLowerCase() === chParam.toLowerCase() || c.name.toLowerCase() === chParam.toLowerCase());
      if (match) {
        setChannel(match.id);
      } else {
        setChannel(chParam.toUpperCase());
      }
    }
  }, []);

  // Initialize Microphone
  const initMicrophone = useCallback(async () => {
    if (localStreamRef.current) return localStreamRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Initially mute track so we don't transmit until PTT is held down
      stream.getAudioTracks().forEach(track => {
        track.enabled = false;
      });

      localStreamRef.current = stream;
      audioEngine.setupMicAnalyser(stream);
      setMicAllowed(true);

      // If peer connection exists, add track
      if (pcRef.current) {
        stream.getAudioTracks().forEach(track => {
          pcRef.current?.addTrack(track, stream);
        });
      }

      return stream;
    } catch (err) {
      console.warn('Microphone permission denied or unavailable:', err);
      setMicAllowed(false);
      return null;
    }
  }, []);

  // WebRTC Peer Connection Setup
  const createPeerConnection = useCallback((targetPeerId: string, isInitiator: boolean) => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    const pc = new RTCPeerConnection(STUN_SERVERS);
    pcRef.current = pc;

    // Add local tracks if microphone already granted
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // Remote audio track received
    pc.ontrack = (event) => {
      console.log('[WebRTC] Received remote audio track!');
      if (remoteAudioRef.current && event.streams[0]) {
        remoteAudioRef.current.srcObject = event.streams[0];
        audioEngine.setupRemoteAnalyser(event.streams[0]);
      }
    };

    // ICE candidate exchange
    pc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'signal',
            targetId: targetPeerId,
            senderId: peerId,
            data: {
              type: 'candidate',
              candidate: event.candidate,
            },
          })
        );
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE Connection State:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        setIsP2PDirect(true);
        setConnectionStatus('paired');
      } else if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        setIsP2PDirect(false);
      }
    };

    // If initiator, create and send Offer
    if (isInitiator) {
      pc.createOffer({ offerToReceiveAudio: true })
        .then(offer => pc.setLocalDescription(offer))
        .then(() => {
          if (wsRef.current?.readyState === WebSocket.OPEN && pc.localDescription) {
            wsRef.current.send(
              JSON.stringify({
                type: 'signal',
                targetId: targetPeerId,
                senderId: peerId,
                data: pc.localDescription,
              })
            );
          }
        })
        .catch(err => console.error('[WebRTC] Error creating offer:', err));
    }

    return pc;
  }, [peerId]);

  // WebSocket signaling connection
  useEffect(() => {
    let isMounted = true;
    let reconnectTimeout: ReturnType<typeof setTimeout>;

    function connect() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}`;
      console.log('[Walkie-Talkie] Connecting WS to', wsUrl);
      setConnectionStatus('connecting');

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMounted) return;
        setConnectionStatus('connected');
        // Join channel
        ws.send(
          JSON.stringify({
            type: 'join',
            channel,
            peerId,
            name: deviceName,
          })
        );
      };

      ws.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data);
          switch (msg.type) {
            case 'joined-success': {
              if (msg.peers && msg.peers.length > 0) {
                const partner = msg.peers[0];
                setRemotePeer(partner);
                setConnectionStatus('paired');
                // Initiate WebRTC peer connection
                createPeerConnection(partner.peerId, true);
              } else {
                setRemotePeer(null);
                setConnectionStatus('connected');
              }
              break;
            }

            case 'peer-joined': {
              setRemotePeer({ peerId: msg.peerId, name: msg.name });
              setConnectionStatus('paired');
              // Let newcomer initiate or create peer connection
              createPeerConnection(msg.peerId, false);
              break;
            }

            case 'peer-left': {
              if (remotePeer?.peerId === msg.peerId) {
                setRemotePeer(null);
                setIsReceiving(false);
                setIsP2PDirect(false);
                setConnectionStatus('connected');
                if (pcRef.current) {
                  pcRef.current.close();
                  pcRef.current = null;
                }
              }
              break;
            }

            case 'signal': {
              const { data, senderId } = msg;
              if (!pcRef.current) {
                createPeerConnection(senderId, false);
              }
              const pc = pcRef.current;
              if (!pc) return;

              if (data.type === 'offer') {
                await pc.setRemoteDescription(new RTCSessionDescription(data));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                ws.send(
                  JSON.stringify({
                    type: 'signal',
                    targetId: senderId,
                    senderId: peerId,
                    data: pc.localDescription,
                  })
                );
              } else if (data.type === 'answer') {
                await pc.setRemoteDescription(new RTCSessionDescription(data));
              } else if (data.type === 'candidate') {
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
                } catch (e) {
                  console.warn('Error adding ICE candidate:', e);
                }
              }
              break;
            }

            case 'ptt-start': {
              setIsReceiving(true);
              audioEngine.playPttStart();
              if (navigator.vibrate) {
                navigator.vibrate(30);
              }
              break;
            }

            case 'ptt-end': {
              setIsReceiving(false);
              audioEngine.playRogerBeep();
              if (navigator.vibrate) {
                navigator.vibrate([20, 40, 20]);
              }
              break;
            }

            case 'audio-relay': {
              // Fallback audio chunk from peer via WebSocket
              if (msg.audioData && !isP2PDirect) {
                try {
                  const audioBlob = await fetch(msg.audioData).then(r => r.blob());
                  const audioUrl = URL.createObjectURL(audioBlob);
                  const chunkAudio = new Audio(audioUrl);
                  chunkAudio.volume = volume / 100;
                  chunkAudio.play().catch(() => {});
                } catch (e) {
                  console.warn('Audio relay playback error:', e);
                }
              }
              break;
            }

            case 'call-alert': {
              setCallAlertIncoming(true);
              audioEngine.playCallAlert();
              if (navigator.vibrate) {
                navigator.vibrate([100, 50, 100, 50, 100]);
              }
              setTimeout(() => setCallAlertIncoming(false), 3000);
              break;
            }

            default:
              break;
          }
        } catch (e) {
          console.error('Error parsing WS message:', e);
        }
      };

      ws.onclose = () => {
        if (!isMounted) return;
        setConnectionStatus('disconnected');
        setIsP2PDirect(false);
        reconnectTimeout = setTimeout(connect, 2500);
      };

      ws.onerror = (err) => {
        console.warn('WS error:', err);
        ws.close();
      };
    }

    connect();

    return () => {
      isMounted = false;
      clearTimeout(reconnectTimeout);
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (pcRef.current) {
        pcRef.current.close();
      }
    };
  }, [channel, peerId, deviceName, createPeerConnection, volume, isP2PDirect, remotePeer?.peerId]);

  // Channel switch
  const changeChannel = useCallback((newChannel: string) => {
    if (newChannel === channel) return;
    audioEngine.playKnobClick();
    if (navigator.vibrate) navigator.vibrate(15);
    setChannel(newChannel);
  }, [channel]);

  // Start Transmitting (Push To Talk - PTT pressed)
  const startTalking = useCallback(async () => {
    if (isTransmittingRef.current) return;
    isTransmittingRef.current = true;
    setIsTransmitting(true);

    // Haptic feedback for tactile feel
    if (navigator.vibrate) {
      navigator.vibrate(25);
    }

    // Local radio squelch chirp
    audioEngine.playPttStart();

    // Ensure mic is active
    let stream = localStreamRef.current;
    if (!stream) {
      stream = await initMicrophone();
    }

    if (stream) {
      // Unmute audio track for instantaneous WebRTC transmission
      stream.getAudioTracks().forEach(track => {
        track.enabled = true;
      });

      // Also set up fallback audio chunk recorder in case WebRTC NAT is blocked
      try {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
          mediaRecorderRef.current = recorder;
          recorder.ondataavailable = async (e) => {
            if (e.data.size > 0 && !isP2PDirect && wsRef.current?.readyState === WebSocket.OPEN) {
              const reader = new FileReader();
              reader.onloadend = () => {
                wsRef.current?.send(
                  JSON.stringify({
                    type: 'audio-relay',
                    audioData: reader.result,
                  })
                );
              };
              reader.readAsDataURL(e.data);
            }
          };
          recorder.start(150);
        }
      } catch (err) {
        console.warn('Fallback MediaRecorder error:', err);
      }
    }

    // Notify peer via WebSocket
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'ptt-start',
        })
      );
    }
  }, [initMicrophone, isP2PDirect]);

  // Stop Transmitting (PTT released)
  const stopTalking = useCallback(() => {
    if (!isTransmittingRef.current) return;
    isTransmittingRef.current = false;
    setIsTransmitting(false);

    // Mute mic track immediately
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = false;
      });
    }

    // Stop fallback recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        console.warn(e);
      }
    }

    // Play classic Roger Beep!
    audioEngine.playRogerBeep();

    // Haptic confirmation
    if (navigator.vibrate) {
      navigator.vibrate([15, 30, 15]);
    }

    // Notify peer via WebSocket
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'ptt-end',
        })
      );
    }
  }, []);

  // Send Call Siren / Alert to the partner phone
  const sendCallTone = useCallback(() => {
    audioEngine.playCallAlert();
    if (navigator.vibrate) {
      navigator.vibrate([50, 50, 50]);
    }
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'ptt-start',
        })
      );
      wsRef.current.send(
        JSON.stringify({
          type: 'call-alert',
        })
      );
      setTimeout(() => {
        wsRef.current?.send(JSON.stringify({ type: 'ptt-end' }));
      }, 1500);
    }
  }, []);

  // Update VU meters
  useEffect(() => {
    let animId: number;
    const updateMeter = () => {
      if (isTransmitting) {
        setTxLevel(audioEngine.getMicVolume());
      } else {
        setTxLevel(0);
      }

      if (isReceiving) {
        setRxLevel(audioEngine.getRemoteVolume());
      } else {
        setRxLevel(0);
      }

      animId = requestAnimationFrame(updateMeter);
    };

    animId = requestAnimationFrame(updateMeter);
    return () => cancelAnimationFrame(animId);
  }, [isTransmitting, isReceiving]);

  // Rename device
  const updateDeviceName = useCallback((name: string) => {
    const clean = name.trim().slice(0, 16) || 'Smartfon';
    setDeviceName(clean);
    localStorage.setItem('wt_device_name', clean);
  }, []);

  return {
    channel,
    channels: CHANNELS,
    peerId,
    deviceName,
    connectionStatus,
    isP2PDirect,
    isTransmitting,
    isReceiving,
    remotePeer,
    micAllowed,
    txLevel,
    rxLevel,
    callAlertIncoming,
    volume,
    squelch,
    setVolume,
    setSquelch,
    changeChannel,
    startTalking,
    stopTalking,
    sendCallTone,
    initMicrophone,
    updateDeviceName,
  };
}
