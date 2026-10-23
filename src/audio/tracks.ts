// The music of the game: five calm instrumental worship pieces for piano from Pixabay, used
// under the Pixabay Content License. They were trimmed at the edges, faded and brought to one
// loudness (−18 LUFS). Each situation of the game has its own; the moods within it only colour
// the music (quieter and muffled in the storm, distant far from home).

export type Scene = 'world' | 'storm' | 'prodigal' | 'emmaus';
export type Mood = 'world' | 'storm' | 'calm' | 'far' | 'home' | 'path' | 'reveal';

export interface Track {
  id: string;
  /** File under public/music. */
  file: string;
  title: string;
  artist: string;
  /** The piece's page on Pixabay. */
  url: string;
  /** Key, as measured from the recording. */
  key: string;
  /** Notes (MIDI) that sound well over the piece: a pentatonic scale in its key. */
  scale: number[];
  /** Made by its composer to repeat seamlessly. */
  loop?: boolean;
}

export const TRACKS: Track[] = [
  {
    id: 'welt-1',
    file: 'welt-1.mp3',
    title: 'Peaceful Worship Piano Prayer Music',
    artist: 'Denis Pavlov',
    url: 'https://pixabay.com/music/modern-classical-peaceful-worship-piano-prayer-music-253743/',
    key: 'G-Dur',
    scale: [67, 69, 71, 74, 76],
  },
  {
    id: 'welt-2',
    file: 'welt-2.mp3',
    title: 'Beautiful Worship Piano Peaceful Music',
    artist: 'Denis Pavlov',
    url: 'https://pixabay.com/music/modern-classical-beautiful-worship-piano-peaceful-music-240319/',
    key: 'A-Dur',
    scale: [69, 71, 73, 76, 78],
  },
  {
    id: 'sturm',
    file: 'sturm.mp3',
    title: 'Morning Worship',
    artist: 'Adrian Huminiak',
    url: 'https://pixabay.com/music/modern-classical-morning-worship-180330/',
    key: 'C-Dur',
    scale: [72, 74, 76, 79, 81],
  },
  {
    id: 'sohn',
    file: 'sohn.mp3',
    title: 'All Creatures of Our God and King – Piano Improvisation',
    artist: 'smccleery',
    url: 'https://pixabay.com/music/modern-classical-all-creatures-of-our-god-and-king-piano-improvisation-247210/',
    // the improvisation moves between E minor, A minor and D major; this scale suits all three
    key: 'e-Moll / G-Dur',
    scale: [67, 69, 71, 74, 76],
  },
  {
    id: 'emmaus',
    file: 'emmaus.mp3',
    title: 'Peaceful Piano Soaking Instrumental Worship Track (Loops)',
    artist: 'Jesse Quinn',
    url: 'https://pixabay.com/music/ambient-peaceful-piano-soaking-instrumental-worship-track-loops-223094/',
    key: 'Cis-Dur',
    scale: [73, 75, 77, 80, 82],
    loop: true,
  },
];

/** The pieces of each situation, played in turn. */
export const SCENES: Record<Scene, string[]> = {
  world: ['welt-1', 'welt-2'],
  storm: ['sturm'],
  prodigal: ['sohn'],
  emmaus: ['emmaus'],
};

/** How a mood colours the music: its loudness, and how open (or muffled) it sounds. */
export const TREATMENT: Record<Mood, { gain: number; cutoff: number }> = {
  world: { gain: 1, cutoff: 16000 },
  path: { gain: 1, cutoff: 16000 },
  calm: { gain: 1, cutoff: 16000 },
  home: { gain: 1, cutoff: 16000 },
  reveal: { gain: 1.12, cutoff: 16000 },
  far: { gain: 0.55, cutoff: 1100 },
  storm: { gain: 0.4, cutoff: 800 },
};

export const trackById = (id: string) => {
  const t = TRACKS.find((x) => x.id === id);
  if (!t) throw new Error(`unknown track ${id}`);
  return t;
};

/** The piece that follows `current` in a scene (the first one if nothing of the scene plays). */
export function nextTrack(scene: Scene, current: string | null): Track {
  const list = SCENES[scene];
  const i = current ? list.indexOf(current) : -1;
  return trackById(list[(i + 1) % list.length]);
}
