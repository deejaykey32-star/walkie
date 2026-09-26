import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { QrCode, Share2, Copy, Check, Camera, X, Radio, ArrowRight, ShieldCheck } from 'lucide-react';

interface PairingModalProps {
  channel: string;
  isOpen: boolean;
  onClose: () => void;
  onChannelSelect: (ch: string) => void;
  deviceName: string;
}

export const PairingModal: React.FC<PairingModalProps> = ({
  channel,
  isOpen,
  onClose,
  onChannelSelect,
  deviceName,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'qr' | 'scan' | 'manual'>('qr');
  const [customChannelInput, setCustomChannelInput] = useState('');
  const [scanError, setScanError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Generate shareable URL
  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}?ch=${encodeURIComponent(channel)}`
    : '';

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

  // Copy URL to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn('Copy failed:', e);
    }
  };

  // Native Android Share Sheet
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Połącz krótkofalówkę Walkie-Talkie',
          text: `Połącz się bezpośrednio z moim telefonem (${deviceName}) na kanale ${channel}:`,
          url: shareUrl,
        });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          handleCopy();
        }
      }
    } else {
      handleCopy();
    }
  };

  // Built-in Camera Scanner
  useEffect(() => {
    if (activeTab !== 'scan') {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((t) => t.stop());
        videoRef.current.srcObject = null;
      }
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
      }
      return;
    }

    let stream: MediaStream | null = null;
    let detector: unknown = null;

    if ('BarcodeDetector' in window) {
      try {
        // @ts-expect-error - BarcodeDetector is a modern browser API
        detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      } catch (e) {
        console.warn('BarcodeDetector error:', e);
      }
    }

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'environment' } })
      .then((s) => {
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.play().catch(() => {});
        }

        // Periodic detection
        if (detector) {
          scanIntervalRef.current = setInterval(async () => {
            if (!videoRef.current || videoRef.current.readyState < 2) return;
            try {
              // @ts-expect-error - detector call
              const barcodes = await detector.detect(videoRef.current);
              if (barcodes && barcodes.length > 0) {
                const scannedRaw = barcodes[0].rawValue;
                handleScannedUrl(scannedRaw);
              }
            } catch {
              // Ignore frame errors
            }
          }, 350);
        } else {
          setScanError('Twoja przeglądarka nie obsługuje bezpośredniego skanowania w oknie. Możesz otworzyć standardowy aparat lub zeskanować link Google Lens.');
        }
      })
      .catch((err) => {
        console.warn('Camera access denied:', err);
        setScanError('Brak uprawnień do aparatu fotograficznego.');
      });

    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
      }
    };
  }, [activeTab]);

  const handleScannedUrl = (url: string) => {
    try {
      const parsed = new URL(url);
      const ch = parsed.searchParams.get('ch') || parsed.searchParams.get('channel');
      if (ch) {
        onChannelSelect(ch);
        onClose();
      }
    } catch {
      // If user typed raw channel
      if (url.trim()) {
        onChannelSelect(url.trim().toUpperCase());
        onClose();
      }
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customChannelInput.trim()) {
      onChannelSelect(customChannelInput.trim().toUpperCase());
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-sm rounded-3xl border border-slate-700/80 bg-gradient-to-b from-slate-900 to-slate-950 p-6 shadow-2xl text-slate-100 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Parowanie 2 telefonów</h3>
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

        {/* Tabs */}
        <div className="flex gap-1.5 p-1 bg-slate-950/80 border border-slate-800 rounded-xl my-4 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('qr')}
            className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition ${
              activeTab === 'qr' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Pokaż QR</span>
          </button>
          <button
            onClick={() => setActiveTab('scan')}
            className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition ${
              activeTab === 'scan' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Skanuj aparat</span>
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

        {/* Tab 1: Show QR code */}
        {activeTab === 'qr' && (
          <div className="flex flex-col items-center">
            <div className="p-3 bg-white rounded-2xl shadow-lg border-4 border-amber-500/30">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="QR Code Kanału Walkie-Talkie" className="w-48 h-48 rounded-lg" />
              ) : (
                <div className="w-48 h-48 flex items-center justify-center text-slate-900 font-mono text-xs">
                  Generowanie kodu QR...
                </div>
              )}
            </div>

            <div className="mt-3 text-center">
              <p className="text-xs text-slate-300 font-medium">
                Drugi smartfon Android: skieruj aparat lub Google Lens na ten kod!
              </p>
              <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-emerald-400 font-mono">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Bezpośrednie połączenie P2P WebRTC</span>
              </div>
            </div>

            <div className="w-full grid grid-cols-2 gap-2 mt-4">
              <button
                onClick={handleCopy}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-xs font-semibold text-white transition active:scale-95"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
                <span>{copied ? 'Skopiowano!' : 'Kopiuj link'}</span>
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

        {/* Tab 2: Camera Scanner */}
        {activeTab === 'scan' && (
          <div className="flex flex-col items-center">
            <div className="relative w-full aspect-square max-h-56 rounded-2xl overflow-hidden bg-black border-2 border-amber-500/50 flex items-center justify-center">
              <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
              {/* Target sight box */}
              <div className="absolute inset-8 border-2 border-dashed border-amber-400/80 rounded-xl pointer-events-none animate-pulse" />
            </div>

            {scanError ? (
              <p className="mt-3 text-xs text-amber-300 text-center bg-amber-950/40 border border-amber-500/30 p-2.5 rounded-xl">
                {scanError}
              </p>
            ) : (
              <p className="mt-3 text-xs text-slate-400 text-center">
                Skieruj obiektyw na kod QR wyświetlony na ekranie drugiego telefonu.
              </p>
            )}
          </div>
        )}

        {/* Tab 3: Manual Channel input */}
        {activeTab === 'manual' && (
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Wpisz nazwę kanału lub kod pokoju:
              </label>
              <input
                type="text"
                value={customChannelInput}
                onChange={(e) => setCustomChannelInput(e.target.value)}
                placeholder="np. CH-01, ALFA, 7721..."
                className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3.5 py-2.5 text-sm font-mono text-amber-400 placeholder:text-slate-600 focus:outline-hidden focus:border-amber-500"
                autoFocus
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Wpisz ten sam kod na obu telefonach, aby natychmiast nawiązać bezpośrednią łączność radiową.
              </p>
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold uppercase tracking-wider transition active:scale-95"
            >
              <span>Dołącz do kanału</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
