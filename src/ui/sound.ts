// 文字が出るときの「ピピピ」音。音声ファイルは使わず、ブラウザの中で矩形波を鳴らす（昔のゲーム機と同じ作り）
import { settings } from './settings';

let ctx: AudioContext | null = null;

/** 音声ファイルで鳴らす効果音（public/bgm/ の mp3。出どころは public/bgm/README.md） */
const FILES = {
  /** 塔の鐘「カーン」 */
  towerbell: 'Church_Bell03-11(Far-Low-Mid)',
  /** 大時計の秒針「カチ、コチ」（くり返し鳴らせる音） */
  clock: 'Clock-Second_Hand02-3(Dry-Loop)',
} as const;
const FILE_BASE = `${import.meta.env.BASE_URL}bgm/`;

/** 音声ファイルの効果音を鳴らす。ms を書くと、その長さだけくり返して、最後は小さくして止める */
export function playSound(id: keyof typeof FILES, ms?: number) {
  if (!settings.sfx || settings.volume <= 0) return;
  const a = new Audio(`${FILE_BASE}${encodeURIComponent(FILES[id])}.mp3`);
  const vol = Math.min(1, settings.volume * 0.8);
  a.volume = vol;
  if (ms) {
    a.loop = true;
    setTimeout(() => {
      const fade = setInterval(() => {
        a.volume = Math.max(0, a.volume - vol / 8);
        if (a.volume <= 0) {
          clearInterval(fade);
          a.pause();
        }
      }, 50);
    }, ms);
  }
  void a.play().catch(() => {});
}

/** ブラウザは、クリックやキー入力のあとでないと音を出せない。最初の操作で準備しておく */
export function unlockAudio() {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return;
  ctx ??= new Ctx();
  if (ctx.state === 'suspended') void ctx.resume();
}

for (const ev of ['pointerdown', 'keydown'] as const) window.addEventListener(ev, unlockAudio, { capture: true });

/** 効果音。音声ファイルは使わず、ブラウザの中で合成する。seconds は長さ（ザザッ のノイズ） */
export function sfx(name: string, seconds = 0.5) {
  if (!settings.sfx || !ctx || ctx.state !== 'running' || settings.volume <= 0) return;
  if (name === 'bell') bell(ctx);
  if (name === 'static') noise(ctx, seconds);
  if (name === 'pi') pi(ctx);
  if (name === 'stomp') stomp(ctx);
  if (name === 'roar') roar(ctx);
  if (name === 'gameover') gameOver(ctx);
  if (name === 'unlock') unlock(ctx);
}

/**
 * 大きな獣の足音「ずしーん」。とても低い音を、ドンと鳴らしてから下げていき、
 * こもった雑音（土のゆれ）を重ねる
 */
function stomp(c: AudioContext) {
  const t = c.currentTime;
  const out = c.createGain();
  out.gain.value = 0.55 * settings.volume;
  out.connect(c.destination);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(95, t);
  osc.frequency.exponentialRampToValueAtTime(32, t + 0.9);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(1, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
  osc.connect(g).connect(out);
  osc.start(t);
  osc.stop(t + 1.15);
  // 土のゆれ: 低いところだけ残した雑音
  const len = Math.floor(c.sampleRate * 0.8);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const src = c.createBufferSource();
  src.buffer = buf;
  const low = c.createBiquadFilter();
  low.type = 'lowpass';
  low.frequency.value = 220;
  const ng = c.createGain();
  ng.gain.value = 0.9;
  src.connect(low).connect(ng).connect(out);
  src.start(t);
}

/** ボタンを押したときの「ピッ」。昔のゲーム機のような、短く高い矩形波 */
function pi(c: AudioContext) {
  const t = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(1320, t);
  osc.frequency.setValueAtTime(1760, t + 0.03);
  const peak = 0.07 * settings.volume;
  g.gain.setValueAtTime(peak, t);
  g.gain.setValueAtTime(peak, t + 0.06);
  g.gain.linearRampToValueAtTime(0, t + 0.075);
  osc.connect(g).connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.08);
}

// ボタン（タイトルのメニュー、右上の道具、設定、吹き出しの「次へ」など）を押したら「ピッ」
window.addEventListener(
  'click',
  (e) => {
    if ((e.target as Element | null)?.closest?.('button')) sfx('pi');
  },
  { capture: true },
);

let noiseBuf: AudioBuffer | null = null;

