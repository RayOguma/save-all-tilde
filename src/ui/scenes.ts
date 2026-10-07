// 章の幕（始まり・終わり）の背景。160×90 ドットの小さな絵を描いて、画面ではドットのまま拡大する。
// 主人公は「頭（表情）＋体＋腕のポーズ」を組み合わせて作る。立ち絵の 16×16 より大きい 16×24。
// 背景の木・家・沼などは、下の描く関数を組み合わせる。登場人物は sprites.ts の立ち絵をそのまま並べる。
import type { Gender } from '../state';
import { spritePalette, spriteRows } from './sprites';

export const SCENE_W = 160;
export const SCENE_H = 90;
/** 地面の高さ（ここに足がつく） */
const GROUND = 70;

// ---- 主人公（16×24）----

export type Face = 'smile' | 'determined' | 'joy' | 'tired' | 'relieved';
export type Pose = 'stand' | 'back' | 'fist' | 'wipe' | 'wave' | 'banzai';

/** 左半分を書いて、左右を反転してつなげる */
const mirror = (left: string) => left + [...left].reverse().join('');

/** 顔の中（4〜11列目）の5行。眉・目・目・ほお・口 */
const FACES: Record<Face, string[]> = {
  smile: ['hhsssshh', 'ssessess', 'ssessess', 'scsssscs', 'sssmmsss'],
  determined: ['hksssskh', 'ssessess', 'ssessess', 'ssssssss', 'sskkkkss'],
  joy: ['hhsssshh', 'ssksskss', 'skskksks', 'scsssscs', 'ssmmmmss'],
  tired: ['hhsssshh', 'ssssssss', 'skksskks', 'ssssssss', 'sssmssss'],
  relieved: ['hhsssshh', 'ssssssss', 'skksskks', 'scsssscs', 'ssmmmmss'],
};

const HEAD_TOP = ['.....kkkkkk.....', '....khhhhhhk....', '...khhhhhhhhk...', '...khhhhhhhhk...'];
const CHIN = '....kssssssk....';
const HEAD_BACK = [
  ...HEAD_TOP,
  '...khhhhhhhhk...',
  '...khhhhhhhhk...',
  '...khhhhhhhhk...',
  '...khhhhhhhhk...',
  '....khhhhhhk....',
  '....kksssskk....',
];

const BODY = [
  mirror('....kkgg'),
  mirror('...kgggg'),
  mirror('..kggggg'),
  mirror('..kgkggg'),
  mirror('..kgkggg'),
  mirror('..kskggg'),
  mirror('...kkkkk'),
  mirror('....kppp'),
  mirror('....kppp'),
  mirror('....kppk'),
  mirror('....kppk'),
  mirror('....kppk'),
  mirror('...kbbbk'),
  mirror('...kkkkk'),
];

/** 腕のポーズ。'.' はそのまま、'_' は消す、ほかの文字は上から描く。行の番号 → 16文字 */
type Overlay = Record<number, string>;

const ARM_UP_RIGHT: Overlay = {
  1: '.............kk.',
  2: '............kssk',
  3: '............kssk',
  ...Object.fromEntries([4, 5, 6, 7, 8, 9, 10, 11].map((r) => [r, '............kgk.'])),
  12: '...........k__..',
  13: '...........k__..',
  14: '...........k__..',
  15: '...........k__..',
};
const flip = (o: Overlay): Overlay => Object.fromEntries(Object.entries(o).map(([r, s]) => [r, [...s].reverse().join('')]));

const OVERLAYS: Record<Pose, Overlay[]> = {
  stand: [],
  back: [],
  // ガッツポーズ（右手を突き上げる）
  fist: [ARM_UP_RIGHT],
  // 手を振る（指を開く）
  wave: [{ ...ARM_UP_RIGHT, 1: '............k.k.', 0: '...............k' }],
  // 両手を上げて、ばんざい
  banzai: [ARM_UP_RIGHT, flip(ARM_UP_RIGHT)],
  // 左手で、おでこの汗をぬぐう
  wipe: [
    {
      3: '...kssk.........',
      4: '...kssk.........',
      5: '..kgk...........',
      6: '..kgk...........',
      7: '.kgk............',
      8: '.kgk............',
      9: '.kgk............',
      10: '.kgk............',
      11: '..kg............',
      12: '..__............',
      13: '..__............',
      14: '..__............',
      15: '..__............',
    },
  ],
};

