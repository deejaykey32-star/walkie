import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
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
  ShieldAlert,
  RefreshCw,
  Key,
  Video,
} from 'lucide-react';

interface PairingModalProps {
  channel: string;
  isOpen: boolean;
  onClose: () => void;
  onChannelSelect: (ch: string, targetPeerId?: string) => void;
  deviceName: string;
  peerId?: string;
}

export const PairingModal: React.FC<PairingModalProps> = ({
  channel,
  isOpen,
  onClose,
  onChannelSelect,
  deviceName,
  peerId,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [activeTab, setActiveTab] = useState<'qr' | 'scan' | 'manual'>('qr');
  const [customChannelInput, setCustomChannelInput] = useState('');
  const [scanError, setScanError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Determine base public URL for QR code generation (avoids localhost inside native APK container)
  const baseUrl =
    typeof window !== 'undefined' &&
    !window.location.origin.includes('localhost') &&
    !window.location.origin.includes('capacitor://')
      ? window.location.origin
      : 'https://walkie-talkie-p2p.pages.dev';

  // Generate shareable URL with embedded Peer ID for 1-scan P2P connection
  const shareUrl = `${baseUrl}/?ch=${encodeURIComponent(channel)}${
    peerId ? `&peer=${encodeURIComponent(peerId)}` : ''
  }`;

  useEffect(() => {
    if (shareUrl) {
      QRCode.toDataURL(shareUrl, {
        width: 320,
        margin: 2,
        color: {
          dark: '#0a0d10',
          light: '#f8fafc',
        },
      })
        .then(setQrDataUrl)
        .catch(console.error);
    }
  }, [shareUrl]);

  // Copy full URL to clipboard
  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn('Copy URL failed:', e);
    }
  };

  // Copy full shareable link to clipboard when KOPIUJ KOD button is tapped
  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl || channel);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (e) {
      console.warn('Copy code failed:', e);
    }
  };

  // Native Android Share Sheet
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Połącz krótkofalówkę Walkie-Talkie',
          text: `Kod połączenia z telefonem (${deviceName}): ${channel}\nLink: ${shareUrl}`,
          url: shareUrl,
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

    // 1. If running inside Native Android APK container, explicitly request Native Android Camera Permission via Capacitor Plugin
    if (Capacitor.isNativePlatform()) {
      try {
        const check = await CapCamera.checkPermissions();
        if (check.camera !== 'granted') {
          const req = await CapCamera.requestPermissions({ permissions: ['camera'] });
          if (req.camera !== 'granted') {
            setScanError(
              'Zezwolenie na aparat jest wymagane w aplikacji Android. Przyznaj uprawnienie w wyskakującym okienku.'
            );
            return;
          }
        }
      } catch (e) {
        console.warn('Capacitor native camera permission check warning:', e);
      }
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setScanError(
        'Brak obsługi aparatu w tym środowisku przeglądarki. Użyj bezpiecznego połączenia HTTPS.'
      );
      return;
    }

    let stream: MediaStream | null = null;
    try {
      // 2. First attempt: Rear environment camera
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
    } catch (err1) {
      console.warn('FacingMode environment failed, trying default camera:', err1);
      try {
        // 3. Fallback attempt: Any available camera stream
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      } catch (err2) {
        console.warn('Camera permission denied or device not found:', err2);
        setScanError(
          'Aplikacja zablokowała dostęp do aparatu. Kliknij przycisk poniżej, aby wywołać monit o udzielenie zgody.'
        );
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
          console.warn('Video play error:', e);
        }
      }

      // 4. Initialize BarcodeDetector if available
      let detector: unknown = null;
      if ('BarcodeDetector' in window) {
        try {
          // @ts-expect-error - BarcodeDetector browser API
          detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        } catch (e) {
          console.warn('BarcodeDetector error:', e);
        }
      }

      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);

      scanIntervalRef.current = setInterval(async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) return;
        try {
          if (detector) {
            // @ts-expect-error - detector call
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes && barcodes.length > 0) {
              const scannedRaw = barcodes[0].rawValue;
              handleScannedUrl(scannedRaw);
            }
          }
        } catch {
          // Ignore frame decode error
        }
      }, 300);
    }
  };

  // Stop camera stream cleanly
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

  const handleScannedUrl = (url: string) => {
    try {
      const parsed = new URL(url);
      const ch = parsed.searchParams.get('ch') || parsed.searchParams.get('channel');
      const targetPeer = parsed.searchParams.get('peer');
      if (ch) {
        onChannelSelect(ch, targetPeer || undefined);
        stopCameraStream();
        onClose();
      }
    } catch {
      if (url.trim()) {
        onChannelSelect(url.trim().toUpperCase());
        stopCameraStream();
        onClose();
      }
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const input = customChannelInput.trim();
    if (!input) return;

    try {
      const parsed = new URL(input);
      const ch = parsed.searchParams.get('ch') || parsed.searchParams.get('channel');
      const targetPeer = parsed.searchParams.get('peer');
      if (ch) {
        onChannelSelect(ch, targetPeer || undefined);
        onClose();
        return;
      }
    } catch {
      // Not a URL
    }

    if (input.startsWith('WT-')) {
      onChannelSelect(channel, input.toUpperCase());
      onClose();
    } else {
      onChannelSelect(input.toUpperCase());
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200 overflow-y-auto">
      <div className="w-full max-w-sm rounded-3xl border border-slate-700/80 bg-gradient-to-b from-slate-900 to-slate-950 p-5 sm:p-6 shadow-2xl text-slate-100 flex flex-col my-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Parowanie Walkie-Talkie</h3>
              <p className="text-xs text-amber-400 font-mono">Bieżący kanał: {channel}</p>
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
              KOD DOSTĘPU / POŁĄCZENIA:
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

        {/* Tabs */}
        <div className="flex gap-1.5 p-1 bg-slate-950/80 border border-slate-800 rounded-xl mb-4 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('qr')}
            className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition ${
              activeTab === 'qr'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Kod QR</span>
          </button>
          <button
            onClick={() => setActiveTab('scan')}
            className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition ${
              activeTab === 'scan'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Aparat</span>
          </button>
          <button
            onClick={() => setActiveTab('manual')}
            className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition ${
              activeTab === 'manual'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Wpisz kod</span>
          </button>
        </div>

        {/* Tab 1: Show QR code & Access Code */}
        {activeTab === 'qr' && (
          <div className="flex flex-col items-center">
            <div className="p-3 bg-white rounded-2xl shadow-lg border-4 border-amber-500/30">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="Kod QR Połączenia" className="w-48 h-48 rounded-lg" />
              ) : (
                <div className="w-48 h-48 flex items-center justify-center text-slate-900 font-mono text-xs">
                  Generowanie kodu...
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

              {/* Target sight box when active */}
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

        {/* Tab 3: Manual Channel input */}
        {activeTab === 'manual' && (
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Wpisz Kod Dostępu / Kanał:
              </label>
              <input
                type="text"
                value={customChannelInput}
                onChange={(e) => setCustomChannelInput(e.target.value)}
                placeholder="np. CH-1, ALFA, 7721..."
                className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3.5 py-2.5 text-sm font-mono text-amber-400 uppercase placeholder:text-slate-600 focus:outline-hidden focus:border-amber-500"
                autoFocus
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Wpisz ten sam kod na obu telefonach, aby natychmiast rozmawiać przez radio P2P.
              </p>
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold uppercase tracking-wider transition active:scale-95"
            >
              <span>Dołącz do Kanału</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
