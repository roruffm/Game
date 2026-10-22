// Progress and settings, kept only on this device.

export interface SaveData {
  settings: { muted: boolean; clearFont: boolean };
  /** Fragment indices ever found, per verse id. */
  fragments: Record<string, number[]>;
  /** Verses the player has put together, per verse id. */
  verses: Record<string, { unlockedAt: string }>;
  notes: Record<string, string>;
  seenRestQuote: boolean;
}

const KEY = 'lichtpfad.v1';

const fresh = (): SaveData => ({
  settings: { muted: false, clearFont: false },
  fragments: {},
  verses: {},
  notes: {},
  seenRestQuote: false,
});

function load(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const data = JSON.parse(raw) as Partial<SaveData>;
    const base = fresh();
    return { ...base, ...data, settings: { ...base.settings, ...data.settings } };
  } catch {
    return fresh();
  }
}

export const save = load();

export function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    // Private mode or storage disabled: progress lasts for this visit only.
  }
}
