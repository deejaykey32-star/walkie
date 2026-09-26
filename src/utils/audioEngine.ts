/**
 * Synthesizer for authentic Walkie-Talkie radio effects
 * Uses Web Audio API (no external sound files required)
 */

class AudioEngine {
  private ctx: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private micAnalyser: AnalyserNode | null = null;
  private remoteAnalyser: AnalyserNode | null = null;
  private micDataArray: Uint8Array<ArrayBuffer> | null = null;
  private remoteDataArray: Uint8Array<ArrayBuffer> | null = null;
  public rogerBeepEnabled = true;

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  /**
   * Sound effect when PTT button is pressed (Mic open squelch burst + radio chirp)
   */
  public playPttStart() {
    try {
      const ctx = this.initContext();
      const now = ctx.currentTime;

      // 1. Noise burst (Squelch open, 25ms)
      const bufferSize = Math.floor(ctx.sampleRate * 0.03);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.5));
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      // Bandpass filter for radio static crunch
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1800;
      filter.Q.value = 3.0;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.03);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start(now);

      // 2. High-pitch radio chirp (40ms)
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1450, now);
      osc.frequency.exponentialRampToValueAtTime(1850, now + 0.04);

      oscGain.gain.setValueAtTime(0.12, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(oscGain);
      oscGain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.04);
    } catch (e) {
      console.warn('Audio playPttStart error:', e);
    }
  }

  /**
   * Classic radio Roger Beep (PTT release tone)
   */
  public playRogerBeep() {
    if (!this.rogerBeepEnabled) return;
    try {
      const ctx = this.initContext();
      const now = ctx.currentTime;

      // Tone 1: 1050 Hz (classic Motorola/PMR446 tone)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(1050, now);

      gain1.gain.setValueAtTime(0.18, now);
      gain1.gain.setValueAtTime(0.18, now + 0.07);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.08);

      // Tone 2: Squelch click tail at the end
      const bufferSize = Math.floor(ctx.sampleRate * 0.04);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.4));
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.15, now + 0.08);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      noise.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noise.start(now + 0.08);
    } catch (e) {
      console.warn('Audio playRogerBeep error:', e);
    }
  }

  /**
   * Rotary switch tactile click sound
   */
  public playKnobClick() {
    try {
      const ctx = this.initContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(450, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.02);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.02);
    } catch (e) {
      console.warn('Audio playKnobClick error:', e);
    }
  }

  /**
   * Radio call tone / Alert siren to buzz the other handset
   */
  public playCallAlert() {
    try {
      const ctx = this.initContext();
      const now = ctx.currentTime;

      // 4 rapid dual-frequency beeps (1750 Hz / 1200 Hz repeater tone)
      for (let i = 0; i < 4; i++) {
        const start = now + i * 0.12;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(i % 2 === 0 ? 1750 : 1350, start);

        gain.gain.setValueAtTime(0.15, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.09);

        // Lowpass to mellow square wave
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 2500;

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.09);
      }
    } catch (e) {
      console.warn('Audio playCallAlert error:', e);
    }
  }

  /**
   * Attach microphone MediaStream for level metering
   */
  public setupMicAnalyser(stream: MediaStream) {
    try {
      const ctx = this.initContext();
      this.micStream = stream;
      const source = ctx.createMediaStreamSource(stream);
      this.micAnalyser = ctx.createAnalyser();
      this.micAnalyser.fftSize = 64;
      this.micAnalyser.smoothingTimeConstant = 0.5;
      source.connect(this.micAnalyser);
      this.micDataArray = new Uint8Array(new ArrayBuffer(this.micAnalyser.frequencyBinCount));
    } catch (e) {
      console.warn('setupMicAnalyser error:', e);
    }
  }

  /**
   * Attach remote incoming stream for level metering
   */
  public setupRemoteAnalyser(stream: MediaStream) {
    try {
      const ctx = this.initContext();
      const source = ctx.createMediaStreamSource(stream);
      this.remoteAnalyser = ctx.createAnalyser();
      this.remoteAnalyser.fftSize = 64;
      this.remoteAnalyser.smoothingTimeConstant = 0.5;
      source.connect(this.remoteAnalyser);
      this.remoteDataArray = new Uint8Array(new ArrayBuffer(this.remoteAnalyser.frequencyBinCount));
    } catch (e) {
      console.warn('setupRemoteAnalyser error:', e);
    }
  }

  /**
   * Get current volume level (0 to 100) for TX (local mic)
   */
  public getMicVolume(): number {
    if (!this.micAnalyser || !this.micDataArray) return 0;
    this.micAnalyser.getByteFrequencyData(this.micDataArray);
    let sum = 0;
    for (let i = 0; i < this.micDataArray.length; i++) {
      sum += this.micDataArray[i];
    }
    const avg = sum / this.micDataArray.length;
    return Math.min(100, Math.round((avg / 128) * 100));
  }

  /**
   * Get current volume level (0 to 100) for RX (incoming audio)
   */
  public getRemoteVolume(): number {
    if (!this.remoteAnalyser || !this.remoteDataArray) return 0;
    this.remoteAnalyser.getByteFrequencyData(this.remoteDataArray);
    let sum = 0;
    for (let i = 0; i < this.remoteDataArray.length; i++) {
      sum += this.remoteDataArray[i];
    }
    const avg = sum / this.remoteDataArray.length;
    return Math.min(100, Math.round((avg / 128) * 100));
  }
}

export const audioEngine = new AudioEngine();
