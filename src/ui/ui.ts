// The HTML layer over the game: HUD, toasts, touch buttons and all screens
// (title, intros, verse puzzle, background, reflection, verse book, pause).

import type Phaser from 'phaser';
import { sound } from '../audio/sound';
import { QUOTES, TRANSLATION, UPCOMING, VERSES, type Verse } from '../data/verses';
import { bus } from '../game/bus';
import type { GameScene } from '../game/GameScene';
import { input } from '../game/input';
import { FRAGMENT, ICON_SHEEP, spriteDataUrl } from '../gfx/sprites';
import { persist, save } from '../save';

const VERSE = VERSES['lk15-6'];

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector(sel) as T;

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const touchDevice = () => window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

type Screen = (el: HTMLElement) => void;

export function createUI(game: Phaser.Game) {
  const scene = () => game.scene.getScene('game') as GameScene;
  const overlay = $('#overlay');
  const hud = $('#hud');
  const touch = $('#touch');
  let playing = false;
  let paused = false;

  applyFont();
  $<HTMLImageElement>('#hud-sheep-icon').src = spriteDataUrl(ICON_SHEEP, 2);
  $<HTMLImageElement>('#hud-frag-icon').src = spriteDataUrl(FRAGMENT, 2);

  // ── HUD and toasts ──────────────────────────────────────────────────

  bus.on('hud', (h) => {
    $('#hud-sheep').textContent = `${h.sheep}/${h.herd}`;
    $('#hud-frags').textContent = `${h.fragments}/${h.totalFragments}`;
  });

  const toasts: { text: string; ref?: string; ms: number }[] = [];
  let toastBusy = false;
  bus.on('toast', (t) => {
    toasts.push({ text: t.text, ref: t.ref, ms: t.ms ?? 3200 });
    if (toasts.length > 3) toasts.shift();
    if (!toastBusy) nextToast();
  });
  function nextToast() {
    const t = toasts.shift();
    const el = $('#toast');
    if (!t) {
      toastBusy = false;
      return;
    }
    toastBusy = true;
    el.innerHTML = `<p>${esc(t.text)}</p>${t.ref ? `<small>${esc(t.ref)}</small>` : ''}`;
    el.classList.add('show');
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(nextToast, 260);
    }, t.ms);
  }

  bus.on('levelComplete', ({ fragments }) => {
    playing = false;
    setPlayingUI(false);
    sound.music(null);
    show(puzzleScreen(fragments));
  });

  // ── Touch controls ──────────────────────────────────────────────────

  const dpad = $('#dpad');
  const dpadPointers = new Map<number, number>();
  const updateDpad = () => {
    const dirs = [...dpadPointers.values()];
    input.setTouch({ left: dirs.includes(-1), right: dirs.includes(1) });
    dpad.dataset.dir = dirs.includes(-1) ? 'left' : dirs.includes(1) ? 'right' : '';
  };
  const dpadDir = (e: PointerEvent) => {
    const r = dpad.getBoundingClientRect();
    return e.clientX < r.left + r.width / 2 ? -1 : 1;
  };
  dpad.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    dpad.setPointerCapture(e.pointerId);
    dpadPointers.set(e.pointerId, dpadDir(e));
    updateDpad();
  });
  dpad.addEventListener('pointermove', (e) => {
    if (!dpadPointers.has(e.pointerId)) return;
    dpadPointers.set(e.pointerId, dpadDir(e));
    updateDpad();
  });
  const dpadUp = (e: PointerEvent) => {
    dpadPointers.delete(e.pointerId);
    updateDpad();
  };
  dpad.addEventListener('pointerup', dpadUp);
  dpad.addEventListener('pointercancel', dpadUp);

  const jump = $('#jump');
  const jumpPointers = new Set<number>();
  jump.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    jump.setPointerCapture(e.pointerId);
    jumpPointers.add(e.pointerId);
    input.setTouch({ jump: true });
    jump.classList.add('down');
  });
  const jumpUp = (e: PointerEvent) => {
    jumpPointers.delete(e.pointerId);
    if (jumpPointers.size === 0) {
      input.setTouch({ jump: false });
      jump.classList.remove('down');
    }
  };
  jump.addEventListener('pointerup', jumpUp);
  jump.addEventListener('pointercancel', jumpUp);

  window.addEventListener('touchstart', () => document.body.classList.add('is-touch'), { once: true, passive: true });
  if (touchDevice()) document.body.classList.add('is-touch');

  // ── Pause ────────────────────────────────────────────────────────────

  $('#btn-pause').addEventListener('click', () => pause());
  window.addEventListener('keydown', (e) => {
    if ((e.code === 'Escape' || e.code === 'KeyP') && playing) {
      e.preventDefault();
      if (paused) resume();
      else pause();
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && playing && !paused) pause();
  });

  function pause() {
    if (!playing || paused) return;
    paused = true;
    game.scene.pause('game');
    sound.music(null);
    setPlayingUI(false);
    show(pauseScreen);
  }

  function resume() {
    paused = false;
    hide();
    setPlayingUI(true);
    input.reset();
    game.scene.resume('game');
    sound.music(scene().isCarrying() ? 'carry' : 'search');
  }

  // ── Screens ──────────────────────────────────────────────────────────

  function show(screen: Screen) {
    overlay.hidden = false;
    overlay.className = 'overlay';
    overlay.innerHTML = '';
    overlay.scrollTop = 0;
    screen(overlay);
    overlay.querySelector<HTMLElement>('[data-focus]')?.focus({ preventScroll: true });
  }

  function hide() {
    overlay.hidden = true;
    overlay.innerHTML = '';
    (document.activeElement as HTMLElement | null)?.blur();
  }

  function setPlayingUI(on: boolean) {
    hud.hidden = !on;
    touch.hidden = !on;
  }

  function panel(el: HTMLElement, html: string, cls = '') {
    el.innerHTML = `<div class="panel ${cls}">${html}</div>`;
  }

  function on(el: HTMLElement, action: string, fn: () => void) {
    el.querySelectorAll<HTMLElement>(`[data-action="${action}"]`).forEach((b) =>
      b.addEventListener('click', () => {
        sound.unlock();
        fn();
      }),
    );
  }

  const settingsButtons = () => `
    <div class="row small">
      <button class="btn ghost" data-action="mute">${sound.muted ? 'Ton: aus' : 'Ton: an'}</button>
      <button class="btn ghost" data-action="font">${save.settings.clearFont ? 'Schrift: klar' : 'Schrift: Pixel'}</button>
      ${document.fullscreenEnabled ? '<button class="btn ghost" data-action="fullscreen">Vollbild</button>' : ''}
    </div>`;

  function bindSettings(el: HTMLElement, rerender: () => void) {
    on(el, 'mute', () => {
      sound.setMuted(!sound.muted);
      rerender();
    });
    on(el, 'font', () => {
      save.settings.clearFont = !save.settings.clearFont;
      persist();
      applyFont();
      rerender();
    });
    on(el, 'fullscreen', () => {
      if (document.fullscreenElement) void document.exitFullscreen();
      else void document.documentElement.requestFullscreen?.().catch(() => undefined);
    });
  }

  const titleScreen: Screen = (el) => {
    el.classList.add('title-bg');
    panel(
      el,
      `<h1 class="logo">Lichtpfad</h1>
       <blockquote class="quote">„${esc(QUOTES.title.text)}“<cite>${esc(QUOTES.title.ref)}</cite></blockquote>
       <div class="row">
         <button class="btn primary" data-action="play" data-focus>Spielen</button>
         <button class="btn" data-action="book">Versbuch</button>
       </div>
       ${settingsButtons()}
       <p class="fine">Prototyp · Welt 1, Level 1 · Bibeltext: ${TRANSLATION}</p>`,
      'title',
    );
    on(el, 'play', () => show(worldIntro));
    on(el, 'book', () => show(bookScreen(() => show(titleScreen))));
    bindSettings(el, () => show(titleScreen));
  };

  const worldIntro: Screen = (el) => {
    panel(
      el,
      `<p class="kicker">Welt 1</p>
       <h2>Verloren und gefunden</h2>
       <blockquote class="quote">„${esc(QUOTES.world1.text)}“<cite>${esc(QUOTES.world1.ref)}</cite></blockquote>
       <div class="row"><button class="btn primary" data-action="next" data-focus>Weiter</button></div>`,
    );
    on(el, 'next', () => show(levelIntro));
  };

  const levelIntro: Screen = (el) => {
    const controls = document.body.classList.contains('is-touch')
      ? '<b>◀ ▶</b> unten links laufen · <b>▲</b> unten rechts springen (halten = höher)'
      : '<b>← →</b> oder <b>A D</b> laufen · <b>Leertaste</b> springen (halten = höher) · <b>Esc</b> Pause';
    panel(
      el,
      `<p class="kicker">Level 1</p>
       <h2>Das verlorene Schaf</h2>
       <p class="lead">Hundert Schafe. Eins fehlt.</p>
       <p>Unterwegs liegen Fragmente eines Bibelverses. Sammle sie – am Ende setzt du den Vers zusammen.</p>
       <p class="controls">${controls}</p>
       <div class="row"><button class="btn primary" data-action="go" data-focus>Los geht’s</button></div>`,
    );
    on(el, 'go', () => {
      hide();
      playing = true;
      paused = false;
      setPlayingUI(true);
      scene().begin();
    });
  };

  const pauseScreen: Screen = (el) => {
    panel(
      el,
      `<h2>Pause</h2>
       <div class="stack">
         <button class="btn primary" data-action="resume" data-focus>Weiter</button>
         <button class="btn" data-action="rest">Zum letzten Rastplatz</button>
         <button class="btn" data-action="restart">Level neu starten</button>
         <button class="btn" data-action="book">Versbuch</button>
         <button class="btn" data-action="title">Zum Titel</button>
       </div>
       ${settingsButtons()}`,
    );
    on(el, 'resume', resume);
    on(el, 'rest', () => {
      resume();
      scene().backToRestingPlace();
    });
    on(el, 'restart', () => {
      paused = false;
      hide();
      game.scene.resume('game');
      setPlayingUI(true);
      scene().restartLevel();
    });
    on(el, 'book', () => show(bookScreen(() => show(pauseScreen))));
    on(el, 'title', () => {
      paused = false;
      playing = false;
      game.scene.resume('game');
      scene().scene.restart({ autoplay: false });
      show(titleScreen);
    });
    bindSettings(el, () => show(pauseScreen));
  };

  // ── After the level: puzzle → verse → background → reflection → book ─

  function puzzleScreen(found: number[]): Screen {
    return (el) => {
      const order = [...found].sort((a, b) => a - b);
      if (order.length === 0) return revealScreen(order)(el);
      let next = 0;
      const chips = shuffle(order);
      panel(
        el,
        `<p class="kicker">${esc(VERSE.ref)}</p>
         <h2>Setz den Vers zusammen</h2>
         <p>Tippe die Fragmente in der richtigen Reihenfolge an.</p>
         <div class="slots">${VERSE.fragments
           .map((_, i) =>
             order.includes(i + 1)
               ? `<span class="slot" data-slot="${i + 1}">&nbsp;</span>`
               : `<span class="slot missing" title="nicht gefunden">…</span>`,
           )
           .join('')}</div>
         <div class="chips">${chips
           .map((i) => `<button class="chip" data-chip="${i}">${esc(VERSE.fragments[i - 1])}</button>`)
           .join('')}</div>
         <p class="feedback" aria-live="polite"></p>`,
        'puzzle',
      );
      el.querySelectorAll<HTMLButtonElement>('[data-chip]').forEach((chip) =>
        chip.addEventListener('click', () => {
          sound.unlock();
          const i = Number(chip.dataset.chip);
          const feedback = el.querySelector('.feedback')!;
          if (i !== order[next]) {
            chip.classList.remove('shake');
            void chip.offsetWidth;
            chip.classList.add('shake');
            feedback.textContent = 'Nicht ganz – welches Stück kommt als Nächstes?';
            return;
          }
          feedback.textContent = '';
          next++;
          chip.disabled = true;
          chip.classList.add('used');
          const slot = el.querySelector<HTMLElement>(`[data-slot="${i}"]`)!;
          slot.textContent = VERSE.fragments[i - 1];
          slot.classList.add('filled');
          sound.collect();
          if (next === order.length) setTimeout(() => show(revealScreen(order)), 700);
        }),
      );
    };
  }

  function revealScreen(found: number[]): Screen {
    return (el) => {
      const lead = VERSE.text.slice(0, VERSE.text.length - VERSE.fragments.join(' ').length).trim();
      const missing = VERSE.fragments.length - found.length;
      save.verses[VERSE.id] ??= { unlockedAt: new Date().toISOString() };
      persist();
      panel(
        el,
        `<p class="kicker">Neu im Versbuch</p>
         <blockquote class="verse"><span class="lead-in">${esc(lead)}</span> <strong>${esc(VERSE.fragments.join(' '))}</strong>
           <cite>${esc(VERSE.ref)} · ${TRANSLATION}</cite></blockquote>
         ${
           missing > 0
             ? `<p class="note">Du hast ${found.length} von ${VERSE.fragments.length} Fragmenten gefunden. Die übrigen warten noch – vielleicht beim nächsten Mal.</p>`
             : '<p class="note">Alle Fragmente gefunden.</p>'
         }
         <div class="row"><button class="btn primary" data-action="next" data-focus>Hintergrund</button></div>`,
        'reveal',
      );
      on(el, 'next', () => show(contextScreen));
    };
  }

  const contextScreen: Screen = (el) => {
    panel(
      el,
      `<p class="kicker">Hintergrund</p>
       <h2>Warum erzählt Jesus das?</h2>
       ${VERSE.context.map((p) => `<p>${esc(p)}</p>`).join('')}
       <blockquote class="quote small">„${esc(QUOTES.joy.text)}“<cite>${esc(QUOTES.joy.ref)}</cite></blockquote>
       <div class="row"><button class="btn primary" data-action="next" data-focus>Zum Nachdenken</button></div>`,
    );
    on(el, 'next', () => show(reflectScreen));
  };

  const reflectScreen: Screen = (el) => {
    panel(
      el,
      `<p class="kicker">Zum Nachdenken</p>
       <h2 class="question">${esc(VERSE.question)}</h2>
       <label class="field">
         <span>Deine Gedanken (optional – bleiben nur auf diesem Gerät)</span>
         <textarea rows="4" maxlength="2000"></textarea>
       </label>
       <div class="row"><button class="btn primary" data-action="next">Ins Versbuch</button></div>`,
    );
    const ta = el.querySelector('textarea')!;
    ta.value = save.notes[VERSE.id] ?? '';
    ta.addEventListener('input', () => {
      save.notes[VERSE.id] = ta.value;
      persist();
    });
    on(el, 'next', () => show(bookScreen(() => show(finishedScreen))));
  };

  const finishedScreen: Screen = (el) => {
    panel(
      el,
      `<p class="kicker">Level 1 geschafft</p>
       <h2>Danke fürs Spielen!</h2>
       <p>Als Nächstes in dieser Welt: <b>Der verlorene Groschen</b> und <b>Der verlorene Sohn</b>. Sie folgen im nächsten Schritt.</p>
       <div class="row">
         <button class="btn primary" data-action="again" data-focus>Nochmal spielen</button>
         <button class="btn" data-action="title">Zum Titel</button>
       </div>`,
    );
    on(el, 'again', () => {
      hide();
      playing = true;
      setPlayingUI(true);
      scene().restartLevel();
    });
    on(el, 'title', () => {
      scene().scene.restart({ autoplay: false });
      show(titleScreen);
    });
  };

  function bookScreen(back: () => void): Screen {
    return (el) => {
      const entries = Object.values(VERSES)
        .map((v) => bookEntry(v))
        .join('');
      const locked = UPCOMING.map(
        (u) => `<li class="entry locked"><b>${esc(u.ref)}</b><span>${esc(u.title)} – noch verborgen</span></li>`,
      ).join('');
      panel(
        el,
        `<h2>Versbuch</h2>
         <ul class="book">${entries}${locked}</ul>
         <div class="row"><button class="btn primary" data-action="back" data-focus>Zurück</button></div>`,
        'book-panel',
      );
      on(el, 'back', back);
    };
  }

  function bookEntry(v: Verse): string {
    const unlocked = !!save.verses[v.id];
    if (!unlocked) {
      const n = save.fragments[v.id]?.length ?? 0;
      return `<li class="entry locked"><b>${esc(v.ref)}</b><span>${n ? `${n} von ${v.fragments.length} Fragmenten gefunden` : 'noch verborgen'}</span></li>`;
    }
    const note = save.notes[v.id]?.trim();
    return `<li class="entry">
      <b>${esc(v.ref)}</b>
      <p class="verse-text">${esc(v.text)}</p>
      ${note ? `<p class="my-note"><span>Deine Gedanken:</span> ${esc(note)}</p>` : ''}
    </li>`;
  }

  const params = new URLSearchParams(location.search);
  if (params.has('dev') && params.has('play')) {
    playing = true;
    setPlayingUI(true);
    scene().begin();
  } else {
    show(titleScreen);
  }
}

function applyFont() {
  document.body.classList.toggle('clear-font', save.settings.clearFont);
}

/** Shuffles, and makes sure the result is not already in order. */
function shuffle(items: number[]): number[] {
  if (items.length < 2) return items.slice();
  let out = items.slice();
  do {
    out = out
      .map((v) => ({ v, r: Math.random() }))
      .sort((a, b) => a.r - b.r)
      .map((o) => o.v);
  } while (out.every((v, i) => v === items[i]));
  return out;
}
