// Chiptune sounds and music, synthesised with the Web Audio API (no audio files).

import { persist, save } from '../save';

type Wave = OscillatorType;
type Track = 'search' | 'carry';

interface ToneOpts {
  type?: Wave;
  vol?: number;
  slideTo?: number;
  pan?: number;
  vibrato?: { rate: number; depth: number };
  filter?: number;
  dest?: AudioNode;
}

const SEMITONES: Record<string, number> = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };

function freq(note: string): number {
  const m = /^([A-G])(#?)(\d)$/.exec(note)!;
  const semis = SEMITONES[m[1]] + (m[2] ? 1 : 0) + (Number(m[3]) - 4) * 12;
  return 440 * 2 ** (semis / 12);
}

const _ = null;
const TRACKS: Record<Track, { step: number; melody: (string | null)[]; bass: string[]; lead: Wave; leadVol: number }> = {
  // Searching: slow, A minor pentatonic, a bit lonely.
  search: {
    step: 0.375,
    lead: 'triangle',
    leadVol: 0.11,
    melody: [
      'A4', _, _, 'C5', _, 'E5', _, _, 'D5', _, 'C5', _, 'A4', _, _, _,
      'G4', _, _, 'A4', _, 'C5', _, _, 'E5', _, 'D5', _, 'C5', _, _, _,
    ],
    bass: ['A2', 'F2', 'C3', 'E2'],
  },
  // Carrying the sheep home: brighter and quicker, although the way is harder.
  carry: {
    step: 0.27,
    lead: 'square',
    leadVol: 0.05,
    melody: [
      'C5', 'E5', 'G5', 'E5', 'F5', 'A5', 'G5', 'E5', 'D5', 'F5', 'E5', 'C5', 'D5', _, 'G4', _,
      'C5', 'E5', 'G5', 'C6', 'A5', 'G5', 'F5', 'E5', 'D5', 'E5', 'F5', 'D5', 'C5', _, _, _,
    ],
    bass: ['C3', 'F2', 'G2', 'C3'],
  },
};

class Sound {
  private ctx?: AudioContext;
  private master?: GainNode;
  private musicBus?: GainNode;
  private track: Track | null = null;
  private step = 0;
  private nextTime = 0;
  private timer?: number;

  get muted() {
    return save.settings.muted;
  }

  /** Must be called from a user gesture (tap or key) before sound can play. */
  unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.9;
      this.master.connect(this.ctx.destination);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = 0.55;
      this.musicBus.connect(this.master);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setMuted(muted: boolean) {
    save.settings.muted = muted;
    persist();
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : 0.9, this.ctx.currentTime, 0.02);
  }

  private tone(f: number, at: number, dur: number, o: ToneOpts = {}) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = o.type ?? 'square';
    osc.frequency.setValueAtTime(f, at);
    if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(o.slideTo, at + dur);
    if (o.vibrato) {
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = o.vibrato.rate;
      depth.gain.value = o.vibrato.depth;
      lfo.connect(depth).connect(osc.frequency);
      lfo.start(at);
      lfo.stop(at + dur + 0.05);
    }
    const vol = o.vol ?? 0.1;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(vol, at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    let node: AudioNode = osc.connect(gain);
    if (o.filter) {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = o.filter;
      bp.Q.value = 1.2;
      node = node.connect(bp);
    }
    if (o.pan !== undefined && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, o.pan));
      node = node.connect(p);
    }
    node.connect(o.dest ?? this.master);
    osc.start(at);
    osc.stop(at + dur + 0.05);
  }

  private noise(at: number, dur: number, vol: number, cutoff: number) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = cutoff;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(lp).connect(gain).connect(this.master);
    src.start(at);
  }

  private get now() {
    return this.ctx?.currentTime ?? 0;
  }

  jump() {
    this.tone(300, this.now, 0.12, { vol: 0.06, slideTo: 620 });
  }

  collect() {
    ['G5', 'B5', 'D6', 'G6'].forEach((n, i) => this.tone(freq(n), this.now + i * 0.06, 0.16, { type: 'triangle', vol: 0.16 }));
  }

  /** "Mäh": pan -1..1 tells the direction, vol the distance. */
  bleat(pan = 0, vol = 0.18) {
    const t = this.now;
    const o = { type: 'sawtooth' as Wave, vol, pan, filter: 1300, vibrato: { rate: 26, depth: 22 } };
    this.tone(520, t, 0.22, { ...o, slideTo: 500 });
    this.tone(500, t + 0.2, 0.32, { ...o, slideTo: 380 });
  }

  hurt() {
    this.noise(this.now, 0.25, 0.25, 900);
    this.tone(240, this.now, 0.3, { vol: 0.08, slideTo: 70 });
  }

  rest() {
    [880, 1320, 1760].forEach((f, i) => this.tone(f, this.now + i * 0.09, 0.9, { type: 'sine', vol: 0.09 }));
  }

  gate() {
    this.noise(this.now, 0.35, 0.18, 500);
    this.tone(110, this.now, 0.4, { type: 'sawtooth', vol: 0.05, slideTo: 70 });
    this.tone(300, this.now + 0.3, 0.5, { type: 'triangle', vol: 0.08, slideTo: 600 });
  }

  pickup() {
    ['C5', 'E5', 'G5', 'C6', 'E6'].forEach((n, i) => this.tone(freq(n), this.now + i * 0.07, 0.2, { type: 'triangle', vol: 0.15 }));
    setTimeout(() => this.bleat(0, 0.16), 420);
  }

  fanfare() {
    const notes = ['G4', 'C5', 'E5', 'G5', _, 'E5', 'G5', 'C6'];
    notes.forEach((n, i) => {
      if (n) this.tone(freq(n), this.now + i * 0.14, i === notes.length - 1 ? 0.9 : 0.16, { vol: 0.08 });
      if (n) this.tone(freq(n) / 2, this.now + i * 0.14, 0.16, { type: 'triangle', vol: 0.1 });
    });
  }

  music(track: Track | null) {
    if (track === this.track) return;
    this.track = track;
    this.step = 0;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    if (!track || !this.ctx) return;
    this.nextTime = this.now + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 50);
  }

  private schedule() {
    if (!this.track || !this.ctx) return;
    const t = TRACKS[this.track];
    while (this.nextTime < this.now + 0.2) {
      const i = this.step % t.melody.length;
      const note = t.melody[i];
      if (note) this.tone(freq(note), this.nextTime, t.step * 1.6, { type: t.lead, vol: t.leadVol, dest: this.musicBus });
      if (i % 8 === 0) {
        const bass = t.bass[(i / 8) % t.bass.length];
        this.tone(freq(bass), this.nextTime, t.step * 7.5, { type: 'triangle', vol: 0.13, dest: this.musicBus });
      }
      if (this.track === 'carry' && i % 2 === 0) {
        this.tone(freq(t.bass[Math.floor(i / 8) % t.bass.length]) * 2, this.nextTime, t.step * 0.8, {
          type: 'triangle',
          vol: 0.05,
          dest: this.musicBus,
        });
      }
      this.nextTime += t.step;
      this.step++;
    }
  }
}

export const sound = new Sound();
