import { useEffect, useRef, useState, useCallback } from 'react';
import Peer, { DataConnection, MediaConnection } from 'peerjs';
import { audioEngine } from '../utils/audioEngine';
import {
  ICE_SERVERS_CONFIG,
  waitForIceGatheringComplete,
  generateServerlessOfferSdp,
  generateServerlessAnswerSdp,
  decodeSdpPayload,
} from '../utils/sdpUtils';

export interface PeerInfo {
  peerId: string;
  name: string;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'paired';

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
    const defaultName = isAndroid
      ? `Android-${Math.floor(10 + Math.random() * 90)}`
      : `Radio-${Math.floor(10 + Math.random() * 90)}`;
    localStorage.setItem('wt_device_name', defaultName);
    return defaultName;
  });

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [connectionErrorMessage, setConnectionErrorMessage] = useState<string | null>(null);
  const [isP2PDirect, setIsP2PDirect] = useState(false);
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [isReceiving, setIsReceiving] = useState(false);
  const [remotePeer, setRemotePeer] = useState<PeerInfo | null>(null);
  
  // Microphone permission & error state handling
  const [micAllowed, setMicAllowed] = useState<boolean | null>(null);
  const [micErrorDetails, setMicErrorDetails] = useState<string | null>(null);

  const [txLevel, setTxLevel] = useState(0);
  const [rxLevel, setRxLevel] = useState(0);
  const [callAlertIncoming, setCallAlertIncoming] = useState(false);
  const [volume, setVolume] = useState(85); // 0 to 100
  const [squelch, setSquelch] = useState(50); // 0 to 100

  // Serverless SDP QR Code State
  const [serverlessOfferSdp, setServerlessOfferSdp] = useState<string | null>(null);
  const [isGatheringIce, setIsGatheringIce] = useState(false);

  // State refs to prevent unnecessary useEffect re-runs
  const channelRef = useRef(channel);
  useEffect(() => {
    channelRef.current = channel;
  }, [channel]);

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
  const isTransmittingRef = useRef(false);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const roomPeerRef = useRef<Peer | null>(null);
  const isRoomHostRef = useRef(false);
  const roomMembersRef = useRef<Set<string>>(new Set());
  const reconnectRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Helper to build deterministic room peer ID for channel auto-discovery
  const getRoomPeerId = (channelName: string): string => {
    const clean = channelName.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    return `WT-ROOM-${clean || 'CH01'}`;
  };

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

  // Update volume safely
  useEffect(() => {
    if (remoteAudioRef.current) {
      try {
        const safeVol = Math.max(0, Math.min(1, (volume || 0) / 100));
        remoteAudioRef.current.volume = safeVol;
      } catch (e) {
        console.warn('Błąd ustawiania głośności audio:', e);
      }
    }
  }, [volume]);

  // Read URL query parameter for instant channel pairing or serverless SDP import
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const chParam = urlParams.get('ch') || urlParams.get('channel');
    if (chParam) {
      const match = CHANNELS.find(
        (c) => c.id.toLowerCase() === chParam.toLowerCase() || c.name.toLowerCase() === chParam.toLowerCase()
      );
      if (match) {
        setChannel(match.id);
      } else {
        setChannel(chParam.toUpperCase());
      }
    }
  }, []);

  /**
   * INICJALIZACJA MIKROFONU - Wywoływana WYŁĄCZNIE jako bezpośrednia reakcja na akcję użytkownika.
   * Obsługuje pełną obsługę wyjątków (NotAllowedError, NotFoundError, NotReadableError) z komunikatami w UI.
   */
  const initMicrophone = useCallback(async (): Promise<MediaStream | null> => {
    setMicErrorDetails(null);

    if (localStreamRef.current && localStreamRef.current.active) {
      setMicAllowed(true);
      return localStreamRef.current;
    }

    let stream: MediaStream | null = null;
    try {
      // 1. Zbiór zaawansowanych parametrów audio (redukcja szumów, usuwanie echa)
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (err1: any) {
      console.warn('[Mikrofon] Błąd zaawansowanych parametrów audio, próba podstawowego audio:', err1);
      
      try {
        // 2. Rezerwowa próba z podstawowymi uprawnieniami audio
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err2: any) {
        console.error('[Mikrofon] Wyjątek podczas uzyskiwania dostępu do mikrofonu:', err2);
        setMicAllowed(false);

        // Precyzyjna obsługa błędu dostępu do mikrofonu i komunikacja z użytkownikiem w UI:
        if (err2.name === 'NotAllowedError' || err2.name === 'PermissionDeniedError') {
          setMicErrorDetails('Brak zgody na użycie mikrofonu. Odblokuj dostęp w ustawieniach przeglądarki.');
        } else if (err2.name === 'NotFoundError' || err2.name === 'DevicesNotFoundError') {
          setMicErrorDetails('Nie wykryto urządzenia mikrofonowego na tym smartfonie.');
        } else if (err2.name === 'NotReadableError' || err2.name === 'TrackStartError') {
          setMicErrorDetails('Mikrofon jest zajęty przez inną aplikację lub wystąpił błąd sprzętowy.');
        } else {
          setMicErrorDetails(`Błąd mikrofonu: ${err2.message || err2.name || 'Brak dostępu'}`);
        }
        return null;
      }
    }

    if (stream) {
      // Wyciszamy ścieżkę dźwiękową, dopóki użytkownik nie naciśnie przycisku NADAWANIA (PTT)
      stream.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });

      localStreamRef.current = stream;
      audioEngine.setupMicAnalyser(stream);
      setMicAllowed(true);
      setMicErrorDetails(null);

      // Jeśli połączenie mediów jest aktywne, podmieniamy ścieżkę na nową
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
  }, []);

  /**
   * REJESTRACJA NASŁUCHIWACZY STANÓW WEBRTC (oniceconnectionstatechange, onsignalingstatechange, onconnectionstatechange)
   */
  const attachWebRtcStateListeners = useCallback((pc: RTCPeerConnection) => {
    directPeerConnectionRef.current = pc;

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      console.log('[WebRTC State Log] Zmiana stanu ICE:', state);

      if (state === 'disconnected' || state === 'failed') {
        console.warn('[WebRTC Connection Loss] Wykryto przerwanie połączenia ICE. Próba ponownego nawiązania (restartIce)...');
        setConnectionStatus('connecting');
        setConnectionErrorMessage('Przerwanie zasięgu - automatyczne odnawianie połączenia...');

        try {
          if (typeof pc.restartIce === 'function') {
            pc.restartIce();
          }
        } catch (e) {
          console.warn('Błąd restartIce:', e);
        }

        // Zabezpieczenie: Jeśli połączenie nie odnowi się po 10 sekundach, resetujemy UI do stanu początkowego
        setTimeout(() => {
          if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
            console.warn('[WebRTC Recovery Timeout] Ponowne nawiązanie połączenia nie powiodło się. Resetowanie stanu UI.');
            setConnectionStatus('disconnected');
            setConnectionErrorMessage('Połączenie przerwane. Zresetowano stan radiotelefonu.');
            setIsP2PDirect(false);
            setRemotePeer(null);
            setIsReceiving(false);
          }
        }, 10000);
      } else if (state === 'connected' || state === 'completed') {
        setConnectionStatus('paired');
        setConnectionErrorMessage(null);
      }
    };

    pc.onsignalingstatechange = () => {
      console.log('[WebRTC State Log] Zmiana stanu sygnalizacji:', pc.signalingState);
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log('[WebRTC State Log] Zmiana stanu PeerConnection:', state);

      if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        if (state === 'failed' || state === 'closed') {
          setConnectionStatus('disconnected');
          setIsP2PDirect(false);
          setRemotePeer(null);
          setIsReceiving(false);
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
      if (conn.peer === peerId) {
        console.warn('[PeerJS] Ignorowanie próby samo-połączenia.');
        return;
      }

      dataConnRef.current = conn;

      if (conn.peerConnection) {
        attachWebRtcStateListeners(conn.peerConnection);
      }

      const handleDataOpen = () => {
        console.log('[PeerJS] Kanał danych otwarto z partnerem:', conn.peer);
        setIsP2PDirect(true);
        setConnectionStatus('paired');
        setConnectionErrorMessage(null);
        setRemotePeer((prev) => {
          if (!prev || prev.peerId !== conn.peer) {
            return { peerId: conn.peer, name: 'Partner-Radio' };
          }
          return prev;
        });

        try {
          conn.send({
            type: 'peer-info',
            peerId,
            name: deviceNameRef.current,
            channel: channelRef.current,
          });
        } catch (e) {
          console.warn('Błąd wysyłania peer-info:', e);
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
              if (msg.peerId && msg.peerId !== peerId) {
                const remoteId = msg.peerId as string;
                setRemotePeer({
                  peerId: remoteId,
                  name: (msg.name as string) || 'Partner-Radio',
                });
                setConnectionStatus('paired');
                setIsP2PDirect(true);

                if (!mediaConnRef.current || !mediaConnRef.current.open) {
                  connectToPeer(remoteId);
                }
              }
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
          console.warn('Błąd parsowania danych PeerJS:', e);
        }
      });

      conn.on('close', () => {
        console.log('[PeerJS] Połączenie danych zamknięte z:', conn.peer);
        setIsP2PDirect(false);
        setRemotePeer(null);
        setIsReceiving(false);
        setConnectionStatus('connected');
      });

      conn.on('error', (err) => {
        console.warn('[PeerJS] Błąd połączenia danych:', err);
      });
    },
    [peerId, attachWebRtcStateListeners]
  );

  // Bind Media Call events
  const setupMediaCall = useCallback(
    (call: MediaConnection) => {
      if (call.peer === peerId) {
        console.warn('[PeerJS] Ignorowanie próby połączenia głosowego z samym sobą.');
        return;
      }

      mediaConnRef.current = call;

      if (call.peerConnection) {
        attachWebRtcStateListeners(call.peerConnection);
      }

      call.on('stream', (remoteStream) => {
        console.log('[PeerJS] Odebrano strumień dźwiękowy od partnera:', call.peer);
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
        setIsReceiving(false);
      });

      call.on('error', (err) => {
        console.warn('[PeerJS] Błąd strumienia audio WebRTC:', err);
      });
    },
    [peerId, attachWebRtcStateListeners]
  );

  // Connect directly to target remote peer ID
  const connectToPeer = useCallback(
    async (targetPeerId: string) => {
      if (!peerRef.current || peerRef.current.destroyed) return;
      if (!targetPeerId || targetPeerId === peerId) {
        console.warn('[PeerJS] Ignorowanie próby połączenia ze sobą:', targetPeerId);
        return;
      }

      console.log('[PeerJS] Nawiązywanie bezpośredniego połączenia P2P z ID:', targetPeerId);
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
    },
    [peerId, initMicrophone, setupDataConnection, setupMediaCall]
  );

  // Connect to channel room beacon host
  const connectToRoomHost = useCallback(
    (roomId: string) => {
      if (!peerRef.current || peerRef.current.destroyed) return;
      if (isRoomHostRef.current) return;
      console.log('[RoomBeacon] Łączenie z hostem pokoju kanału:', roomId);

      try {
        const conn = peerRef.current.connect(roomId, {
          metadata: { peerId: peerIdRef.current, name: deviceNameRef.current, channel: channelRef.current },
        });

        const sendJoin = () => {
          try {
            conn.send({
              type: 'join-room',
              peerId: peerIdRef.current,
              name: deviceNameRef.current,
              channel: channelRef.current,
            });
          } catch (e) {
            console.warn('[RoomBeacon] Błąd wysyłania komendy join-room:', e);
          }
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
          } catch (e) {
            console.warn('[RoomBeacon] Błąd odczytu danych hosta pokoju:', e);
          }
        });

        conn.on('error', (err) => {
          console.warn('[RoomBeacon] Błąd połączenia z hostem pokoju:', err);
        });
      } catch (err) {
        console.warn('[RoomBeacon] Wyjątek podczas połączenia z hostem:', err);
      }
    },
    [connectToPeer]
  );

  // Initialize Channel Room Beacon (claims room host or joins existing host)
  const initRoomBeacon = useCallback(
    (targetChannel: string) => {
      if (roomPeerRef.current) {
        try {
          roomPeerRef.current.destroy();
        } catch (e) {}
        roomPeerRef.current = null;
      }
      isRoomHostRef.current = false;
      roomMembersRef.current.clear();

      const roomId = getRoomPeerId(targetChannel);
      console.log('[RoomBeacon] Inicjalizacja hosta dla kanału:', targetChannel, 'Room ID:', roomId);

      try {
        const roomPeer = new Peer(roomId, {
          debug: 1,
          config: ICE_SERVERS_CONFIG,
        });
        roomPeerRef.current = roomPeer;

        roomPeer.on('open', (id) => {
          console.log('[RoomBeacon] Pomyślnie utworzono host kanału:', targetChannel, 'ID:', id);
          isRoomHostRef.current = true;
        });

        roomPeer.on('connection', (conn) => {
          conn.on('data', (data: unknown) => {
            try {
              const msg = typeof data === 'string' ? JSON.parse(data) : (data as Record<string, unknown>);
              if (msg.type === 'join-room' && msg.peerId && typeof msg.peerId === 'string') {
                const remoteId = msg.peerId;
                if (remoteId === peerIdRef.current) return;

                console.log('[RoomBeacon] Host odebrał chęć dołączenia od:', remoteId);
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
            } catch (e) {
              console.warn('[RoomBeacon] Błąd transmisji danych do hosta:', e);
            }
          });
        });

        roomPeer.on('error', (err: any) => {
          if (err.type === 'unavailable-id') {
            console.log('[RoomBeacon] Host pokoju już istnieje dla kanału:', targetChannel, '. Dołączanie jako klient...');
            if (roomPeerRef.current) {
              try {
                roomPeerRef.current.destroy();
              } catch (e) {}
              roomPeerRef.current = null;
            }
            isRoomHostRef.current = false;
            connectToRoomHost(roomId);
          } else {
            console.warn('[RoomBeacon] Błąd hosta pokoju:', err.type, err.message);
          }
        });
      } catch (e) {
        console.warn('[RoomBeacon] Wyjątek podczas inicjalizacji pokoju:', e);
        connectToRoomHost(roomId);
      }
    },
    [connectToPeer, connectToRoomHost]
  );

  // Setup BroadcastChannel for local cross-tab pairing
  useEffect(() => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const bc = new BroadcastChannel('walkie_talkie_p2p_channel');
      broadcastChannelRef.current = bc;

      bc.onmessage = (event) => {
        const data = event.data;
        if (data && data.type === 'announce-presence') {
          if (data.channel === channelRef.current && data.peerId && data.peerId !== peerId) {
            connectToPeer(data.peerId);
          }
        }
      };

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

  /**
   * GŁÓWNA INICJALIZACJA SYGNALIZACJI PEERJS (Obsługuje ponawianie połączenia z serwerem sygnalizacyjnym)
   */
  useEffect(() => {
    setConnectionStatus('connecting');

    const peer = new Peer(peerId, {
      debug: 1,
      config: ICE_SERVERS_CONFIG,
    });
    peerRef.current = peer;

    peer.on('open', (id) => {
      console.log('[PeerJS] Połączono z brokerem sygnalizacyjnym WebRTC ID:', id);
      setConnectionStatus('connected');
      setConnectionErrorMessage(null);

      // Automatyczny nasłuch/tworzenie pokoju kanału
      initRoomBeacon(channelRef.current);

      // Sprawdzenie czy w URL znajduje się docelowy peerId do parowania
      const urlParams = new URLSearchParams(window.location.search);
      const targetPeer = urlParams.get('peer');
      if (targetPeer && targetPeer !== id) {
        connectToPeer(targetPeer);
      }
    });

    peer.on('connection', (conn) => {
      if (conn.peer === peerId) return;
      console.log('[PeerJS] Przychodzące połączenie danych od partnera:', conn.peer);
      setupDataConnection(conn);
    });

    peer.on('call', (call) => {
      if (call.peer === peerId) return;
      console.log('[PeerJS] Przychodzące połączenie głosowe od partnera:', call.peer);

      const activeStream = localStreamRef.current;
      try {
        if (activeStream && activeStream.active) {
          call.answer(activeStream);
        } else {
          call.answer();
        }
      } catch (e) {
        console.warn('Błąd call.answer:', e);
        try {
          call.answer();
        } catch (err) {}
      }

      setupMediaCall(call);
    });

    // PONAWIANIE POŁĄCZENIA W PRZYPADKU ROZŁĄCZENIA Z SERWEREM SYGNALIZACJI:
    peer.on('disconnected', () => {
      console.warn('[PeerJS Broker] Rozłączono z serwerem sygnalizacyjnym. Próba ponownego połączenia...');
      setConnectionStatus('connecting');

      if (reconnectRetryTimeoutRef.current) clearTimeout(reconnectRetryTimeoutRef.current);

      reconnectRetryTimeoutRef.current = setTimeout(() => {
        if (peerRef.current && !peerRef.current.destroyed) {
          try {
            peerRef.current.reconnect();
          } catch (e) {
            console.warn('[PeerJS Broker] Błąd reconnect:', e);
          }
        }
      }, 2000);
    });

    peer.on('error', (err) => {
      console.warn('[PeerJS Błąd Brokera]:', err.type, err.message);
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
  }, [peerId, connectToPeer, setupDataConnection, setupMediaCall, initRoomBeacon]);

  // Periodic channel room check if unpaired
  useEffect(() => {
    if (connectionStatus === 'paired') return;

    const interval = setInterval(() => {
      if (!isRoomHostRef.current && peerRef.current && !peerRef.current.destroyed) {
        const roomId = getRoomPeerId(channelRef.current);
        connectToRoomHost(roomId);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [connectionStatus, connectToRoomHost]);

  // Channel switch & manual peer pairing handler
  const changeChannel = useCallback(
    (newChannel: string, targetPeerId?: string) => {
      audioEngine.playKnobClick();
      if (navigator.vibrate) navigator.vibrate(15);
      setChannel(newChannel);

      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.postMessage({
          type: 'announce-presence',
          peerId,
          channel: newChannel,
          name: deviceNameRef.current,
        });
      }

      initRoomBeacon(newChannel);

      if (targetPeerId && targetPeerId !== peerId) {
        connectToPeer(targetPeerId);
      }
    },
    [peerId, connectToPeer, initRoomBeacon]
  );

  /**
   * SERVERLESS SDP OFFER GENERATOR:
   * Tworzy kompletną ofertę SDP dopiero po odebraniu zdarzenia complete dla zbierania kandydatów ICE.
   */
  const generateCompleteServerlessOffer = useCallback(async (): Promise<string | null> => {
    try {
      setIsGatheringIce(true);
      const stream = localStreamRef.current || (await initMicrophone());
      const { pc, sdpPayload } = await generateServerlessOfferSdp(stream);

      attachWebRtcStateListeners(pc);
      setServerlessOfferSdp(sdpPayload);
      setIsGatheringIce(false);
      return sdpPayload;
    } catch (e) {
      console.error('[Serverless SDP] Błąd generowania pełnej oferty SDP:', e);
      setIsGatheringIce(false);
      return null;
    }
  }, [initMicrophone, attachWebRtcStateListeners]);

  /**
   * SERVERLESS SDP ANSWER GENERATOR:
   * Przyjmuje ofertę i tworzy odpowiedź po zbieraniu ICE (icegatheringstatechange === complete).
   */
  const processServerlessOfferAndAnswer = useCallback(
    async (encodedOfferSdp: string): Promise<string | null> => {
      try {
        setIsGatheringIce(true);
        const decoded = decodeSdpPayload(encodedOfferSdp);
        const rawSdp = decoded?.sdp || encodedOfferSdp;

        const stream = localStreamRef.current || (await initMicrophone());
        const { pc, sdpPayload } = await generateServerlessAnswerSdp(rawSdp, stream);

        attachWebRtcStateListeners(pc);
        setIsGatheringIce(false);
        setConnectionStatus('paired');
        setIsP2PDirect(true);
        return sdpPayload;
      } catch (e) {
        console.error('[Serverless SDP] Błąd generowania pełnej odpowiedzi SDP:', e);
        setIsGatheringIce(false);
        return null;
      }
    },
    [initMicrophone, attachWebRtcStateListeners]
  );

  // Start Transmitting (PTT pressed) - Requires microphone permission
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
  const updateDeviceName = useCallback(
    (name: string) => {
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
    },
    [peerId]
  );

  return {
    channel,
    channels: CHANNELS,
    peerId,
    deviceName,
    connectionStatus,
    connectionError: connectionErrorMessage,
    connectionErrorMessage,
    isP2PDirect,
    isTransmitting,
    isReceiving,
    remotePeer,
    micAllowed,
    micError: micErrorDetails,
    micErrorDetails,
    txLevel,
    rxLevel,
    callAlertIncoming,
    volume,
    squelch,
    serverlessOffer: serverlessOfferSdp,
    serverlessOfferSdp,
    isGatheringIce,
    setVolume,
    setSquelch,
    changeChannel,
    startTalking,
    stopTalking,
    sendCallTone,
    initMicrophone,
    updateDeviceName,
    generateServerlessOffer: generateCompleteServerlessOffer,
    generateCompleteServerlessOffer,
    processServerlessOffer: processServerlessOfferAndAnswer,
    processServerlessAnswer: async (ans: string) => !!(await processServerlessOfferAndAnswer(ans)),
    processServerlessOfferAndAnswer,
  };
}
