import './style.css';
import ch0 from '../scenario/ch0.yaml?raw';
import ch1 from '../scenario/ch1.yaml?raw';
import ch2 from '../scenario/ch2.yaml?raw';
import ch3 from '../scenario/ch3.yaml?raw';
import ch4 from '../scenario/ch4.yaml?raw';
import ch5 from '../scenario/ch5.yaml?raw';
import ch6 from '../scenario/ch6.yaml?raw';
import ch7 from '../scenario/ch7.yaml?raw';
import ch8 from '../scenario/ch8.yaml?raw';
import ch9 from '../scenario/ch9.yaml?raw';
import commands from '../scenario/commands.yaml?raw';
import { fillChapterCheckpoint, snapshot, startAtChapter } from './checkpoint';
import { buildMap, currentStage } from './map';
import { loadScenario } from './scenario';
import { Shell } from './shell';
import { clearState, loadState, newState, saveState, textVars, type Gender, type GameState } from './state';
import { fill, parseMsg } from './text';
import {
  BagView,
  BookPane,
  chooseChapter,
  chooseGender,
  confirmDialog,
  Handbook,
  MapView,
  ObjectiveView,
  PartyView,
  runGuide,
  runTour,
  SettingsView,
  MenuView,
  hideChapterCard,
  showChapterCard,
  showChapterEnd,
  showGameOver,
  showTitle,
  toast,
} from './ui/panels';
import { Frame } from './ui/frame';
import { setupLayout } from './ui/layout';
import { applyTextSize } from './ui/settings';
import { NEWS } from './news';
import { startAmbience } from './ui/ambience';
import { cutMusic, playOnce, resumeStageMusic, setStageMusic } from './ui/music';
import { drawScene } from './ui/scenes';
import { runEnding } from './ui/ending';
import { check } from './vfs';
import { INTERRUPTED, Terminal } from './ui/terminal';

const NAME_MAX = 12;
/** 幕とタイトルの曲（public/bgm/ のファイル名）。ステージの曲は、シナリオの場所の bgm に書く */
/** ゲームオーバーのあと、やり直しの場面を読みこみ直したしるし（タイトルを飛ばす） */
const REWOUND_KEY = 'moribito-rewound';
const MUSIC = { title: '水平線を見据えて', chapterStart: '仲間２', chapterEnd: '仲間１' };
const $ = (id: string) => document.getElementById(id)!;

const scn = loadScenario([ch0, ch1, ch2, ch3, ch4, ch5, ch6, ch7, ch8, ch9], commands);

// 設定の文字の大きさと、地図・手帳の幅（境目のつまみ）を、はじめに当てておく
applyTextSize();
setupLayout();

/** セーブの進み具合で、いまの章（shell.chapter() と同じ決め方） */
function chapterOf(st: GameState) {
  return [...scn.chapters].reverse().find((c) => check(c.startIf, st.flags)) ?? scn.chapters[0];
}

/** 「第1章 はじめての森」のように */
const chapterName = (c: { no: number; title: string }) => `第${c.no}章「${c.title}」`;

/** その章で覚えたコマンドと、短い使い方（エンディングで、挿絵の横に流す）。第0章は、はじめから使える ls・cd・cat も */
function lessonsOf(no: number): { cmd: string; desc: string }[] {
  const ch = scn.chapters.find((c) => c.no === no);
  const learned = [...(no === 0 ? scn.startCommands : []), ...(ch?.clear?.learned ?? [])];
  return learned.map((l) => {
    const [base, ...rest] = l.split(' ');
    const d = scn.commands[base];
    const flag = rest.join(' ');
    const opt = flag ? d?.options?.find((o) => o.flag === flag) : undefined;
    if (opt) return { cmd: l, desc: opt.short ?? opt.desc };
    return { cmd: d?.usage ?? l, desc: d?.summary ?? '' };
  });
}
// 主人公のせりふの立ち絵と声。性別を選ぶまでは決まらないので、あとから入れる
let player: { name: string; gender: Gender } | null = null;
const PLAYER_VOICE: Record<Gender, number> = { boy: 540, girl: 640 };
const term = new Terminal($('log'), $('inputbar'), (name) =>
  scn.characters[name] ??
  (player && name === player.name
    ? { sprite: `player-${player.gender}`, color: '#8fd3c0', voice: PLAYER_VOICE[player.gender] }
    : undefined),
);
const insert = (cmd: string) => {
  document.body.classList.remove('map-open');
  term.insert(cmd);
};
const partyView = new PartyView($('party'), insert);
const bagView = new BagView($('bag'), insert);
const objective = new ObjectiveView($('objective'));
const frame = new Frame($('termwrap'), $('frame-plate'));

