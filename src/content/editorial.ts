// Editorial layer: short, checked explanations for selected cross-references.
//
// Every entry belongs to a link that exists in the OpenBible.info dataset (tests/content.test.ts
// checks the source verse, the target and the minimum votes). The text is an explanation written
// for this game. It is interpretation, marked as such in the interface, and it says what the texts
// say rather than what they prove. Quotations are from the Lutherbibel 1912.

export interface EditorialNote {
  /** Source verse, data notation. */
  from: string;
  /** Target range, data notation; matches dataset links whose target overlaps it. */
  to: string;
  /** Votes the link has in the pinned snapshot (checked by the tests). */
  votes: number;
  title: string;
  text: string;
}

export const EDITORIAL: EditorialNote[] = [
  // Jesus stillt den Sturm
  {
    from: 'MAR 4:39',
    to: 'PSA 107:29',
    votes: 23,
    title: 'Gott stillt den Sturm',
    text:
      'Psalm 107 erzählt von Seeleuten in Seenot: Sie schreien zum HERRN, und er „stillte das Ungewitter, daß die Wellen sich legten“. ' +
      'In Markus 4 geschieht dasselbe auf Jesu Wort hin. Danach fragen die Jünger: „Wer ist der?“ Wer den Psalm kennt, hört in dieser Frage mit, ' +
      'dass Jesus hier tut, was der Psalm von Gott sagt. Markus gibt die Antwort nicht vor, er lässt die Frage stehen.',
  },
  {
    from: 'MAR 4:39',
    to: 'PSA 89:9',
    votes: 12,
    title: 'Herr über das Meer',
    text:
      'Psalm 89 preist Gott: „Du herrschest über das ungestüme Meer; du stillest seine Wellen, wenn sie sich erheben.“ ' +
      'Das tobende Meer steht in vielen biblischen Texten für Bedrohung und Chaos, die Gott in Grenzen hält. Markus erzählt, wie Wind und Meer auf Jesus hören.',
  },
  {
    from: 'MAR 4:37',
    to: 'JON 1:4',
    votes: 4,
    title: 'Ein anderer Sturm',
    text:
      'Auch im Buch Jona gerät ein Schiff in ein großes Unwetter, und auch dort schläft einer, während die anderen um ihr Leben fürchten (Jona 1,5–6). ' +
      'Die Unterschiede sind deutlich: Jona ist auf der Flucht vor Gott, von Jesus wird nur erzählt, dass er schlief. Ob Markus bewusst an Jona erinnern will, beurteilen Ausleger unterschiedlich.',
  },
  {
    from: 'MAR 4:40',
    to: 'PSA 46:1-3',
    votes: 8,
    title: 'Furcht und Zuversicht',
    text:
      'Jesus fragt: „Wie seid ihr so furchtsam?“ Psalm 46 beschreibt das Gegenbild: „Darum fürchten wir uns nicht, … wenngleich das Meer wütete und wallte“. ' +
      'Der Psalm verbindet Furchtlosigkeit nicht mit ruhigem Wetter, sondern mit dem Vertrauen auf Gott.',
  },
  {
    from: 'MAR 4:35',
    to: 'LUK 8:22',
    votes: 12,
    title: 'Dieselbe Geschichte bei Lukas',
    text:
      'Markus, Matthäus und Lukas erzählen die Sturmstillung jeweils mit eigenen Akzenten (Matthäus 8,23–27; Lukas 8,22–25). ' +
      'Wer die Fassungen nebeneinander liest, sieht, was jedem Evangelisten wichtig ist.',
  },
  // Der verlorene Sohn
  {
    from: 'LUK 15:20',
    to: 'PSA 103:10-13',
    votes: 18,
    title: 'Wie sich ein Vater erbarmt',
    text:
      'Psalm 103,13: „Wie sich ein Vater über Kinder erbarmt, so erbarmt sich der HERR über die, so ihn fürchten.“ ' +
      'Im Gleichnis wird dieses Bild zur Szene: Der Vater sieht den Sohn von ferne, „und es jammerte ihn“. Jesus erzählt ein Gleichnis; der Psalm zeigt, warum viele darin Gottes Erbarmen erkennen.',
  },
  {
    from: 'LUK 15:24',
    to: 'EPH 2:5',
    votes: 30,
    title: 'Tot – und lebendig',
    text:
      'Der Vater sagt: „dieser mein Sohn war tot und ist wieder lebendig geworden“. Epheser 2,5 gebraucht dieselben Gegensätze für alle Glaubenden: ' +
      '„da wir tot waren in den Sünden, hat er uns samt Christo lebendig gemacht (denn aus Gnade seid ihr selig geworden)“. Hier verbindet der Datensatz eine Erzählung mit einer Lehraussage.',
  },
  {
    from: 'LUK 15:24',
    to: 'LUK 19:10',
    votes: 25,
    title: 'Suchen, was verloren ist',
    text:
      'Am Ende der Begegnung mit Zachäus sagt Jesus: „Denn des Menschen Sohn ist gekommen, zu suchen und selig zu machen, das verloren ist.“ ' +
      'Das Wort „verloren“ verbindet Lukas 15 mit Lukas 19.',
  },
  {
    from: 'LUK 15:24',
    to: 'EZE 34:16',
    votes: 28,
    title: 'Das Verlorene suchen',
    text:
      'Bei Hesekiel spricht Gott wie ein Hirte: „Ich will das Verlorene wieder suchen und das Verirrte wiederbringen“. ' +
      'Lukas 15 beginnt mit dem Gleichnis vom verlorenen Schaf; der Datensatz verbindet beide Bilder.',
  },
  {
    from: 'LUK 15:32',
    to: 'JON 4:10-11',
    votes: 7,
    title: 'Der ältere Bruder und Jona',
    text:
      'Jona ärgert sich, dass Gott Ninive verschont. Gott antwortet ihm mit einer Frage, und das Buch endet, ohne dass Jonas Antwort erzählt wird. ' +
      'Auch das Gleichnis endet mit den Worten des Vaters an den älteren Bruder; ob er zum Fest hineingeht, bleibt offen.',
  },
  {
    from: 'LUK 15:18',
    to: 'PSA 51:3-5',
    votes: 9,
    title: 'Schuld aussprechen',
    text:
      'Der Sohn nimmt sich vor zu sagen: „Vater, ich habe gesündigt gegen den Himmel und vor dir“. Psalm 51 ist ein Gebet, in dem jemand seine Schuld vor Gott ausspricht: ' +
      '„An dir allein habe ich gesündigt und übel vor dir getan“. Beide Texte verbinden das Eingeständnis mit der Hoffnung auf Erbarmen.',
  },
  // Die Emmausjünger
  {
    from: 'LUK 24:27',
    to: 'DEU 18:15',
    votes: 23,
    title: 'Ein Prophet wie Mose',
    text:
      'Lukas schreibt nur, dass Jesus „von Mose und allen Propheten“ an die Schriften auslegte; einzelne Stellen nennt er nicht. ' +
      'Der Datensatz verbindet die Stelle unter anderem mit 5. Mose 18,15: „Einen Propheten wie mich wird der HERR, dein Gott, dir erwecken“. ' +
      'Petrus bezieht dieses Wort in Apostelgeschichte 3,22 auf Jesus.',
  },
  {
    from: 'LUK 24:26',
    to: 'ISA 53:1-12',
    votes: 8,
    title: 'Leiden und Herrlichkeit',
    text:
      '„Mußte nicht Christus solches leiden und zu seiner Herrlichkeit eingehen?“ Jesaja 53 spricht von einem, der „um unsrer Missetat willen verwundet“ wird. ' +
      'Im Neuen Testament wird Jesaja 53 mehrfach auf Jesus bezogen, etwa in Apostelgeschichte 8,32–35.',
  },
  {
    from: 'LUK 24:26',
    to: '1PE 1:11',
    votes: 10,
    title: 'Was die Propheten bezeugten',
    text:
      '1. Petrus 1,11 sagt von den Propheten, dass der Geist Christi in ihnen war „und zuvor bezeugt hat die Leiden, die über Christus kommen sollten, und die Herrlichkeit darnach“. ' +
      'Dieselbe Abfolge – erst Leiden, dann Herrlichkeit – steht in Lukas 24,26.',
  },
  {
    from: 'LUK 24:32',
    to: 'JER 20:9',
    votes: 10,
    title: 'Ein brennendes Herz',
    text:
      '„Brannte nicht unser Herz in uns, da er mit uns redete auf dem Wege, als er uns die Schrift öffnete?“ Auch Jeremia beschreibt Gottes Wort „in meinem Herzen wie ein brennendes Feuer“. ' +
      'Bei Jeremia ist es die Last des Auftrags, in Emmaus die Freude des Verstehens – das Bild des brennenden Herzens verbindet beide.',
  },
  {
    from: 'LUK 24:30',
    to: 'LUK 9:16',
    votes: 4,
    title: 'Er nahm das Brot',
    text:
      'Bei der Speisung der Fünftausend „nahm er die fünf Brote … dankte darüber, brach sie“. In Emmaus erkennen die beiden Jesus genau an dieser Geste: ' +
      '„wie er von ihnen erkannt wäre an dem, da er das Brot brach“ (Lukas 24,35).',
  },
  {
    from: 'LUK 24:34',
    to: '1CO 15:5',
    votes: 7,
    title: 'Simon erschienen',
    text:
      '„Der HERR ist wahrhaftig auferstanden und Simon erschienen.“ Paulus nennt in seiner Aufzählung der Zeugen ebenfalls zuerst Kephas, also Simon Petrus (1. Korinther 15,5).',
  },
];