const PLAYER_PAL: Record<Gender, Record<string, string>> = {
  boy: { h: '#3a2a22', g: '#3f8f7a', p: '#2a3a5a', b: '#5a3a2a' },
  girl: { h: '#5a3424', g: '#e08a4a', p: '#3a3a6a', b: '#6a3a2a', R: '#e0605a' },
};
const BASE_PAL: Record<string, string> = {
  k: '#1e1612',
  s: '#f2c79b',
  e: '#1e1612',
  m: '#c0504d',
  c: '#f0a090',
  d: '#9fd3ff',
  w: '#f4f1ea',
};

function apply(rows: string[], o: Overlay): string[] {
  const out = rows.map((r) => [...r]);
  for (const [r, s] of Object.entries(o)) {
    [...s].forEach((ch, x) => {
      if (ch === '.') return;
      out[Number(r)][x] = ch === '_' ? '.' : ch;
    });
  }
  return out.map((r) => r.join(''));
}

/** 主人公の絵（16×24 の行と色）。DOM を使わないのでテストできる */
export function playerRows(gender: Gender, face: Face, pose: Pose): { rows: string[]; pal: Record<string, string> } {
  const head = pose === 'back' ? [...HEAD_BACK] : [...HEAD_TOP, ...FACES[face].map((f) => `...k${f}k...`), CHIN];
  let rows = [...head, ...BODY];
  if (gender === 'girl') {
    // 長い髪とリボン
    const hair: Overlay = { 1: '...........RR...' };
    if (pose === 'back') {
      for (let r = 9; r <= 13; r++) hair[r] = '...khhhhhhhhk...';
      hair[1] = '.......RR.......';
    } else for (let r = 2; r <= 11; r++) hair[r] = '..kh........hk..';
    rows = apply(rows, hair);
  }
  for (const o of OVERLAYS[pose]) rows = apply(rows, o);
  // 疲れた顔には、汗のしずく
  if (face === 'tired' && pose !== 'back') rows = apply(rows, { 4: '.............d..', 5: '.............dd.' });
  return { rows, pal: { ...BASE_PAL, ...PLAYER_PAL[gender] } };
}

// ---- 描く道具 ----

type Ctx = CanvasRenderingContext2D;

function rect(ctx: Ctx, x: number, y: number, w: number, h: number, c: string) {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/** 塗りつぶした楕円（ドットのまま） */
function ellipse(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, c: string) {
  ctx.fillStyle = c;
  for (let y = -ry; y <= ry; y++) {
    const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))));
    ctx.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1);
  }
}

function sky(ctx: Ctx, top: string, bottom: string) {
  const g = ctx.createLinearGradient(0, 0, 0, GROUND);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SCENE_W, GROUND);
}

/** 地面。a が地の色、b がところどころの点 */
function ground(ctx: Ctx, a: string, b: string, seed = 1) {
  rect(ctx, 0, GROUND, SCENE_W, SCENE_H - GROUND, a);
  let s = seed;
  for (let i = 0; i < 70; i++) {
    s = (s * 9301 + 49297) % 233280;
    const x = (s / 233280) * SCENE_W;
    s = (s * 9301 + 49297) % 233280;
    const y = GROUND + 2 + (s / 233280) * (SCENE_H - GROUND - 3);
    rect(ctx, x, y, 2, 1, b);
  }
}

function grid(ctx: Ctx, rows: string[], pal: Record<string, string>, x: number, y: number, flipX = false) {
  rows.forEach((row, ry) => {
    const chars = flipX ? [...row].reverse() : [...row];
    chars.forEach((ch, rx) => {
      if (ch === '.') return;
      ctx.fillStyle = pal[ch] ?? '#ff00ff';
      ctx.fillRect(Math.round(x + rx), Math.round(y + ry), 1, 1);
    });
  });
}

/** 立ち絵（16×16）を、足もとが footY に来るように置く */
function figure(ctx: Ctx, id: string, x: number, footY = GROUND + 1, flipX = false) {
  const rows = spriteRows(id);
  grid(ctx, rows, spritePalette(id), x, footY - rows.length, flipX);
}

function player(ctx: Ctx, gender: Gender, face: Face, pose: Pose, x: number) {
  const p = playerRows(gender, face, pose);
  grid(ctx, p.rows, p.pal, x, GROUND + 1 - p.rows.length);
}

function cloud(ctx: Ctx, x: number, y: number, c = '#ffffff') {
  ellipse(ctx, x, y, 8, 3, c);
  ellipse(ctx, x + 6, y - 2, 6, 3, c);
  ellipse(ctx, x - 6, y + 1, 5, 2, c);
}

function hills(ctx: Ctx, c: string, y: number, seed: number) {
  for (let i = -1; i < 6; i++) ellipse(ctx, i * 34 + seed, y + 10, 26, 14, c);
}

