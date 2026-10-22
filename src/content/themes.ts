// Thematic constellations: an editorial navigation aid, kept apart from the cross-reference data.
// A passage may belong to several themes. Membership is a reading suggestion, not a category.

export interface Theme {
  id: string;
  title: string;
  description: string;
  color: number;
  /** Ranges in data notation. */
  passages: string[];
}

export const THEMES: Theme[] = [
  {
    id: 'gnade',
    title: 'Gnade und Vergebung',
    description: 'Texte darüber, dass Gott vergibt und annimmt, ohne dass es verdient wäre.',
    color: 0xffd27a,
    passages: ['LUK 15:11-32', 'EPH 2:4-9', 'ROM 5:8', '1JO 1:9', 'COL 3:13', 'LUK 7:36-50', 'MAT 18:21-35'],
  },
  {
    id: 'glaube',
    title: 'Glaube und Vertrauen',
    description: 'Wie Menschen Gott vertrauen – oder an ihrem Vertrauen ringen.',
    color: 0x6fe3ff,
    passages: ['MAR 4:35-41', 'HEB 11:1', 'MAR 9:23-24', 'MAT 6:25-34', 'ROM 10:17', 'PRO 3:5-6'],
  },
  {
    id: 'liebe',
    title: 'Liebe und Barmherzigkeit',
    description: 'Gottes Liebe und die Liebe, die Menschen einander erweisen sollen.',
    color: 0xff9fc2,
    passages: ['1CO 13:1-13', 'LUK 10:25-37', 'JOH 3:16', '1JO 4:7-12', 'MAT 5:43-48'],
  },
  {
    id: 'identitaet',
    title: 'Identität Jesu',
    description: 'Texte, in denen gefragt oder gesagt wird, wer Jesus ist.',
    color: 0xfff1c9,
    passages: ['MAR 4:41', 'JOH 1:1-14', 'MAT 16:13-17', 'JOH 8:12', 'COL 1:15-20', 'LUK 24:25-27'],
  },
  {
    id: 'umkehr',
    title: 'Umkehr und Nachfolge',
    description: 'Wege zurück zu Gott und der Ruf, Jesus nachzufolgen.',
    color: 0x9be7b0,
    passages: ['LUK 15:17-20', 'MAR 1:15', 'LUK 9:23', 'MAT 4:18-22', 'LUK 19:1-10', 'ACT 2:37-38'],
  },
  {
    id: 'gebet',
    title: 'Gebet und Beziehung zu Gott',
    description: 'Wie Menschen mit Gott reden, klagen, bitten und danken.',
    color: 0xb4a6ff,
    passages: ['MAT 6:5-15', 'LUK 11:1-13', 'PHI 4:6-7', 'ROM 8:15', 'PSA 107:28-30'],
  },
  {
    id: 'hoffnung',
    title: 'Hoffnung und Auferstehung',
    description: 'Die Auferstehung Jesu und die Hoffnung, die daraus wächst.',
    color: 0xffb37a,
    passages: ['LUK 24:13-35', '1CO 15:3-8', '1CO 15:20-22', '1PE 1:3', 'REV 21:1-5'],
  },
  {
    id: 'geist',
    title: 'Heiliger Geist und Gemeinde',
    description: 'Gottes Geist und die Gemeinschaft derer, die an Jesus glauben.',
    color: 0x7fd8c8,
    passages: ['ACT 2:1-4', 'ACT 2:42-47', 'JOH 14:16-17', 'ROM 8:14-16', '1CO 12:4-13', 'GAL 5:22-23'],
  },
];
