import React, { useEffect, useState } from 'react';
import { Activity, Volume2, Mic, Radio, ShieldCheck, Zap } from 'lucide-react';
import { audioEngine } from '../utils/audioEngine';

interface AudioEqualizerProps {
  isReceiving: boolean;
  isTransmitting: boolean;
  backlightColor: 'amber' | 'emerald' | 'cyan';
}

const FREQ_LABELS = ['60', '125', '250', '500', '1k', '2k', '4k', '8k', '16k'];

export const AudioEqualizer: React.FC<AudioEqualizerProps> = ({
  isReceiving,
  isTransmitting,
  backlightColor,
}) => {
  const [bands, setBands] = useState<number[]>(() => new Array(16).fill(0));
  const [dbLevel, setDbLevel] = useState<number>(-60);

  // Theme color styling based on LCD backlight theme
  const theme = {
    amber: {
      border: 'border-amber-500/40',
      bg: 'bg-[#1b1406]/95',
      text: 'text-amber-400',
      barLit: 'bg-amber-400 shadow-xs shadow-amber-400/50',
      barPeak: 'bg-red-500',
      waveStroke: '#f59e0b',
    },
    emerald: {
      border: 'border-emerald-500/40',
      bg: 'bg-[#061910]/95',
      text: 'text-emerald-400',
      barLit: 'bg-emerald-400 shadow-xs shadow-emerald-400/50',
      barPeak: 'bg-red-500',
      waveStroke: '#10b981',
    },
    cyan: {
      border: 'border-cyan-500/40',
      bg: 'bg-[#08151f]/95',
      text: 'text-cyan-400',
      barLit: 'bg-cyan-400 shadow-xs shadow-cyan-400/50',
      barPeak: 'bg-red-500',
      waveStroke: '#0ea5e9',
    },
  }[backlightColor];

  // RequestAnimationFrame loop for high-fps spectrum equalizer rendering
  useEffect(() => {
    let animId: number;
    let frameCount = 0;

    const tick = () => {
      frameCount++;
      let currentBands: number[];

      if (isReceiving) {
        currentBands = audioEngine.getRemoteEqualizerBands(16);
      } else if (isTransmitting) {
        currentBands = audioEngine.getMicEqualizerBands(16);
      } else {
        // Idle ambient subtle pulse (demonstrates active monitoring)
        currentBands = Array.from({ length: 16 }).map((_, idx) => {
          const sine = Math.sin(frameCount * 0.08 + idx * 0.5);
          return Math.max(2, Math.round((sine + 1) * 3));
        });
      }

      setBands(currentBands);

      // Compute average volume level in dB
      const avg = currentBands.reduce((a, b) => a + b, 0) / currentBands.length;
      if (avg > 0) {
        const db = Math.round(-60 + (avg / 100) * 60);
        setDbLevel(db);
      } else {
        setDbLevel(-60);
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [isReceiving, isTransmitting]);

  // Construct SVG Waveform path from equalizer bands
  const generateWavePath = () => {
    const width = 280;
    const height = 24;
    const points: string[] = [];

    bands.forEach((val, idx) => {
      const x = (idx / (bands.length - 1)) * width;
      const amp = (val / 100) * (height / 2 - 2);
      const y = height / 2 - (idx % 2 === 0 ? amp : -amp);
      points.push(`${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`);
    });

    return points.join(' ');
  };

  return (
    <div
      className={`w-full rounded-2xl border-2 p-3 font-mono shadow-lg transition-colors duration-300 ${theme.bg} ${theme.border}`}
    >
      {/* Equalizer Header Bar */}
      <div className="flex items-center justify-between pb-2 border-b border-white/10 text-[10px] uppercase font-bold tracking-wider">
        <div className="flex items-center gap-1.5">
          <Activity className={`w-3.5 h-3.5 ${theme.text} animate-pulse`} />
          <span className={theme.text}>
            {isReceiving
              ? '🔊 WYKRES GŁOSU PRZYCHODZĄCEGO (RX)'
              : isTransmitting
              ? '🎙️ WYKRES NADAWANIA GŁOSU (TX)'
              : '📊 ANALIZATOR WIDMA GŁOSU (STANDBY)'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[9px] text-white/50">{dbLevel} dB</span>
          <span
            className={`px-1.5 py-0.5 rounded text-[8px] font-black ${
              isReceiving
                ? 'bg-emerald-500 text-slate-950 animate-pulse'
                : isTransmitting
                ? 'bg-red-600 text-white animate-pulse'
                : 'bg-white/10 text-white/40'
            }`}
          >
            {isReceiving ? 'ODBIÓR ACTIVE' : isTransmitting ? 'NADAWANIE' : 'NASŁUCH'}
          </span>
        </div>
      </div>

      {/* 16-Band Graphic Equalizer Bars */}
      <div className="my-2.5">
        <div className="flex items-end justify-between gap-1 h-14 px-1 py-1 bg-black/50 rounded-xl border border-white/10">
          {bands.map((val, idx) => {
            // 8 segments per band
            const segments = 8;
            const litSegments = Math.round((val / 100) * segments);

            return (
              <div key={idx} className="flex-1 flex flex-col-reverse gap-0.5 h-full justify-start">
                {Array.from({ length: segments }).map((_, segIdx) => {
                  const isLit = segIdx < litSegments;
                  const isTopSeg = segIdx === segments - 1;

                  let colorClass = 'bg-white/5';
                  if (isLit) {
                    if (isTopSeg || segIdx >= 6) {
                      colorClass = 'bg-red-500 shadow-xs shadow-red-500/80';
                    } else if (segIdx >= 4) {
                      colorClass = 'bg-amber-400 shadow-xs shadow-amber-400/80';
                    } else {
                      colorClass = theme.barLit;
                    }
                  }

                  return (
                    <div
                      key={segIdx}
                      className={`w-full flex-1 rounded-2xs transition-all duration-75 ${colorClass}`}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Frequency Band Labels */}
        <div className="flex items-center justify-between text-[8px] font-bold text-white/30 px-1 mt-1 font-mono">
          {FREQ_LABELS.map((label, idx) => (
            <span key={idx}>{label}</span>
          ))}
        </div>
      </div>

      {/* Real-time Oscilloscope Waveform Curve */}
      <div className="pt-2 border-t border-white/10 flex items-center justify-between">
        <div className="w-full flex items-center justify-between gap-2">
          <div className="text-[9px] text-white/40 font-mono font-bold shrink-0">OSCYLOSKOP:</div>
          <div className="flex-1 h-6 bg-black/60 rounded-lg border border-white/10 px-1 flex items-center overflow-hidden">
            <svg className="w-full h-full" viewBox="0 0 280 24" preserveAspectRatio="none">
              <path
                d={generateWavePath()}
                fill="none"
                stroke={theme.waveStroke}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};
