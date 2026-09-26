import React, { useState } from 'react';
import { Download, Smartphone, CheckCircle, Info, Layers, Globe, Zap } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useAppPlatform } from '../hooks/useAppPlatform';
import { VersionSelectorModal } from './VersionSelectorModal';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const { mode, isWeb, isPWA, isNative } = useAppPlatform();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showAndroidGuide, setShowAndroidGuide] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  const handleInstallClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const success = await install();
    if (!success) {
      setIsModalOpen(true);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Version Badge & Picker trigger */}
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1 bg-slate-800/90 border border-amber-500/30 hover:border-amber-400 rounded-full text-xs font-semibold text-slate-200 shadow-sm transition active:scale-95"
          title="Kliknij, aby zobaczyć wszystkie 3 wersje aplikacji (Android Natywna, Web, PWA)"
        >
          <Layers className="w-3.5 h-3.5 text-amber-400" />
          <span>
            {isNative
              ? 'Wersja Natywna Android'
              : isPWA
              ? 'Wersja PWA (Zainstalowano)'
              : 'Wersja Webowa (W internecie)'}
          </span>
        </button>

        {/* Dedicated PWA Install Button on Webpage */}
        {isInstalled || isPWA ? (
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-emerald-950/80 border border-emerald-500/40 rounded-full text-[11px] font-mono text-emerald-400">
            <CheckCircle className="w-3 h-3 text-emerald-400" />
            <span>ZAINSTALOWANO (PWA)</span>
          </div>
        ) : (
          <button
            onClick={handleInstallClick}
            className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-600 to-amber-500 px-3 py-1 text-xs font-bold uppercase tracking-wider text-slate-950 shadow-md shadow-amber-900/30 hover:brightness-110 active:scale-95 transition"
            title="Kliknij, aby zainstalować aplikację PWA na tym urządzeniu"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Zainstaluj PWA</span>
          </button>
        )}
      </div>

      {/* 3-Version Selector Modal */}
      <VersionSelectorModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
};