/**
 * 「ザザザッ」という砂嵐のノイズ。白いノイズを、ラジオの雑音くらいの高さにしぼり、
 * 音量を細かく上げ下げして、途切れ途切れに鳴らす
 */
function noise(c: AudioContext, seconds: number) {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const band = c.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 1800 + Math.random() * 1400;
  band.Q.value = 0.6;
  const g = c.createGain();
  const peak = 0.16 * settings.volume;
  g.gain.setValueAtTime(0, t);
  // 途切れ途切れに: 短い区間ごとに、大きくしたり小さくしたり
  for (let s = 0; s < seconds; s += 0.04 + Math.random() * 0.05) {
    g.gain.setValueAtTime(Math.random() < 0.75 ? peak * (0.5 + Math.random() * 0.5) : peak * 0.05, t + s);
  }
  g.gain.setValueAtTime(peak * 0.3, t + seconds);
  g.gain.linearRampToValueAtTime(0, t + seconds + 0.05);
  src.connect(band).connect(g).connect(c.destination);
  src.start(t, Math.random() * 1.5);
  src.stop(t + seconds + 0.1);
}

/**
 * 扉の錠がはずれる「カチャリ」。鍵を回すこすれる音のあと、小さな「カチ」、
 * 重い掛け金が外れる「ガチャ」（金物の低いひびき）、最後に小さく「リ」と鳴る
 */
function unlock(c: AudioContext) {
  const t = c.currentTime;
  const out = c.createGain();
  out.gain.value = 0.5 * settings.volume;
  out.connect(c.destination);
  /** 金物の「カチッ」ひとつ。ごく短い雑音を高い所だけ残し、金属らしい響きを少し重ねる */
  const click = (at: number, freq: number, amp: number, ring: number) => {
    const len = Math.floor(c.sampleRate * 0.03);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4);
    const src = c.createBufferSource();
    src.buffer = buf;
    const band = c.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = freq;
    band.Q.value = 3;
    const g = c.createGain();
    g.gain.value = amp;
    src.connect(band).connect(g).connect(out);
    src.start(t + at);
    // 金物の響き: きれいな倍数ではない高さを2つ、すぐ消える
    for (const ratio of [1, 1.47]) {
      const osc = c.createOscillator();
      const og = c.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq * 0.6 * ratio;
      og.gain.setValueAtTime(amp * 0.12, t + at);
      og.gain.exponentialRampToValueAtTime(0.0001, t + at + ring);
      osc.connect(og).connect(out);
      osc.start(t + at);
      osc.stop(t + at + ring + 0.02);
    }
  };
  // 鍵を回す「ジ…」: 弱い雑音を、こすれる高さにしぼる
  const len = Math.floor(c.sampleRate * 0.22);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.sin((Math.PI * i) / len) * (0.6 + 0.4 * Math.random());
  const src = c.createBufferSource();
  src.buffer = buf;
  const band = c.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 3200;
  band.Q.value = 1.2;
  const sg = c.createGain();
  sg.gain.value = 0.18;
  src.connect(band).connect(sg).connect(out);
  src.start(t);
  click(0.24, 4200, 0.7, 0.05); // カチ
  click(0.46, 2600, 1.4, 0.18); // ガ
  click(0.5, 1500, 1.1, 0.25); // チャ
  // 掛け金が落ちる、こもった「ゴトッ」
  const osc = c.createOscillator();
  const og = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(180, t + 0.47);
  osc.frequency.exponentialRampToValueAtTime(90, t + 0.6);
  og.gain.setValueAtTime(0, t + 0.47);
  og.gain.linearRampToValueAtTime(0.5, t + 0.475);
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);
  osc.connect(og).connect(out);
  osc.start(t + 0.47);
  osc.stop(t + 0.7);
  click(0.68, 5200, 0.35, 0.3); // リ
}

/** 鈴の「チリーン……」。高い音をいくつか重ねて、ゆっくり消えていく */
function bell(c: AudioContext) {
  const t = c.currentTime;
  const out = c.createGain();
  out.gain.value = 0.18 * settings.volume;
  out.connect(c.destination);
  // 鈴らしさは、きれいな倍数ではない倍音から出る
  for (const [ratio, amp, decay] of [
    [1, 1, 2.2],
    [2.76, 0.5, 1.4],
    [5.4, 0.28, 0.8],
    [8.93, 0.14, 0.5],
  ] as const) {
    for (const delay of [0, 0.09]) {
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = 'sine';
      osc.frequency.value = 1760 * ratio;
      const a = amp * (delay ? 0.45 : 1);
      g.gain.setValueAtTime(0, t + delay);
      g.gain.linearRampToValueAtTime(a, t + delay + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + delay + decay);
      osc.connect(g).connect(out);
      osc.start(t + delay);
      osc.stop(t + delay + decay + 0.05);
    }
  }
}

