// Audio Engine: real music, played quietly. Calm instrumental worship pieces for piano (see
// tracks.ts) accompany the world and each encounter and cross-fade when the scene changes; the
// moods of an encounter only colour them. The game's small sounds are soft piano notes in the key
// of the piece that is playing, so they join the music rather than sound over it. A wind-and-water
// layer belongs to the storm. Nothing plays before the player's first tap or click.

import { nextTrack, TREATMENT, trackById, type Mood, type Scene, type Track } from './tracks';

export type { Mood, Scene } from './tracks';
export type ChimeKind = 'near' | 'discover' | 'thread' | 'enter' | 'beat' | 'reveal' | 'grow';

const MUSIC_DIR = `${import.meta.env.BASE_URL}music/`;
/** Seconds over which one piece fades into the next. */
const CROSSFADE = 3.5;
/** The music sits below the game; the volume setting scales everything. */
const MUSIC_LEVEL = 0.55;
/** Used when nothing plays yet: G major pentatonic. */
const DEFAULT_SCALE = [67, 69, 71, 74, 76];

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

interface Deck {
  el: HTMLAudioElement;
  gain: GainNode;
  track: Track | null;
}

export class AudioEngine {
  private ctx: BaseAudioContext | null = null;
  private master!: GainNode;
  /** Where the music enters: the mood's loudness, then its tone. */
  musicIn!: GainNode;
  private tone!: BiquadFilterNode;
  private notes!: GainNode;
  private piano!: PeriodicWave;
  private storm!: { gain: GainNode; band: BiquadFilterNode };
  private decks: Deck[] = [];
  private active = 0;
  private scene: Scene = 'world';
  private mood: Mood = 'world';
  /** The piece of the world that played last, so the world continues with the other one. */
  private lastWorld: string | null = null;
  private richness = 0;
  /** The piece whose key the small sounds follow. */
  current: Track | null = null;
  enabled = true;
  volume = 0.7;

