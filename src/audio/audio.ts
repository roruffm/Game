// Audio Engine: slow, breathing pads (more voices as the world grows), a wind-and-water
// layer for the storm, and soft bell tones for discoveries. All synthesised with the Web Audio
// API; nothing plays before the player's first tap or click.

export type Mood = 'world' | 'storm' | 'calm' | 'far' | 'home' | 'path' | 'reveal';

const CHORDS: Record<Mood, number[]> = {
  // D with a raised fourth: open, floating
  world: [73.42, 110, 146.83, 185, 220, 277.18, 329.63, 440],
  storm: [65.41, 98, 116.54, 155.56, 196, 233.08],
  calm: [146.83, 220, 293.66, 369.99, 440, 554.37],
  far: [110, 130.81, 164.81, 246.94, 329.63],
  home: [87.31, 130.81, 174.61, 220, 261.63, 329.63, 392],
  path: [82.41, 123.47, 164.81, 196, 246.94],
  reveal: [146.83, 220, 293.66, 369.99, 440, 554.37, 659.25],
};
const BRIGHTNESS: Record<Mood, number> = { world: 1100, storm: 520, calm: 2600, far: 600, home: 2100, path: 950, reveal: 3200 };
const BELLS = [587.33, 659.25, 739.99, 880, 987.77, 1174.66, 1318.51];

interface Voice {
  oscA: OscillatorNode;
  oscB: OscillatorNode;
  gain: GainNode;
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private music!: GainNode;
  private filter!: BiquadFilterNode;
  private fx!: GainNode;
  private voices: Voice[] = [];
  private storm!: { gain: GainNode; band: BiquadFilterNode };
  private mood: Mood = 'world';
  private richness = 0;
  enabled = true;
  volume = 0.7;

  /** Must run inside a user gesture. Safe to call often. */
  unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.build(this.ctx);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private build(ctx: AudioContext) {
    this.master = ctx.createGain();
    this.master.gain.value = this.enabled ? this.volume : 0;
    this.master.connect(ctx.destination);

    // a feedback delay gives every sound some space
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.34;
    const fb = ctx.createGain();
    fb.gain.value = 0.38;
    const damp = ctx.createBiquadFilter();
    damp.type = 'lowpass';
    damp.frequency.value = 2400;
    this.fx = ctx.createGain();
    this.fx.gain.value = 0.35;
    this.fx.connect(delay);
    delay.connect(damp).connect(fb).connect(delay);
    damp.connect(this.master);

    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = BRIGHTNESS.world;
    this.filter.Q.value = 0.4;
    this.music = ctx.createGain();
    this.music.gain.value = 0.9;
    this.filter.connect(this.music).connect(this.master);
    this.music.connect(this.fx);

    for (let i = 0; i < 8; i++) {
      const gain = ctx.createGain();
      gain.gain.value = 0;
      const oscA = ctx.createOscillator();
      const oscB = ctx.createOscillator();
      oscA.type = 'sine';
      oscB.type = 'triangle';
      oscB.detune.value = 6 + i;
      oscA.connect(gain);
      oscB.connect(gain);
      gain.connect(this.filter);
      // each voice breathes at its own slow pace
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = 0.03 + i * 0.011;
      depth.gain.value = 0.012;
      lfo.connect(depth).connect(gain.gain);
      oscA.start();
      oscB.start();
      lfo.start();
      this.voices.push({ oscA, oscB, gain });
    }

    // wind and water: looping noise through a moving band-pass filter
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let brown = 0;
    for (let i = 0; i < len; i++) {
      brown = (brown + (Math.random() * 2 - 1) * 0.08) * 0.985;
      data[i] = brown * 3 + (Math.random() * 2 - 1) * 0.2;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 500;
    band.Q.value = 0.7;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = 0.13;
    depth.gain.value = 320;
    lfo.connect(depth).connect(band.frequency);
    src.connect(band).connect(gain).connect(this.master);
    src.start();
    lfo.start();
    this.storm = { gain, band };
    this.applyMood(0.1);
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (on) this.unlock();
    if (this.ctx) this.master.gain.setTargetAtTime(on ? this.volume : 0, this.ctx.currentTime, 0.2);
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.ctx && this.enabled) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1);
  }

  setRichness(r: number) {
    this.richness = r;
    if (this.mood === 'world') this.applyMood(3);
  }

  setMood(mood: Mood, seconds = 3) {
    this.mood = mood;
    this.applyMood(seconds);
  }

  /** 0–1: how loud the storm layer is. */
  setStorm(amount: number, seconds = 1.5) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.storm.gain.gain.setTargetAtTime(amount * 0.28, t, seconds / 3);
    this.storm.band.Q.setTargetAtTime(0.5 + amount, t, seconds / 3);
  }

  private applyMood(seconds: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const chord = CHORDS[this.mood];
    const active = this.mood === 'world' ? 3 + Math.round(this.richness * 5) : chord.length;
    this.voices.forEach((v, i) => {
      const f = chord[i % chord.length] * (i >= chord.length ? 2 : 1);
      v.oscA.frequency.setTargetAtTime(f, t, seconds / 3);
      v.oscB.frequency.setTargetAtTime(f * (this.mood === 'storm' ? 1.003 : 2), t, seconds / 3);
      const level = i < active ? 0.05 / (1 + i * 0.18) : 0;
      v.gain.gain.setTargetAtTime(level, t, seconds / 2);
    });
    const bright = BRIGHTNESS[this.mood] + (this.mood === 'world' ? this.richness * 1800 : 0);
    this.filter.frequency.setTargetAtTime(bright, t, seconds / 2);
  }

  /** A soft bell. */
  chime(kind: 'near' | 'discover' | 'thread' | 'enter' | 'beat' | 'reveal') {
    if (!this.ctx || !this.enabled) return;
    const steps: Record<typeof kind, number[]> = {
      near: [5],
      beat: [3],
      thread: [2, 4],
      discover: [0, 2, 4],
      enter: [0, 4, 6],
      reveal: [0, 2, 4, 6, 5],
    };
    steps[kind].forEach((n, i) => this.bell(BELLS[n % BELLS.length] * (kind === 'enter' ? 0.5 : 1), i * 0.16, kind === 'near' ? 0.04 : 0.07));
  }

  /** A soft note for each word caught on a ride, climbing a little with every one. */
  pluck(step: number) {
    if (!this.ctx || !this.enabled) return;
    const scale = [0, 1, 2, 4, 5];
    const octave = Math.floor(step / scale.length) % 2;
    this.bell(BELLS[scale[step % scale.length]] * (octave ? 2 : 1), 0, 0.03);
  }

  private bell(freq: number, delay: number, level: number) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(level, t + 0.02);
    out.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
    out.connect(this.master);
    out.connect(this.fx);
    for (const [mult, amp] of [
      [1, 1],
      [2.76, 0.25],
      [5.4, 0.08],
    ]) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = freq * mult;
      g.gain.value = amp;
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + 2.5);
    }
  }
}

export const audio = new AudioEngine();
