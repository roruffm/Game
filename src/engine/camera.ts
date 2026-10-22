// A smooth 2D camera: follows a point, zooms, converts between screen and world.

import type { Container } from 'pixi.js';

export class Camera {
  x = 0;
  y = 0;
  zoom = 1;
  targetZoom = 1;
  width = 1;
  height = 1;
  minZoom = 0.08;
  maxZoom = 1.8;

  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  follow(tx: number, ty: number, dt: number, sharpness = 3) {
    const k = 1 - Math.exp(-dt * sharpness);
    this.x += (tx - this.x) * k;
    this.y += (ty - this.y) * k;
    this.zoom += (this.targetZoom - this.zoom) * (1 - Math.exp(-dt * 4));
  }

  jump(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  zoomBy(factor: number) {
    this.targetZoom = Math.min(this.maxZoom, Math.max(this.minZoom, this.targetZoom * factor));
  }

  apply(container: Container) {
    container.scale.set(this.zoom);
    container.position.set(this.width / 2 - this.x * this.zoom, this.height / 2 - this.y * this.zoom);
  }

  toWorld(sx: number, sy: number) {
    return { x: (sx - this.width / 2) / this.zoom + this.x, y: (sy - this.height / 2) / this.zoom + this.y };
  }

  toScreen(wx: number, wy: number) {
    return { x: (wx - this.x) * this.zoom + this.width / 2, y: (wy - this.y) * this.zoom + this.height / 2 };
  }

  /** The visible world rectangle, grown by a margin in world units. */
  view(margin = 0) {
    const w = this.width / this.zoom;
    const h = this.height / this.zoom;
    return { x: this.x - w / 2 - margin, y: this.y - h / 2 - margin, w: w + margin * 2, h: h + margin * 2 };
  }

  sees(x: number, y: number, margin = 0) {
    const v = this.view(margin);
    return x >= v.x && x <= v.x + v.w && y >= v.y && y <= v.y + v.h;
  }
}
