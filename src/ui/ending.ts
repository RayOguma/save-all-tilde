// エンディング。エンディング・テーマを流しながら、章ごとの挿絵（章の終わりの幕）と、その章で覚えたコマンドを流す。
// 挿絵が終わったら画面を真っ暗にし、曲がゆっくり消えて音がなくなってから、「制作」「Thank you for playing」を順に出す。
import type { Gender } from '../state';
import { holdMusic, playOnce } from './music';
import { drawScene, hasScene } from './scenes';
import { sfx } from './sound';
import { spriteImg } from './sprites';
import { el } from './terminal';

/** 制作者の名前。ここを変えれば、エンディングの名前が変わる */
export const CREATOR = 'RayOguma';

/** 音楽・効果音の出どころ（public/bgm/README.md と同じものを書く）。制作のあと、ひとつずつ画面に出す */
const MUSIC_CREDITS: { role: string; name: string; url: string; works: string[] }[] = [
  {
    role: '音楽',
    name: 'もみじばミュージック',
    url: 'https://music.storyinvention.com/',
    works: [
      '水平線を見据えて',
      '仲間１',
      '仲間２',
      '水上のダンス',
      'アラブの砂漠',
      'よろずや道中',
      '妖精の森のワルツ',
      '不気味な塔',
      '時の風',
      '湖上の社',
      'レクイエム',
      '悠久の空へ',
      '復活の祈り２',
      'エンディング・テーマ',
    ],
  },
  {
    role: '効果音',
    name: 'OtoLogic',
    url: 'https://otologic.jp',
    works: ['Church Bell03-11 (Far-Low-Mid)', 'Clock-Second Hand02-3 (Dry-Loop)'],
  },
];

/** 音楽・効果音の画面ひとつを見せる長さ */
const CREDIT_MS = 7000;

/** 挿絵ひとつを見せる長さ */
const SLIDE_MS = 6500;
/** 真っ暗になってから、曲を消していく長さ */
const FADE_MS = 4000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** スペース（Enter・クリックでも）を待つ。会話と同じ進め方。進めると「ピッ」 */
function nextKey(): Promise<void> {
  return new Promise((done) => {
    const finish = () => {
      sfx('pi');
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('click', onClick, true);
      done();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      e.preventDefault();
      e.stopPropagation();
      finish();
    };
    const onClick = () => finish();
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('click', onClick, true);
  });
}

/** 章で覚えたコマンドひとつ（書き方と、短い使い方） */
export interface Lesson {
  cmd: string;
  desc: string;
}

export interface EndingOpts {
  gender: Gender;
  /** 挿絵に出す章。章の終わりの幕の絵と、その章で覚えたコマンドを、この順に流す */
  chapters: { no: number; title: string; lessons: Lesson[] }[];
  /** 選んだ結末の名前（最後の挿絵に添える） */
  endingTitle: string;
  /** Thank you for playing のあと、真っ暗な中に1行ずつ出すせりふ（「名前: せりふ」）。つづきをにおわせる */
  epilogue: string[];
  /** せりふの話し手の立ち絵（名前 → ドット絵の id） */
  sprites?: Record<string, string>;
}

function line(cls: string, text: string): HTMLElement {
  return Object.assign(el('div', cls), { textContent: text });
}

/** 章で覚えたコマンドの一覧（挿絵の横を、下から上へ流れていく） */
function lessonList(c: EndingOpts['chapters'][number]): HTMLElement {
  const box = el('div', 'ed-lessons');
  box.append(line('ed-lessons-head', `第${c.no}章で覚えた言葉`));
  for (const l of c.lessons) {
    const row = el('div', 'ed-lesson');
    row.append(line('ed-lesson-cmd', l.cmd), line('ed-lesson-desc', l.desc));
    box.append(row);
  }
  return box;
}

