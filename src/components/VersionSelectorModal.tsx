import React, { useState } from 'react';
import {
  Smartphone,
  Globe,
  Zap,
  CheckCircle2,
  Download,
  ExternalLink,
  ShieldCheck,
  X,
  Info,
  Radio,
  Layers,
  Sparkles,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useAppPlatform, AppVersionMode } from '../hooks/useAppPlatform';

interface VersionSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VersionSelectorModal: React.FC<VersionSelectorModalProps> = ({ isOpen, onClose }) => {
  const { mode, isWeb, isPWA, isNative } = useAppPlatform();
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();

  const [downloadingAPK, setDownloadingAPK] = useState(false);
  const [showAndroidGuide, setShowAndroidGuide] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (!isOpen) return null;

  const handleInstallPWA = async () => {
    const success = await install();
    if (!success) {
      if (isIOS) {
        setShowIOSGuide(true);
      } else {
        setShowAndroidGuide(true);
      }
    }
  };

  const handleDownloadAPK = () => {
    setDownloadingAPK(true);
    // Trigger download of APK asset
    const link = document.createElement('a');
    link.href = '/walkie-talkie-p2p.apk';
    link.download = 'WalkieTalkie-P2P-Android.apk';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
      setDownloadingAPK(false);
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-5 animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-3xl border border-slate-700/80 bg-slate-900/95 p-5 sm:p-7 shadow-2xl text-slate-100 my-auto">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700 transition"
          aria-label="Zamknij"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
          <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <Layers className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-extrabold text-xl sm:text-2xl text-white tracking-tight">
                3 Wersje Aplikacji Walkie-Talkie
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                P2P Ready
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Wybierz odpowiednią wersję dopasowaną do Twojego urządzenia i potrzeb.
            </p>
          </div>
        </div>

        {/* Current Active Mode Banner */}
        <div className="mt-4 p-3 rounded-2xl bg-gradient-to-r from-slate-800/80 via-slate-800/50 to-slate-800/80 border border-slate-700/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-slate-400 font-medium">Obecnie uruchomiono w trybie:</span>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
            {isNative
              ? '🤖 Aplikacja Natywna Android'
              : isPWA
              ? '⚡ Samodzielna PWA (Zainstalowano)'
              : '🌐 Wersja Webowa (Przeglądarka)'}
          </span>
        </div>

        {/* 3 Versions Cards Grid */}
        <div className="mt-5 space-y-4">
          {/* VERSION 1: NATIVE ANDROID */}
          <div
            className={`p-4 sm:p-5 rounded-2xl border transition-all ${
              isNative
                ? 'bg-amber-950/30 border-amber-500/60 shadow-lg shadow-amber-950/20'
                : 'bg-slate-800/40 border-slate-700/60 hover:border-slate-600'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 text-emerald-400 border border-emerald-500/30 flex-shrink-0 mt-0.5 sm:mt-0">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-white">1. Natywna Aplikacja Android (.APK)</h3>
                    {isNative && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        AKTYWNA TERAZ
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    Pelna aplikacja natywna Android (zbudowana w Capacitor z dostępem do miksera audio i tła systemowego). Idealna dla smartfonów Android.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:items-end gap-2 flex-shrink-0 mt-2 sm:mt-0">
                <button
                  onClick={handleDownloadAPK}
                  disabled={downloadingAPK}
                  className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-md shadow-emerald-900/30 hover:brightness-110 active:scale-95 transition disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  <span>{downloadingAPK ? 'Pobieranie...' : 'Pobierz plik .APK'}</span>
                </button>
                <span className="text-[10px] text-slate-400">Android 7.0+ | Capacitor Engine</span>
              </div>
            </div>
          </div>

          {/* VERSION 2: WEB INTERNET VERSION */}
          <div
            className={`p-4 sm:p-5 rounded-2xl border transition-all ${
              isWeb
                ? 'bg-amber-950/30 border-amber-500/60 shadow-lg shadow-amber-950/20'
                : 'bg-slate-800/40 border-slate-700/60 hover:border-slate-600'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 text-cyan-400 border border-cyan-500/30 flex-shrink-0 mt-0.5 sm:mt-0">
                  <Globe className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-white">2. Wersja Webowa w Internecie</h3>
                    {isWeb && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        AKTYWNA TERAZ
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    Działa od razu w dowolnej przeglądarce internetowej (Chrome, Edge, Safari, Firefox). Zero instalacji — otwórz link i natychmiast rozmawiaj P2P.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:items-end gap-2 flex-shrink-0 mt-2 sm:mt-0">
                <button
                  onClick={onClose}
                  className="flex items-center justify-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-cyan-300 hover:bg-cyan-500/20 transition"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Uruchom w Przeglądarce</span>
                </button>
                <span className="text-[10px] text-slate-400">Bez instalacji | Dowolna przeglądarka</span>
              </div>
            </div>
          </div>

          {/* VERSION 3: INSTALLED PWA */}
          <div
            className={`p-4 sm:p-5 rounded-2xl border transition-all ${
              isPWA
                ? 'bg-amber-950/30 border-amber-500/60 shadow-lg shadow-amber-950/20'
                : 'bg-slate-800/40 border-slate-700/60 hover:border-slate-600'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 text-amber-400 border border-amber-500/30 flex-shrink-0 mt-0.5 sm:mt-0">
                  <Zap className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-white">
                      3. Wersja PWA (Instalowana z Przycisku)
                    </h3>
                    {isPWA && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        AKTYWNA TERAZ
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    Instaluje się bezpośrednio na pulpicie lub w menu smartfona po 1 kliknięciu przycisku poniżej. Działa offline i jako pełnoekranowe PWA.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:items-end gap-2 flex-shrink-0 mt-2 sm:mt-0">
                {isInstalled || isPWA ? (
                  <div className="flex items-center gap-1.5 px-3 py-2 bg-emerald-950/80 border border-emerald-500/40 rounded-xl text-xs font-bold text-emerald-400">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>ZAINSTALOWANO PWA</span>
                  </div>
                ) : (
                  <button
                    onClick={handleInstallPWA}
                    className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-950 shadow-md shadow-amber-900/30 hover:brightness-110 active:scale-95 transition"
                  >
                    <Download className="w-4 h-4" />
                    <span>Zainstaluj PWA Teraz</span>
                  </button>
                )}
                <span className="text-[10px] text-slate-400">Instalacja 1-kliknięciem | Web Manifest</span>
              </div>
            </div>
          </div>
        </div>

        {/* Android / iOS Guides Modals fallback */}
        {showAndroidGuide && (
          <div className="mt-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200">
            <div className="flex items-center gap-2 font-bold text-amber-300 mb-1">
              <Info className="w-4 h-4" />
              <span>Instrukcja instalacji PWA na Android:</span>
            </div>
            <p>1. Kliknij menu z trzema kropkami <strong className="text-white">⋮</strong> w Google Chrome.</p>
            <p>2. Wybierz opcję <strong className="text-amber-300">„Zainstaluj aplikację”</strong> lub <strong className="text-amber-300">„Dodaj do ekranu głównego”</strong>.</p>
          </div>
        )}

        {showIOSGuide && (
          <div className="mt-4 p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 text-xs text-blue-200">
            <div className="flex items-center gap-2 font-bold text-blue-300 mb-1">
              <Info className="w-4 h-4" />
              <span>Instrukcja instalacji PWA na iOS (Safari):</span>
            </div>
            <p>1. Dotknij przycisku <strong>Udostępnij (kwadrat ze strzałką)</strong> w Safari.</p>
            <p>2. Wybierz opcję <strong>„Do ekranu początkowego”</strong> i kliknij <strong>Dodaj</strong>.</p>
          </div>
        )}

        {/* Footer info */}
        <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Wszystkie 3 wersje korzystają z tego samego protokołu szyfrowanego P2P</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 font-semibold text-slate-200 hover:bg-slate-700 transition"
          >
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
};
