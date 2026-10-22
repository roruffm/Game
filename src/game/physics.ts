// Movement tuning shared by the game and the level solver in tests.
// Heights in tiles: a normal jump clears 3 tiles, a jump while carrying the sheep only 2.

export const TILE = 16;

export const PHYS = {
  gravity: 900,
  maxFall: 380,
  runSpeed: 96,
  carrySpeed: 80,
  groundAccel: 1100,
  airAccel: 800,
  jumpVelocity: 320,
  carryJumpVelocity: 262,
  /** Upward velocity is multiplied by this when the jump button is released early. */
  jumpCut: 0.45,
  coyoteTime: 0.09,
  jumpBuffer: 0.12,
  body: { w: 10, h: 14 },
} as const;

/** Hazard box of a thorn tile, relative to the tile's top-left corner. */
export const THORN_BOX = { x: 2, y: 6, w: 12, h: 10 } as const;
