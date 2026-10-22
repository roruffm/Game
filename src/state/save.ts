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

export function persist(data: SaveData, immediate = false) {
  const write = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      // private mode or full storage: the world lasts for this visit
    }
  };
  window.clearTimeout(timer);
  if (immediate) write();
  else timer = window.setTimeout(write, 400);
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // nothing stored
  }
}
