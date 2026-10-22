// Events from the game scene to the HTML interface.

export interface GameEvents {
  hud: { sheep: number; herd: number; fragments: number; totalFragments: number };
  fragment: { index: number };
  toast: { text: string; ref?: string; ms?: number };
  levelComplete: { fragments: number[] };
}

type Handler<T> = (payload: T) => void;

class Bus {
  private handlers = new Map<keyof GameEvents, Handler<never>[]>();

  on<K extends keyof GameEvents>(event: K, handler: Handler<GameEvents[K]>) {
    const list = this.handlers.get(event) ?? [];
    list.push(handler as Handler<never>);
    this.handlers.set(event, list);
  }

  emit<K extends keyof GameEvents>(event: K, payload: GameEvents[K]) {
    this.handlers.get(event)?.forEach((h) => (h as Handler<GameEvents[K]>)(payload));
  }
}

export const bus = new Bus();
