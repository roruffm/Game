// One input state for keyboard and touch buttons.

type Action = 'left' | 'right' | 'jump';

const KEYMAP: Record<string, Action> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  Space: 'jump',
  ArrowUp: 'jump',
  KeyW: 'jump',
  KeyK: 'jump',
};

class Input {
  left = false;
  right = false;
  jump = false;
  private jumpPressed = false;
  private keys = new Set<string>();
  private touch: Record<Action, boolean> = { left: false, right: false, jump: false };

  constructor() {
    window.addEventListener('keydown', (e) => {
      if (!KEYMAP[e.code] || isTyping(e)) return;
      e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      this.refresh();
    });
    window.addEventListener('keyup', (e) => {
      if (!KEYMAP[e.code]) return;
      this.keys.delete(e.code);
      this.refresh();
    });
    window.addEventListener('blur', () => this.reset());
  }

  setTouch(part: Partial<Record<Action, boolean>>) {
    Object.assign(this.touch, part);
    this.refresh();
  }

  /** True once per press, so a jump pressed slightly too early is not lost. */
  consumeJumpPress(): boolean {
    const p = this.jumpPressed;
    this.jumpPressed = false;
    return p;
  }

  reset() {
    this.keys.clear();
    this.touch = { left: false, right: false, jump: false };
    this.left = this.right = this.jump = this.jumpPressed = false;
  }

  private refresh() {
    const held = (a: Action) => this.touch[a] || [...this.keys].some((k) => KEYMAP[k] === a);
    const jump = held('jump');
    if (jump && !this.jump) this.jumpPressed = true;
    this.left = held('left');
    this.right = held('right');
    this.jump = jump;
  }
}

function isTyping(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.tagName === 'BUTTON');
}

export const input = new Input();