  /** Must run inside a user gesture. Safe to call often. */
  unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      this.attach(new Ctx());
      window.setInterval(() => this.watch(), 400);
      document.addEventListener('visibilitychange', () => this.onVisibility());
    }
    const ctx = this.ctx as AudioContext;
    if (ctx.state === 'suspended') void ctx.resume();
    if (!this.enabled) return;
    // the music files load only once sound is on
    if (!this.decks.length) this.createDecks(ctx);
    this.ensureMusic();
  }

  /** Two players, so one piece can fade into the next. Called inside a tap or click. */
  private createDecks(ctx: AudioContext) {
    const first = nextTrack(this.scene, this.scene === 'world' ? this.lastWorld : null);
    for (let i = 0; i < 2; i++) {
      const el = new Audio();
      el.preload = 'auto';
      const gain = ctx.createGain();
      gain.gain.value = 0;
      ctx.createMediaElementSource(el).connect(gain).connect(this.musicIn);
      const deck: Deck = { el, gain, track: null };
      this.decks.push(deck);
      // where a direct link to the file is refused, load it as data instead
      el.addEventListener('error', () => void this.reload(deck));
      // some browsers let an element play only if it first started inside a tap or click
      el.src = MUSIC_DIR + first.file;
      void el
        .play()
        .then(() => {
          if (!deck.track) el.pause();
        })
        .catch(() => undefined);
    }
  }

  /** Builds the sound graph on a context (an OfflineAudioContext works too, for listening tests). */
  attach(ctx: BaseAudioContext) {
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.enabled ? this.volume : 0;
    this.master.connect(ctx.destination);

    this.tone = ctx.createBiquadFilter();
    this.tone.type = 'lowpass';
    this.tone.Q.value = 0.3;
    this.tone.frequency.value = TREATMENT.world.cutoff;
    this.musicIn = ctx.createGain();
    this.musicIn.gain.value = MUSIC_LEVEL * TREATMENT.world.gain;
    this.musicIn.connect(this.tone).connect(this.master);

    // the small sounds get a little room, so they blend with the recording
    const room = ctx.createConvolver();
    room.buffer = this.room(ctx, 2);
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    room.connect(wet).connect(this.master);
    this.notes = ctx.createGain();
    this.notes.connect(this.master);
    this.notes.connect(room);
    this.piano = ctx.createPeriodicWave(new Float32Array(7), new Float32Array([0, 1, 0.45, 0.2, 0.09, 0.04, 0.02]));

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
  }

  /** A short stereo impulse response: soft reflections that fade within a moment. */
  private room(ctx: BaseAudioContext, seconds: number) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const k = i / len;
        lp += (Math.random() * 2 - 1 - lp) * (0.5 - 0.42 * k);
        d[i] = lp * Math.pow(1 - k, 3);
      }
    }
    return buf;
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (on) this.unlock();
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(on ? this.volume : 0, this.ctx.currentTime, 0.2);
    const deck = this.decks[this.active];
    if (!on) for (const d of this.decks) d.el.pause();
    else if (deck?.track) void deck.el.play().catch(() => undefined);
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.ctx && this.enabled) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1);
  }

  /** 0 at the start, 1 for a world full of light: the small sounds become a little brighter. */
  setRichness(r: number) {
    this.richness = r;
  }

  /** Changes the music to the pieces of a situation of the game. */
  setScene(scene: Scene) {
    if (scene === this.scene) return;
    this.scene = scene;
    if (!this.ctx || !this.enabled || !this.decks.length) return;
    this.play(nextTrack(scene, scene === 'world' ? this.lastWorld : null));
  }

  /** Colours the music for a mood (quieter, further away, brighter) over `seconds`. */
  setMood(mood: Mood, seconds = 3) {
    this.mood = mood;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const m = TREATMENT[mood];
    this.musicIn.gain.setTargetAtTime(MUSIC_LEVEL * m.gain, t, seconds / 3);
    this.tone.frequency.setTargetAtTime(m.cutoff, t, seconds / 3);
  }

  /** 0–1: how loud the storm layer is. */
  setStorm(amount: number, seconds = 1.5) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.storm.gain.gain.setTargetAtTime(amount * 0.28, t, seconds / 3);
    this.storm.band.Q.setTargetAtTime(0.5 + amount, t, seconds / 3);
  }

  /** Starts the music of the current scene if nothing plays. */
  private ensureMusic() {
    const deck = this.decks[this.active];
    if (!deck) return;
    if (!deck.track) this.play(nextTrack(this.scene, this.scene === 'world' ? this.lastWorld : null), 2.5);
    else if (deck.el.paused) void deck.el.play().catch(() => undefined);
  }

  /** Fades from the piece that plays to `track` on the other deck. */
  private play(track: Track, fade = CROSSFADE) {
    const ctx = this.ctx as AudioContext;
    const t = ctx.currentTime;
    const from = this.decks[this.active];
    // the very first piece starts on the player that is already prepared
    if (from.track) this.active = 1 - this.active;
    const to = this.decks[this.active];
    to.track = track;
    if (!to.el.src.endsWith(MUSIC_DIR.replace(/^\./, '') + track.file) || to.el.ended) to.el.src = MUSIC_DIR + track.file;
    to.el.currentTime = 0;
    to.gain.gain.cancelScheduledValues(t);
    to.gain.gain.setValueAtTime(0, t);
    to.gain.gain.linearRampToValueAtTime(1, t + fade);
    void to.el.play().catch(() => undefined);
    this.current = track;
    if (track.id.startsWith('welt')) this.lastWorld = track.id;
    if (from.track && from !== to) {
      from.gain.gain.cancelScheduledValues(t);
      from.gain.gain.setValueAtTime(from.gain.gain.value, t);
      from.gain.gain.linearRampToValueAtTime(0, t + fade);
      const el = from.el;
      from.track = null;
      window.setTimeout(() => {
        if (!this.decks.some((d) => d.el === el && d.track)) el.pause();
      }, fade * 1000 + 300);
    }
  }

  private reloaded = new Set<string>();

  private async reload(deck: Deck) {
    const track = deck.track;
    if (!track || this.reloaded.has(track.id)) return;
    this.reloaded.add(track.id);
    try {
      const blob = await (await fetch(MUSIC_DIR + track.file)).blob();
      if (deck.track !== track) return;
      deck.el.src = URL.createObjectURL(blob);
      await deck.el.play();
    } catch {
      // without music the game goes on quietly
    }
  }

  /** Before a piece ends, the next one (or the same again) fades in, so the music never stops. */
  private watch() {
    const deck = this.decks[this.active];
    if (!deck?.track || !this.enabled || deck.el.paused) return;
    const { duration, currentTime } = deck.el;
    const fade = deck.track.loop ? 1.2 : CROSSFADE;
    if (Number.isFinite(duration) && duration - currentTime < fade + 0.4) this.play(nextTrack(this.scene, deck.track.id), fade);
  }

  /** A hidden page is silent; the music goes on where it was when the page returns. */
  private onVisibility() {
    const ctx = this.ctx as AudioContext | null;
    if (!ctx) return;
    const deck = this.decks[this.active];
    if (document.hidden) {
      for (const d of this.decks) d.el.pause();
      void ctx.suspend();
    } else if (this.enabled) {
      void ctx.resume();
      if (deck?.track) void deck.el.play().catch(() => undefined);
    }
  }

  /** One soft piano note: a gentle attack and a filter that closes as it fades. */
  private note(midi: number, t: number, level: number, decay: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    const f = mtof(midi);
    const bright = 2400 + this.richness * 1200;
    const osc = ctx.createOscillator();
    osc.setPeriodicWave(this.piano);
    osc.frequency.value = f;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 0.2;
    lp.frequency.setValueAtTime(Math.min(bright, f * 6), t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(220, Math.min(bright, f * 2)), t + decay * 0.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(level, t + 0.01);
    g.gain.setTargetAtTime(0, t + 0.01, decay / 4);
    osc.connect(lp).connect(g).connect(this.notes);
    osc.start(t);
    osc.stop(t + decay * 1.6);
  }

  /** The game's small sounds, at time `t` (now, if not given), in the key of the music. */
  chime(kind: ChimeKind, t?: number) {
    if (!this.ctx || !this.enabled) return;
    const at = t ?? this.ctx.currentTime + 0.02;
    const s = this.current?.scale ?? DEFAULT_SCALE;
    const play = (notes: number[], gap: number, level: number, decay = 2.8) => notes.forEach((m, i) => this.note(m, at + i * gap, level, decay));
    switch (kind) {
      case 'near':
        play([s[4]], 0, 0.016, 2);
        break;
      case 'beat':
        play([s[2]], 0, 0.019, 2.6);
        break;
      case 'thread':
        play([s[1], s[3]], 0.15, 0.022);
        break;
      case 'discover':
        play([s[0], s[2], s[4]], 0.13, 0.024, 3);
        break;
      case 'enter':
        play([s[0] - 12, s[2] - 12, s[4] - 12], 0, 0.02, 4);
        break;
      case 'reveal':
        play([...s, s[0] + 12], 0.17, 0.022, 3.2);
        break;
      case 'grow':
        play([s[0] - 12, s[2], s[4], s[1] + 12], 0.22, 0.021, 4);
        break;
    }
  }

  private lastTaste = 0;

  /** A word taken in: a short, very soft note, wandering through the scale as more follow. */
  taste(step: number, t?: number) {
    if (!this.ctx || !this.enabled) return;
    const at = t ?? this.ctx.currentTime + 0.01;
    // a whole verse can be taken in at once; it should ripple, not rattle
    if (t === undefined && at - this.lastTaste < 0.08) return;
    this.lastTaste = at;
    const s = this.current?.scale ?? DEFAULT_SCALE;
    const walk = [0, 2, 1, 3, 2, 4, 3, 1];
    this.note(s[walk[step % walk.length]] + 12, at, 0.011, 1.4);
  }

  /** A soft note for each word caught on a ride, climbing the scale with every one. */
  pluck(step: number, t?: number) {
    if (!this.ctx || !this.enabled) return;
    const s = this.current?.scale ?? DEFAULT_SCALE;
    const octave = Math.floor(step / s.length) % 2;
    this.note(s[step % s.length] + octave * 12, t ?? this.ctx.currentTime + 0.01, 0.019, 2.2);
  }

  /** A deep, open chord that rings out with a resonance. */
  resonance(t?: number) {
    if (!this.ctx || !this.enabled) return;
    const at = t ?? this.ctx.currentTime + 0.02;
    const root = (this.current?.scale ?? DEFAULT_SCALE)[0] - 24;
    for (const m of [root, root + 7, root + 12]) this.note(m, at, 0.026, 5);
    this.note(root + 24, at + 0.35, 0.016, 3.5);
  }

  /** For tests: what plays, and how. */
  state() {
    const deck = this.decks[this.active];
    return { scene: this.scene, mood: this.mood, track: deck?.track?.id ?? null, playing: !!deck && !deck.el.paused && !!deck.track, players: this.decks.length };
  }
}

export const audio = new AudioEngine();

/**
 * Renders a stretch of a piece with some of the game's small sounds over it, offline: to listen
 * to the balance, and to check it in the tests.
 */
export async function renderPreview(trackId: string, seconds: number, events: { at: number; kind: ChimeKind | 'pluck' | 'taste' | 'resonance'; step?: number }[], offset = 30) {
  const track = trackById(trackId);
  const rate = 44100;
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * rate), rate);
  const data = await (await fetch(MUSIC_DIR + track.file)).arrayBuffer();
  const buffer = await ctx.decodeAudioData(data);
  const engine = new AudioEngine();
  engine.attach(ctx);
  engine.current = track;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(engine.musicIn);
  src.start(0, offset);
  for (const e of events) {
    if (e.kind === 'pluck') engine.pluck(e.step ?? 0, e.at);
    else if (e.kind === 'taste') engine.taste(e.step ?? 0, e.at);
    else if (e.kind === 'resonance') engine.resonance(e.at);
    else engine.chime(e.kind, e.at);
  }
  return ctx.startRendering();
}
