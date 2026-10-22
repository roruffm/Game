// Input: mouse (the organism follows the pointer), keyboard (WASD/arrows), touch
// (drag anywhere as a soft joystick, tap to choose or to glide there, pinch to zoom).

import type { Camera } from './camera';

export interface Steer {
  x: number;
  y: number;
  thrust: number;
  boost: boolean;
}

type TapHandler = (sx: number, sy: number) => void;

const MOVE_KEYS: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  KeyW: [0, -1],
  ArrowDown: [0, 1],
  KeyS: [0, 1],
  ArrowLeft: [-1, 0],
  KeyA: [-1, 0],
  ArrowRight: [1, 0],
  KeyD: [1, 0],
};

export class Input {
  private keys = new Set<string>();
  private mouse = { x: 0, y: 0, inside: false, down: false, movedAt: -1e9 };
  private touches = new Map<number, { x: number; y: number; sx: number; sy: number; t: number; moved: boolean }>();
  private pinchDist = 0;
  /** World point to glide to after a tap on empty space. */
  glide: { x: number; y: number } | null = null;
  /** Screen position of the touch joystick, for drawing. */
  joystick: { x: number; y: number; dx: number; dy: number } | null = null;
  lastDevice: 'mouse' | 'touch' | 'keyboard' = 'mouse';
  onTap: TapHandler = () => {};
  onHover: TapHandler = () => {};
  onZoom: (factor: number) => void = () => {};
  enabled = true;

  constructor(private readonly el: HTMLElement) {
    el.addEventListener('pointerdown', this.down);
    el.addEventListener('pointermove', this.move);
    el.addEventListener('pointerup', this.up);
    el.addEventListener('pointercancel', this.up);
    el.addEventListener('pointerleave', () => {
      this.mouse.inside = false;
    });
    el.addEventListener('wheel', this.wheel, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', this.keydown);
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  private keydown = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    if (MOVE_KEYS[e.code] || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      this.keys.add(e.code);
      this.lastDevice = 'keyboard';
      this.glide = null;
      if (MOVE_KEYS[e.code]) e.preventDefault();
    }
  };

  private down = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') {
      this.lastDevice = 'mouse';
      this.mouse.down = true;
      this.mouse.x = e.offsetX;
      this.mouse.y = e.offsetY;
      this.mouse.movedAt = performance.now();
      this.touches.set(e.pointerId, { x: e.offsetX, y: e.offsetY, sx: e.offsetX, sy: e.offsetY, t: performance.now(), moved: false });
      return;
    }
    this.lastDevice = 'touch';
    this.el.setPointerCapture?.(e.pointerId);
    this.touches.set(e.pointerId, { x: e.offsetX, y: e.offsetY, sx: e.offsetX, sy: e.offsetY, t: performance.now(), moved: false });
    if (this.touches.size === 2) this.pinchDist = this.touchDistance();
  };

  private move = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') {
      this.mouse.x = e.offsetX;
      this.mouse.y = e.offsetY;
      this.mouse.inside = true;
      this.mouse.movedAt = performance.now();
      this.lastDevice = 'mouse';
      this.glide = null;
      this.onHover(e.offsetX, e.offsetY);
    }
    const t = this.touches.get(e.pointerId);
    if (!t) return;
    t.x = e.offsetX;
    t.y = e.offsetY;
    if (Math.hypot(t.x - t.sx, t.y - t.sy) > 12) t.moved = true;
    if (this.touches.size === 2 && e.pointerType !== 'mouse') {
      const d = this.touchDistance();
      if (this.pinchDist > 0 && d > 0) this.onZoom(d / this.pinchDist);
      this.pinchDist = d;
    }
  };

  private up = (e: PointerEvent) => {
    const t = this.touches.get(e.pointerId);
    this.touches.delete(e.pointerId);
    if (e.pointerType === 'mouse') this.mouse.down = false;
    if (this.touches.size < 2) this.pinchDist = 0;
    if (t && !t.moved && performance.now() - t.t < 450 && this.enabled) this.onTap(e.offsetX, e.offsetY);
  };

  private wheel = (e: WheelEvent) => {
    e.preventDefault();
    this.onZoom(Math.exp(-e.deltaY * 0.0012));
  };

  private touchDistance() {
    const [a, b] = [...this.touches.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  /** Steering for an organism at world position (ox, oy). */
  steer(camera: Camera, ox: number, oy: number): Steer {
    const none = { x: 0, y: 0, thrust: 0, boost: false };
    if (!this.enabled) return none;
    const boost = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    let kx = 0;
    let ky = 0;
    for (const k of this.keys) {
      const d = MOVE_KEYS[k];
      if (d) {
        kx += d[0];
        ky += d[1];
      }
    }
    if (kx || ky) {
      const l = Math.hypot(kx, ky);
      return { x: kx / l, y: ky / l, thrust: 1, boost };
    }

    // touch joystick: the first touch that is dragging
    this.joystick = null;
    if (this.touches.size === 1) {
      const t = [...this.touches.values()][0];
      if (t.moved && this.lastDevice === 'touch') {
        const dx = t.x - t.sx;
        const dy = t.y - t.sy;
        const l = Math.hypot(dx, dy);
        this.joystick = { x: t.sx, y: t.sy, dx, dy };
        this.glide = null;
        return { x: dx / l, y: dy / l, thrust: Math.min(1, l / 70), boost: l > 110 };
      }
    }

    if (this.glide) {
      const dx = this.glide.x - ox;
      const dy = this.glide.y - oy;
      const l = Math.hypot(dx, dy);
      if (l < 18) {
        this.glide = null;
        return none;
      }
      return { x: dx / l, y: dy / l, thrust: Math.min(1, l / 160), boost: false };
    }

    // mouse: drift towards the pointer while it is over the world and has moved recently
    if (this.lastDevice === 'mouse' && this.mouse.inside && performance.now() - this.mouse.movedAt < 4000) {
      const w = camera.toWorld(this.mouse.x, this.mouse.y);
      const dx = w.x - ox;
      const dy = w.y - oy;
      const l = Math.hypot(dx, dy);
      if (l < 26) return none;
      return { x: dx / l, y: dy / l, thrust: Math.min(1, (l - 26) / (220 / camera.zoom)), boost: this.mouse.down };
    }
    return none;
  }

  get pointer() {
    return this.mouse;
  }

  reset() {
    this.keys.clear();
    this.touches.clear();
    this.glide = null;
    this.joystick = null;
  }
}
