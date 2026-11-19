// SOLBAY — synthesized sound: WebAudio only, no audio files.
// Music is a mellow synthwave loop (pad + bass + hats), effects are one-shots.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.musicOn = false;
    this._musicTimer = null;
    this._engineOsc = null;
    this._engineGain = null;
  }
  ensure() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.5;
        this.master.connect(this.ctx.destination);
      } catch { this.ctx = null; }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }
  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }
  _tone(freq, dur, type = 'sine', vol = 0.2, slideTo = null, delay = 0) {
    if (!this.ensure() || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  _noise(dur, vol = 0.3, filterFreq = 1200, delay = 0) {
    if (!this.ensure() || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t0);
  }
  click() { this._tone(880, 0.07, 'square', 0.08); }
  pickup() { this._tone(660, 0.09, 'sine', 0.18); this._tone(990, 0.12, 'sine', 0.18, null, 0.08); }
  punch() { this._noise(0.12, 0.35, 500); }
  gunshot() { this._noise(0.16, 0.5, 2400); this._tone(180, 0.1, 'square', 0.2, 60); }
  crash() { this._noise(0.35, 0.5, 700); this._tone(90, 0.3, 'sawtooth', 0.25, 40); }
  sirenBlip() { this._tone(950, 0.16, 'square', 0.07, 1300); }
  missionDone() {
    [523, 659, 784, 1047].forEach((f, i) => this._tone(f, 0.22, 'triangle', 0.2, null, i * 0.11));
  }
  wantedUp() { this._tone(440, 0.2, 'sawtooth', 0.15, 330); this._tone(330, 0.25, 'sawtooth', 0.15, 220, 0.18); }
  busted() { this._tone(220, 0.5, 'sawtooth', 0.2, 110); this._tone(110, 0.8, 'sawtooth', 0.2, 55, 0.4); }
  startEngine(speed01) {
    if (!this.ensure() || this.muted) return;
    if (!this._engineOsc) {
      this._engineOsc = this.ctx.createOscillator();
      this._engineOsc.type = 'sawtooth';
      this._engineGain = this.ctx.createGain();
      this._engineGain.gain.value = 0.0;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 900;
      this._engineOsc.connect(f); f.connect(this._engineGain); this._engineGain.connect(this.master);
      this._engineOsc.start();
    }
    const target = speed01 > 0.01 ? 0.05 + speed01 * 0.06 : 0.0;
    this._engineOsc.frequency.setTargetAtTime(60 + speed01 * 140, this.ctx.currentTime, 0.1);
    this._engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
  }
  stopEngine() {
    if (this._engineGain) this._engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
  }
  startMusic() {
    if (!this.ensure() || this.musicOn) return;
    this.musicOn = true;
    // Am – F – C – G pad loop, 100 BPM, scheduled bar by bar
    const chords = [[220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7], [164.8, 196, 246.9]];
    const bass = [55, 43.65, 65.4, 49];
    let bar = 0;
    const barLen = 2.4;
    const scheduleBar = () => {
      if (!this.musicOn) return;
      const t0 = this.ctx.currentTime + 0.05;
      const ch = chords[bar % 4];
      for (const f of ch) {
        const o = this.ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(0.045, t0 + 0.4);
        g.gain.setValueAtTime(0.045, t0 + barLen - 0.5);
        g.gain.linearRampToValueAtTime(0.0001, t0 + barLen);
        o.connect(g); g.connect(this.master);
        o.start(t0); o.stop(t0 + barLen + 0.05);
      }
      const b = this.ctx.createOscillator(); b.type = 'sine'; b.frequency.value = bass[bar % 4];
      const bg = this.ctx.createGain();
      bg.gain.setValueAtTime(0.0001, t0);
      bg.gain.linearRampToValueAtTime(0.12, t0 + 0.1);
      bg.gain.linearRampToValueAtTime(0.0001, t0 + barLen);
      b.connect(bg); bg.connect(this.master);
      b.start(t0); b.stop(t0 + barLen + 0.05);
      bar++;
      this._musicTimer = setTimeout(scheduleBar, barLen * 1000 - 60);
    };
    scheduleBar();
  }
  stopMusic() { this.musicOn = false; if (this._musicTimer) clearTimeout(this._musicTimer); }
}
