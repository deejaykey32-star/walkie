/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Radio,
  RadioTower,
  HelpCircle,
  Wifi,
  Sparkles,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Edit2,
  X,
} from 'lucide-react';
import { useWalkieTalkie } from './hooks/useWalkieTalkie';
import { AudioEqualizer } from './components/AudioEqualizer';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';

export default function App() {
  const {
    peerId,
    deviceName,
    connectionStatus,
    connectionError,
    isP2PDirect,
    remotePeer,
    micAllowed,
    micError,
    txLevel,
    rxLevel,
    volume,
    setVolume,
    isMicMuted,
    setIsMicMuted,
    isSpeakerMuted,
    setIsSpeakerMuted,
    audioActivated,
    activateAudio,
    initMicrophone,
    updateDeviceName,
  } = useWalkieTalkie();

  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(deviceName);
  const [showGuide, setShowGuide] = useState(false);

  // Resume AudioContext on any user click on the document
  useEffect(() => {
    const handleGlobalClick = () => {
      if (!audioActivated) {
        activateAudio();
      }
    };
    window.addEventListener('click', handleGlobalClick);
    window.addEventListener('touchstart', handleGlobalClick);
    return () => {
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('touchstart', handleGlobalClick);
    };
  }, [audioActivated, activateAudio]);

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    updateDeviceName(tempName);
    setIsEditingName(false);
  };

  const isPaired = connectionStatus === 'paired' && remotePeer !== null;

  return (
    <div className="min-h-screen w-full bg-[#080a0f] text-slate-100 flex flex-col items-center justify-between p-3 sm:p-6 font-sans select-none overflow-x-hidden">
      <OfflineIndicator />

      {/* Header Bar */}
      <header className="w-full max-w-md flex items-center justify-between py-2 px-1 mb-2">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <RadioTower className="w-6 h-6 text-emerald-400" />
            <span
              className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ${
                isPaired
                  ? 'bg-emerald-500 animate-ping'
                  : connectionStatus === 'connecting'
                  ? 'bg-amber-400 animate-pulse'
                  : 'bg-emerald-400'
              }`}
            />
          </div>
          <div>
            <h1 className="text-xs font-black tracking-widest uppercase text-white flex items-center gap-1.5 font-mono">
              <span>ZAWSTAWEK P2P</span>
              <span className="text-[10px] px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded font-sans font-bold">
                BEZPRZERWOWY
              </span>
            </h1>
            <p className="text-[11px] text-slate-400 flex items-center gap-1">
              <span>{deviceName}</span>
              <button
                onClick={() => {
                  setTempName(deviceName);
                  setIsEditingName(true);
                }}
                className="text-amber-400 hover:text-amber-300 p-0.5"
                title="Zmień nazwę urządzenia"
              >
                <Edit2 className="w-3 h-3" />
              </button>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <PWAInstallButton />
          <button
            onClick={() => setShowGuide(true)}
            className="p-2 rounded-xl border border-slate-700 bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700 transition"
            title="Informacje"
          >
            <HelpCircle className="w-4.5 h-4.5" />
          </button>
        </div>
      </header>

      {/* Main Container Card */}
      <main className="w-full max-w-[420px] relative flex flex-col rounded-3xl bg-gradient-to-b from-[#141a24] via-[#0d121a] to-[#080b10] p-5 sm:p-6 shadow-2xl border-2 border-slate-700/60 my-auto">
        {/* Connection Status Banner */}
        <div className="mb-4">
          <div
            className={`w-full p-4 rounded-2xl border-2 flex items-center justify-between transition-all duration-300 ${
              isPaired
                ? 'bg-emerald-950/40 border-emerald-500/60 shadow-[0_0_30px_rgba(16,185,129,0.15)] text-emerald-200'
                : 'bg-amber-950/30 border-amber-500/50 text-amber-200 shadow-[0_0_20px_rgba(245,158,11,0.1)]'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`p-3 rounded-xl ${
                  isPaired
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse'
                }`}
              >
                <Wifi className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-black uppercase tracking-wider font-mono">
                  {isPaired ? 'POŁĄCZENIE AKTYWNE 24/7' : 'SZUKAM DRUGIEGO TELEFONU...'}
                </div>
                <div className="text-[11px] opacity-90 font-medium mt-0.5">
                  {isPaired ? (
                    <span className="text-emerald-300">
                      Sparowano z: <strong className="text-white">{remotePeer.name}</strong>
                    </span>
                  ) : (
                    <span className="text-amber-300">
                      Otwórz tę samą stronę na 2. telefonie — połączenie nawiąże się samo!
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Audio Activation Alert Banner (If user gesture needed or mic not allowed) */}
        {!audioActivated || micAllowed === false || micError ? (
          <div className="mb-4 p-4 rounded-2xl bg-amber-500/10 border-2 border-amber-500/60 text-amber-200 flex flex-col gap-2 shadow-lg">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400 shrink-0 animate-bounce" />
              <div className="text-xs font-bold">
                {micError || 'Dotknij przycisk poniżej, aby aktywować mikrofon i linię audio'}
              </div>
            </div>
            <button
              onClick={() => {
                activateAudio();
                initMicrophone();
              }}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black uppercase text-xs tracking-wider rounded-xl shadow-md transition active:scale-95 flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4 fill-current" />
              WŁĄCZ INTERKOM I MIKROFON NOW
            </button>
          </div>
        ) : null}

        {/* Live Audio Spectrum Equalizer */}
        <div className="mb-4">
          <AudioEqualizer
            isReceiving={rxLevel > 5 && !isSpeakerMuted}
            isTransmitting={txLevel > 5 && !isMicMuted}
            backlightColor={isPaired ? 'emerald' : 'amber'}
          />
        </div>

        {/* Voice Indicators & Volume Levels */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {/* Local Microphone status */}
          <div
            className={`p-3.5 rounded-2xl border-2 transition flex flex-col justify-between ${
              isMicMuted
                ? 'bg-red-950/20 border-red-800/60 text-red-300'
                : txLevel > 10
                ? 'bg-emerald-950/30 border-emerald-500/60 text-emerald-200'
                : 'bg-slate-900/60 border-slate-800 text-slate-300'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider mb-2">
              <span className="flex items-center gap-1.5">
                {isMicMuted ? (
                  <MicOff className="w-4 h-4 text-red-400" />
                ) : (
                  <Mic className="w-4 h-4 text-emerald-400" />
                )}
                MÓJ MIKROFON
              </span>
              <span className="text-[10px] font-mono opacity-80">
                {isMicMuted ? 'WYCISZONY' : `${txLevel}%`}
              </span>
            </div>

            {/* Level bar */}
            <div className="h-2.5 w-full bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800 my-1">
              <div
                className={`h-full rounded-full transition-all duration-75 ${
                  isMicMuted
                    ? 'bg-red-600'
                    : txLevel > 75
                    ? 'bg-red-500'
                    : txLevel > 40
                    ? 'bg-amber-400'
                    : 'bg-emerald-400'
                }`}
                style={{ width: `${isMicMuted ? 0 : txLevel}%` }}
              />
            </div>

            <button
              onClick={() => setIsMicMuted(!isMicMuted)}
              className={`mt-2 w-full py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition active:scale-95 flex items-center justify-center gap-1.5 border ${
                isMicMuted
                  ? 'bg-red-600 border-red-400 text-white shadow-md'
                  : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
              }`}
            >
              {isMicMuted ? (
                <>
                  <MicOff className="w-3.5 h-3.5" /> ODCISZ MIC
                </>
              ) : (
                <>
                  <Mic className="w-3.5 h-3.5" /> WYCISZ MIC
                </>
              )}
            </button>
          </div>

          {/* Remote Speaker Status */}
          <div
            className={`p-3.5 rounded-2xl border-2 transition flex flex-col justify-between ${
              isSpeakerMuted
                ? 'bg-red-950/20 border-red-800/60 text-red-300'
                : rxLevel > 10
                ? 'bg-emerald-950/30 border-emerald-500/60 text-emerald-200'
                : 'bg-slate-900/60 border-slate-800 text-slate-300'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider mb-2">
              <span className="flex items-center gap-1.5">
                {isSpeakerMuted ? (
                  <VolumeX className="w-4 h-4 text-red-400" />
                ) : (
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                )}
                GŁOŚNIK
              </span>
              <span className="text-[10px] font-mono opacity-80">
                {isSpeakerMuted ? 'WYCISZONY' : `${volume}%`}
              </span>
            </div>

            {/* Level bar */}
            <div className="h-2.5 w-full bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800 my-1">
              <div
                className={`h-full rounded-full transition-all duration-75 ${
                  isSpeakerMuted
                    ? 'bg-red-600'
                    : rxLevel > 75
                    ? 'bg-red-500'
                    : rxLevel > 40
                    ? 'bg-amber-400'
                    : 'bg-emerald-400'
                }`}
                style={{ width: `${isSpeakerMuted ? 0 : rxLevel}%` }}
              />
            </div>

            <button
              onClick={() => setIsSpeakerMuted(!isSpeakerMuted)}
              className={`mt-2 w-full py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition active:scale-95 flex items-center justify-center gap-1.5 border ${
                isSpeakerMuted
                  ? 'bg-red-600 border-red-400 text-white shadow-md'
                  : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
              }`}
            >
              {isSpeakerMuted ? (
                <>
                  <VolumeX className="w-3.5 h-3.5" /> ODCISZ DŹWIĘK
                </>
              ) : (
                <>
                  <Volume2 className="w-3.5 h-3.5" /> WYCISZ DŹWIĘK
                </>
              )}
            </button>
          </div>
        </div>

        {/* Master Volume Slider */}
        <div className="p-3.5 rounded-2xl bg-black/50 border border-slate-800 mb-3 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-300">
            <span className="flex items-center gap-1.5">
              <Volume2 className="w-4 h-4 text-emerald-400" /> GŁOŚNOŚĆ ODBIORU:
            </span>
            <span className="font-mono text-emerald-400 font-black">{volume}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="w-full h-2.5 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-emerald-400"
          />
        </div>

        {/* Live Audio Info Footer */}
        <div className="mt-2 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${isPaired ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
            <span>{isPaired ? 'Połączono w czasie rzeczywistym' : 'Oczekiwanie na drugie urządzenie'}</span>
          </div>

          <div className="font-mono text-[10px] text-slate-500">PEER: {peerId}</div>
        </div>
      </main>

      {/* Footer Info */}
      <footer className="w-full max-w-md mt-3 text-center text-[11px] text-slate-500">
        Połączenie automatyczne i stałe — brak przycisków nadawania, bez podawania kodów czy kanałów.
      </footer>

      {/* Edit Device Name Modal */}
      {isEditingName && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4">
          <form
            onSubmit={handleSaveName}
            className="w-full max-w-sm rounded-3xl border border-slate-700 bg-slate-900 p-5 shadow-2xl text-slate-100"
          >
            <h3 className="font-bold text-base text-white mb-1">Nazwa Twojego Urządzenia</h3>
            <p className="text-xs text-slate-400 mb-4">
              Ta nazwa wyświetli się na ekranie drugiego smartfona po połączeniu.
            </p>
            <input
              type="text"
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              placeholder="np. Telefon 1, Patrol Alfa"
              className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-emerald-400 font-mono focus:outline-hidden focus:border-emerald-500"
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
                className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-xs font-bold text-slate-950 hover:bg-emerald-400"
              >
                Zapisz
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Instructions Guide Modal */}
      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="w-full max-w-sm rounded-3xl border border-slate-700 bg-slate-900 p-5 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-base text-white">Jak to działa?</h3>
              <button
                onClick={() => setShowGuide(false)}
                className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-4 space-y-3 text-xs text-slate-300">
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                <strong className="text-emerald-400 block mb-1">1. Pełna Automatyzacja:</strong>
                Wystarczy otworzyć aplikację na dwóch urządzeniach (np. dwóch telefonach). Urządzenia połączą się automatycznie bez wpisywania kodów, weryfikacji czy wybierania kanałów.
              </div>
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                <strong className="text-emerald-400 block mb-1">2. Stale Otwarte Audio (Hot-Mic):</strong>
                Głos jest przesyłany w czasie rzeczywistym w obu kierunkach bez wciskania jakichkolwiek przycisków.
              </div>
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                <strong className="text-emerald-400 block mb-1">3. Wyciszanie:</strong>
                Możesz w każdej chwili tymczasowo wyciszyć swój mikrofon lub głośnik przyciskami w aplikacji.
              </div>
            </div>

            <button
              onClick={() => setShowGuide(false)}
              className="w-full py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold uppercase text-xs hover:bg-emerald-400 transition"
            >
              Rozumiem
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
