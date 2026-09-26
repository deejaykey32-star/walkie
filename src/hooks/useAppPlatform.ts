import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';

export type AppVersionMode = 'native' | 'pwa' | 'web';

export function useAppPlatform() {
  const [mode, setMode] = useState<AppVersionMode>('web');
  const [isCapacitorNative, setIsCapacitorNative] = useState(false);
  const [isPWAStandalone, setIsPWAStandalone] = useState(false);

  useEffect(() => {
    const isNative = Capacitor.isNativePlatform();
    setIsCapacitorNative(isNative);

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
      document.referrer.includes('android-app://');

    setIsPWAStandalone(isStandalone);

    if (isNative) {
      setMode('native');
    } else if (isStandalone) {
      setMode('pwa');
    } else {
      setMode('web');
    }
  }, []);

  return {
    mode,
    isCapacitorNative,
    isPWAStandalone,
    isWeb: mode === 'web',
    isPWA: mode === 'pwa',
    isNative: mode === 'native',
  };
}
