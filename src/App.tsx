/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Mic,
  MicOff,
  Radio,
  QrCode,
  Volume2,
  VolumeX,
  BellRing,
  HelpCircle,
  Sliders,
  Sparkles,
  Smartphone,
  CheckCircle2,
  ChevronDown,
  Info,
  RadioTower,
  Lock,
  Unlock,
} from 'lucide-react';
import { useWalkieTalkie, CHANNELS } from './hooks/useWalkieTalkie';
import { RadioDisplay } from './components/RadioDisplay';
import { AudioEqualizer } from './components/AudioEqualizer';
import { PairingModal } from './components/PairingModal';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import { audioEngine } from './utils/audioEngine';

export default function App() {
  const {
    channel,
    channels,
    peerId,
    deviceName,
    connectionStatus,
    isP2PDirect,
    isTransmitting,
    isReceiving,
    remotePeer,
    micAllowed,
    txLevel,
    rxLevel,
    callAlertIncoming,
    volume,
    squelch,
    setVolume,
    setSquelch,
    changeChannel,
    startTalking,
    stopTalking,
    sendCallTone,
    initMicrophone,
    updateDeviceName,
  } = useWalkieTalkie();

  const [isPairingOpen, setIsPairingOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(deviceName);
  const [backlightColor, setBacklightColor] = useState<'amber' | 'emerald' | 'cyan'>('amber');
  const [rogerBeepOn, setRogerBeepOn] = useState(true);
  const [showChannelPicker, setShowChannelPicker] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);

  // Toggle mode state: false = hold-to-talk (tradycyjne PTT), true = tap-to-toggle (Hands-Free / kliknij aby włączyć/wyłączyć)
  const [isToggleMode, setIsToggleMode] = useState<boolean>(() => {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('walkie_toggle_mode') === 'true';
    }
    return false;
  });

  const toggleTalkingMode = () => {
    const next = !isToggleMode;
    setIsToggleMode(next);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('walkie_toggle_mode', String(next));
    }
    audioEngine.playKnobClick();
  };

  const currentChannelObj = channels.find((c) => c.id === channel) || {
    id: channel,
    name: `KANAŁ ${channel}`,
    freq: '446.00625 MHz',
    subcode: 'CTCSS 01',
  };

  // Sync Roger Beep setting
  const toggleRogerBeep = () => {
    const next = !rogerBeepOn;
    setRogerBeepOn(next);
    audioEngine.rogerBeepEnabled = next;
    audioEngine.playKnobClick();
  };

  // Toggle backlight color
  const cycleBacklight = () => {
    const colors: Array<'amber' | 'emerald' | 'cyan'> = ['amber', 'emerald', 'cyan'];
    const nextIndex = (colors.indexOf(backlightColor) + 1) % colors.length;
    setBacklightColor(colors[nextIndex]);
    audioEngine.playKnobClick();
  };

  // Keyboard Spacebar PTT support for easy testing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          if (isToggleMode) {
            if (isTransmitting) {
              stopTalking();
            } else {
              startTalking();
            }
          } else if (!spaceHeld) {
            setSpaceHeld(true);
            startTalking();
          }
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isToggleMode && spaceHeld) {
        e.preventDefault();
        setSpaceHeld(false);
        stopTalking();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isToggleMode, isTransmitting, spaceHeld, startTalking, stopTalking]);

  // Request mic permission and toggle/start talking
  const handlePttClick = useCallback(
    async (e: React.SyntheticEvent) => {
      e.preventDefault();
      if (micAllowed === null || micAllowed === false) {
        await initMicrophone();
      }

      if (isToggleMode) {
        if (isTransmitting) {
          stopTalking();
        } else {
          startTalking();
        }
      }
    },
    [micAllowed, initMicrophone, isToggleMode, isTransmitting, startTalking, stopTalking]
  );

  const handlePttStart = useCallback(
    async (e: React.SyntheticEvent) => {
      if (isToggleMode) return;
      e.preventDefault();
      if (micAllowed === null || micAllowed === false) {
        await initMicrophone();
      }
      startTalking();
    },
    [isToggleMode, micAllowed, initMicrophone, startTalking]
  );

  const handlePttEnd = useCallback(
    (e: React.SyntheticEvent) => {
      if (isToggleMode) return;
      e.preventDefault();
      stopTalking();
    },
    [isToggleMode, stopTalking]
  );

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    updateDeviceName(tempName);
    setIsEditingName(false);
  };

  return (
    <div className="min-h-screen w-full bg-[#0a0c0e] text-slate-100 flex flex-col items-center justify-between p-3 sm:p-6 font-sans select-none overflow-x-hidden">
      {/* Header Bar */}
      <header className="w-full max-w-md flex items-center justify-between py-2 px-1 mb-2">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <RadioTower className="w-5 h-5 text-amber-500" />
            <span
              className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${
                connectionStatus === 'paired'
                  ? 'bg-emerald-500 animate-ping'
                  : connectionStatus === 'connected'
                  ? 'bg-amber-400'
                  : 'bg-red-500'
              }`}
            />
          </div>
          <div>
            <h1 className="text-xs font-black tracking-wider uppercase text-white flex items-center gap-1.5">
              <span>Walkie-Talkie</span>
              <span className="text-[10px] px-1.5 py-0.2 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded font-mono">
                P2P
              </span>
            </h1>
            <p className="text-[10px] text-slate-400 truncate max-w-[120px] sm:max-w-[160px]">
              {deviceName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <PWAInstallButton />
          <button
            onClick={() => setShowGuide(true)}
            className="p-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition"
            title="Instrukcja obsługi"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Walkie-Talkie Physical Body */}
      <main className="w-full max-w-[390px] relative flex flex-col rounded-3xl sm:rounded-[36px] bg-gradient-to-b from-[#242b33] via-[#1a1f26] to-[#11151a] p-4 sm:p-5 shadow-2xl border-4 border-[#333d48] overflow-hidden my-auto">
        {/* Antenna & Hardware Knobs Accents */}
        <div className="flex items-end justify-between px-3 -mt-6 sm:-mt-7 mb-2">
          {/* Antenna */}
          <div className="flex flex-col items-center">
            {/* Radio wave pulse when transmitting */}
            {isTransmitting && (
              <div className="flex gap-1 mb-1 animate-pulse">
                <span className="w-1 h-3 bg-red-500 rounded-full" />
                <span className="w-1 h-5 bg-red-400 rounded-full" />
                <span className="w-1 h-3 bg-red-500 rounded-full" />
              </div>
            )}
            <div className="w-6 h-12 bg-gradient-to-r from-[#20272e] via-[#3a4450] to-[#181d22] rounded-t-lg border-2 border-slate-700 shadow-md relative">
              <div className="absolute top-1 inset-x-1 h-1.5 bg-[#4b5563] rounded-full" />
            </div>
          </div>

          {/* Rotary Channel Switch & Volume Knobs */}
          <div className="flex items-center gap-4">
            {/* Channel Knob */}
            <div className="flex flex-col items-center">
              <button
                onClick={() => setShowChannelPicker(true)}
                className="w-10 h-7 rounded-t-md bg-[#252c34] border-2 border-slate-600 shadow-inner flex items-center justify-center hover:brightness-110 active:scale-95 transition"
                title="Przełącz kanał"
              >
                <div className="w-1.5 h-4 bg-amber-400 rounded-xs" />
              </button>
              <span className="text-[9px] font-mono text-slate-400 mt-0.5 uppercase tracking-tighter">
                KANAŁ
              </span>
            </div>

            {/* Volume Knob */}
            <div className="flex flex-col items-center">
              <button
                onClick={() => setVolume((v) => (v >= 100 ? 0 : v + 25))}
                className="w-10 h-7 rounded-t-md bg-[#252c34] border-2 border-slate-600 shadow-inner flex items-center justify-center hover:brightness-110 active:scale-95 transition"
                title={`Głośność: ${volume}%`}
              >
                <div
                  className="w-1.5 h-4 bg-emerald-400 rounded-xs transition-transform"
                  style={{ transform: `rotate(${(volume / 100) * 180 - 90}deg)` }}
                />
              </button>
              <span className="text-[9px] font-mono text-slate-400 mt-0.5 uppercase tracking-tighter">
                VOL: {volume}%
              </span>
            </div>
          </div>
        </div>

        {/* Tactical LCD Display Screen */}
        <div className="mb-3">
          <RadioDisplay
            channel={currentChannelObj.name}
            frequency={currentChannelObj.freq}
            subcode={currentChannelObj.subcode}
            isTransmitting={isTransmitting}
            isReceiving={isReceiving}
            connectionStatus={connectionStatus}
            isP2PDirect={isP2PDirect}
            remotePeer={remotePeer}
            txLevel={txLevel}
            rxLevel={rxLevel}
            volume={volume}
            callAlertIncoming={callAlertIncoming}
            backlightColor={backlightColor}
            onToggleBacklight={cycleBacklight}
            isToggleMode={isToggleMode}
          />
        </div>

        {/* Real-time Voice Equalizer & Spectrum Waveform Screen */}
        <div className="mb-3">
          <AudioEqualizer
            isReceiving={isReceiving}
            isTransmitting={isTransmitting}
            backlightColor={backlightColor}
          />
        </div>

        {/* Microphone Permission Warning Banner */}
        {micAllowed === false && (
          <div className="mb-3 p-2.5 rounded-xl bg-red-950/80 border border-red-500/50 text-[11px] text-red-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MicOff className="w-4 h-4 text-red-400 shrink-0" />
              <span>Mikrofon jest zablokowany w przeglądarce.</span>
            </div>
            <button
              onClick={initMicrophone}
              className="px-2 py-1 bg-red-600 hover:bg-red-500 rounded text-white font-bold uppercase text-[10px]"
            >
              Włącz
            </button>
          </div>
        )}

        {/* Quick Function Controls Row */}
        <div className="grid grid-cols-4 gap-1.5 mb-3 text-center">
          {/* Pair Phones / QR Code */}
          <button
            onClick={() => setIsPairingOpen(true)}
            className="flex flex-col items-center justify-center p-2 rounded-xl bg-[#1d232a] border border-slate-700/80 hover:border-amber-500/60 hover:bg-slate-800 transition active:scale-95 text-slate-200"
          >
            <QrCode className="w-4 h-4 text-amber-400 mb-1" />
            <span className="text-[10px] font-bold uppercase tracking-tight">Połącz 2 tel</span>
          </button>

          {/* Toggle Mode Button: Hands-Free vs Hold PTT */}
          <button
            onClick={toggleTalkingMode}
            className={`flex flex-col items-center justify-center p-2 rounded-xl border transition active:scale-95 ${
              isToggleMode
                ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300 shadow-md shadow-emerald-950/40'
                : 'bg-[#1d232a] border-slate-700/80 text-slate-300 hover:border-amber-500/60'
            }`}
            title="Przełącz tryb rozmowy: 1-kliknięcie (Hands-Free) vs Przytrzymaj (PTT)"
          >
            <RadioTower className="w-4 h-4 mb-1 text-emerald-400" />
            <span className="text-[10px] font-bold uppercase tracking-tight">
              {isToggleMode ? 'Tryb: 1-Klik' : 'Tryb: Trzymaj'}
            </span>
          </button>

          {/* Call Tone / Siren */}
          <button
            onClick={sendCallTone}
            className="flex flex-col items-center justify-center p-2 rounded-xl bg-[#1d232a] border border-slate-700/80 hover:border-red-500/60 hover:bg-slate-800 transition active:scale-95 text-slate-200"
          >
            <BellRing className="w-4 h-4 text-red-400 mb-1" />
            <span className="text-[10px] font-bold uppercase tracking-tight">Wywołaj (SOS)</span>
          </button>

          {/* Roger Beep Toggle */}
          <button
            onClick={toggleRogerBeep}
            className={`flex flex-col items-center justify-center p-2 rounded-xl border transition active:scale-95 ${
              rogerBeepOn
                ? 'bg-amber-500/15 border-amber-500/50 text-amber-300'
                : 'bg-[#1d232a] border-slate-700/80 text-slate-400'
            }`}
          >
            <Sparkles className="w-4 h-4 mb-1" />
            <span className="text-[10px] font-bold uppercase tracking-tight">
              Roger: {rogerBeepOn ? 'WŁ' : 'WYŁ'}
            </span>
          </button>
        </div>

        {/* Tactical Speaker Grille */}
        <div className="py-2.5 px-4 mb-3 rounded-2xl bg-black/50 border border-slate-800/80 flex flex-col items-center justify-center">
          <div className="flex gap-2.5 my-1">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-slate-800" />
            <span className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-slate-800" />
            <span className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-slate-800" />
            <span className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-slate-800" />
            <span className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-slate-800" />
          </div>
          <div className="flex gap-2.5 my-1">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-slate-800" />
            <span className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-slate-800" />
            <span className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-slate-800" />
            <span className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-slate-800" />
          </div>
          <div className="text-[9px] uppercase font-mono tracking-widest text-slate-600 mt-1">
            AKUSTYCZNY GŁOŚNIK PMR
          </div>
        </div>

        {/* GIANT ERGONOMIC PUSH-TO-TALK (PTT) BUTTON */}
        <div className="w-full flex flex-col items-center my-1">
          <button
            onClick={handlePttClick}
            onMouseDown={handlePttStart}
            onMouseUp={handlePttEnd}
            onMouseLeave={handlePttEnd}
            onTouchStart={handlePttStart}
            onTouchEnd={handlePttEnd}
            onTouchCancel={handlePttEnd}
            onContextMenu={(e) => e.preventDefault()}
            style={{ touchAction: 'none' }}
            className={`group relative w-full h-32 sm:h-36 rounded-3xl border-4 transition-all duration-100 flex flex-col items-center justify-center overflow-hidden cursor-pointer select-none active:scale-[0.98] ${
              isTransmitting
                ? 'bg-gradient-to-b from-amber-600 via-amber-500 to-amber-700 border-amber-300 shadow-[0_0_35px_rgba(245,158,11,0.6)] scale-[0.98]'
                : isReceiving
                ? 'bg-gradient-to-b from-emerald-800 via-emerald-700 to-emerald-900 border-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.4)]'
                : 'bg-gradient-to-b from-[#2e3742] via-[#212831] to-[#151a20] border-[#44505f] hover:border-amber-500/60 shadow-xl'
            }`}
          >
            {/* Grip Ridges */}
            <div className="absolute inset-x-8 top-3 flex justify-between opacity-30 pointer-events-none">
              <span className="w-full h-1 bg-white/40 rounded-full" />
            </div>
            <div className="absolute inset-x-8 bottom-3 flex justify-between opacity-30 pointer-events-none">
              <span className="w-full h-1 bg-white/40 rounded-full" />
            </div>

            {/* Ripple rings while transmitting */}
            {isTransmitting && (
              <div className="absolute inset-0 border-4 border-amber-300 rounded-3xl animate-ping opacity-30 pointer-events-none" />
            )}

            {/* PTT Main Icon & Text */}
            <div className="relative z-10 flex flex-col items-center text-center px-4">
              <div
                className={`p-3 rounded-full mb-1.5 transition-colors ${
                  isTransmitting
                    ? 'bg-slate-950 text-amber-400 animate-pulse'
                    : isReceiving
                    ? 'bg-emerald-950 text-emerald-300 animate-bounce'
                    : 'bg-[#181d23] text-amber-400 group-hover:text-amber-300'
                }`}
              >
                <Mic className="w-8 h-8" />
              </div>

              <span
                className={`font-black tracking-wider uppercase text-base sm:text-lg drop-shadow-sm ${
                  isTransmitting
                    ? 'text-slate-950'
                    : isReceiving
                    ? 'text-emerald-100'
                    : 'text-white'
                }`}
              >
                {isTransmitting
                  ? isToggleMode
                    ? '🎙️ ROZMAWIASZ (KLIKNIJ ABY ZAKOŃCZYĆ)'
                    : 'NADAJESZ GŁOS...'
                  : isReceiving
                  ? 'ODBIERANIE GŁOSU...'
                  : isToggleMode
                  ? 'KLIKNIJ 1X ABY MÓWIĆ'
                  : 'TRZYMAJ ABY MÓWIĆ'}
              </span>

              <span
                className={`text-[11px] font-semibold mt-0.5 tracking-tight ${
                  isTransmitting
                    ? 'text-slate-900 font-bold'
                    : isReceiving
                    ? 'text-emerald-200'
                    : 'text-slate-400'
                }`}
              >
                {isTransmitting
                  ? isToggleMode
                    ? 'Kliknij ponownie, aby wyłączyć mikrofon'
                    : 'Puść przycisk, aby usłyszeć Roger Beep'
                  : isToggleMode
                  ? 'Tryb bez trzymania (Hands-Free). Kliknij raz aby zacząć mówić'
                  : 'Naciśnij i trzymaj (lub klawisz Spacja)'}
              </span>
            </div>
          </button>
        </div>

        {/* Footer info inside radio chassis */}
        <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                remotePeer ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
              }`}
            />
            <span className="truncate max-w-[170px]">
              {remotePeer ? remotePeer.name : 'Czeka na 2. telefon'}
            </span>
          </div>

          <button
            onClick={() => {
              setTempName(deviceName);
              setIsEditingName(true);
            }}
            className="text-[10px] text-amber-400/80 hover:text-amber-300 underline underline-offset-2"
          >
            Zmień nazwę
          </button>
        </div>
      </main>

      {/* Quick instructions strip at bottom */}
      <footer className="w-full max-w-md mt-2 text-center text-[11px] text-slate-500">
        <p>
          Tryb rozmowy: użyj przycisku <strong>„Tryb: 1-Klik”</strong> na radiu, aby rozmawiać bez trzymania przycisku.
        </p>
      </footer>

      {/* Channel Picker Modal */}
      {showChannelPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl border border-slate-700 bg-slate-900 p-5 shadow-2xl text-slate-100 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-base text-white">Wybierz kanał częstotliwości</h3>
              <button
                onClick={() => setShowChannelPicker(false)}
                className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-3 space-y-2 overflow-y-auto pr-1">
              {channels.map((ch) => {
                const isActive = ch.id === channel;
                return (
                  <button
                    key={ch.id}
                    onClick={() => {
                      changeChannel(ch.id);
                      setShowChannelPicker(false);
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-2xl border transition ${
                      isActive
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                        : 'bg-slate-950/60 border-slate-800 text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    <div>
                      <div className="font-black text-sm font-mono text-amber-400">{ch.name}</div>
                      <div className="text-xs text-slate-400 font-mono">
                        {ch.freq} • {ch.subcode}
                      </div>
                    </div>
                    {isActive && (
                      <CheckCircle2 className="w-5 h-5 text-amber-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Edit Device Name Modal */}
      {isEditingName && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <form
            onSubmit={handleSaveName}
            className="w-full max-w-sm rounded-3xl border border-slate-700 bg-slate-900 p-5 shadow-2xl text-slate-100"
          >
            <h3 className="font-bold text-base text-white mb-2">Twoja nazwa radiotelefonu</h3>
            <p className="text-xs text-slate-400 mb-3">
              Ta nazwa wyświetli się na ekranie drugiego smartfona po połączeniu.
            </p>
            <input
              type="text"
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              placeholder="np. Smartfon-1, Patrol Alfa"
              className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-amber-400 font-mono focus:outline-hidden focus:border-amber-500"
              maxLength={20}
              autoFocus
            />
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={() => setIsEditingName(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-700"
              >
                Anuluj
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl bg-amber-500 text-xs font-bold text-slate-950 hover:bg-amber-400"
              >
                Zapisz
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Instruction Guide Modal */}
      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl border border-slate-700 bg-slate-900 p-6 shadow-2xl text-slate-100 space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-800">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                <Info className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-white">Instrukcja Walkie-Talkie</h3>
            </div>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <div className="p-2.5 rounded-xl bg-slate-800/80">
                <h4 className="font-bold text-amber-400 mb-1">1. Tryby rozmowy (PTT vs Hands-Free)</h4>
                <p>
                  Przycisk <strong>„Tryb: 1-Klik”</strong> na radiu pozwala na przełączenie trybu rozmowy. W trybie 1-Klik wystarczy kliknąć przycisk raz, aby włączyć mikrofon i zacząć mówić (bez trzymania), a kliknąć ponownie aby zakończyć.
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-800/80">
                <h4 className="font-bold text-amber-400 mb-1">2. Połączenie 2 smartfonów</h4>
                <p>
                  Na telefonie 1 dotknij przycisku <strong>„Połącz 2 tel”</strong> i pokaż kod QR. Na telefonie 2 otwórz aparat lub kliknij link i dołącz do tego samego kanału radiowego.
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-800/80">
                <h4 className="font-bold text-amber-400 mb-1">3. Rozmowa PTT w czasie rzeczywistym</h4>
                <p>
                  Rozmawiaj bezpośrednio w jakości HD P2P bez opóźnień. Po zakończeniu nadawania rozlegnie się klasyczny sygnał „Roger Beep”.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowGuide(false)}
              className="w-full py-2.5 rounded-xl bg-amber-500 text-xs font-bold uppercase tracking-wider text-slate-950 hover:bg-amber-400 transition"
            >
              Rozumiem, zamknij
            </button>
          </div>
        </div>
      )}

      {/* Pairing / QR Code Modal */}
      <PairingModal
        isOpen={isPairingOpen}
        onClose={() => setIsPairingOpen(false)}
        channel={channel}
        peerId={peerId}
        onChannelSelect={(ch, targetPeerId) => {
          changeChannel(ch, targetPeerId);
          setIsPairingOpen(false);
        }}
        deviceName={deviceName}
      />

      {/* Offline Status Toast */}
      <OfflineIndicator />
    </div>
  );
}
