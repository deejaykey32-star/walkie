import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { Capacitor } from '@capacitor/core';
import { Camera as CapCamera } from '@capacitor/camera';
import {
  QrCode,
  Share2,
  Copy,
  Check,
  Camera,
  X,
  Radio,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Video,
  Loader2,
  Wifi,
} from 'lucide-react';

interface PairingModalProps {
  channel: string;
  isOpen: boolean;
  onClose: () => void;
  onChannelSelect: (ch: string, targetPeerId?: string) => void;
  deviceName: string;
  peerId?: string;
  generateServerlessOffer?: () => Promise<string | null>;
  processServerlessOffer?: (encodedOffer: string) => Promise<string | null>;
  processServerlessAnswer?: (encodedAnswer: string) => Promise<boolean>;
  generateCompleteServerlessOffer?: () => Promise<string | null>;
  processServerlessOfferAndAnswer?: (sdp: string) => Promise<string | null>;
  isGatheringIce?: boolean;
}

export const PairingModal: React.FC<PairingModalProps> = ({
  channel,
  isOpen,
  onClose,
  onChannelSelect,
  deviceName,
  peerId,
  generateServerlessOffer,
  processServerlessOffer,
  processServerlessAnswer,
  generateCompleteServerlessOffer,
  processServerlessOfferAndAnswer,
  isGatheringIce = false,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [activeTab, setActiveTab] = useState<'qr' | 'scan' | 'manual'>('qr');
  const [customChannelInput, setCustomChannelInput] = useState('');
  const [scanError, setScanError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  
  // Tryb parowania: 'peer' (Szybki link z ID) vs 'sdp' (Bezserwerowy Serverless SDP po zbieraniu ICE)
  const [pairingMode, setPairingMode] = useState<'peer' | 'sdp'>('sdp');
  const [completeSdpPayload, setCompleteSdpPayload] = useState<string | null>(null);
  const [sdpAnswerGenerated, setSdpAnswerGenerated] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Bazowy URL dla celów generowania linków
  const baseUrl =
    typeof window !== 'undefined' &&
    !window.location.origin.includes('localhost') &&
    !window.location.origin.includes('capacitor://')
      ? window.location.origin
      : 'https://walkie-talkie-p2p.pages.dev';

  /**
   * GENEROWANIE KOMPLETNEGO KODU QR I LINKU SERVERLESS (Wymaganie #1):
   * Kod NIE wygeneruje oferty natychmiast. Czeka na zakończone zbieranie ICE (icegatheringstatechange === 'complete').
   */
  useEffect(() => {
    if (!isOpen) return;

    if (pairingMode === 'sdp' && generateCompleteServerlessOffer) {
      setQrDataUrl('');
      generateCompleteServerlessOffer().then((sdp) => {
        if (sdp) {
          setCompleteSdpPayload(sdp);
          const fullServerlessUrl = `${baseUrl}/?ch=${encodeURIComponent(channel)}&sdp=${encodeURIComponent(sdp)}`;
          QRCode.toDataURL(fullServerlessUrl, {
            width: 320,
            margin: 2,
            color: { dark: '#0a0d10', light: '#f8fafc' },
          })
            .then(setQrDataUrl)
            .catch(console.error);
        }
      });
    } else {
      // Standardowy link parowania z ID radiotelefonu
      const shareUrl = `${baseUrl}/?ch=${encodeURIComponent(channel)}${
        peerId ? `&peer=${encodeURIComponent(peerId)}` : ''
      }`;
      QRCode.toDataURL(shareUrl, {
        width: 320,
        margin: 2,
        color: { dark: '#0a0d10', light: '#f8fafc' },
      })
        .then(setQrDataUrl)
        .catch(console.error);
    }
  }, [isOpen, pairingMode, channel, peerId, baseUrl, generateCompleteServerlessOffer]);

  const currentShareUrl =
    pairingMode === 'sdp' && completeSdpPayload
      ? `${baseUrl}/?ch=${encodeURIComponent(channel)}&sdp=${encodeURIComponent(completeSdpPayload)}`
      : `${baseUrl}/?ch=${encodeURIComponent(channel)}${peerId ? `&peer=${encodeURIComponent(peerId)}` : ''}`;

  // Copy full URL to clipboard
  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(currentShareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn('Błąd kopiowania linku:', e);
    }
  };

  // Copy channel access code to clipboard
  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(currentShareUrl || channel);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (e) {
      console.warn('Błąd kopiowania kodu:', e);
    }
  };

  // Native Android Share Sheet
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Połącz Walkie-Talkie P2P',
          text: `Kod kanału (${deviceName}): ${channel}\nLink WebRTC SDP: ${currentShareUrl}`,
          url: currentShareUrl,
        });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          handleCopyUrl();
        }
      }
    } else {
      handleCopyUrl();
    }
  };

  // Request camera permission and start video stream safely on Native Android APK and Web
  const startCameraStream = async () => {
    setScanError(null);
    setIsScanning(false);

    if (Capacitor.isNativePlatform()) {
      try {
        const check = await CapCamera.checkPermissions();
        if (check.camera !== 'granted') {
          const req = await CapCamera.requestPermissions({ permissions: ['camera'] });
          if (req.camera !== 'granted') {
            setScanError(
              'Zezwolenie na aparat jest wymagane w aplikacji Android APK. Przyznaj uprawnienie w ustawieniach aparatu.'
            );
            return;
          }
        }
      } catch (e) {
        console.warn('Błąd sprawdzania uprawnień aparatu Capacitor:', e);
      }
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setScanError('Brak obsługi aparatu w bieżącym środowisku przeglądarki.');
      return;
    }

    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
    } catch (err1) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      } catch (err2) {
        setScanError('Zablokowano dostęp do aparatu. Kliknij przycisk ponownego zapytania poniżej.');
        return;
      }
    }

    if (stream) {
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
          setIsScanning(true);
        } catch (e) {
          console.warn('Błąd odtwarzania wideo:', e);
        }
      }

      const canvas = document.createElement('canvas');
      const canvasCtx = canvas.getContext('2d', { willReadFrequently: true });

      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);

      scanIntervalRef.current = setInterval(() => {
        if (!videoRef.current || videoRef.current.readyState < 2) return;
        const video = videoRef.current;
        const w = video.videoWidth;
        const h = video.videoHeight;

        if (w > 0 && h > 0 && canvasCtx) {
          canvas.width = w;
          canvas.height = h;
          canvasCtx.drawImage(video, 0, 0, w, h);
          const imageData = canvasCtx.getImageData(0, 0, w, h);
          const result = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          });

          if (result && result.data) {
            console.log('[Skaner QR] Zeskanowano zawartość:', result.data);
            handleScannedUrl(result.data);
          }
        }
      }, 250);
    }
  };

  const stopCameraStream = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    setIsScanning(false);
  };

  useEffect(() => {
    if (activeTab === 'scan' && isOpen) {
      startCameraStream();
    } else {
      stopCameraStream();
    }
    return () => {
      stopCameraStream();
    };
  }, [activeTab, isOpen]);

  const handleScannedUrl = async (url: string) => {
    try {
      const parsed = new URL(url);
      const ch = parsed.searchParams.get('ch') || parsed.searchParams.get('channel');
      const targetPeer = parsed.searchParams.get('peer');
      const sdpParam = parsed.searchParams.get('sdp');

      if (sdpParam && processServerlessOfferAndAnswer) {
        stopCameraStream();
        const answer = await processServerlessOfferAndAnswer(sdpParam);
        if (answer) {
          setSdpAnswerGenerated(answer);
        }
        onClose();
        return;
      }

      if (ch) {
        onChannelSelect(ch, targetPeer || undefined);
        stopCameraStream();
        onClose();
      }
    } catch {
      if (url.trim().length > 30 && processServerlessOfferAndAnswer) {
        stopCameraStream();
        await processServerlessOfferAndAnswer(url.trim());
        onClose();
      } else if (url.trim()) {
        onChannelSelect(url.trim().toUpperCase());
        stopCameraStream();
        onClose();
      }
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const input = customChannelInput.trim();
    if (!input) return;

    try {
      const parsed = new URL(input);
      const ch = parsed.searchParams.get('ch') || parsed.searchParams.get('channel');
      const targetPeer = parsed.searchParams.get('peer');
      const sdpParam = parsed.searchParams.get('sdp');

      if (sdpParam && processServerlessOfferAndAnswer) {
        await processServerlessOfferAndAnswer(sdpParam);
        onClose();
        return;
      }

      if (ch) {
        onChannelSelect(ch, targetPeer || undefined);
        onClose();
        return;
      }
    } catch {
      // Not a URL
    }

    if (input.length > 50 && processServerlessOfferAndAnswer) {
      await processServerlessOfferAndAnswer(input);
      onClose();
    } else if (input.startsWith('WT-')) {
      onChannelSelect(channel, input.toUpperCase());
      onClose();
    } else {
      onChannelSelect(input.toUpperCase());
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto">
      <div className="w-full max-w-sm rounded-3xl border border-slate-700/80 bg-gradient-to-b from-slate-900 to-slate-950 p-5 sm:p-6 shadow-2xl text-slate-100 flex flex-col my-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Parowanie Walkie-Talkie P2P</h3>
              <p className="text-xs text-amber-400 font-mono">Kanał: {channel}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* PROMINENT ACCESS CODE BANNER */}
        <div className="my-3 p-3 rounded-2xl bg-amber-500/10 border-2 border-amber-500/40 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider block">
              KOD POŁĄCZENIA / KANAŁU:
            </span>
            <span className="text-xl font-black font-mono text-white tracking-widest">{channel}</span>
          </div>
          <button
            onClick={handleCopyCode}
            className="px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-extrabold text-xs hover:bg-amber-400 active:scale-95 transition"
          >
            {copiedCode ? 'SKOPIOWANO!' : 'KOPIUJ KOD'}
          </button>
        </div>

        {/* Serverless vs Quick Link Toggle */}
        <div className="flex gap-1 mb-3 p-1 rounded-xl bg-slate-950/90 border border-slate-800 text-[11px] font-bold">
          <button
            onClick={() => setPairingMode('sdp')}
            className={`flex-1 py-1 rounded-lg flex items-center justify-center gap-1 transition ${
              pairingMode === 'sdp' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'text-slate-400'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>Serverless (Pełne SDP ICE)</span>
          </button>
          <button
            onClick={() => setPairingMode('peer')}
            className={`flex-1 py-1 rounded-lg flex items-center justify-center gap-1 transition ${
              pairingMode === 'peer' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'text-slate-400'
            }`}
          >
            <Wifi className="w-3.5 h-3.5 text-amber-400" />
            <span>Szybki ID Link</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 p-1 bg-slate-950/80 border border-slate-800 rounded-xl mb-4 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('qr')}
            className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition ${
              activeTab === 'qr' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Kod QR</span>
          </button>
          <button
            onClick={() => setActiveTab('scan')}
            className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition ${
              activeTab === 'scan' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Aparat</span>
          </button>
          <button
            onClick={() => setActiveTab('manual')}
            className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition ${
              activeTab === 'manual' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Wpisz kod</span>
          </button>
        </div>

        {/* Tab 1: Show QR code & Access Code */}
        {activeTab === 'qr' && (
          <div className="flex flex-col items-center">
            <div className="p-3 bg-white rounded-2xl shadow-lg border-4 border-amber-500/30 min-h-[210px] min-w-[210px] flex items-center justify-center relative">
              {isGatheringIce ? (
                <div className="flex flex-col items-center justify-center p-4 text-center">
                  <Loader2 className="w-8 h-8 text-amber-500 animate-spin mb-2" />
                  <span className="text-xs text-slate-900 font-bold">
                    Zbieranie kandydatów ICE...
                  </span>
                  <span className="text-[10px] text-slate-600 font-mono mt-1">
                    icegatheringstatechange: complete
                  </span>
                </div>
              ) : qrDataUrl ? (
                <img src={qrDataUrl} alt="Kod QR Połączenia WebRTC" className="w-48 h-48 rounded-lg" />
              ) : (
                <div className="w-48 h-48 flex items-center justify-center text-slate-900 font-mono text-xs">
                  Generowanie pełnego SDP...
                </div>
              )}
            </div>

            <div className="mt-3 text-center">
              <p className="text-xs text-slate-300 font-medium">
                Na drugim telefonie zeskanuj ten kod QR lub wpisz kod <strong className="text-amber-400 font-mono">{channel}</strong>
              </p>
            </div>

            <div className="w-full grid grid-cols-2 gap-2 mt-4">
              <button
                onClick={handleCopyUrl}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-xs font-semibold text-white transition active:scale-95"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
                <span>{copied ? 'Skopiowano!' : 'Kopiuj Link'}</span>
              </button>

              <button
                onClick={handleShare}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition active:scale-95 shadow-md shadow-amber-950/40"
              >
                <Share2 className="w-4 h-4" />
                <span>Udostępnij</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Camera Scanner with direct user gesture prompt button */}
        {activeTab === 'scan' && (
          <div className="flex flex-col items-center">
            <div className="relative w-full aspect-square max-h-52 rounded-2xl overflow-hidden bg-black border-2 border-amber-500/50 flex flex-col items-center justify-center">
              <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />

              {isScanning ? (
                <div className="absolute inset-6 border-2 border-dashed border-amber-400/80 rounded-xl pointer-events-none animate-pulse flex items-center justify-center">
                  <span className="text-[10px] text-amber-300 font-mono bg-black/60 px-2 py-0.5 rounded">
                    Skanowanie QR...
                  </span>
                </div>
              ) : (
                <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-4 text-center">
                  <Video className="w-8 h-8 text-amber-400 mb-2 animate-bounce" />
                  <p className="text-xs text-slate-200 font-semibold mb-3">
                    Włącz aparat, aby zeskanować kod QR drugiego telefonu
                  </p>
                  <button
                    onClick={startCameraStream}
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 text-xs font-black uppercase tracking-wider shadow-lg hover:brightness-110 active:scale-95 transition"
                  >
                    Włącz Aparat i Zezwól na Dostęp
                  </button>
                </div>
              )}
            </div>

            {scanError && (
              <div className="mt-3 text-center space-y-2">
                <p className="text-xs text-amber-300 bg-amber-950/60 border border-amber-500/40 p-2.5 rounded-xl">
                  {scanError}
                </p>
                <button
                  onClick={startCameraStream}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold uppercase transition active:scale-95"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Ponów Zapytanie o Dostęp do Aparatu</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Manual Channel input & Available Channels List */}
        {activeTab === 'manual' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">
                Dostępne Kanały PMR (1-Tap):
              </label>
              <div className="grid grid-cols-4 gap-1.5 mb-3">
                {['CH-01', 'CH-02', 'CH-03', 'CH-04', 'CH-05', 'CH-06', 'CH-07', 'CH-08'].map((ch) => (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => {
                      onChannelSelect(ch);
                      stopCameraStream();
                      onClose();
                    }}
                    className={`py-2 px-1 rounded-xl text-center text-xs font-mono font-black transition active:scale-95 border ${
                      ch === channel
                        ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-md'
                        : 'bg-slate-950 text-slate-200 border-slate-700/80 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    {ch}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleManualSubmit} className="space-y-3 pt-2 border-t border-slate-800">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Lub Wpisz Kod Kanału / Wklej Ofertę SDP:
                </label>
                <input
                  type="text"
                  value={customChannelInput}
                  onChange={(e) => setCustomChannelInput(e.target.value)}
                  placeholder="np. ALFA, PATROL lub wklej link z SDP..."
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3.5 py-2.5 text-sm font-mono text-amber-400 uppercase placeholder:text-slate-600 focus:outline-hidden focus:border-amber-500"
                />
              </div>

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold uppercase tracking-wider transition active:scale-95"
              >
                <span>Dołącz do Kanału</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