/** 木。幹と、三段の葉 */
function tree(ctx: Ctx, x: number, h: number, leaf: string, dark: string, trunk = '#6a4428') {
  rect(ctx, x - 2, GROUND - h * 0.45, 4, h * 0.45 + 1, trunk);
  ellipse(ctx, x, GROUND - h * 0.55, h * 0.36, h * 0.24, dark);
  ellipse(ctx, x, GROUND - h * 0.68, h * 0.3, h * 0.2, leaf);
  ellipse(ctx, x, GROUND - h * 0.84, h * 0.2, h * 0.15, leaf);
  ellipse(ctx, x - h * 0.08, GROUND - h * 0.88, h * 0.08, h * 0.05, '#ffffff22');
}

function house(ctx: Ctx, x: number, w: number, h: number, wall: string, roof: string, opts: { door?: string; window?: string; chimney?: boolean } = {}) {
  const top = GROUND - h;
  rect(ctx, x, top, w, h + 1, wall);
  for (let i = 0; i <= 6; i++) rect(ctx, x - 3 + i, top - 6 + i, w + 6 - i * 2, 1, roof);
  rect(ctx, x - 3, top - 1, w + 6, 2, roof);
  if (opts.chimney) rect(ctx, x + w - 7, top - 10, 4, 6, '#7a4a3a');
  rect(ctx, x + w / 2 - 3, GROUND - 9, 6, 10, opts.door ?? '#6a4428');
  if (opts.window) {
    rect(ctx, x + 3, top + 4, 5, 4, opts.window);
    rect(ctx, x + w - 8, top + 4, 5, 4, opts.window);
  }
}

function smoke(ctx: Ctx, x: number, y: number, c = '#ffffffcc') {
  ellipse(ctx, x, y, 2, 2, c);
  ellipse(ctx, x + 3, y - 5, 3, 2, c);
  ellipse(ctx, x + 1, y - 10, 3, 3, c);
}

function reeds(ctx: Ctx, x: number, c: string, top: string) {
  for (let i = 0; i < 5; i++) {
    const h = 10 + ((i * 7) % 6);
    rect(ctx, x + i * 2, GROUND - h, 1, h + 1, c);
    rect(ctx, x + i * 2, GROUND - h - 3, 1, 3, top);
  }
}

/** 市場の天幕の露店 */
function stall(ctx: Ctx, x: number, w: number, a: string, b: string) {
  rect(ctx, x, GROUND - 22, 2, 23, '#6a4428');
  rect(ctx, x + w - 2, GROUND - 22, 2, 23, '#6a4428');
  for (let i = 0; i < w; i++) rect(ctx, x + i, GROUND - 26, 1, 6, Math.floor(i / 4) % 2 ? b : a);
  for (let i = 0; i < w; i += 4) rect(ctx, x + i + 1, GROUND - 20, 2, 1, a);
  rect(ctx, x + 2, GROUND - 8, w - 4, 9, '#a0703a');
  rect(ctx, x + 2, GROUND - 8, w - 4, 1, '#c8905a');
}

function stars(ctx: Ctx, n: number, seed: number, c = '#ffffffaa') {
  let s = seed;
  for (let i = 0; i < n; i++) {
    s = (s * 9301 + 49297) % 233280;
    const x = (s / 233280) * SCENE_W;
    s = (s * 9301 + 49297) % 233280;
    rect(ctx, x, (s / 233280) * 40, 1, 1, c);
  }
}

// ---- 章ごとの幕 ----

export interface SceneOpts {
  gender: Gender;
  /** コダマが仲間になっているか（一緒に映る） */
  kodama: boolean;
}

type Draw = (ctx: Ctx, o: SceneOpts) => void;

/** 幕のコダマ（横向きの全身。尾に鈴） */
const KODAMA_BODY = {
  rows: [
    '..............kk....',
    '.............kwk.k..',
    '............kwrkwk..',
    '...........kwwwwwwk.',
    '..kkk......kwwewwwkk',
    '.kwwwk....kwwwwwwwwk',
    'kwwwwwk..kwwwwwwkkk.',
    'kwwyywwkkwwwwwwk....',
    '.kwwywwwwwwwwwWk....',
    '..kkwwwwwwwwwWk.....',
    '....kwwkkkkwwk......',
    '....kwk....kwk......',
    '....kk.....kk.......',
  ],
  pal: { k: '#1e1612', w: '#f4f6fa', W: '#c8d0dc', e: '#1e1612', r: '#e07a8a', y: '#e8b84a' },
};

