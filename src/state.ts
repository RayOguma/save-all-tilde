import type { TimeLimit } from './vfs';
import type { Flags } from './vfs';

export type Gender = 'boy' | 'girl';

export interface GameState {
  name: string;
  /** 主人公の立ち絵と一人称（ぼく／わたし）を決める */
  gender: Gender;
  /** 根からの名前の列（/home/チルダ村 → ['home', 'チルダ村']） */
  cwd: string[];
  /** ひとつ前にいた場所（cd - で戻る先。本物の OLDPWD） */
  prevCwd?: string[];
  flags: Flags;
  history: string[];
  /** 手帳に載っているコマンド（"ls -a" のようなオプションも含む） */
  learned: string[];
  /** 地図に載った場所（絶対パス） */
  discovered: string[];
  /** 一度でも入った場所（絶対パス） */
  visited: string[];
  /** Permission denied を受けた場所（絶対パス） */
  denied: string[];
  /** ヒントを何段階目まで見たか（ヒントの条件式ごと） */
  hintSteps: Record<string, number>;
  onboarded: boolean;
  /** 正体を見破ったリンク（ls -l で見た・file で調べた）。見破るまでは、見た目どおりのものとして表示する */
  identified?: string[];
  /** プレイヤーが入っている組（グループ） */
  groups?: string[];
  /** 持ち主や鍵のかけ方を変えた場所（パス → 変えたあとの値） */
  perms?: Record<string, { owner?: string; mode?: string; group?: string }>;
  /** 章が始まった時点のセーブ（「章を選ぶ」で、その章の最初からやり直せる） */
  checkpoints?: Record<number, GameState>;
  /** ゲームオーバーのとき、やり直す状態（rewindPoint や、番号で kill する直前） */
  rewind?: GameState;
  /** 進んでいる時間制限（始まった時刻・締め切り・中身・出した合図） */
  timer?: { startedAt: number; deadline: number; spec: TimeLimit; warned: number[] };
  /** 導入（見出しとナレーション）を見た章の番号 */
  introSeen?: number[];
  /** プレイヤーが mkdir・mv・cp でしたこと。読みこむときに、同じ順でやり直す */
  ops?: FsOp[];
  /** プレイヤーが ln -s で作ったリンク（at: 作った場所の絶対パス） */
  links?: { at: string; name: string; target: string }[];
  /** 最後に物語が進んだときの会話（「つづきから」で読み直せるように） */
  recap?: string[];
  /** echo > で書いた紙の中身（パス → 行）。読みこむときに、紙に戻す（なければ新しい紙を作る） */
  texts?: Record<string, string[]>;
  /** crontab で塔に渡した予定表（crontab -l で見る） */
  crontab?: string[];
}

/** mkdir（path に場所を作る）・mv（from を to へ運ぶ）・cp（from の写しを to に作る）。道のりは絶対パス */
export type FsOp =
  | { op: 'mkdir'; path: string }
  | { op: 'mv'; from: string; to: string }
  | { op: 'cp'; from: string; to: string }
  /** tar -czf: from をまとめて、to の包みを作った */
  | { op: 'tar'; from: string; to: string }
  /** tar -xzf: path の包みを、to の場所でほどいた */
  | { op: 'untar'; path: string; to: string }
  /** unlink: path のリンク（シナリオの札も）を抜いた */
  | { op: 'unlink'; path: string };

const KEY = 'morihito-save-v3';

/** シナリオの {me} を置き換える一人称 */
export const FIRST_PERSON: Record<Gender, string> = { boy: 'ぼく', girl: 'わたし' };

/** シナリオの {name} や {me} に入れる値 */
export function textVars(s: GameState): Record<string, string> {
  return { name: s.name, me: FIRST_PERSON[s.gender] };
}

export function newState(name: string, gender: Gender, start: string[], learned: string[]): GameState {
  return {
    name,
    gender,
    cwd: [...start],
    flags: {},
    history: [],
    learned: [...learned],
    discovered: [],
    visited: ['/' + start.join('/')],
    denied: [],
    hintSteps: {},
    onboarded: false,
    introSeen: [],
  };
}

// ストレージはプライベートウィンドウなどで例外を投げることがあるので、失敗しても遊べるようにする
export function loadState(): GameState | null {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (s && typeof s.name === 'string' && Array.isArray(s.cwd) && s.flags && Array.isArray(s.learned)) {
      s.gender ??= 'boy'; // 性別を選ぶ前に作られたセーブ
      return s;
    }
  } catch {
    /* セーブなしとして扱う */
  }
  return null;
}

export function saveState(s: GameState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* 保存できなくても続行 */
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}
