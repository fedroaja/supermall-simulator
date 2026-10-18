// ============================================
// SUPERMALL SIMULATOR - Sound Manager (Web Audio API)
// ============================================

export class SoundManager {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.masterGain = null;
    this._initContext();
  }

  _initContext() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.4;
      this.masterGain.connect(this.ctx.destination);
    } catch (e) {
      console.warn('Web Audio not supported', e);
    }
  }

  _resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  _playOscillator(freq, type, duration, startTime, gain = 0.3, decayTime = null) {
    if (!this.ctx || !this.enabled) return;
    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();
    osc.connect(gainNode);
    gainNode.connect(this.masterGain);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    gainNode.gain.setValueAtTime(gain, startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + (decayTime || duration));
    osc.start(startTime);
    osc.stop(startTime + duration);
  }

  _noise(duration, startTime, gain = 0.1) {
    if (!this.ctx || !this.enabled) return;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(gain, startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;
    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.masterGain);
    source.start(startTime);
    source.stop(startTime + duration);
  }

  // ====== SOUND EFFECTS ======

  playBuild() {
    this._resume();
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    // Rising construction sound
    [261, 329, 392, 523].forEach((freq, i) => {
      this._playOscillator(freq, 'square', 0.12, t + i * 0.08, 0.15, 0.1);
    });
    this._noise(0.3, t, 0.06);
  }

  playCoin() {
    this._resume();
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    // Soft golden bell
    this._playOscillator(1047, 'sine', 0.4, t, 0.2, 0.35);
    this._playOscillator(1319, 'sine', 0.3, t + 0.05, 0.1, 0.25);
  }

  playRent() {
    this._resume();
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    // Happy jingle - tenant signing contract
    const notes = [523, 659, 784, 1047, 784, 1047];
    notes.forEach((freq, i) => {
      this._playOscillator(freq, 'sine', 0.15, t + i * 0.1, 0.2, 0.12);
    });
  }

  playUpgrade() {
    this._resume();
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    // Power-up arpeggio
    const notes = [261, 329, 392, 523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      this._playOscillator(freq, 'sawtooth', 0.1, t + i * 0.07, 0.25, 0.08);
    });
    // Sparkle
    this._playOscillator(2093, 'sine', 0.5, t + 0.3, 0.15, 0.4);
  }

  playDemolish() {
    this._resume();
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    // Thud + crumble
    this._noise(0.4, t, 0.25);
    this._playOscillator(80, 'sawtooth', 0.3, t, 0.3, 0.25);
    this._playOscillator(60, 'square', 0.4, t + 0.05, 0.2, 0.35);
  }

  playExpand() {
    this._resume();
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    // Whoosh + success
    this._noise(0.5, t, 0.15);
    [196, 247, 330, 392, 494, 659].forEach((freq, i) => {
      this._playOscillator(freq, 'sine', 0.2, t + i * 0.06, 0.2, 0.15);
    });
  }

  playLevelUp() {
    this._resume();
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    // Triumphant fanfare
    const melody = [523, 523, 523, 415, 523, 659, 784];
    melody.forEach((freq, i) => {
      this._playOscillator(freq, 'triangle', 0.25, t + i * 0.15, 0.4, 0.2);
      this._playOscillator(freq * 0.5, 'sine', 0.25, t + i * 0.15, 0.2, 0.2);
    });
    this._playOscillator(1047, 'sine', 0.8, t + melody.length * 0.15, 0.3, 0.7);
  }

  playClick() {
    this._resume();
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    this._playOscillator(800, 'square', 0.06, t, 0.1, 0.05);
  }

  playError() {
    this._resume();
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    this._playOscillator(200, 'sawtooth', 0.15, t, 0.2, 0.12);
    this._playOscillator(160, 'sawtooth', 0.15, t + 0.1, 0.2, 0.12);
  }

  playIncomeTick() {
    this._resume();
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    // Very subtle coin clink
    this._playOscillator(1200, 'sine', 0.08, t, 0.05, 0.07);
  }

  // ====== TOGGLE ======
  toggle() {
    this.enabled = !this.enabled;
    if (this.masterGain) {
      this.masterGain.gain.value = this.enabled ? 0.4 : 0;
    }
    return this.enabled;
  }

  setVolume(vol) {
    if (this.masterGain) this.masterGain.gain.value = vol * 0.4;
  }
}
