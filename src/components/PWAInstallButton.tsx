import React, { useState } from 'react';
import { Download, CheckCircle, ArrowDownCircle, Info, Smartphone } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useAppPlatform } from '../hooks/useAppPlatform';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const { mode, isWeb, isPWA, isNative } = useAppPlatform();

  const [downloadingAPK, setDownloadingAPK] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Direct 1-click PWA installation (NO modal frames!)
  const handleInstallPWA = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isInstalled || isPWA) {
      showToast('Aplikacja PWA jest już zainstalowana na tym urządzeniu!');
      return;
    }

    const success = await install();
    if (!success) {
      if (isIOS) {
        showToast('W Safari dotknij ikony Udostępnij ➔ „Do ekranu początkowego”');
      } else {
        showToast('W menu Chrome (⋮) wybierz „Zainstaluj aplikację” lub „Dodaj do ekranu głównego”');
      }
    }
  };

  // Direct 1-click APK Download (Forces browser download without opening frames!)
  const handleDownloadDirectAPK = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isNative) {
      showToast('Korzystasz już z natywnej aplikacji Android APK!');
      return;
    }

    setDownloadingAPK(true);

    const apkUrl = `${window.location.origin}/walkie-talkie-p2p.apk`;
    const link = document.createElement('a');
    link.href = apkUrl;
    link.setAttribute('download', 'walkie-talkie-p2p.apk');
    link.setAttribute('target', '_blank');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('Rozpoczęto pobieranie pliku instalacyjnego Android APK...');

    setTimeout(() => {
      setDownloadingAPK(false);
    }, 2500);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  return (
    <div className="relative flex items-center gap-2 flex-wrap">
      {/* If ALREADY running inside Native Android APK container, show native installed badge */}
      {isNative ? (
        <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-950/90 border border-emerald-500/50 rounded-full text-xs font-bold text-emerald-400 shadow-sm">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
          <span>APK ZAINSTALOWANO (NATYWNY ANDROID)</span>
        </div>
      ) : (
        <>
          {/* Direct APK Download Button (Visible on Web / PWA) */}
          <button
            onClick={handleDownloadDirectAPK}
            disabled={downloadingAPK}
            className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white shadow-md shadow-emerald-900/30 hover:brightness-110 active:scale-95 transition disabled:opacity-50"
            title="Pobierz plik instalacyjny APK bezpośrednio dla smartfona z systemem Android"
          >
            <ArrowDownCircle className="w-3.5 h-3.5 text-emerald-200" />
            <span>{downloadingAPK ? 'Pobieranie...' : 'Pobierz APK'}</span>
          </button>

          {/* Direct PWA Install Button */}
          {isInstalled || isPWA ? (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-950/80 border border-emerald-500/40 rounded-full text-xs font-semibold text-emerald-400">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span>PWA ZAINSTALOWANO</span>
            </div>
          ) : (
            <button
              onClick={handleInstallPWA}
              className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-950 shadow-md shadow-amber-900/30 hover:brightness-110 active:scale-95 transition"
              title="Zainstaluj aplikację bezpośrednio na urządzeniu z przeglądarki"
            >
              <Download className="w-3.5 h-3.5 text-slate-950" />
              <span>Zainstaluj PWA</span>
            </button>
          )}
        </>
      )}

      {/* Direct Toast Hint Notification (No Frame Modal!) */}
      {toastMessage && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-sm w-[90%] rounded-2xl bg-slate-900/95 border border-amber-500/50 p-3.5 shadow-2xl backdrop-blur-md text-slate-100 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
            <Info className="w-4 h-4" />
          </div>
          <p className="text-xs font-medium text-slate-200 leading-snug">{toastMessage}</p>
        </div>
      )}
    </div>
  );
};
