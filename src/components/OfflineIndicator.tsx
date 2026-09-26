import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 z-50 flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-bold text-white shadow-xl shadow-amber-950/60 border border-amber-400/40">
      <WifiOff className="w-4 h-4 animate-bounce" />
      <span>Brak połączenia z siecią — Przejście w tryb offline</span>
    </div>
  );
};
