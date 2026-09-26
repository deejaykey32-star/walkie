import { useEffect, useRef, useState, useCallback } from 'react';
import Peer, { DataConnection, MediaConnection } from 'peerjs';
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

  // State refs to prevent unnecessary useEffect re-runs
  const channelRef = useRef(channel);
  useEffect(() => {
    channelRef.current = channel;
  }, [channel]);

  const deviceNameRef = useRef(deviceName);
  useEffect(() => {
    deviceNameRef.current = deviceName;
  }, [deviceName]);

  const peerRef = useRef<Peer | null>(null);
  const dataConnRef = useRef<DataConnection | null>(null);
  const mediaConnRef = useRef<MediaConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const isTransmittingRef = useRef(false);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  // Hidden audio element for WebRTC remote sound
  useEffect(() => {
    const audio = new Audio();
    audio.autoplay = true;
    audio.volume = volume / 100;
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
      const match = CHANNELS.find((c) => c.id.toLowerCase() === chParam.toLowerCase() || c.name.toLowerCase() === chParam.toLowerCase());
      if (match) {
        setChannel(match.id);
      } else {
        setChannel(chParam.toUpperCase());
      }
    }
  }, []);

  // Microphone initialization
  const initMicrophone = useCallback(async () => {
    if (localStreamRef.current && localStreamRef.current.active) {
      setMicAllowed(true);
      return localStreamRef.current;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Initially mute track so microphone won't record until user presses PTT
      stream.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });

      localStreamRef.current = stream;
      audioEngine.setupMicAnalyser(stream);
      setMicAllowed(true);

      // If media connection is already active, replace track
      if (mediaConnRef.current && mediaConnRef.current.peerConnection) {
        const senders = mediaConnRef.current.peerConnection.getSenders();
        const audioTrack = stream.getAudioTracks()[0];
        const sender = senders.find((s) => s.track?.kind === 'audio');
        if (sender && audioTrack) {
          sender.replaceTrack(audioTrack);
        }
      }

      return stream;
    } catch (err) {
      console.warn('[Microphone] Permission error:', err);
      setMicAllowed(false);
      return null;
    }
  }, []);

  // Auto initialize mic & audio context on user interaction
  useEffect(() => {
    initMicrophone();

    const unlockAudio = () => {
      audioEngine.playKnobClick();
      if (remoteAudioRef.current) {
        remoteAudioRef.current.play().catch(() => {});
      }
      if (!localStreamRef.current) {
        initMicrophone();
      }
    };

    window.addEventListener('touchstart', unlockAudio, { once: true });
    window.addEventListener('mousedown', unlockAudio, { once: true });
    window.addEventListener('click', unlockAudio, { once: true });

    return () => {
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('mousedown', unlockAudio);
      window.removeEventListener('click', unlockAudio);
    };
  }, [initMicrophone]);

  // Bind Data Connection events
  const setupDataConnection = useCallback((conn: DataConnection) => {
    dataConnRef.current = conn;

    const handleDataOpen = () => {
      console.log('[PeerJS] Data connection open with:', conn.peer);
      setIsP2PDirect(true);
      setConnectionStatus('paired');
      setRemotePeer((prev) => prev || { peerId: conn.peer, name: 'Partner-Radio' });

      try {
        conn.send({
          type: 'peer-info',
          peerId,
          name: deviceNameRef.current,
          channel: channelRef.current,
        });
      } catch (e) {
        console.warn('Error sending peer-info:', e);
      }
    };

    if (conn.open) {
      handleDataOpen();
    } else {
      conn.on('open', handleDataOpen);
    }

    conn.on('data', (data: unknown) => {
      try {
        const msg = typeof data === 'string' ? JSON.parse(data) : (data as Record<string, unknown>);
        switch (msg.type) {
          case 'peer-info':
            setRemotePeer({
              peerId: (msg.peerId as string) || conn.peer,
              name: (msg.name as string) || 'Partner-Radio',
            });
            setConnectionStatus('paired');
            break;

          case 'ptt-start':
            setIsReceiving(true);
            audioEngine.playPttStart();
            if (remoteAudioRef.current) {
              remoteAudioRef.current.play().catch(() => {});
            }
            if (navigator.vibrate) navigator.vibrate(30);
            break;

          case 'ptt-end':
            setIsReceiving(false);
            audioEngine.playRogerBeep();
            if (navigator.vibrate) navigator.vibrate([20, 40, 20]);
            break;

          case 'call-alert':
            setCallAlertIncoming(true);
            audioEngine.playCallAlert();
            if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 100]);
            setTimeout(() => setCallAlertIncoming(false), 3000);
            break;

          default:
            break;
        }
      } catch (e) {
        console.warn('Error parsing PeerJS data:', e);
      }
    });

    conn.on('close', () => {
      console.log('[PeerJS] Data connection closed');
      setIsP2PDirect(false);
      setRemotePeer(null);
      setIsReceiving(false);
      setConnectionStatus('connected');
    });

    conn.on('error', (err) => {
      console.warn('[PeerJS] Data connection error:', err);
    });
  }, [peerId]);

  // Bind Media Call events
  const setupMediaCall = useCallback((call: MediaConnection) => {
    mediaConnRef.current = call;

    call.on('stream', (remoteStream) => {
      console.log('[PeerJS] Received remote audio stream!');
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStream;
        remoteAudioRef.current.play().catch((e) => console.warn('Play error:', e));
        audioEngine.setupRemoteAnalyser(remoteStream);
      }
      setIsP2PDirect(true);
      setConnectionStatus('paired');
    });

    call.on('close', () => {
      setIsP2PDirect(false);
      setIsReceiving(false);
    });

    call.on('error', (err) => {
      console.warn('[PeerJS] Media call error:', err);
    });
  }, []);

  // Connect directly to target peer ID
  const connectToPeer = useCallback(async (targetPeerId: string) => {
    if (!peerRef.current || peerRef.current.destroyed) return;
    if (targetPeerId === peerId) return;

    console.log('[PeerJS] Connecting to target peer:', targetPeerId);
    setConnectionStatus('connecting');

    const stream = await initMicrophone();

    const conn = peerRef.current.connect(targetPeerId, {
      metadata: { name: deviceNameRef.current, channel: channelRef.current },
    });
    setupDataConnection(conn);

    if (stream) {
      const call = peerRef.current.call(targetPeerId, stream);
      setupMediaCall(call);
    }
  }, [peerId, initMicrophone, setupDataConnection, setupMediaCall]);

  // Setup BroadcastChannel for local cross-tab / local network pairing
  useEffect(() => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const bc = new BroadcastChannel('walkie_talkie_p2p_channel');
      broadcastChannelRef.current = bc;

      bc.onmessage = (event) => {
        const data = event.data;
        if (data && data.type === 'announce-presence') {
          if (data.channel === channelRef.current && data.peerId !== peerId) {
            connectToPeer(data.peerId);
          }
        }
      };

      // Announce presence
      bc.postMessage({
        type: 'announce-presence',
        peerId,
        channel: channelRef.current,
        name: deviceNameRef.current,
      });
    }

    return () => {
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.close();
      }
    };
  }, [peerId, connectToPeer]);

  // Main PeerJS Initialization Effect (Runs ONLY ONCE per peerId)
  useEffect(() => {
    setConnectionStatus('connecting');

    const peer = new Peer(peerId, {
      debug: 1,
      config: STUN_SERVERS,
    });
    peerRef.current = peer;

    peer.on('open', (id) => {
      console.log('[PeerJS] Connected to signaling broker with ID:', id);
      setConnectionStatus('connected');

      // Check if URL query contains target peer ID to auto connect after QR code scan
      const urlParams = new URLSearchParams(window.location.search);
      const targetPeer = urlParams.get('peer');
      if (targetPeer && targetPeer !== id) {
        connectToPeer(targetPeer);
      }
    });

    peer.on('connection', (conn) => {
      console.log('[PeerJS] Incoming data connection from:', conn.peer);
      setupDataConnection(conn);
    });

    peer.on('call', async (call) => {
      console.log('[PeerJS] Incoming media call from:', call.peer);
      let stream = localStreamRef.current;
      if (!stream) {
        stream = await initMicrophone();
      }

      if (stream) {
        call.answer(stream);
      } else {
        call.answer();
      }
      setupMediaCall(call);
    });

    peer.on('error', (err) => {
      console.warn('[PeerJS] Peer error:', err.type, err.message);
      setConnectionStatus('connected');
    });

    peer.on('disconnected', () => {
      console.log('[PeerJS] Peer disconnected, reconnecting...');
      if (!peer.destroyed) {
        peer.reconnect();
      }
    });

    return () => {
      if (dataConnRef.current) dataConnRef.current.close();
      if (mediaConnRef.current) mediaConnRef.current.close();
      peer.destroy();
    };
  }, [peerId]); // Intentionally ONLY peerId so channel switch never destroys PeerJS

  // Channel switch & manual peer pairing handler
  const changeChannel = useCallback((newChannel: string, targetPeerId?: string) => {
    audioEngine.playKnobClick();
    if (navigator.vibrate) navigator.vibrate(15);
    setChannel(newChannel);

    // Announce new channel presence to local BroadcastChannel
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.postMessage({
        type: 'announce-presence',
        peerId,
        channel: newChannel,
        name: deviceNameRef.current,
      });
    }

    if (targetPeerId) {
      connectToPeer(targetPeerId);
    }
  }, [peerId, connectToPeer]);

  // Start Transmitting (PTT pressed)
  const startTalking = useCallback(async () => {
    if (isTransmittingRef.current) return;
    isTransmittingRef.current = true;
    setIsTransmitting(true);

    if (navigator.vibrate) navigator.vibrate(25);
    audioEngine.playPttStart();

    let stream = localStreamRef.current;
    if (!stream) {
      stream = await initMicrophone();
    }

    if (stream) {
      stream.getAudioTracks().forEach((track) => {
        track.enabled = true;
      });
    }

    if (dataConnRef.current && dataConnRef.current.open) {
      dataConnRef.current.send({ type: 'ptt-start' });
    }
  }, [initMicrophone]);

  // Stop Transmitting (PTT released)
  const stopTalking = useCallback(() => {
    if (!isTransmittingRef.current) return;
    isTransmittingRef.current = false;
    setIsTransmitting(false);

    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });
    }

    audioEngine.playRogerBeep();
    if (navigator.vibrate) navigator.vibrate([15, 30, 15]);

    if (dataConnRef.current && dataConnRef.current.open) {
      dataConnRef.current.send({ type: 'ptt-end' });
    }
  }, []);

  // Send Call Siren / Alert
  const sendCallTone = useCallback(() => {
    audioEngine.playCallAlert();
    if (navigator.vibrate) navigator.vibrate([50, 50, 50]);

    if (dataConnRef.current && dataConnRef.current.open) {
      dataConnRef.current.send({ type: 'ptt-start' });
      dataConnRef.current.send({ type: 'call-alert' });
      setTimeout(() => {
        dataConnRef.current?.send({ type: 'ptt-end' });
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

    if (dataConnRef.current && dataConnRef.current.open) {
      dataConnRef.current.send({
        type: 'peer-info',
        peerId,
        name: clean,
      });
    }
  }, [peerId]);

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