/** 短い電子音を1回鳴らす。pitch は Hz */
export function blip(pitch = 520) {
  if (!settings.sound || !ctx || ctx.state !== 'running' || settings.volume <= 0) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  // ほんの少し高さを揺らすと、機械的すぎない
  osc.frequency.setValueAtTime(pitch * (0.97 + Math.random() * 0.06), t);
  const peak = 0.06 * settings.volume;
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(peak, t + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.05);
}

/**
 * 獣の叫び声「グオオオッ」。低いのこぎり波を2つ、少しずらして重ね、
 * 高さを上げてから下げる。細かく音量をふるわせて、のどのざらつきを出す
 */
function roar(c: AudioContext) {
  const t = c.currentTime;
  const len = 1.5;
  const out = c.createGain();
  out.gain.setValueAtTime(0, t);
  out.gain.linearRampToValueAtTime(0.32 * settings.volume, t + 0.12);
  out.gain.setValueAtTime(0.32 * settings.volume, t + 0.8);
  out.gain.exponentialRampToValueAtTime(0.0001, t + len);
  out.connect(c.destination);
  // ひずませて、荒々しくする
  const shaper = c.createWaveShaper();
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * 4);
  }
  shaper.curve = curve;
  // のどの響き（口の形）
  const mouth = c.createBiquadFilter();
  mouth.type = 'lowpass';
  mouth.frequency.setValueAtTime(500, t);
  mouth.frequency.linearRampToValueAtTime(1300, t + 0.35);
  mouth.frequency.exponentialRampToValueAtTime(350, t + len);
  mouth.Q.value = 4;
  // ざらつき: 速いふるえで音量を上げ下げする
  const rasp = c.createGain();
  rasp.gain.value = 0.6;
  const lfo = c.createOscillator();
  lfo.frequency.value = 33;
  const depth = c.createGain();
  depth.gain.value = 0.4;
  lfo.connect(depth).connect(rasp.gain);
  shaper.connect(mouth).connect(rasp).connect(out);
  for (const detune of [0, 7]) {
    const osc = c.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(70 + detune, t);
    osc.frequency.exponentialRampToValueAtTime(150 + detune, t + 0.3);
    osc.frequency.setValueAtTime(150 + detune, t + 0.6);
    osc.frequency.exponentialRampToValueAtTime(55 + detune, t + len);
    const g = c.createGain();
    g.gain.value = 0.5;
    osc.connect(g).connect(shaper);
    osc.start(t);
    osc.stop(t + len + 0.05);
  }
  // 息: 雑音を重ねる
  const n = Math.floor(c.sampleRate * len);
  const buf = c.createBuffer(1, n, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const breath = c.createBiquadFilter();
  breath.type = 'bandpass';
  breath.frequency.value = 700;
  breath.Q.value = 0.8;
  const bg = c.createGain();
  bg.gain.value = 0.35;
  src.connect(breath).connect(bg).connect(out);
  src.start(t);
  lfo.start(t);
  lfo.stop(t + len + 0.05);
}

/**
 * ゲームオーバーの「テレレレ……ジャーン」。矩形波で半音ずつ下がっていき、最後に暗い和音で消える
 */
function gameOver(c: AudioContext) {
  const t = c.currentTime;
  const out = c.createGain();
  out.gain.value = 0.09 * settings.volume;
  out.connect(c.destination);
  const note = (hz: number, at: number, len: number, type: OscillatorType = 'square') => {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.value = hz;
    g.gain.setValueAtTime(0, t + at);
    g.gain.linearRampToValueAtTime(1, t + at + 0.01);
    g.gain.setValueAtTime(1, t + at + len * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + at + len);
    osc.connect(g).connect(out);
    osc.start(t + at);
    osc.stop(t + at + len + 0.05);
  };
  [659.3, 622.3, 587.3, 554.4].forEach((hz, i) => note(hz, i * 0.38, 0.34));
  // 暗い和音（ラ・ド・ミ）を、ゆっくり消す
  for (const hz of [220, 261.6, 329.6]) note(hz, 1.6, 2.4);
  note(110, 1.6, 2.6, 'triangle');
}