async function askName(): Promise<string> {
  term.print([{ t: 'きみの名前を教えてほしい。（Enter でそのまま進むと「きみ」になる）', c: 'hint' }]);
  const raw = await term.readLine([{ t: '名前 › ', c: 'p-user' }]);
  return raw.normalize('NFKC').replace(/\s/g, '').slice(0, NAME_MAX) || 'きみ';
}

async function main() {
  // ?dev をつけて開くと、まだ着いていない章も「章を選ぶ」から遊べる（テストプレイ用）。
  // 効くのは開発サーバー（npm run dev）だけで、公開したページでは何も起きない
  const dev = import.meta.env.DEV && new URLSearchParams(location.search).has('dev');
  const saved = loadState();
  // 設定は、タイトルからも開ける（音量や文字の大きさを、始める前に変えられるように）
  const settingsView = new SettingsView($('settings'));
  // 章の終わりで「セーブして終わる」を選んだセーブにも、次の章のチェックポイントを残す（「章を選ぶ」で選べるように）
  if (saved && fillChapterCheckpoint(scn, saved)) saveState(saved);
  let st!: GameState;
  let mode: 'fresh' | 'continue' | 'chapter' = 'fresh';
  // ゲームオーバーで、やり直しの場面を読みこみ直したところ。タイトルは飛ばして、そのまま続ける
  let rewound = false;
  try {
    rewound = sessionStorage.getItem(REWOUND_KEY) === '1';
    sessionStorage.removeItem(REWOUND_KEY);
  } catch {}
  // タイトル画面の曲（はじめの選択や名前を決める間も流しておく）
  setStageMusic(MUSIC.title);
  for (;;) {
    if (rewound && saved) {
      st = saved;
      mode = 'continue';
      break;
    }
    const canSelect = dev || Object.keys(saved?.checkpoints ?? {}).length > 0;
    const choice = await showTitle(!!saved, canSelect, {
      news: NEWS,
      openSettings: () => settingsView.open(),
      // 「つづきから」も、どこから続くかを見せて確かめる
      confirmContinue: saved
        ? () => {
            const cur = chapterOf(saved);
            const fromStart = !(saved.introSeen ?? []).includes(cur.no);
            return confirmDialog({
              title: 'つづきから遊ぶ？',
              message: `${saved.name}の旅を、${chapterName(cur)}${fromStart ? 'のはじめ' : ''}からつづけます。`,
              ok: 'つづける',
              cancel: 'やめておく',
              focusOk: true,
            });
          }
        : undefined,
    });
    if (choice === 'continue' && saved) {
      st = saved;
      mode = 'continue';
      break;
    }
    if (choice === 'select') {
      let no: number | null = null;
      for (;;) {
        no = await chooseChapter(
          scn.chapters.map((c) => ({
            no: c.no,
            title: c.title,
            available: dev || c.no === 0 || !!saved?.checkpoints?.[c.no],
          })),
        );
        // セーブがあるときは、上書きしてよいか確かめる（まちがえて押したときに、もどれるように）
        if (no === null || !saved) break;
        const ok = await confirmDialog({
          title: 'この章のはじめから遊ぶ？',
          message: `${chapterName(scn.chapters.find((c) => c.no === no)!)}のはじめから遊びます。いまの「つづきから」のセーブ（${chapterName(chapterOf(saved))}）は、上書きされます。`,
          note: '着いたことのある章は、あとでまた「章を選ぶ」から遊べます。',
          ok: `第${no}章を遊ぶ`,
          cancel: 'やめておく',
          danger: true,
        });
        if (ok) break;
      }
      if (no === null) continue;
      st = startAtChapter(scn, no, saved, dev);
      mode = 'chapter';
      break;
    }
    // はじめから。セーブがあるときは、消えてよいか確かめる
    if (
      saved &&
      !(await confirmDialog({
        title: 'はじめから遊ぶ？',
        message: `いまの「つづきから」のセーブ（${chapterName(chapterOf(saved))}）は消えて、第0章のはじめからになります。`,
        note: '着いたことのある章は、「章を選ぶ」から遊べます。',
        ok: 'はじめから遊ぶ',
        cancel: 'やめておく',
        danger: true,
      }))
    )
      continue;
    // 章のチェックポイントは残しておく（あとで「章を選ぶ」から戻れるように）
    const checkpoints = saved?.checkpoints;
    clearState();
    const gender = await chooseGender();
    st = newState(await askName(), gender, scn.start, scn.startCommands);
    if (checkpoints) st.checkpoints = checkpoints;
    mode = 'fresh';
    break;
  }
  saveState(st);

  // ゲームオーバーになる行動をしたら、やり直すまで曲を流さない
  let gameIsOver = false;
  const gameOverStart = () => {
    gameIsOver = true;
    cutMusic();
  };
  const update = () => {
    mapView.render();
    bookPane.render();
    partyView.render(shell.party().map((c) => ({ name: c.node.name, icon: shell.iconOf(c.node) })));
    bagView.render(shell.bagItems());
    objective.render(shell.currentObjective());
    const place = shell.currentPlace();
    frame.apply(place.theme, place.label, place.icon);
    document.body.classList.toggle('drained', place.drained);
    document.body.classList.toggle('glitchy', place.glitchy);
    document.body.classList.toggle('belling', place.belling);
    setStageMusic(gameIsOver ? null : place.bgm);
    const ch = shell.chapter();
    $('chapter-label').textContent = `第${ch.no}章 ${ch.title}`;
  };
  const restart = () => {
    clearState();
    location.reload();
  };
  // 進み具合はコマンドごとに自動でセーブしている。念のためもう一度セーブして、タイトルにもどる
  const quit = () => {
    saveState(st);
    location.reload();
  };
  // ゲームオーバー: 画面を見せたあと、やり直しの場面（rewindPoint や、kill を唱える前）を読みこみ直す
  const gameOver = async () => {
    await term.flush();
    await new Promise((r) => setTimeout(r, 600));
    await showGameOver();
    const back = shell.rewindState();
    if (back) saveState({ ...back, rewind: back, checkpoints: st.checkpoints });
    try {
      sessionStorage.setItem(REWOUND_KEY, '1');
    } catch {}
    location.reload();
    await new Promise(() => {});
  };
  const shell = new Shell(scn, st, term, { restart, update, toast, quit, gameOver, gameOverStart });
  const mapView = new MapView(
    $('map'),
    insert,
    (overrides) => buildMap(shell, overrides),
    () => currentStage(shell),
  );

  const bookData = () => ({ learned: st.learned, docs: scn.commands, history: st.history, flags: st.flags });
  const book = new Handbook($('drawer'), bookData, insert);
  // 右の手帳は、はじめから出しておく。広い画面では「📖 手帳」で閉じたり開いたり、せまい画面では引き出しで見る
  const bookPane = new BookPane($('bookpane'), bookData, insert, () => book.open());
  const BOOK_KEY = 'moribito-book-closed';
  try {
    document.body.classList.toggle('book-closed', localStorage.getItem(BOOK_KEY) === '1');
  } catch {}
  $('btn-book').addEventListener('click', () => {
    if (!matchMedia('(min-width: 1101px)').matches) return book.toggle();
    const closed = document.body.classList.toggle('book-closed');
    try {
      localStorage.setItem(BOOK_KEY, closed ? '1' : '0');
    } catch {}
  });
  $('btn-hint').addEventListener('click', () => term.submit('hint'));
  $('btn-guide').addEventListener('click', () => runTour());
  // 吹き出しを出す前に、表示し終えたせりふを読んでもらう（スペースを待つ）
  term.guide = async (steps) => {
    await term.flush();
    await runGuide(steps);
  };
  startAmbience();
  $('btn-settings').addEventListener('click', () => settingsView.toggle());
  const menuView = new MenuView($('menu'), { quit, restart });
  $('btn-menu').addEventListener('click', () => menuView.toggle());
  $('map-toggle').addEventListener('click', () => document.body.classList.toggle('map-open'));

  player = { name: st.name, gender: st.gender };
  const say = (lines: string[]) => term.say(lines.map((l) => parseMsg(fill(l, textVars(st)))));
  /** 章の始まり: 見出し → ナレーション →（はじめての人だけ画面の説明）→ 最初の行動の指示 */
  const startChapter = async () => {
    const ch = shell.chapter();
    shell.arriveAtChapterStart();
    // 章の始まりを、チェックポイントとして残す
    st.checkpoints = { ...st.checkpoints, [ch.no]: snapshot(st, ch.no) };
    saveState(st);
    update();
    // 章の始まりの幕。幕の曲（仲間２）が鳴り終わったら、ステージへ
    const opening = playOnce(MUSIC.chapterStart, 4000);
    await showChapterCard(ch.no, ch.title, drawScene(ch.no, 'start', { gender: st.gender, kodama: !!st.flags.kodama_joined }), opening);
    resumeStageMusic();
    await say(ch.intro);
    await term.flush();
    // 画面の説明は、はじめに一度にせず、第0章で兄がそれにまつわるコマンドを使うときに紹介する（「❓ 遊び方」でまとめて見られる）
    st.onboarded = true;
    await say(ch.guide);
    await shell.opening();
  };

  update();
  if (mode !== 'continue') {
    term.clear();
    await startChapter();
    saveState(st);
  } else {
    term.print(
      rewound
        ? [{ t: '（……気がつくと、少し前の場面に立っていた。もう一度、やり直そう。）', c: 'narr' }]
        : [{ t: `おかえり、${st.name}。（はじめからやり直すときは restart）`, c: 'hint' }],
    );
    st.onboarded = true;
    // 章が変わったのに、その章の始まりを見のがしているセーブなら、章の始まりからやり直す
    if (shell.needsChapterStart()) {
      await startChapter();
      saveState(st);
    } else if (shell.needsOpening()) {
      // 章のはじめのイベントの途中で閉じたときは、もう一度はじめから
      await shell.opening();
      saveState(st);
    } else await shell.recap();
  }

  for (;;) {
    // 時間制限があるあいだは、迫ってくる合図（足音など）と、時間切れを予約する。残り時間は見せない
    const timers: number[] = [];
    const t = shell.timerInfo();
    if (t) {
      timers.push(window.setTimeout(() => term.interrupt(), Math.max(0, t.deadline - Date.now())));
      t.warnings.forEach((at, i) => {
        const ms = t.startedAt + at * 1000 - Date.now();
        if (ms > 0) timers.push(window.setTimeout(() => void shell.warn(i), ms));
      });
    }
    const line = await term.readLine(shell.prompt(), {
      history: st.history,
      complete: (v) => shell.complete(v),
      suggest: (v) => shell.suggest(v),
    });
    timers.forEach((id) => clearTimeout(id));
    if (line === INTERRUPTED) {
      await shell.timeUp();
      update();
      saveState(st);
      continue;
    }
    const before = shell.chapter().no;
    const clearFlag = `ch${before}_clear`;
    const clearedBefore = !!st.flags[clearFlag];
    await shell.exec(line);
    update();
    saveState(st);
    // 章をクリアしたら、演出を見終わってから章の終わりの画面 → 次の章の入口へ
    if (!clearedBefore && st.flags[clearFlag]) {
      await new Promise((r) => setTimeout(r, 800));
      const prev = scn.chapters.find((c) => c.no === before)!;
      // 最後の章: 章の終わりの画面のかわりに、エンディング（挿絵とスタッフロール）。終わったらタイトルへ
      if (prev.ending) {
        await runEnding({
          gender: st.gender,
          chapters: scn.chapters.map((c) => ({ no: c.no, title: c.title, lessons: lessonsOf(c.no) })),
          endingTitle: prev.endingTitles.find((e) => check(e.if, st.flags))?.title ?? '',
          epilogue: prev.epilogue.map((l) => fill(l, textVars(st))),
          sprites: Object.fromEntries(Object.entries(scn.characters).map(([k, v]) => [k, v.sprite])),
        });
        quit();
        return;
      }
      const scene = drawScene(prev.no, 'end', { gender: st.gender, kodama: !!st.flags.kodama_joined });
      // 章の終わりの幕の曲（仲間１）。選んだら止める
      const ending = playOnce(MUSIC.chapterEnd, 0);
      const choice = await showChapterEnd(prev.no, prev.title, scene);
      ending.skip();
      if (choice === 'quit') {
        quit();
        return;
      }
      if (shell.chapter().no !== before) await startChapter();
      // まだ次の章がないとき（いま作っている最後の章）。章を終えたステージの曲は、もう流さない
      else {
        await hideChapterCard();
        term.print([{ t: '（つづきの章は、制作中です。この章の中は、このまま歩きまわれます）', c: 'hint' }]);
      }
    } else if (shell.chapter().no !== before) await startChapter();
  }
}

main();
