import '@fontsource/jersey-10/400.css';
import './style.css';
import Phaser from 'phaser';
import { GameScene } from './game/GameScene';
import { PHYS } from './game/physics';
import { createUI } from './ui/ui';

// The world is drawn at 180 px height; the width follows the screen's aspect ratio
// (landscape), so phones with long screens see more of the level instead of black bars.
const HEIGHT = 180;

function gameWidth() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const aspect = Math.max(w, h) / Math.max(1, Math.min(w, h));
  return Math.round(Math.min(400, Math.max(260, HEIGHT * aspect)));
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: gameWidth(),
  height: HEIGHT,
  backgroundColor: '#100d22',
  pixelArt: true,
  roundPixels: true,
  banner: false,
  physics: { default: 'arcade', arcade: { gravity: { x: 0, y: PHYS.gravity }, fps: 60 } },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  // Input and sound are handled outside Phaser (see input.ts and sound.ts).
  input: { keyboard: false, mouse: false, touch: false, gamepad: false },
  audio: { noAudio: true },
  scene: [GameScene],
});

window.addEventListener('resize', () => {
  const w = gameWidth();
  if (w !== game.scale.gameSize.width) game.scale.setGameSize(w, HEIGHT);
});

game.events.once(Phaser.Core.Events.READY, () => createUI(game));

if (import.meta.env.PROD && 'serviceWorker' in navigator && window.top === window.self) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => undefined));
}