/** 主人公（とコダマ）を真ん中に置く。コダマは、主人公と同じほうを向いて横に並ぶ */
function hero(ctx: Ctx, o: SceneOpts, face: Face, pose: Pose, x = 72) {
  player(ctx, o.gender, face, pose, x);
  if (o.kodama) grid(ctx, KODAMA_BODY.rows, KODAMA_BODY.pal, x + 17, GROUND + 1 - KODAMA_BODY.rows.length, pose !== 'back');
}

const VILLAGE_DAY: Draw = (ctx) => {
  sky(ctx, '#3f8fe0', '#bfe3ff');
  cloud(ctx, 30, 14);
  cloud(ctx, 118, 10);
  hills(ctx, '#7cc47c', 52, 6);
  house(ctx, 6, 34, 22, '#f0e0b8', '#c0504d', { window: '#9fd3ff', door: '#8a5a3a' });
  house(ctx, 118, 34, 20, '#f2d8a8', '#e0a84a', { window: '#ffe8a0', chimney: true });
  smoke(ctx, 147, 34);
  ground(ctx, '#5aa85a', '#4a9048', 3);
  // 村の道
  for (let y = GROUND; y < SCENE_H; y++) {
    const w = 10 + (y - GROUND) * 1.6;
    rect(ctx, 80 - w / 2, y, w, 1, '#c8a070');
  }
};

const VILLAGE_DUSK: Draw = (ctx) => {
  sky(ctx, '#07040a', '#3a0f1a');
  stars(ctx, 26, 7, '#e8a0a855');
  ellipse(ctx, 132, 16, 6, 6, '#c86a6a');
  hills(ctx, '#2a1420', 52, 6);
  // 村の外、これから向かう森が遠くに見える
  for (let i = 0; i < 4; i++) tree(ctx, 96 + i * 9, 26, '#1e3a24', '#16301c', '#1a120e');
  house(ctx, 6, 34, 22, '#5a4a48', '#4a2a2a', { window: '#2a2028', door: '#3a2a22' });
  house(ctx, 118, 34, 20, '#5a4a42', '#5a3a28', { window: '#2a2028', chimney: true });
  ground(ctx, '#3a3a34', '#2a2a26', 3);
};

const FOREST: Draw = (ctx) => {
  sky(ctx, '#8ccc90', '#e0f2c0');
  // 奥の木（小さく、暗く）
  for (let i = 0; i < 9; i++) tree(ctx, 8 + i * 18, 34, '#3a7a44', '#2e6438');
  // 手前の木
  tree(ctx, 10, 64, '#4cae5a', '#2b6e35');
  tree(ctx, 40, 52, '#56b862', '#2b6e35');
  tree(ctx, 124, 56, '#4cae5a', '#2b6e35');
  tree(ctx, 152, 66, '#56b862', '#2b6e35');
  ground(ctx, '#3f8a3f', '#2e6a30', 11);
};

const SWAMP: Draw = (ctx) => {
  sky(ctx, '#4a3a5a', '#a898b8');
  // 霧の帯
  rect(ctx, 0, 30, SCENE_W, 3, '#c8c0d855');
  rect(ctx, 0, 44, SCENE_W, 2, '#c8c0d844');
  // 枯れ木
  rect(ctx, 22, 28, 3, 40, '#3a2c38');
  rect(ctx, 16, 36, 8, 2, '#3a2c38');
  rect(ctx, 24, 32, 7, 2, '#3a2c38');
  // 沼の水と浮き草
  rect(ctx, 0, 56, SCENE_W, 14, '#4a5a5a');
  for (let i = 0; i < 10; i++) rect(ctx, (i * 37) % SCENE_W, 58 + (i % 4) * 3, 8, 1, '#6a7a7a');
  ellipse(ctx, 34, 62, 7, 2, '#4a8a3a');
  ellipse(ctx, 112, 60, 8, 2, '#4a8a3a');
  ellipse(ctx, 140, 66, 6, 2, '#4a8a3a');
  reeds(ctx, 2, '#6a7a3a', '#5a3a28');
  reeds(ctx, 146, '#6a7a3a', '#5a3a28');
  // 手前のぬかるみ
  rect(ctx, 0, GROUND, SCENE_W, SCENE_H - GROUND, '#4a3e34');
  ground(ctx, '#4a3e34', '#3a3028', 5);
  for (let i = 0; i < 6; i++) ellipse(ctx, 14 + i * 28, GROUND + 9, 5, 1, '#5a6a5a');
};

