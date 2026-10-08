// 地図（左）と手帳（右）の幅。境目をドラッグして変えられる。幅はセーブとは別に、ブラウザに保存する
// （style.css の --side-user / --book-user。せまい画面で地図や手帳をしまう決まりは、style.css のほうが勝つ）

const KEY = 'moribito-layout';
const SIDE = { min: 220, max: 640, base: 300 };
const BOOK = { min: 220, max: 600, base: 290 };
/** まん中のターミナルに、少なくとも残す幅 */
const TERM_MIN = 380;

interface Widths {
  side?: number;
  book?: number;
}

let widths: Widths = load();

function load(): Widths {
  try {
    const w = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (w && typeof w === 'object') return { side: num(w.side), book: num(w.book) };
  } catch {
    /* ふつうの幅で遊ぶ */
  }
  return {};
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(widths));
  } catch {
    /* 保存できなくても続行 */
  }
}

function apply() {
  const root = document.documentElement.style;
  if (widths.side) root.setProperty('--side-user', `${widths.side}px`);
  else root.removeProperty('--side-user');
  if (widths.book) root.setProperty('--book-user', `${widths.book}px`);
  else root.removeProperty('--book-user');
}

/** いま画面に出ている幅（しまっているときは 0） */
function shown(id: string): number {
  return document.getElementById(id)?.getBoundingClientRect().width ?? 0;
}

/** 地図と手帳の幅を、はじめの幅にもどす */
export function resetLayout() {
  widths = {};
  save();
  apply();
}

/** 境目のつまみを置いて、保存してある幅を当てる */
export function setupLayout() {
  apply();
  const app = document.getElementById('app')!;
  const grip = (side: 'side' | 'book') => {
    const g = document.createElement('div');
    g.className = `splitter ${side}-split`;
    g.title = 'ドラッグで幅を変える（ダブルクリックでもとにもどす）';
    g.setAttribute('aria-hidden', 'true');
    g.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      g.setPointerCapture(e.pointerId);
      document.body.classList.add('resizing');
      const move = (ev: PointerEvent) => {
        const vw = window.innerWidth;
        if (side === 'side') {
          const room = vw - shown('bookpane') - TERM_MIN;
          widths.side = Math.round(clamp(ev.clientX, SIDE.min, Math.min(SIDE.max, room)));
        } else {
          const room = vw - shown('side') - TERM_MIN;
          widths.book = Math.round(clamp(vw - ev.clientX, BOOK.min, Math.min(BOOK.max, room)));
        }
        apply();
      };
      const up = () => {
        g.removeEventListener('pointermove', move);
        g.removeEventListener('pointerup', up);
        g.removeEventListener('pointercancel', up);
        document.body.classList.remove('resizing');
        save();
        // 候補の行の矢印などは、窓の大きさが変わったときに測り直している
        window.dispatchEvent(new Event('resize'));
      };
      g.addEventListener('pointermove', move);
      g.addEventListener('pointerup', up);
      g.addEventListener('pointercancel', up);
    });
    g.addEventListener('dblclick', () => {
      delete widths[side];
      save();
      apply();
      window.dispatchEvent(new Event('resize'));
    });
    return g;
  };
  app.append(grip('side'), grip('book'));
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(Math.max(lo, hi), v));
}
