import React, { useState } from 'react';
import { Download, Smartphone, CheckCircle, Info, Layers, Globe, Zap, ArrowDownCircle } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useAppPlatform } from '../hooks/useAppPlatform';
import { VersionSelectorModal } from './VersionSelectorModal';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const { mode, isWeb, isPWA, isNative } = useAppPlatform();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [downloadingAPK, setDownloadingAPK] = useState(false);

  const handleInstallPWA = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const success = await install();
    if (!success) {
      setIsModalOpen(true);
    }
  };

  const handleDownloadDirectAPK = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDownloadingAPK(true);
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
    <>
      <div className="flex items-center gap-2 flex-wrap">
        {/* Direct APK Download Button */}
        <button
          onClick={handleDownloadDirectAPK}
          disabled={downloadingAPK}
          className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-md shadow-emerald-900/30 hover:brightness-110 active:scale-95 transition disabled:opacity-50"
          title="Pobierz plik instalacyjny APK bezpośrednio dla smartfona z systemem Android"
        >
          <ArrowDownCircle className="w-3.5 h-3.5 text-emerald-200" />
          <span>{downloadingAPK ? 'Pobieranie...' : 'Pobierz APK'}</span>
        </button>

        {/* PWA Install Button */}
        {isInstalled || isPWA ? (
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-emerald-950/80 border border-emerald-500/40 rounded-full text-[11px] font-mono text-emerald-400">
            <CheckCircle className="w-3 h-3 text-emerald-400" />
            <span>PWA ZAINSTALOWANO</span>
          </div>
        ) : (
          <button
            onClick={handleInstallPWA}
            className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-600 to-amber-500 px-3 py-1 text-xs font-bold uppercase tracking-wider text-slate-950 shadow-md shadow-amber-900/30 hover:brightness-110 active:scale-95 transition"
            title="Zainstaluj aplikację jako PWA bezpośrednio z przeglądarki"
          >
            <Download className="w-3.5 h-3.5 text-slate-950" />
            <span>Zainstaluj PWA</span>
          </button>
        )}

        {/* Version Switcher Badge */}
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1 px-2.5 py-1 bg-slate-800/90 border border-slate-700 hover:border-amber-500 rounded-full text-[11px] font-semibold text-slate-300 shadow-sm transition active:scale-95"
          title="Zobacz pełny podgląd 3 wersji aplikacji"
        >
          <Layers className="w-3 h-3 text-amber-400" />
          <span className="hidden md:inline">
            {isNative ? 'Natywny Android' : isPWA ? 'PWA Standalone' : 'Przeglądarka Web'}
          </span>
          <span className="md:hidden">3 Wersje</span>
        </button>
      </div>

      {/* 3-Version Selector Modal */}
      <VersionSelectorModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
};
