import { useEffect, useRef, useState, useCallback } from 'react';
import Peer, { DataConnection, MediaConnection } from 'peerjs';
import { audioEngine } from '../utils/audioEngine';
import { ICE_SERVERS_CONFIG } from '../utils/sdpUtils';

export interface PeerInfo {
  peerId: string;
  name: string;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'paired';

const ALWAYS_ON_ROOM = 'LIVE-LINE-P2P';

export function useWalkieTalkie() {
  const [peerId] = useState(() => 'LINE-' + Math.random().toString(36).substring(2, 7).toUpperCase());
  const [deviceName, setDeviceName] = useState(() => {
    const saved = localStorage.getItem('wt_device_name');
    if (saved) return saved;
    const isAndroid = /android/i.test(navigator.userAgent);
    const defaultName = isAndroid
      ? `Urządzenie-${Math.floor(10 + Math.random() * 90)}`
      : `Telefon-${Math.floor(10 + Math.random() * 90)}`;
    localStorage.setItem('wt_device_name', defaultName);
    return defaultName;
  });

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [connectionErrorMessage, setConnectionErrorMessage] = useState<string | null>(null);
  const [isP2PDirect, setIsP2PDirect] = useState(false);
  const [remotePeer, setRemotePeer] = useState<PeerInfo | null>(null);
  
  // Audio Controls
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
  const [audioActivated, setAudioActivated] = useState(false);
  
  // Microphone permission & error state handling
  const [micAllowed, setMicAllowed] = useState<boolean | null>(null);
  const [micErrorDetails, setMicErrorDetails] = useState<string | null>(null);

  const [txLevel, setTxLevel] = useState(0);
  const [rxLevel, setRxLevel] = useState(0);
  const [volume, setVolume] = useState(100); // 0 to 100

  // State refs
  const deviceNameRef = useRef(deviceName);
  useEffect(() => {
    deviceNameRef.current = deviceName;
  }, [deviceName]);

  const peerIdRef = useRef(peerId);
  useEffect(() => {
    peerIdRef.current = peerId;
  }, [peerId]);

  const peerRef = useRef<Peer | null>(null);
  const dataConnRef = useRef<DataConnection | null>(null);
  const mediaConnRef = useRef<MediaConnection | null>(null);
  const directPeerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const roomPeerRef = useRef<Peer | null>(null);
  const isRoomHostRef = useRef(false);
  const roomMembersRef = useRef<Set<string>>(new Set());
  const reconnectRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Helper to build deterministic room peer ID for channel auto-discovery
  const getRoomPeerId = (): string => `WT-ROOM-${ALWAYS_ON_ROOM}`;

  // Hidden audio element for WebRTC remote sound
  useEffect(() => {
    const audio = new Audio();
    audio.autoplay = true;
    audio.volume = isSpeakerMuted ? 0 : volume / 100;
    remoteAudioRef.current = audio;

    return () => {
      audio.srcObject = null;
      audio.remove();
    };
  }, []);

  // Sync volume and speaker mute
  useEffect(() => {
    if (remoteAudioRef.current) {
      try {
        const safeVol = isSpeakerMuted ? 0 : Math.max(0, Math.min(1, (volume || 0) / 100));
        remoteAudioRef.current.volume = safeVol;
      } catch (e) {
        console.warn('Błąd głośności:', e);
      }
    }
  }, [volume, isSpeakerMuted]);

  // Sync mic mute state to MediaStream tracks
  useEffect(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !isMicMuted;
      });
    }
  }, [isMicMuted]);

  /**
   * INICJALIZACJA MIKROFONU Z AUTOMATYCZNĄ TRANSMISJĄ ON-LINE (Hot-mic)
   */
  const initMicrophone = useCallback(async (): Promise<MediaStream | null> => {
    setMicErrorDetails(null);

    if (localStreamRef.current && localStreamRef.current.active) {
      setMicAllowed(true);
      return localStreamRef.current;
    }

    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (err1) {
      console.warn('[Mikrofon] Błąd zaawansowanych parametrów audio, próba podstawowego audio:', err1);
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err2: any) {
        console.error('[Mikrofon] Wyjątek podczas uzyskiwania dostępu do mikrofonu:', err2);
        setMicAllowed(false);

        if (err2.name === 'NotAllowedError' || err2.name === 'PermissionDeniedError') {
          setMicErrorDetails('Brak zgody na użycie mikrofonu. Odblokuj dostęp w ustawieniach przeglądarki.');
        } else if (err2.name === 'NotFoundError' || err2.name === 'DevicesNotFoundError') {
          setMicErrorDetails('Nie wykryto mikrofonu.');
        } else if (err2.name === 'NotReadableError' || err2.name === 'TrackStartError') {
          setMicErrorDetails('Mikrofon jest zajęty przez inną aplikację.');
        } else {
          setMicErrorDetails(`Błąd mikrofonu: ${err2.message || err2.name || 'Brak dostępu'}`);
        }
        return null;
      }
    }

    if (stream) {
      // Hot-mic: upewniamy się, że ścieżki audio są AKTYWNE od razu
      stream.getAudioTracks().forEach((track) => {
        track.enabled = !isMicMuted;
      });

      localStreamRef.current = stream;
      audioEngine.setupMicAnalyser(stream);
      setMicAllowed(true);
      setMicErrorDetails(null);

      if (mediaConnRef.current && mediaConnRef.current.peerConnection) {
        const senders = mediaConnRef.current.peerConnection.getSenders();
        const audioTrack = stream.getAudioTracks()[0];
        const sender = senders.find((s) => s.track?.kind === 'audio');
        if (sender && audioTrack) {
          sender.replaceTrack(audioTrack);
        }
      }

      return stream;
    }

    setMicAllowed(false);
    return null;
  }, [isMicMuted]);

  // Activate Audio (Browser Autoplay / AudioContext unlock gesture)
  const activateAudio = useCallback(async () => {
    setAudioActivated(true);
    const stream = await initMicrophone();
    if (remoteAudioRef.current && remoteAudioRef.current.srcObject) {
      remoteAudioRef.current.play().catch(() => {});
    }
    return stream;
  }, [initMicrophone]);

  // WebRTC Connection State Listeners
  const attachWebRtcStateListeners = useCallback((pc: RTCPeerConnection) => {
    directPeerConnectionRef.current = pc;

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      console.log('[WebRTC State Log] Stan ICE:', state);

      if (state === 'disconnected' || state === 'failed') {
        setConnectionStatus('connecting');
        setConnectionErrorMessage('Przerwanie zasięgu - automatyczne odnawianie połączenia...');

        try {
          if (typeof pc.restartIce === 'function') {
            pc.restartIce();
          }
        } catch (e) {}

        setTimeout(() => {
          if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
            setConnectionStatus('disconnected');
            setConnectionErrorMessage('Szukam drugiego urządzenia...');
            setIsP2PDirect(false);
            setRemotePeer(null);
          }
        }, 10000);
      } else if (state === 'connected' || state === 'completed') {
        setConnectionStatus('paired');
        setConnectionErrorMessage(null);
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        if (state === 'failed' || state === 'closed') {
          setConnectionStatus('disconnected');
          setIsP2PDirect(false);
          setRemotePeer(null);
        }
      } else if (state === 'connected') {
        setConnectionStatus('paired');
        setConnectionErrorMessage(null);
      }
    };
  }, []);

  // Bind Data Connection events
  const setupDataConnection = useCallback(
    (conn: DataConnection) => {
      if (conn.peer === peerId) return;

      dataConnRef.current = conn;

      if (conn.peerConnection) {
        attachWebRtcStateListeners(conn.peerConnection);
      }

      const handleDataOpen = () => {
        setIsP2PDirect(true);
        setConnectionStatus('paired');
        setConnectionErrorMessage(null);
        setRemotePeer((prev) => {
          if (!prev || prev.peerId !== conn.peer) {
            return { peerId: conn.peer, name: 'Drugie Urządzenie' };
          }
          return prev;
        });

        try {
          conn.send({
            type: 'peer-info',
            peerId,
            name: deviceNameRef.current,
          });
        } catch (e) {}
      };

      if (conn.open) {
        handleDataOpen();
      } else {
        conn.on('open', handleDataOpen);
      }

      conn.on('data', (data: unknown) => {
        try {
          const msg = typeof data === 'string' ? JSON.parse(data) : (data as Record<string, unknown>);
          if (msg.type === 'peer-info' && msg.peerId && msg.peerId !== peerId) {
            const remoteId = msg.peerId as string;
            setRemotePeer({
              peerId: remoteId,
              name: (msg.name as string) || 'Drugie Urządzenie',
            });
            setConnectionStatus('paired');
            setIsP2PDirect(true);

            if (!mediaConnRef.current || !mediaConnRef.current.open) {
              connectToPeer(remoteId);
            }
          }
        } catch (e) {}
      });

      conn.on('close', () => {
        setIsP2PDirect(false);
        setRemotePeer(null);
        setConnectionStatus('connected');
      });
    },
    [peerId, attachWebRtcStateListeners]
  );

  // Bind Media Call events
  const setupMediaCall = useCallback(
    (call: MediaConnection) => {
      if (call.peer === peerId) return;

      mediaConnRef.current = call;

      if (call.peerConnection) {
        attachWebRtcStateListeners(call.peerConnection);
      }

      call.on('stream', (remoteStream) => {
        console.log('[PeerJS] Odebrano otwarty strumień dźwiękowy:', call.peer);
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = remoteStream;
          remoteAudioRef.current.play().catch((e) => console.warn('Błąd odtwarzania audio:', e));
          audioEngine.setupRemoteAnalyser(remoteStream);
        }
        setIsP2PDirect(true);
        setConnectionStatus('paired');
        setConnectionErrorMessage(null);
      });

      call.on('close', () => {
        setIsP2PDirect(false);
      });
    },
    [peerId, attachWebRtcStateListeners]
  );

  // Connect directly to target remote peer ID
  const connectToPeer = useCallback(
    async (targetPeerId: string) => {
      if (!peerRef.current || peerRef.current.destroyed) return;
      if (!targetPeerId || targetPeerId === peerId) return;

      console.log('[PeerJS] Zestawianie stałego połączenia głosu z ID:', targetPeerId);
      setConnectionStatus('connecting');

      const stream = localStreamRef.current || (await initMicrophone());

      const conn = peerRef.current.connect(targetPeerId, {
        metadata: { name: deviceNameRef.current },
      });
      setupDataConnection(conn);

      if (stream) {
        const call = peerRef.current.call(targetPeerId, stream);
        setupMediaCall(call);
      }
    },
    [peerId, initMicrophone, setupDataConnection, setupMediaCall]
  );

  // Connect to room host
  const connectToRoomHost = useCallback(
    (roomId: string) => {
      if (!peerRef.current || peerRef.current.destroyed) return;
      if (isRoomHostRef.current) return;

      try {
        const conn = peerRef.current.connect(roomId, {
          metadata: { peerId: peerIdRef.current, name: deviceNameRef.current },
        });

        const sendJoin = () => {
          try {
            conn.send({
              type: 'join-room',
              peerId: peerIdRef.current,
              name: deviceNameRef.current,
            });
          } catch (e) {}
        };

        if (conn.open) {
          sendJoin();
        } else {
          conn.on('open', sendJoin);
        }

        conn.on('data', (data: unknown) => {
          try {
            const msg = typeof data === 'string' ? JSON.parse(data) : (data as Record<string, unknown>);
            if (msg.type === 'room-peers' && Array.isArray(msg.peers)) {
              msg.peers.forEach((pId: unknown) => {
                if (typeof pId === 'string' && pId !== peerIdRef.current) {
                  connectToPeer(pId);
                }
              });
            }
          } catch (e) {}
        });
      } catch (err) {}
    },
    [connectToPeer]
  );

  // Room Beacon initialization
  const initRoomBeacon = useCallback(() => {
    if (roomPeerRef.current) {
      try {
        roomPeerRef.current.destroy();
      } catch (e) {}
      roomPeerRef.current = null;
    }
    isRoomHostRef.current = false;
    roomMembersRef.current.clear();

    const roomId = getRoomPeerId();

    try {
      const roomPeer = new Peer(roomId, {
        debug: 1,
        config: ICE_SERVERS_CONFIG,
      });
      roomPeerRef.current = roomPeer;

      roomPeer.on('open', (id) => {
        isRoomHostRef.current = true;
      });

      roomPeer.on('connection', (conn) => {
        conn.on('data', (data: unknown) => {
          try {
            const msg = typeof data === 'string' ? JSON.parse(data) : (data as Record<string, unknown>);
            if (msg.type === 'join-room' && msg.peerId && typeof msg.peerId === 'string') {
              const remoteId = msg.peerId;
              if (remoteId === peerIdRef.current) return;

              connectToPeer(remoteId);

              const activePeers = Array.from(roomMembersRef.current);
              try {
                conn.send({
                  type: 'room-peers',
                  peers: [peerIdRef.current, ...activePeers],
                });
              } catch (e) {}

              roomMembersRef.current.add(remoteId);
            }
          } catch (e) {}
        });
      });

      roomPeer.on('error', (err: any) => {
        if (err.type === 'unavailable-id') {
          if (roomPeerRef.current) {
            try {
              roomPeerRef.current.destroy();
            } catch (e) {}
            roomPeerRef.current = null;
          }
          isRoomHostRef.current = false;
          connectToRoomHost(roomId);
        }
      });
    } catch (e) {
      connectToRoomHost(roomId);
    }
  }, [connectToPeer, connectToRoomHost]);

  // Local BroadcastChannel for instant same-network cross-tab discovery
  useEffect(() => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const bc = new BroadcastChannel('always_on_walkie_channel');
      broadcastChannelRef.current = bc;

      bc.onmessage = (event) => {
        const data = event.data;
        if (data && data.type === 'announce-presence') {
          if (data.peerId && data.peerId !== peerId) {
            connectToPeer(data.peerId);
          }
        }
      };

      bc.postMessage({
        type: 'announce-presence',
        peerId,
        name: deviceNameRef.current,
      });
    }

    return () => {
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.close();
      }
    };
  }, [peerId, connectToPeer]);

  // Initialize main PeerJS client & start microphone automatically
  useEffect(() => {
    setConnectionStatus('connecting');

    // Attempt auto mic start on mount
    initMicrophone();

    const peer = new Peer(peerId, {
      debug: 1,
      config: ICE_SERVERS_CONFIG,
    });
    peerRef.current = peer;

    peer.on('open', () => {
      setConnectionStatus('connected');
      setConnectionErrorMessage(null);
      initRoomBeacon();
    });

    peer.on('connection', (conn) => {
      if (conn.peer === peerId) return;
      setupDataConnection(conn);
    });

    peer.on('call', async (call) => {
      if (call.peer === peerId) return;

      let activeStream = localStreamRef.current;
      if (!activeStream) {
        activeStream = await initMicrophone();
      }

      try {
        if (activeStream && activeStream.active) {
          call.answer(activeStream);
        } else {
          call.answer();
        }
      } catch (e) {
        try {
          call.answer();
        } catch (err) {}
      }

      setupMediaCall(call);
    });

    peer.on('disconnected', () => {
      setConnectionStatus('connecting');
      if (reconnectRetryTimeoutRef.current) clearTimeout(reconnectRetryTimeoutRef.current);
      reconnectRetryTimeoutRef.current = setTimeout(() => {
        if (peerRef.current && !peerRef.current.destroyed) {
          try {
            peerRef.current.reconnect();
          } catch (e) {}
        }
      }, 2000);
    });

    peer.on('error', (err) => {
      if (err.type === 'network' || err.type === 'server-error' || err.type === 'socket-error') {
        if (reconnectRetryTimeoutRef.current) clearTimeout(reconnectRetryTimeoutRef.current);
        reconnectRetryTimeoutRef.current = setTimeout(() => {
          if (peerRef.current && !peerRef.current.destroyed) {
            try {
              peerRef.current.reconnect();
            } catch (e) {}
          }
        }, 3000);
      }
    });

    return () => {
      if (reconnectRetryTimeoutRef.current) clearTimeout(reconnectRetryTimeoutRef.current);
      if (dataConnRef.current) dataConnRef.current.close();
      if (mediaConnRef.current) mediaConnRef.current.close();
      if (roomPeerRef.current) roomPeerRef.current.destroy();
      peer.destroy();
    };
  }, [peerId, connectToPeer, setupDataConnection, setupMediaCall, initRoomBeacon, initMicrophone]);

  // Continuous background auto-join loop if unpaired
  useEffect(() => {
    if (connectionStatus === 'paired') return;

    const interval = setInterval(() => {
      if (!isRoomHostRef.current && peerRef.current && !peerRef.current.destroyed) {
        const roomId = getRoomPeerId();
        connectToRoomHost(roomId);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [connectionStatus, connectToRoomHost]);

  // Update volume levels continuously
  useEffect(() => {
    let animId: number;
    const updateMeter = () => {
      setTxLevel(isMicMuted ? 0 : audioEngine.getMicVolume());
      setRxLevel(isSpeakerMuted ? 0 : audioEngine.getRemoteVolume());
      animId = requestAnimationFrame(updateMeter);
    };

    animId = requestAnimationFrame(updateMeter);
    return () => cancelAnimationFrame(animId);
  }, [isMicMuted, isSpeakerMuted]);

  // Rename device
  const updateDeviceName = useCallback(
    (name: string) => {
      const clean = name.trim().slice(0, 16) || 'Urządzenie';
      setDeviceName(clean);
      localStorage.setItem('wt_device_name', clean);

      if (dataConnRef.current && dataConnRef.current.open) {
        dataConnRef.current.send({
          type: 'peer-info',
          peerId,
          name: clean,
        });
      }
    },
    [peerId]
  );

  return {
    peerId,
    deviceName,
    connectionStatus,
    connectionError: connectionErrorMessage,
    connectionErrorMessage,
    isP2PDirect,
    remotePeer,
    micAllowed,
    micError: micErrorDetails,
    micErrorDetails,
    txLevel,
    rxLevel,
    volume,
    setVolume,
    isMicMuted,
    setIsMicMuted,
    isSpeakerMuted,
    setIsSpeakerMuted,
    audioActivated,
    activateAudio,
    initMicrophone,
    updateDeviceName,
  };
}
