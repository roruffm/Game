// Ties the systems together: loads data, runs the world and the encounters, turns discoveries
// into a changing world, and answers the interface.

import { audio } from './audio/audio';
import { Bible, type Range, type Versification } from './bible/bible';
import { BOOKS } from './bible/books';
import { encounterById, type EncounterId } from './content/encounters';
import { THEMES } from './content/themes';
import { EmmausEncounter } from './encounters/emmaus';
import type { EncounterScene } from './encounters/kit';
import { ProdigalEncounter } from './encounters/prodigal';
import { StormEncounter } from './encounters/storm';
import { Game } from './engine/game';
import { clearSave, loadSave, persist, type Discovery, type SaveData, type Settings } from './state/save';
import { store, toast, type Panel } from './state/store';
import type { GraphData, Thread } from './world/model';
import { WorldModel } from './world/model';
import { WorldScene } from './world/scene';
import { CrossRefs, linkKey, type XLink } from './xref/crossrefs';

export interface Meta {
  generated: string;
  verses: number;
  links: number;
  linksMin4: number;
  linksNegative: number;
  snapshot: string;
  markersMoved: number;
  sources: { id: string; url: string; license: string; licenseUrl?: string; homepage: string; attribution: string; via?: string }[];
}

const BASE = `${import.meta.env.BASE_URL}data/`;
const fetchJson = async (path: string) => {
  const res = await fetch(BASE + path);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
};

const MODULES: Record<EncounterId, new (api: ConstructorParameters<typeof StormEncounter>[0]) => EncounterScene> = {
  storm: StormEncounter,
  prodigal: ProdigalEncounter,
  emmaus: EmmausEncounter,
};

export class Director {
  game!: Game;
  bible!: Bible;
  xrefs!: CrossRefs;
  model!: WorldModel;
  world!: WorldScene;
  meta!: Meta;
  save!: SaveData;
  encounter: { id: EncounterId; scene: EncounterScene } | null = null;

  async boot(stage: HTMLElement) {
    try {
      const loaded = loadSave();
      this.save = loaded.data;
      const [meta, versification, graph] = await Promise.all([fetchJson('meta.json'), fetchJson('versification.json'), fetchJson('graph.json')]);
      this.meta = meta as Meta;
      this.bible = new Bible(versification as Versification, fetchJson);
      this.xrefs = new CrossRefs(this.bible, fetchJson);
      // labels in the world are drawn by Pixi, which needs the fonts before it renders text
      await Promise.race([
        Promise.all(['600 21px "Cormorant Garamond"', '500 16px "Cormorant Garamond"', '15px "Albert Sans"'].map((f) => document.fonts.load(f))),
        new Promise((r) => setTimeout(r, 2500)),
      ]).catch(() => undefined);
      this.game = await Game.create(stage);
      this.game.quality.reducedMotion ||= this.save.settings.reducedMotion;
      this.applyMotion();
      this.model = new WorldModel(this.bible, this.xrefs, this.save, graph as GraphData);
      this.model.clock = () => this.game.time;
      await this.model.init();
      this.world = new WorldScene(this.game, this.model, {
        activate: (ch) => this.activate(ch),
        openThread: (t) => this.openThread(t),
        arrived: (ch) => this.arrived(ch),
      });
      this.world.reducedView = this.save.settings.reducedView;
      this.model.onChange = () => this.changed();
      const start = this.save.player ?? this.startPoint();
      this.game.organism.place(start.x, start.y);
      this.game.camera.jump(start.x, start.y);
      this.game.camera.targetZoom = this.game.camera.zoom = this.save.zoom ?? (this.game.quality.particles < 1 ? 0.62 : 0.9);
      this.game.setScene(this.world);
      if (this.save.theme) this.setTheme(this.save.theme);
      this.changed();
      audio.enabled = this.save.settings.sound;
      audio.volume = this.save.settings.volume;
      this.game.input.enabled = false;
      store.set({ phase: 'start', hasSave: loaded.existed });
      window.setInterval(() => this.remember(), 4000);
      this.exposeForTests();
    } catch (err) {
      console.error(err);
      store.set({ loadError: err instanceof Error ? err.message : String(err) });
    }
  }

  /** Near the heart of the Gospels, a little away from the three encounters. */
  private startPoint() {
    const pts = (['storm', 'prodigal', 'emmaus'] as EncounterId[]).map((id) => this.model.position(this.model.encounterChapter(id)));
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    return { x: cx + 40, y: cy + 260 };
  }

  /** Called from the start screen, inside a click: sound may start now. */
  begin(fresh: boolean) {
    if (fresh && this.save.discoveries.length) {
      this.reset();
      return;
    }
    audio.unlock();
    audio.setEnabled(this.save.settings.sound);
    audio.setMood('world', 4);
    audio.setRichness(this.model.richness());
    this.game.input.enabled = true;
    store.set({ phase: 'world' });
    if (!this.save.discoveries.length) {
      window.setTimeout(() => toast('Gleite durch den Wortstrom.', 'Maus, Pfeiltasten oder Wischen bewegen dich. Drei helle Lichtknoten warten auf dich.', 7000), 600);
    }
  }