const FAR_SHORE: Draw = (ctx, o) => {
  SWAMP(ctx, o);
  // 向こう岸の岩と、渡ってきた飛び石
  ellipse(ctx, 140, 62, 18, 8, '#7a7068');
  ellipse(ctx, 140, 58, 12, 4, '#9a9088');
  for (let i = 0; i < 4; i++) ellipse(ctx, 20 + i * 14, 64 - i, 4, 2, '#8a8078');
};

/** ムラガレ。warm なら、窓に明かりがともる（第3章の終わり） */
function muragare(ctx: Ctx, warm: boolean) {
  sky(ctx, warm ? '#1a0a1a' : '#07040a', warm ? '#6a2a2a' : '#3a0f1a');
  stars(ctx, 20, 3, '#e8a0a844');
  hills(ctx, '#24121c', 54, 14);
  const lit = warm ? '#f2c46d' : '#2a2028';
  house(ctx, 4, 30, 20, '#5a4a48', '#3a2a3a', { window: lit, door: '#2a1e1a' });
  house(ctx, 44, 24, 16, '#4a4044', '#3a2a3a', { window: '#2a2028', door: '#2a1e1a' });
  house(ctx, 122, 32, 22, '#544844', '#3a2a3a', { window: lit, door: '#2a1e1a' });
  ground(ctx, '#3a3634', '#2a2826', 9);
}

/** 市場。stage なら、右の露店のかわりに広場の舞台を置く（第4章の終わり） */
function market(ctx: Ctx, stage: boolean) {
  sky(ctx, '#f2b85a', '#ffe0a8');
  cloud(ctx, 40, 12, '#fff3d6');
  stall(ctx, 4, 34, '#d85a4a', '#f6ead2');
  stall(ctx, 44, 26, '#4f8fd6', '#f6ead2');
  if (!stage) stall(ctx, 118, 38, '#e0a84a', '#f6ead2');
  ground(ctx, '#c8a070', '#b08858', 13);
  // 石だたみ
  for (let x = 0; x < SCENE_W; x += 8) rect(ctx, x, GROUND + 6, 6, 1, '#b08858');
  if (stage) stageProp(ctx);
}

/** 広場の舞台（第4章の終わり） */
function stageProp(ctx: Ctx) {
  rect(ctx, 104, GROUND - 6, 46, 7, '#b07a40');
  rect(ctx, 104, GROUND - 6, 46, 1, '#d8a060');
  rect(ctx, 104, GROUND - 30, 3, 24, '#c0504d');
  rect(ctx, 147, GROUND - 30, 3, 24, '#c0504d');
  rect(ctx, 104, GROUND - 32, 46, 3, '#c0504d');
}

/** 縄で縛った包み（.tar.gz） */
function bundle(ctx: Ctx, x: number, w = 4) {
  ellipse(ctx, x, GROUND - 3, w, 3, '#c8a070');
  rect(ctx, x, GROUND - 6, 1, 7, '#7a4a2a');
  rect(ctx, x - w, GROUND - 3, w * 2, 1, '#7a4a2a');
}

/** 廃墟山道。灰色の山肌と、崩れた石垣。shrine なら、右の崖の向こうに古い祠（第5章の終わり） */
function mountainPass(ctx: Ctx, shrine: boolean) {
  sky(ctx, '#5a5a66', '#b8b4ac');
  hills(ctx, '#7a766e', 44, 10);
  hills(ctx, '#8a857c', 54, 30);
  ground(ctx, '#6e6a64', '#5a5650', 17);
  // 崩れた石垣
  for (const [x, h] of [[6, 14], [16, 9], [26, 12], [132, 10], [142, 16], [152, 8]]) {
    rect(ctx, x, GROUND - h, 9, h + 1, '#8c8780');
    rect(ctx, x, GROUND - h, 9, 1, '#a39e96');
  }
  if (shrine) {
    // 崖の向こうの古い祠
    rect(ctx, 122, GROUND - 22, 2, 23, '#5a4a3a');
    rect(ctx, 140, GROUND - 22, 2, 23, '#5a4a3a');
    rect(ctx, 118, GROUND - 26, 28, 4, '#8a3a3a');
    rect(ctx, 126, GROUND - 14, 12, 10, '#7a6a5a');
  } else {
    // 転がっている包み
    bundle(ctx, 48);
    bundle(ctx, 112, 5);
    bundle(ctx, 124);
  }
}

