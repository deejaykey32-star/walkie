import React from 'react';
import { Wifi, Signal, Radio, Volume2, ShieldAlert, Cpu, Mic, Lock, Zap } from 'lucide-react';
import { ConnectionStatus, PeerInfo } from '../hooks/useWalkieTalkie';

interface RadioDisplayProps {
  channel: string;
  frequency: string;
  subcode?: string;
  isTransmitting: boolean;
  isReceiving: boolean;
  connectionStatus: ConnectionStatus;
  isP2PDirect: boolean;
  remotePeer: PeerInfo | null;
  txLevel: number;
  rxLevel: number;
  volume: number;
  callAlertIncoming: boolean;
  backlightColor: 'amber' | 'emerald' | 'cyan';
  onToggleBacklight: () => void;
  isToggleMode?: boolean;
}

export const RadioDisplay: React.FC<RadioDisplayProps> = ({
  channel,
  frequency,
  subcode = 'CTCSS 01',
  isTransmitting,
  isReceiving,
  connectionStatus,
  isP2PDirect,
  remotePeer,
  txLevel,
  rxLevel,
  volume,
  callAlertIncoming,
  backlightColor,
  onToggleBacklight,
  isToggleMode = false,
}) => {
  const currentLevel = isTransmitting ? txLevel : isReceiving ? rxLevel : 0;
  // Calculate 10-segment VU meter
  const activeSegments = Math.round((currentLevel / 100) * 10);

  // Backlight style themes
  const theme = {
    amber: {
      screenBg: 'bg-[#1b1406]',
      borderColor: 'border-[#78350f]/80',
      textPrimary: 'text-[#fbbf24]',
      textDim: 'text-[#92400e]',
      glow: 'shadow-[inset_0_0_20px_rgba(245,158,11,0.2)]',
      segmentActive: 'bg-[#f59e0b]',
      segmentDim: 'bg-[#451a03]',
      txBadge: 'bg-red-600 text-white animate-pulse',
      rxBadge: 'bg-emerald-500 text-slate-950 font-black animate-pulse',
    },
    emerald: {
      screenBg: 'bg-[#061910]',
      borderColor: 'border-[#065f46]/80',
      textPrimary: 'text-[#34d399]',
      textDim: 'text-[#065f46]',
      glow: 'shadow-[inset_0_0_20px_rgba(16,185,129,0.2)]',
      segmentActive: 'bg-[#10b981]',
      segmentDim: 'bg-[#022c22]',
      txBadge: 'bg-red-600 text-white animate-pulse',
      rxBadge: 'bg-emerald-400 text-slate-950 font-black animate-pulse',
    },
    cyan: {
      screenBg: 'bg-[#08151f]',
      borderColor: 'border-[#0e7490]/80',
      textPrimary: 'text-[#38bdf8]',
      textDim: 'text-[#155e75]',
      glow: 'shadow-[inset_0_0_20px_rgba(14,165,233,0.2)]',
      segmentActive: 'bg-[#0ea5e9]',
      segmentDim: 'bg-[#082f49]',
      txBadge: 'bg-red-600 text-white animate-pulse',
      rxBadge: 'bg-emerald-400 text-slate-950 font-black animate-pulse',
    },
  }[backlightColor];

  return (
    <div
      onClick={onToggleBacklight}
      className={`relative w-full rounded-2xl border-2 p-3 font-mono select-none cursor-pointer transition-colors duration-300 ${theme.screenBg} ${theme.borderColor} ${theme.glow}`}
    >
      {/* Top Header Indicators */}
      <div className="flex items-center justify-between text-[10px] pb-1.5 border-b border-white/10 uppercase tracking-widest font-bold">
        {/* Status flags */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* TX (Transmit) LED */}
          <span
            className={`px-1.5 py-0.5 rounded text-[9px] font-black transition-all ${
              isTransmitting ? theme.txBadge : 'bg-white/5 text-white/20'
            }`}
          >
            TX
          </span>

          {/* RX (Receive) LED */}
          <span
            className={`px-1.5 py-0.5 rounded text-[9px] font-black transition-all ${
              isReceiving ? theme.rxBadge : 'bg-white/5 text-white/20'
            }`}
          >
            RX
          </span>

          {/* Mode Badge: Hands-Free (1-click) vs Hold PTT */}
          <span
            className={`px-1.5 py-0.5 rounded text-[9px] font-black tracking-tighter ${
              isToggleMode
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-white/5 text-white/30'
            }`}
          >
            {isToggleMode ? 'HANDS-FREE 1X' : 'PTT HOLD'}
          </span>

          {/* Direct P2P badge */}
          <span
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] ${
              isP2PDirect
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold'
                : connectionStatus === 'paired'
                ? 'bg-amber-500/20 text-amber-300 font-semibold'
                : 'text-white/25'
            }`}
          >
            <Cpu className="w-2.5 h-2.5" />
            <span>{isP2PDirect ? 'P2P DIRECT' : connectionStatus === 'paired' ? 'RELAY' : 'STANDBY'}</span>
          </span>
        </div>

        {/* Volume & Battery */}
        <div className="flex items-center gap-2 text-white/70">
          <div className="flex items-center gap-0.5">
            <Volume2 className="w-3 h-3 text-white/50" />
            <span className="text-[10px]">{volume}%</span>
          </div>
          <div className="flex items-center gap-1">
            <Wifi className={`w-3 h-3 ${connectionStatus === 'disconnected' ? 'text-red-400 animate-pulse' : 'text-emerald-400'}`} />
          </div>
        </div>
      </div>

      {/* Main Frequency & Channel Display */}
      <div className="py-2.5 flex items-baseline justify-between">
        <div>
          <div className="text-[11px] font-bold text-white/40 tracking-wider">PMR-446 FM</div>
          <div className={`text-2xl font-black tracking-tight ${theme.textPrimary} drop-shadow-sm`}>
            {channel}
          </div>
        </div>

        <div className="text-right">
          <div className={`text-sm font-black tracking-wider ${theme.textPrimary}`}>
            {frequency}
          </div>
          <div className={`text-[10px] font-semibold ${theme.textDim}`}>
            {subcode} • NARROW
          </div>
        </div>
      </div>

      {/* VU / S-Meter Bar */}
      <div className="pt-1 pb-1">
        <div className="flex items-center justify-between text-[9px] font-bold text-white/40 mb-1">
          <span>SIGNAL (S-METER)</span>
          <span className="font-mono">
            {isTransmitting ? 'NADAWANIE' : isReceiving ? 'ODBIÓR DŹWIĘKU' : 'SZUM BLOKOWANY'}
          </span>
        </div>
        <div className="grid grid-cols-10 gap-1 h-3.5 p-0.5 bg-black/40 rounded-md border border-white/10">
          {Array.from({ length: 10 }).map((_, i) => {
            const isLit = i < activeSegments;
            // Higher segments red/amber
            const colorClass = isLit
              ? i >= 8
                ? 'bg-red-500 shadow-xs shadow-red-500/50'
                : i >= 6
                ? 'bg-amber-400 shadow-xs shadow-amber-400/50'
                : theme.segmentActive
              : theme.segmentDim;
            return <div key={i} className={`rounded-xs transition-colors duration-75 ${colorClass}`} />;
          })}
        </div>
      </div>

      {/* Peer Connection Status Footer */}
      <div className="mt-2 pt-1.5 border-t border-white/10 flex items-center justify-between text-[10px]">
        <div className="flex items-center gap-1.5 truncate">
          <Radio className={`w-3.5 h-3.5 ${remotePeer ? 'text-emerald-400' : 'text-amber-500/60 animate-spin'}`} />
          <span className="truncate">
            {callAlertIncoming ? (
              <span className="text-red-400 font-black animate-pulse flex items-center gap-1">
                <ShieldAlert className="w-3 h-3" />
                WYWOŁANIE ALERT SOS!
              </span>
            ) : remotePeer ? (
              <span className="text-emerald-300 font-semibold">
                POŁĄCZONO: <strong className="text-white">{remotePeer.name}</strong>
              </span>
            ) : (
              <span className="text-amber-400/90 font-medium">
                Oczekiwanie na 2. smartfon...
              </span>
            )}
          </span>
        </div>

        <div className="text-[9px] text-white/40 shrink-0">
          STUN: GOOGLE
        </div>
      </div>
    </div>
  );
};