  private changed() {
    this.world?.syncNodes();
    store.set({ stats: this.model.stats() });
    audio.setRichness(this.model.richness());
  }

  private remember() {
    if (store.get().phase !== 'world') return;
    this.save.player = { x: Math.round(this.game.organism.x), y: Math.round(this.game.organism.y) };
    this.save.zoom = Math.round(this.game.camera.targetZoom * 100) / 100;
    persist(this.save);
  }

  // ── World interactions ───────────────────────────────────────────────

  activate(chapter: number) {
    const node = this.model.nodes.get(chapter);
    audio.unlock();
    if (node?.kind === 'encounter') {
      void this.startEncounter(node.encounter!);
      return;
    }
    if (node?.kind === 'hint') {
      void this.followHint(chapter);
      return;
    }
    this.openReader(chapter, node?.discoveries ?? []);
  }

  private arrived(chapter: number) {
    const node = this.model.nodes.get(chapter);
    if (node && node.kind !== 'encounter') this.activate(chapter);
  }

  openReader(chapter: number, highlight: Range[] = []) {
    this.setPanel({ type: 'reader', chapter, highlight: highlight.map((r) => ({ start: r.start, end: r.end })) });
  }

  /** Reaching a glimmering chapter: compare the two passages and light it up. */
  async followHint(chapter: number) {
    const incoming = this.model.incoming(chapter);
    if (!incoming.length) {
      this.openReader(chapter);
      return;
    }
    const best = incoming[0];
    const strongest = best.links[0];
    const target = this.clampToChapter(strongest, chapter);
    this.setPanel({ type: 'link', a: { start: strongest.from, end: strongest.from }, b: target, fromChapter: best.from.chapter, toChapter: chapter });
    const union = incoming.flatMap((i) => i.links).map((l) => this.clampToChapter(l, chapter));
    const range = { start: Math.min(...union.map((r) => r.start)), end: Math.max(...union.map((r) => r.end)) };
    // keep a discovered passage short: the linked verses, not the whole chapter
    const span = range.end - range.start > 12 ? target : range;
    await this.discover({ start: span.start, end: span.end, chapter, kind: 'reference', via: linkKey(strongest), at: Date.now() });
    this.markLink(strongest);
  }

  private clampToChapter(l: XLink, chapter: number): Range {
    const r = this.bible.chapterRange(chapter);
    return { start: Math.max(r.start, l.start), end: Math.min(r.end, l.end) };
  }

  openThread(thread: Thread) {
    const strongest = thread.links[0];
    const from = this.bible.chapterOf(strongest.from);
    const to = from === thread.a ? thread.b : thread.a;
    this.setPanel({ type: 'link', a: { start: strongest.from, end: strongest.from }, b: this.clampToChapter(strongest, to), fromChapter: from, toChapter: to });
    this.markLink(strongest);
    audio.chime('thread');
  }

  markLink(l: XLink) {
    const key = linkKey(l);
    if (!this.save.links.includes(key)) {
      this.save.links.push(key);
      persist(this.save);
    }
  }

  async discover(d: Discovery) {
    // the model records the discovery in the save at once and then loads its links;
    // save right away so leaving the page during that load keeps it
    const pending = this.model.discover(d);
    persist(this.save);
    const res = await pending;
    if (!res.isNew) return;
    persist(this.save);
    this.world.flare(d.chapter);
    audio.chime('discover');
    const first = BOOKS[this.bible.ref(d.start).b].t === 'OT' && this.model.stats().ot === 1;
    const parts = [res.newThreads ? `${res.newThreads} neue Lichtfäden` : '', res.newHints ? `${res.newHints} ferne Lichter` : ''].filter(Boolean);
    toast(`${this.bible.format(d)} leuchtet auf`, parts.join(' · ') || undefined);
    if (first) {
      window.setTimeout(
        () => toast('Du hast den Quellgrund erreicht.', 'Im äußeren Ring liegt das Alte Testament – die Schriften, auf die das Neue Testament zurückgreift.', 8000),
        1800,
      );
    }
  }

  travelTo(chapter: number) {
    this.setPanel(null);
    if (store.get().phase !== 'world') return;
    this.world.focusOn(chapter);
    this.world.travelTo(chapter);
  }

  search(query: string): Range | null {
    return this.bible.parse(query);
  }

  async readSearch(range: Range, kind: 'search' | 'theme' = 'search', via?: string) {
    const chapter = this.bible.chapterOf(range.start);
    const end = Math.min(range.end, this.bible.chapterRange(chapter).end);
    this.openReader(chapter, [{ start: range.start, end }]);
    await this.discover({ start: range.start, end, chapter, kind, via, at: Date.now() });
  }

  setTheme(id: string | null) {
    const theme = THEMES.find((t) => t.id === id) ?? null;
    this.world.themeChapters = new Set(theme ? this.model.themeChapters(theme.id).map((m) => m.chapter) : []);
    this.world.themeColor = theme?.color ?? 0xffffff;
    this.save.theme = theme?.id ?? null;
    store.set({ activeTheme: this.save.theme });
    persist(this.save);
  }

