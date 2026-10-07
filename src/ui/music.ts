// BGM。曲は public/bgm/ の mp3 を HTMLAudio で流す。
// ステージの曲はループで流し、別の曲のステージへ行ったら、ゆっくり入れかえる。
// 幕（章の始まり・終わり）の曲は1回だけ流し、その間はステージの曲を止めておく。
import { settings } from './settings';

const BASE = `${import.meta.env.BASE_URL}bgm/`;
/** 効果音や文字の音より、少し控えめにする */
const BGM_LEVEL = 0.6;

interface Track {
  name: string;
  el: HTMLAudioElement;
}

let loop: Track | null = null;
let once: Track | null = null;
/** いま流したいステージの曲（幕が終わったら、これを流す） */
let wanted: string | null = null;
/** ブラウザに止められた（クリックやキー入力の前は、音を出せない）ので、最初の操作でもう一度流す */
let blocked = false;
/** 章の終わりなどで、曲を止めておく間。ステージの曲を変えても流さない（次の章の始まりで resumeStageMusic すると、また流す） */
let held = false;

const level = () => (settings.bgm ? settings.volume * BGM_LEVEL : 0);

function make(name: string, repeat: boolean): HTMLAudioElement {
  const a = new Audio(`${BASE}${encodeURIComponent(name)}.mp3`);
  a.loop = repeat;
  a.preload = 'auto';
  a.volume = 0;
  return a;
}

/** 音量を ms かけて to にする */
function fade(a: HTMLAudioElement, to: number, ms: number): Promise<void> {
  return new Promise((done) => {
    const from = a.volume;
    const start = performance.now();
    const step = () => {
      const t = Math.min(1, (performance.now() - start) / Math.max(1, ms));
      a.volume = Math.max(0, Math.min(1, from + (to - from) * t));
      if (t < 1) requestAnimationFrame(step);
      else done();
    };
    step();
  });
}

async function start(a: HTMLAudioElement): Promise<boolean> {
  try {
    await a.play();
    return true;
  } catch {
    blocked = true;
    return false;
  }
}

function dropLoop(ms: number) {
  const old = loop;
  loop = null;
  if (!old) return;
  if (ms <= 0) old.el.pause();
  else void fade(old.el, 0, ms).then(() => old.el.pause());
}

function applyStage() {
  if (once || held) return;
  if (loop?.name === wanted) return;
  dropLoop(900);
  if (!wanted) return;
  const t: Track = { name: wanted, el: make(wanted, true) };
  loop = t;
  void start(t.el).then((ok) => {
    if (ok && loop === t) void fade(t.el, level(), 1200);
  });
}

/** ステージの曲を決める。同じ曲ならそのまま流しつづける。null なら止める */
export function setStageMusic(name: string | null) {
  wanted = name;
  applyStage();
}

/** すぐに音を止める（モリビトを止めた瞬間など）。ステージの曲が変わるまで、また流れることはない */
export function cutMusic() {
  dropLoop(0);
  wanted = null;
}

/**
 * 幕の曲を1回だけ流す。done は鳴り終わったら（BGM がオフ・鳴らせないときは fallbackMs たったら）終わる。
 * skip で途中でやめられる
 */
export function playOnce(name: string, fallbackMs: number): { done: Promise<void>; skip: (ms?: number) => void } {
  dropLoop(400);
  once?.el.pause();
  const t: Track = { name, el: make(name, false) };
  once = t;
  let finish!: () => void;
  const done = new Promise<void>((r) => (finish = r));
  let over = false;
  const end = () => {
    if (over) return;
    over = true;
    if (once === t) once = null;
    finish();
  };
  t.el.addEventListener('ended', end);
  t.el.addEventListener('error', () => setTimeout(end, fallbackMs));
  if (!settings.bgm || settings.volume <= 0) setTimeout(end, fallbackMs);
  else
    void start(t.el).then((ok) => {
      if (ok) t.el.volume = level();
      else setTimeout(end, fallbackMs);
    });
  /** ms かけて小さくして止める（エンディングの終わりは、ゆっくり） */
  const skip = (ms = 400) => {
    if (over) return;
    void fade(t.el, 0, ms).then(() => t.el.pause());
    end();
  };
  return { done, skip };
}

/** ステージの曲を ms かけて消し、resumeStageMusic まで流さない（章の終わり・記録の影） */
export function holdMusic(ms: number) {
  held = true;
  dropLoop(ms);
}

/** 幕の曲が終わったら、ステージの曲に戻す（幕を閉じたあとに呼ぶ） */
export function resumeStageMusic() {
  held = false;
  if (once) {
    once.el.pause();
    once = null;
  }
  applyStage();
}

/** 設定（BGM のオン・オフ、音量）が変わったとき */
export function refreshMusicVolume() {
  for (const t of [loop, once]) if (t) t.el.volume = level();
}

// 最初のクリックやキー入力で、止められていた曲を流しなおす
for (const ev of ['pointerdown', 'keydown'] as const)
  window.addEventListener(
    ev,
    () => {
      if (!blocked) return;
      blocked = false;
      for (const t of [loop, once])
        if (t?.el.paused)
          void start(t.el).then((ok) => {
            if (ok) void fade(t.el, level(), 600);
          });
    },
    { capture: true },
  );