/** 坑道アナグラ。lit なら、ランプの明かりが戻っている（第6章の終わり） */
function mine(ctx: Ctx, lit: boolean) {
  sky(ctx, lit ? '#2a2018' : '#0a0806', lit ? '#4a3a2a' : '#1a1410');
  // 木の支柱と梁
  for (const x of [10, 74, 140]) {
    rect(ctx, x, 12, 4, GROUND - 11, '#6a4428');
    rect(ctx, x + 4, 12, 1, GROUND - 11, '#4a2c18');
  }
  rect(ctx, 0, 10, SCENE_W, 4, '#6a4428');
  // ランプ
  for (const x of [40, 112]) {
    rect(ctx, x, 16, 1, 6, '#3a2c20');
    ellipse(ctx, x, 24, 2, 2, lit ? '#f2c46d' : '#5a4020');
    if (lit) ellipse(ctx, x, 24, 7, 5, '#f2c46d22');
  }
  // レール
  ground(ctx, lit ? '#3a3028' : '#1a1612', lit ? '#2a2420' : '#120e0c', 23);
  rect(ctx, 0, GROUND + 6, SCENE_W, 1, '#8a8078');
  rect(ctx, 0, GROUND + 12, SCENE_W, 1, '#8a8078');
  for (let x = 4; x < SCENE_W; x += 10) rect(ctx, x, GROUND + 5, 3, 9, '#4a2c18');
  if (!lit) {
    // 暗がりの奥の、赤い目
    rect(ctx, 128, 44, 2, 1, '#e04040');
    rect(ctx, 133, 44, 2, 1, '#e04040');
  }
}

/** 物見の塔。下から見上げた塔（大時計つき）。top なら、塔のてっぺんから見晴らした景色（第7章の終わり） */
function tower(ctx: Ctx, top: boolean) {
  if (top) {
    sky(ctx, '#4a8ad8', '#d8ecff');
    cloud(ctx, 18, 12);
    cloud(ctx, 120, 8);
    // はるか下の景色: 森・山・谷
    hills(ctx, '#9ab0c8', 48, 41);
    hills(ctx, '#7aa07a', 56, 42);
    hills(ctx, '#5a8a5a', 62, 43);
    // 胸壁（てっぺんの低い石の壁）
    ground(ctx, '#8c8780', '#7a766e', 29);
    for (let x = 0; x < SCENE_W; x += 12) rect(ctx, x, GROUND - 6, 8, 7, '#a39e96');
    // 鐘つき台と鐘
    rect(ctx, 136, GROUND - 40, 3, 40, '#6a4428');
    rect(ctx, 156, GROUND - 40, 3, 40, '#6a4428');
    rect(ctx, 132, GROUND - 42, 30, 3, '#6a4428');
    ellipse(ctx, 147, GROUND - 30, 6, 7, '#d8b048');
    rect(ctx, 140, GROUND - 25, 15, 3, '#d8b048');
    rect(ctx, 146, GROUND - 22, 3, 2, '#8a6a28');
    return;
  }
  sky(ctx, '#2e2a4a', '#9a8ab8');
  stars(ctx, 10, 7);
  hills(ctx, '#4a4458', 54, 44);
  ground(ctx, '#5a5660', '#46424c', 31);
  // 石の塔と、赤い屋根
  rect(ctx, 100, 10, 40, GROUND - 9, '#7a7680');
  for (let y = 14; y < GROUND; y += 6) rect(ctx, 100, y, 40, 1, '#5a5660');
  for (let i = 0; i < 11; i++) rect(ctx, 96 + i * 2, 10 - i, 48 - i * 4, 1, '#8a3a3a');
  // 大時計（9時を指したまま）
  ellipse(ctx, 120, 26, 8, 8, '#f4f1ea');
  rect(ctx, 120, 19, 1, 7, '#1e1612');
  rect(ctx, 113, 26, 7, 1, '#1e1612');
  // 入口の扉
  rect(ctx, 113, GROUND - 14, 14, 15, '#6a4428');
  rect(ctx, 119, GROUND - 14, 1, 15, '#4a2c18');
}