  setPanel(panel: Panel | null) {
    store.set({ panel });
    this.game.input.enabled = !panel && store.get().phase !== 'start';
    if (panel) this.game.input.reset();
  }

  // ── Encounters ───────────────────────────────────────────────────────

  async startEncounter(id: EncounterId) {
    if (this.encounter) return;
    const info = encounterById(id);
    const range = this.bible.range(info.range);
    const chapter = this.bible.chapterRange(this.bible.chapterOf(range.start));
    const verses = await this.bible.verses(chapter);
    const byNumber = new Map(verses.map((v) => [v.ref.v, v.text]));
    this.save.player = { x: Math.round(this.game.organism.x), y: Math.round(this.game.organism.y) };
    persist(this.save, true);
    this.setPanel(null);
    const scene = new MODULES[id]({
      game: this.game,
      bible: this.bible,
      xrefs: this.xrefs,
      info,
      verse: (n) => byNumber.get(n) ?? '',
      finish: () => void this.finishEncounter(id),
    });
    this.encounter = { id, scene };
    store.set({ phase: 'encounter', focus: null });
    audio.chime('enter');
    this.game.setScene(scene, true);
    this.game.input.enabled = true;
  }

  private async finishEncounter(id: EncounterId) {
    const info = encounterById(id);
    const range = this.bible.range(info.range);
    await this.discover({ start: range.start, end: range.end, chapter: this.bible.chapterOf(range.start), kind: 'encounter', encounter: id, at: Date.now() });
    this.model.completeEncounter(id);
    persist(this.save, true);
    this.setPanel({ type: 'encounterEnd', id });
  }

  /** Back to the Wortstrom, after finishing or leaving an encounter. */
  returnToWorld() {
    if (!this.encounter) return;
    const { id } = this.encounter;
    this.encounter = null;
    const chapter = this.model.encounterChapter(id);
    const pos = this.model.position(chapter);
    const org = this.game.organism;
    org.color = 0x7fe9ff;
    org.accent = 0xffffff;
    org.vitality = 1;
    org.maxSpeed = 260;
    org.place(pos.x + 70, pos.y + 90);
    this.game.camera.jump(org.x, org.y);
    this.game.camera.targetZoom = this.game.quality.particles < 1 ? 0.55 : 0.75;
    this.game.setScene(this.world);
    this.setPanel(null);
    store.set({ phase: 'world', encounter: null, confirmLeave: false });
    audio.setMood('world', 4);
    audio.setStorm(0, 2);
    audio.setRichness(this.model.richness());
    this.world.flare(chapter);
    this.game.input.enabled = true;
  }

  // ── Settings ─────────────────────────────────────────────────────────

  async updateSettings(patch: Partial<Settings>) {
    Object.assign(this.save.settings, patch);
    persist(this.save);
    if (patch.sound !== undefined) audio.setEnabled(patch.sound);
    if (patch.volume !== undefined) audio.setVolume(patch.volume);
    if (patch.reducedMotion !== undefined) {
      this.game.quality.reducedMotion = patch.reducedMotion;
      this.applyMotion();
    }
    if (patch.reducedView !== undefined) {
      this.world.reducedView = patch.reducedView;
      this.world.syncNodes();
    }
    if (patch.minVotes !== undefined) {
      await this.model.reload();
      toast(patch.minVotes <= 0 ? 'Alle Querverweise werden berücksichtigt.' : `Querverweise ab ${patch.minVotes} Stimmen.`);
    }
    store.set((s) => ({ stats: this.model.stats(), settingsRev: s.settingsRev + 1 }));
  }

  private applyMotion() {
    const reduced = this.game.quality.reducedMotion;
    document.body.classList.toggle('reduce-motion', reduced);
    this.game.organism.trailOn = !reduced;
  }

  reset() {
    clearSave();
    window.location.reload();
  }

  /** Test hooks (also handy in the console): window.wortstrom. */
  private exposeForTests() {
    (window as unknown as { wortstrom: unknown }).wortstrom = {
      director: this,
      state: () => ({
        phase: store.get().phase,
        organism: { x: this.game.organism.x, y: this.game.organism.y },
        camera: { x: this.game.camera.x, y: this.game.camera.y, zoom: this.game.camera.zoom },
        encounter: this.encounter ? { id: this.encounter.id, objective: this.encounter.scene.objective(), ui: store.get().encounter } : null,
        nodes: [...this.model.nodes.values()].map((n) => ({ chapter: n.chapter, kind: n.kind, title: n.title, x: n.x, y: n.y, completed: n.completed })),
        threads: this.model.threads.map((t) => ({ a: t.a, b: t.b, kind: t.kind, votes: t.votes, links: t.links.length })),
        stats: this.model.stats(),
        fps: this.game.frameRate,
      }),
      toScreen: (x: number, y: number) => this.game.camera.toScreen(x, y),
    };
  }
}

export const director = new Director();
