// Game Engine host: the Pixi application, camera, input, the shared organism and the
// background. Scenes (the Wortstrom and the encounters) plug into it.

import { Application, Container } from 'pixi.js';
import { Camera } from './camera';
import { Input } from './input';
import { Organism } from './organism';

export interface Scene {
  /** World-space content; the camera transform is applied to it. */
  root: Container;
  update(dt: number, time: number): void;
  tap?(sx: number, sy: number): void;
  hover?(sx: number, sy: number): void;
  /** Called when the scene becomes active / inactive (it may be kept and entered again). */
  enter?(): void;
  leave?(): void;
  destroy(): void;
}

export interface Quality {
  /** Multiplier for particle counts (lower on phones and with reduced motion). */
  particles: number;
  reducedMotion: boolean;
}

export class Game {
  readonly camera = new Camera();
  readonly organism = new Organism();
  readonly input: Input;
  readonly worldLayer = new Container();
  readonly screenLayer = new Container();
  quality: Quality;
  scene: Scene | null = null;
  time = 0;
  paused = false;
  /** Tint of the nebula, set by scenes. */
  nebulaColors: number[] = [0x1b3a7a, 0x2a1d5c, 0x0d4a5a];
  nebulaStrength = 0.5;
  // Sky and nebula are DOM layers behind a transparent canvas: the browser composites them
  // almost for free, where full-screen glowing sprites would cost a weak GPU most of its frame.
  private nebula: HTMLDivElement;
  private nebulaKey = '';
  private fps = 60;

  private constructor(
    readonly app: Application,
    host: HTMLElement,
  ) {
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.quality = { particles: coarse ? 0.55 : 1, reducedMotion: reduced };
    this.input = new Input(app.canvas);
    const sky = document.createElement('div');
    sky.className = 'sky';
    this.nebula = document.createElement('div');
    this.nebula.className = 'nebula';
    host.append(sky, this.nebula, app.canvas);
    app.stage.addChild(this.worldLayer, this.screenLayer);
    this.resize();
    window.addEventListener('resize', () => this.resize());
    app.ticker.add((ticker) => this.tick(Math.min(ticker.deltaMS, 50) / 1000));
  }

  static async create(host: HTMLElement): Promise<Game> {
    const app = new Application();
    await app.init({
      resizeTo: window,
      backgroundAlpha: 0,
      antialias: !window.matchMedia('(pointer: coarse)').matches,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      powerPreference: 'high-performance',
    });
    app.canvas.setAttribute('aria-label', 'Wortstrom – Spielwelt');
    app.canvas.style.touchAction = 'none';
    return new Game(app, host);
  }

  /** Switches scenes; the previous one is destroyed unless it should be kept for later. */
  setScene(scene: Scene, keepPrevious = false) {
    const prev = this.scene;
    if (prev) {
      this.worldLayer.removeChild(prev.root);
      prev.leave?.();
      if (!keepPrevious) prev.destroy();
    }
    this.scene = scene;
    this.input.reset();
    scene.enter?.();
    this.worldLayer.addChild(scene.root);
    this.input.onTap = (x, y) => this.scene?.tap?.(x, y);
    this.input.onHover = (x, y) => this.scene?.hover?.(x, y);
    this.input.onZoom = (f) => this.camera.zoomBy(f);
  }

  get frameRate() {
    return this.fps;
  }

  private resize() {
    const { width, height } = this.app.screen;
    this.camera.resize(width, height);
  }

  private tick(dt: number) {
    if (dt > 0) this.fps += (1 / dt - this.fps) * 0.05;
    if (this.paused) return;
    this.time += dt;
    this.scene?.update(dt, this.time);
    this.camera.apply(this.worldLayer);
    this.drawNebula();
  }

  /** Slow parallax so depth is felt while gliding; colours follow the scene. */
  private drawNebula() {
    const par = 0.18;
    const z = 0.6 + this.camera.zoom * 0.25;
    const x = -this.camera.x * par * z + Math.sin(this.time * 0.02) * 30;
    const y = -this.camera.y * par * z + Math.cos(this.time * 0.017) * 30;
    this.nebula.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${z.toFixed(3)})`;
    const key = `${this.nebulaColors.join(',')}|${this.nebulaStrength.toFixed(2)}`;
    if (key === this.nebulaKey) return;
    this.nebulaKey = key;
    const rgba = (c: number, a: number) => `rgba(${(c >> 16) & 255}, ${(c >> 8) & 255}, ${c & 255}, ${a})`;
    const cols = this.nebulaColors;
    this.nebula.style.setProperty('--neb1', rgba(cols[0], 0.55));
    this.nebula.style.setProperty('--neb2', rgba(cols[1 % cols.length], 0.5));
    this.nebula.style.setProperty('--neb3', rgba(cols[2 % cols.length], 0.45));
    this.nebula.style.setProperty('--neb4', rgba(cols[3 % cols.length], 0.4));
    this.nebula.style.opacity = String(Math.min(1, this.nebulaStrength * 1.2));
  }
}