/** エンディングを流す。「タイトルへ」を押したら終わる */
export async function runEnding(o: EndingOpts): Promise<void> {
  holdMusic(600);
  const music = playOnce('エンディング・テーマ', 0);

  const root = el('div', '');
  root.id = 'ending';
  const stage = el('div', 'ed-stage');
  const side = el('div', 'ed-side');
  const skip = Object.assign(el('button', 'ed-skip ghost-btn'), { textContent: 'スキップ ▶▶', type: 'button' }) as HTMLButtonElement;
  root.append(stage, side, skip);
  document.body.append(root);
  document.body.classList.remove('fx-fadeout');
  await sleep(50);
  root.classList.add('in');

  let skipped = false;
  let wake: () => void = () => {};
  skip.addEventListener('click', () => {
    skipped = true;
    wake();
  });
  const wait = (ms: number) =>
    new Promise<void>((r) => {
      const id = setTimeout(r, ms);
      wake = () => {
        clearTimeout(id);
        r();
      };
    });

  // 1. 挿絵と、その章で覚えたコマンド。奇数章は絵が左、偶数章は絵が右
  const slides = o.chapters.filter((c) => hasScene(c.no));
  for (const [i, c] of slides.entries()) {
    if (skipped) break;
    root.classList.toggle('flip', c.no % 2 === 0);
    // コダマは、第1章から一緒に映る
    const canvas = drawScene(c.no, 'end', { gender: o.gender, kodama: c.no >= 1 });
    if (!canvas) continue;
    canvas.className = 'ed-scene';
    const last = i === slides.length - 1;
    const caption = line('ed-caption', `第${c.no}章　${c.title}${last && o.endingTitle ? `　${o.endingTitle}` : ''}`);
    stage.replaceChildren(canvas, caption);
    side.replaceChildren(lessonList(c));
    await wait(SLIDE_MS);
  }

  // 2. 真っ暗にして、曲をゆっくり消す。音がなくなってから、制作と Thank you for playing
  skip.remove();
  stage.replaceChildren();
  side.remove();
  root.classList.add('dark');
  music.skip(FADE_MS);
  await sleep(FADE_MS + 1200);

  const credit = el('div', 'ed-credit');
  credit.append(line('ed-credit-role', '制作'), line('ed-credit-name', CREATOR));
  stage.replaceChildren(credit);
  await sleep(4500);
  credit.classList.add('out');
  await sleep(1500);

  // 音楽・効果音（曲名つき）
  for (const m of MUSIC_CREDITS) {
    const box = el('div', 'ed-credit');
    const works = el('div', 'ed-credit-works');
    for (const w of m.works) works.append(line('ed-credit-work', w));
    box.append(line('ed-credit-role', m.role), line('ed-credit-site', m.name), line('ed-credit-url', m.url), works);
    stage.replaceChildren(box);
    await sleep(CREDIT_MS);
    box.classList.add('out');
    await sleep(1500);
  }

  const thanks = line('ed-thanks', 'Thank you for playing!');
  stage.replaceChildren(thanks);
  await sleep(4500);

  // 真っ暗な中に、話し手のせりふ（つづきをにおわせる）。1行ずつ浮かんで、消える
  if (o.epilogue.length) {
    thanks.classList.add('out');
    await sleep(2000);
    for (const l of o.epilogue) {
      const m = l.match(/^([^:：]{1,12})[:：]\s?(.*)$/);
      const who = m?.[1] ?? '';
      const box = el('div', 'ed-epilogue');
      const sprite = who && o.sprites?.[who];
      if (sprite) box.append(spriteImg(sprite, 'ed-epilogue-face'));
      if (who) box.append(line('ed-epilogue-who', who));
      box.append(line('ed-epilogue-text', `「${m?.[2] ?? l}」`));
      box.append(line('ed-epilogue-next', '▼'));
      stage.replaceChildren(box);
      await sleep(900);
      await nextKey();
      box.classList.add('out');
      await sleep(1000);
    }
  }

  const btn = Object.assign(el('button', 'primary-btn'), { textContent: 'タイトルへ', type: 'button' }) as HTMLButtonElement;
  const end = el('div', 'ed-end');
  end.append(btn);
  stage.replaceChildren(end);
  await sleep(600);
  btn.classList.add('show');
  btn.focus();
  await new Promise<void>((r) => btn.addEventListener('click', () => r(), { once: true }));
}