/** 記憶の書庫。天井まで届く本棚と、ろうそく。open なら、奥の机に開いた帳面（第8章の終わり） */
function library(ctx: Ctx, open: boolean) {
  sky(ctx, '#1e140e', '#3a281c');
  // 両側の本棚
  const spines = ['#b84a3a', '#3a5a9a', '#4a7a4a', '#c8a048', '#6a4a8a', '#7a2a2a'];
  for (const [x0, x1] of [[0, 44], [116, 160]]) {
    rect(ctx, x0, 4, x1 - x0, GROUND - 3, '#4a2c18');
    for (let y = 8; y < GROUND - 4; y += 14) {
      rect(ctx, x0, y + 11, x1 - x0, 2, '#6a4428');
      for (let x = x0 + 2, i = (y + x0) % 6; x < x1 - 2; x += 3, i++) rect(ctx, x, y + 2 + (i % 3), 2, 9 - (i % 3), spines[i % spines.length]);
    }
  }
  ground(ctx, '#3a2818', '#2a1c12', 37);
  // ろうそく
  for (const x of [52, 108]) {
    rect(ctx, x, GROUND - 12, 2, 6, '#f4f1ea');
    ellipse(ctx, x + 1, GROUND - 14, 1, 2, '#f2c46d');
    ellipse(ctx, x + 1, GROUND - 14, 6, 6, '#f2c46d18');
  }
  if (open) {
    // 奥の机と、開いた帳面
    rect(ctx, 64, GROUND - 16, 32, 3, '#6a4428');
    rect(ctx, 66, GROUND - 13, 2, 14, '#4a2c18');
    rect(ctx, 92, GROUND - 13, 2, 14, '#4a2c18');
    rect(ctx, 70, GROUND - 19, 20, 3, '#f4f1ea');
    rect(ctx, 79, GROUND - 19, 2, 3, '#8a3a3a');
  }
}

/** 賢者の庵。雲の上の金色の空と、わらぶきの小さな家 */
function hermitage(ctx: Ctx) {
  sky(ctx, '#f6c26a', '#fff2d6');
  cloud(ctx, 20, 14);
  cloud(ctx, 128, 8);
  // 雲の地面
  rect(ctx, 0, GROUND, SCENE_W, SCENE_H - GROUND, '#ffffff');
  for (let x = 0; x <= SCENE_W; x += 14) ellipse(ctx, x, GROUND + 1, 10, 4, '#eef2f8');
  // 庵
  rect(ctx, 100, GROUND - 20, 36, 21, '#e8dcc0');
  for (let i = 0; i < 12; i++) rect(ctx, 94 + i * 2, GROUND - 20 - i, 48 - i * 4, 1, i % 3 ? '#c8a860' : '#a88a48');
  rect(ctx, 114, GROUND - 14, 8, 15, '#6a4428');
  rect(ctx, 104, GROUND - 15, 6, 5, '#f2c46d');
  // 飛び石
  for (const x of [56, 70, 84, 98]) ellipse(ctx, x, GROUND + 4, 4, 2, '#c8c8d0');
}

