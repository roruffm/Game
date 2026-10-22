// Automatically suggested connections: words two passages share.
// This is a reading aid computed by the game, not an interpretation and not part of the dataset.

const STOP = new Set(
  (
    'aber alle allem allen aller alles also auch auf aus bei bin bis bist dann darum das dass daß dein deine deinem ' +
    'deinen deiner dem den denn der des dessen dich die dies diese diesem diesen dieser dieses dir doch dort du durch ' +
    'ein eine einem einen einer eines er es euch euer eure für gegen gewesen hab habe haben hat hatte hatten hier hin ' +
    'hinter ich ihm ihn ihnen ihr ihre ihrem ihren ihrer im in indem ist ja jede jedem jeden jeder jedes jener ' +
    'kann kein keine mein meine meinem meinen meiner mich mir mit muss muß nach nicht nichts noch nun nur ob oder ohne ' +
    'sehr sein seine seinem seinen seiner seit sich sie sind so solche solchem solchen solcher soll sollen sollt sondern ' +
    'sonst über um und uns unser unsre unsrer unter vom von vor war waren ward warum was weil welche welchem welchen ' +
    'welcher wenn wer werde werden wie wieder will wir wird wo wollen wollte würde wurde zu zum zur zwar zwischen ' +
    'da daß dass dem denen derselbe dieselbe dasselbe darnach daran darauf daraus darin davon dazu damit jetzt ' +
    'spricht sprach sprachen sagte sagt sagen gesagt kam kamen kommen tat tun getan siehe herr'
  ).split(' '),
);

// Light stemming for German: enough to match "Wellen"/"Welle", "stillte"/"stillen".
function stem(word: string): string {
  let w = word;
  for (const suffix of ['ungen', 'heit', 'keit', 'lich', 'ten', 'te', 'en', 'er', 'es', 'em', 'st', 'et', 'e', 'n', 's', 't']) {
    if (w.length - suffix.length >= 4 && w.endsWith(suffix)) {
      w = w.slice(0, -suffix.length);
      break;
    }
  }
  return w;
}

function words(text: string) {
  const out = new Map<string, string>();
  for (const raw of text.match(/[A-Za-zÄÖÜäöüß]+/g) ?? []) {
    const w = raw.toLowerCase();
    if (w.length < 4 || STOP.has(w)) continue;
    const s = stem(w);
    if (!out.has(s)) out.set(s, raw);
  }
  return out;
}

/** Words (as written in the first text) whose stems also occur in the second. */
export function sharedWords(a: string, b: string, max = 6): string[] {
  const wb = words(b);
  return [...words(a)].filter(([s]) => wb.has(s)).map(([, w]) => w).slice(0, max);
}
