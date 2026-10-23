// A small store shared by the game (Pixi) and the interface (React).

import { useSyncExternalStore } from 'react';
import type { EncounterId } from '../content/encounters';

export interface Focus {
  chapter: number;
  kind: 'encounter' | 'known' | 'hint' | 'theme';
  title: string;
  subtitle: string;
  encounter?: EncounterId;
  completed?: boolean;
  /** Whether the organism is close enough to enter. */
  near: boolean;
}

export type Panel =
  | { type: 'reader'; chapter: number; highlight: { start: number; end: number }[]; via?: { linkKey: string } }
  | { type: 'link'; a: { start: number; end: number }; b: { start: number; end: number }; fromChapter: number; toChapter: number }
  | { type: 'journal'; tab: 'discovered' | 'links' | 'themes' | 'search' }
  | { type: 'settings' }
  | { type: 'credits' }
  | { type: 'encounterEnd'; id: EncounterId };

export interface Beat {
  /** Data notation range, e.g. "MAR 4:37". */
  ref: string;
  label: string;
  text: string;
  /** "bibel" for scripture, "hinweis" for guidance, "datensatz" for a cross-reference. */
  kind: 'bibel' | 'hinweis' | 'datensatz';
  /** Counts up with every verse shown in an encounter, so repeated verses stay distinct. */
  seq?: number;
}

export interface EncounterUi {
  id: EncounterId;
  phase: number;
  beats: Beat[];
  hint: string | null;
  done: boolean;
}

/** The verse a ride of light flows into, assembled from the words caught on the way. */
export interface Reveal {
  id: number;
  chapter: number;
  /** e.g. "Psalm 107,29" */
  label: string;
  note?: string;
  words: { text: string; caught: boolean }[];
  truncated: boolean;
  /** The cross-reference in the dataset's direction, e.g. "Markus 4,39 → Psalm 107,29". */
  linkLabel: string;
  votes: number;
  panel: Panel;
}

export interface Toast {
  id: number;
  text: string;
  sub?: string;
}

export interface UiState {
  phase: 'loading' | 'start' | 'world' | 'encounter';
  loadError: string | null;
  hasSave: boolean;
  focus: Focus | null;
  panel: Panel | null;
  encounter: EncounterUi | null;
  toasts: Toast[];
  stats: { discovered: number; threads: number; connections: number; encounters: number; ot: number };
  zoom: number;
  activeTheme: string | null;
  traveling: boolean;
  reveal: Reveal | null;
  /** Asks whether to leave the running encounter. */
  confirmLeave: boolean;
  /** Bumped whenever settings change, so the interface re-reads them. */
  settingsRev: number;
}

let state: UiState = {
  phase: 'loading',
  loadError: null,
  hasSave: false,
  focus: null,
  panel: null,
  encounter: null,
  toasts: [],
  stats: { discovered: 0, threads: 0, connections: 0, encounters: 0, ot: 0 },
  zoom: 1,
  activeTheme: null,
  traveling: false,
  reveal: null,
  confirmLeave: false,
  settingsRev: 0,
};
const listeners = new Set<() => void>();

export const store = {
  get: () => state,
  set(patch: Partial<UiState> | ((s: UiState) => Partial<UiState>)) {
    const p = typeof patch === 'function' ? patch(state) : patch;
    state = { ...state, ...p };
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export function useStore<T>(select: (s: UiState) => T): T {
  return useSyncExternalStore(store.subscribe, () => select(state));
}

let toastId = 0;
export function toast(text: string, sub?: string, ms = 4200) {
  const id = ++toastId;
  store.set((s) => ({ toasts: [...s.toasts.slice(-2), { id, text, sub }] }));
  window.setTimeout(() => store.set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), ms);
}

/** Screen position of the focused node, written by the game every frame (not React state). */
export const focusAnchor = { x: 0, y: 0, visible: false };

/**
 * Screen position of the organism, written every frame. `avoid` is the side the text beside it
 * should keep free (1: the right, -1: the left), e.g. where the player is heading.
 */
export const organismAnchor = { x: 0, y: 0, avoid: 0 };