/** 章ごとの幕。start は「ステージへ踏みこむ後ろ姿」、end は「乗りこえた顔とポーズ」 */
const SCENES: Record<number, { start: Draw; end: Draw }> = {
  0: {
    start: (ctx, o) => {
      VILLAGE_DAY(ctx, o);
      figure(ctx, 'mom', 12);
      figure(ctx, 'cat', 32, GROUND + 3);
      figure(ctx, 'bash', 50); // 兄。いっしょにパン屋へ
      figure(ctx, 'nano', 128);
      figure(ctx, 'pico', 100);
      hero(ctx, o, 'smile', 'back');
    },
    end: (ctx, o) => {
      VILLAGE_DUSK(ctx, o);
      figure(ctx, 'chown', 26);
      figure(ctx, 'cat', 48, GROUND + 3);
      hero(ctx, o, 'determined', 'stand');
    },
  },
  1: {
    start: (ctx, o) => {
      FOREST(ctx, o);
      figure(ctx, 'squirrel', 30, GROUND + 2);
      figure(ctx, 'owl', 126, GROUND - 17);
      rect(ctx, 120, GROUND - 18, 24, 2, '#6a4428'); // フクロウの枝
      hero(ctx, o, 'smile', 'back');
    },
    end: (ctx, o) => {
      FOREST(ctx, o);
      // 苔むした門
      rect(ctx, 112, GROUND - 34, 6, 35, '#8a8a7a');
      rect(ctx, 140, GROUND - 34, 6, 35, '#8a8a7a');
      rect(ctx, 108, GROUND - 38, 42, 6, '#8a8a7a');
      rect(ctx, 108, GROUND - 38, 42, 2, '#4cae5a');
      rect(ctx, 112, GROUND - 20, 6, 3, '#4cae5a');
      // ほたるの光
      for (const [x, y] of [[30, 30], [56, 22], [100, 40], [150, 26], [70, 14]]) rect(ctx, x, y, 1, 1, '#fff6a0');
      hero(ctx, o, 'joy', 'fist', 60);
    },
  },
  2: {
    start: (ctx, o) => {
      SWAMP(ctx, o);
      figure(ctx, 'frog', 26, 61);
      figure(ctx, 'frog', 106, 59, true);
      figure(ctx, 'tsunagi', 132, 66);
      hero(ctx, o, 'smile', 'back');
    },
    end: (ctx, o) => {
      FAR_SHORE(ctx, o);
      figure(ctx, 'tsunagi', 20, 66);
      hero(ctx, o, 'tired', 'wipe');
    },
  },
  3: {
    start: (ctx, o) => {
      muragare(ctx, false);
      figure(ctx, 'haru', 118);
      hero(ctx, o, 'determined', 'back', 66);
    },
    end: (ctx, o) => {
      muragare(ctx, true);
      figure(ctx, 'groupu', 24);
      figure(ctx, 'haru', 42);
      figure(ctx, 'herbalist', 132);
      hero(ctx, o, 'relieved', 'wave');
    },
  },
  4: {
    start: (ctx, o) => {
      market(ctx, false);
      figure(ctx, 'apt', 14);
      figure(ctx, 'okami', 126);
      hero(ctx, o, 'smile', 'back');
    },
    end: (ctx, o) => {
      market(ctx, true);
      figure(ctx, 'pip', 118, GROUND - 5);
      figure(ctx, 'rine', 136, GROUND - 5);
      figure(ctx, 'apt', 8);
      figure(ctx, 'dd', 26);
      hero(ctx, o, 'joy', 'banzai', 62);
    },
  },
  5: {
    start: (ctx, o) => {
      mountainPass(ctx, false);
      figure(ctx, 'iputa', 136);
      hero(ctx, o, 'determined', 'back', 68);
    },
    // 眠っていた人たちが起きて、見送ってくれる。自分の kill が届いていたことを知っても、前を向く
    end: (ctx, o) => {
      mountainPass(ctx, true);
      figure(ctx, 'kaya', 14);
      figure(ctx, 'meiku', 32);
      figure(ctx, 'zippu', 50);
      hero(ctx, o, 'determined', 'fist', 72);
    },
  },
  6: {
    start: (ctx, o) => {
      mine(ctx, false);
      hero(ctx, o, 'determined', 'back', 66);
    },
    // ランプの明かりが戻った坑道。ノーハップとミナシゴに見送られる。重い言葉を唱えたあとの、ほっとした顔
    end: (ctx, o) => {
      mine(ctx, true);
      figure(ctx, 'nohup', 18);
      figure(ctx, 'minashigo', 36);
      hero(ctx, o, 'relieved', 'stand', 72);
    },
  },
  7: {
    start: (ctx, o) => {
      tower(ctx, false);
      figure(ctx, 'kron', 134);
      hero(ctx, o, 'determined', 'back', 62);
    },
    // 塔のてっぺん。動きだした時の中で、見晴らしに手をふる。クロンも登ってきた
    end: (ctx, o) => {
      tower(ctx, true);
      figure(ctx, 'kron', 22);
      hero(ctx, o, 'smile', 'wave', 64);
    },
  },
  8: {
    start: (ctx, o) => {
      library(ctx, false);
      figure(ctx, 'syslo', 124);
      hero(ctx, o, 'determined', 'back', 66);
    },
    // 自分の過ちの記録から、目をそらさなかった。涙をぬぐって、前を向く
    end: (ctx, o) => {
      library(ctx, true);
      figure(ctx, 'syslo', 22);
      hero(ctx, o, 'determined', 'wipe', 100);
    },
  },
  9: {
    start: (ctx, o) => {
      hermitage(ctx);
      hero(ctx, o, 'determined', 'back', 52);
    },
    // 色の戻ったチルダ村。家族と村のみんな、スドウに囲まれて
    end: (ctx, o) => {
      VILLAGE_DAY(ctx, o);
      figure(ctx, 'mom', 10);
      figure(ctx, 'bash', 26);
      figure(ctx, 'cat', 44, GROUND + 3);
      figure(ctx, 'sudo', 108);
      figure(ctx, 'chown', 124);
      figure(ctx, 'nano', 140);
      figure(ctx, 'pico', 154, GROUND + 1);
      hero(ctx, o, 'smile', 'banzai', 64);
    },
  },
};

export function hasScene(no: number): boolean {
  return no in SCENES;
}

/** 章の幕の絵。その章の絵がなければ null */
export function drawScene(no: number, kind: 'start' | 'end', o: SceneOpts): HTMLCanvasElement | null {
  const scene = SCENES[no];
  if (!scene) return null;
  const canvas = document.createElement('canvas');
  canvas.width = SCENE_W;
  canvas.height = SCENE_H;
  canvas.className = 'cc-scene';
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  scene[kind](ctx, o);
  return canvas;
}
