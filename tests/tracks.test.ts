import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { nextTrack, SCENES, TRACKS, TREATMENT, trackById, type Mood } from '../src/audio/tracks';

describe('the music', () => {
  it('has every piece in the game, with its source and a scale for the small sounds', () => {
    for (const t of TRACKS) {
      const file = join(__dirname, '..', 'public', 'music', t.file);
      expect(existsSync(file), t.file).toBe(true);
      expect(statSync(file).size).toBeGreaterThan(500_000);
      expect(t.url).toMatch(/^https:\/\/pixabay\.com\/music\//);
      expect(t.artist).not.toBe('');
      expect(t.scale).toHaveLength(5);
      expect([...t.scale].sort((a, b) => a - b)).toEqual(t.scale);
    }
  });

  it('gives every situation its own pieces, and each piece a place', () => {
    for (const ids of Object.values(SCENES)) for (const id of ids) expect(() => trackById(id)).not.toThrow();
    expect(new Set(Object.values(SCENES).flat())).toEqual(new Set(TRACKS.map((t) => t.id)));
  });

  it('plays the world’s pieces in turn, and repeats a single piece', () => {
    expect(nextTrack('world', null).id).toBe('welt-1');
    expect(nextTrack('world', 'welt-1').id).toBe('welt-2');
    expect(nextTrack('world', 'welt-2').id).toBe('welt-1');
    expect(nextTrack('storm', null).id).toBe('sturm');
    expect(nextTrack('storm', 'sturm').id).toBe('sturm');
  });

  it('colours the music for every mood, the storm and the far country the most', () => {
    const moods: Mood[] = ['world', 'storm', 'calm', 'far', 'home', 'path', 'reveal'];
    for (const m of moods) expect(TREATMENT[m]).toBeDefined();
    expect(TREATMENT.storm.gain).toBeLessThan(TREATMENT.calm.gain);
    expect(TREATMENT.storm.cutoff).toBeLessThan(TREATMENT.calm.cutoff);
    expect(TREATMENT.far.cutoff).toBeLessThan(TREATMENT.home.cutoff);
  });
});
