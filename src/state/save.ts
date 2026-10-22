// Persistence Service: the player's own world, kept in this browser (localStorage).

import type { EncounterId } from '../content/encounters';
import { DEFAULT_MIN_VOTES } from '../xref/crossrefs';

export type DiscoveryKind = 'encounter' | 'reference' | 'search' | 'theme';

export interface Discovery {
  /** Verse range, global indices (KJV numbering). */
  start: number;
  end: number;
  chapter: number;
  kind: DiscoveryKind;
  encounter?: EncounterId;
  /** The cross-reference (link key) or theme that led here. */
  via?: string;
  at: number;
}

export interface Settings {
  sound: boolean;
  volume: number;
  reducedMotion: boolean;
  reducedView: boolean;
  minVotes: number;
}

export interface SaveData {
  version: 1;
  discoveries: Discovery[];
  encounters: EncounterId[];
  /** Connections the player opened and read. */
  links: string[];
  notes: Record<string, string>;
  settings: Settings;
  player: { x: number; y: number } | null;
  zoom: number | null;
  theme: string | null;
  /** One-time hints already shown. */
  tips: string[];
}

const KEY = 'wortstrom.save.v1';

export const freshSave = (reducedMotion = false): SaveData => ({
  version: 1,
  discoveries: [],
  encounters: [],
  links: [],
  notes: {},
  settings: { sound: true, volume: 0.7, reducedMotion, reducedView: false, minVotes: DEFAULT_MIN_VOTES },
  player: null,
  zoom: null,
  theme: null,
  tips: [],
});

export function loadSave(): { data: SaveData; existed: boolean } {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SaveData;
      if (parsed.version === 1) {
        const base = freshSave();
        return { data: { ...base, ...parsed, settings: { ...base.settings, ...parsed.settings } }, existed: parsed.discoveries.length > 0 };
      }
    }
  } catch {
    // unreadable or blocked storage: start fresh
  }
  return { data: freshSave(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches), existed: false };
}

let timer: number | undefined;
let pending: SaveData | null = null;

function flush() {
  window.clearTimeout(timer);
  if (!pending) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(pending));
  } catch {
    // private mode or full storage: the world lasts for this visit
  }
  pending = null;
}

export function persist(data: SaveData, immediate = false) {
  pending = data;
  window.clearTimeout(timer);
  if (immediate) flush();
  else timer = window.setTimeout(flush, 400);
}

// closing the tab or reloading right after a discovery must not lose it
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
}

export function clearSave() {
  window.clearTimeout(timer);
  pending = null;
  try {
    localStorage.removeItem(KEY);
  } catch {
    // nothing stored
  }
}
