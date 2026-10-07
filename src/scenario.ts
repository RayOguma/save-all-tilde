import { parse } from 'yaml';
import type { FsOp } from './state';
import { buildTree, check, graft, splitPath, tagMarks, type Cond, type DirNode, type FileNode, type Flags, type Trigger, type WriteRule } from './vfs';

export interface Character {
  sprite: string;
  color?: string;
  /** 文字の音の高さ（Hz） */
  voice?: number;
}

export interface Objective {
  if?: Cond;
  text: string;
}

/** ヒントは3段階: 方向性 → 使うコマンド → 答え */
export interface Hint {
  if?: Cond;
  steps: string[];
}

/** コマンドを打ったあとに起きるイベント（チュートリアルの案内など） */
export interface CommandEvent extends Trigger {
  /** コマンドの名前。* なら、どのコマンドのあとでも */
  on: string;
  /** 今いる場所が、ちょうどこのパスのときだけ */
  at?: string;
  /** コマンドに書いた名前のどれかが、この道のりの物を指しているときだけ（例: cat ~/かばん/地図の巻物） */
  target?: string;
  /** find が、この道のりの物を見つけたときだけ（例: 鈴を見つけたら、取りに行くよう頼まれる） */
  found?: string;
  /**
   * コマンドに、この名前を書いたときだけ（道のりの最後の名前で比べる）。
   * リンクとその行き先のように、target では同じ物になってしまうものを、呼んだ名前で分ける（第2章のカエル兄・カエル弟）
   */
  arg?: string;
  /** echo > で、この道のりの紙に書いたときだけ */
  wrote?: string;
  /** パイプで、このコマンドの出した行を流しこまれたときだけ（history | grep kill の history） */
  from?: string;
  /** この道のりのリンクの正体を、見破っているときだけ（ls -l・file で見たあと） */
  identified?: string;
}

/**
 * 物語で頼まれた mkdir・mv・cp。この章では、ここに書いたものしかできない（オートセーブなので、世界を散らかさないように）。
 * to（と mv・cp は from）は絶対パスか ~ から。名前は合っているのに場所がちがうときは、wrong のせりふで正しい場所を教える
 */
export interface AllowRule {
  cmd: 'mkdir' | 'mv' | 'cp' | 'tar' | 'echo';
  from?: string;
  to: string;
  if?: Cond;
  wrong?: string[];
  /** tar -czf で、包みの名前が .tar.gz で終わっていないときのせりふ（wrong より先に出す） */
  noExt?: string[];
}

/** 旅についてくる仲間。joinIf が立つと、どこにいても cat 名前 で話せる */
export interface Companion {
  node: FileNode;
  joinIf: Cond;
}

export interface CommandDoc {
  name: string;
  /** help や clear など、最初から使える操作系のコマンド */
  system?: boolean;
  /** 禁じられた言葉として手帳に載る */
  forbidden?: boolean;
  summary: string;
  usage: string;
  examples?: string[];
  /** short: 右の手帳に出す短い説明（なければ desc） */
  options?: { flag: string; desc: string; short?: string }[];
  /** 本物のLinuxでは */
  real?: string;
  /**
   * until の条件になるまで、正体を伏せて見せる（石碑で知った kill を、何が起こるか分からない謎の言葉にしておく）。
   * 伏せている間は、禁じられた言葉の赤い印も出さない
   */
  veil?: { until: Cond; summary: string; usage?: string; examples?: string[]; real?: string };
  /**
   * 入力候補に、コマンドの名前だけでなく、覚えた唱え方（options）ごと出す（tar -tzf・tar -xzf・tar -czf）。
   * 唱え方が何種類もあって、-〇 の部分を思い出しにくいコマンドに使う
   */
  suggestFlags?: boolean;
  /**
   * この条件のあいだは、手帳にも入力候補にも出さない（唱えることはできる）。
   * 第0章で一度だけ使う kill を、第1章からしまっておく
   */
  hideIf?: Cond;
}

/** 今は手帳や候補に出さず、しまっておくコマンドか */
export function shelved(d: CommandDoc | undefined, flags: Flags): boolean {
  return !!d?.hideIf && check(d.hideIf, flags);
}

/** 今の進み具合で手帳に見せる、コマンドの説明（伏せている間は、伏せた説明） */
export function shownDoc(d: CommandDoc, flags: Flags): CommandDoc & { veiled?: boolean } {
  if (!d.veil || check(d.veil.until, flags)) return d;
  const { until: _u, ...v } = d.veil;
  return { ...d, ...v, options: [], forbidden: false, veiled: true };
}

/** その章をクリアすると手に入るもの。「章を選ぶ」で後の章から始めるときに積み上げる */
export interface ChapterClear {
  flags?: string[];
  learned?: string[];
  groups?: string[];
  perms?: Record<string, { owner?: string; mode?: string; group?: string }>;
  discovered?: string[];
  /** mkdir・mv・cp でしたこと（かばんを作った、など） */
  ops?: FsOp[];
  /** echo > で書いた紙の中身（パス → 行） */
  texts?: Record<string, string[]>;
  /** その章で打ったはずのコマンド（「章を選ぶ」で後の章から始めたときの history。第8章で自分の記録を読む） */
  history?: string[];
}

/** date で出す日時。上から、条件が合った最初のもの */
export interface DateText {
  if?: Cond;
  text: string;
}

/**
 * 予定表（crontab 紙 で塔に渡す）。紙の行を「分 時 日 月 曜日 仕事」として読み、jobs と照らし合わせて
 * フラグを立てる（仕事に key を含む行の時刻が at のどれかなら flag、key を含む行があれば flag_written。
 * all なら、key を含む行が、ぜんぶ合っていないとだめ）。
 * そのあと onInstall の、条件が合った最初のイベント
 */
export interface CronSpec {
  jobs: { key: string; at: string[]; flag: string; all?: boolean }[];
  onInstall: Trigger[];
  /** 行の形がおかしくて、渡せなかったとき（直し方を教える）。上から、条件が合った最初のもの */
  onError?: Trigger[];
}

export interface Chapter {
  no: number;
  title: string;
  /** この条件になったら、この章が始まる（最初の章は空） */
  startIf?: Cond;
  /** 章の始まりの場所。まだ行ったことがなければ、章の始まりにここへ移す */
  startAt?: string;
  /** 章のはじめのナレーション（画面の説明より前） */
  intro: string[];
  /** 画面の説明のあとに出す、最初の行動の指示 */
  guide: string[];
  /** 最初の行動の指示のあとに起きるイベント（兄が起こしに来る、など）。once を書く */
  opening?: Trigger;
  objectives: Objective[];
  hints: Hint[];
  events: CommandEvent[];
  clear?: ChapterClear;
  /** 物語で頼まれた mkdir・mv・cp（これ以外はできない） */
  allow: AllowRule[];
  /** この章で、目に見えずに動いている者たち（ps・fg・bg・kill 番号） */
  procs: Proc[];
  /** date で出す日時（なければ、前の章のもの） */
  date: DateText[];
  /** crontab で渡す予定表の決まり */
  cron?: CronSpec;
  /** systemctl で動かす・確かめるもの（第9章のモリビト） */
  services: Service[];
  /** 最後の章。クリアしたら、章の終わりの画面のかわりにエンディング（挿絵とスタッフロール）を流す */
  ending?: boolean;
  /** エンディングの最後に出す、結末の名前。上から、条件が合った最初のもの */
  endingTitles: { if?: Cond; title: string }[];
  /** エンディングの最後（Thank you for playing のあと）、真っ暗な中に出すせりふ（「名前: せりふ」） */
  epilogue: string[];
}

/**
 * systemctl start 名前・systemctl status 名前 で扱うもの（本物の「サービス」）。
 * start は鍵束の力（sudo）がいる。onStart の、条件が合った最初のイベント（exists なども使える）
 */
export interface Service {
  name: string;
  /** status に出す説明 */
  desc: string;
  /** この条件のとき、動いている（active）。そうでなければ止まっている（inactive） */
  activeIf: Cond;
  /** 止まっているときの、status の since */
  since?: string;
  onStart: Trigger[];
}

/**
 * 目に見えずに動いている者（プロセス）。ps に番号（PID）と状態が出る。
 * fg で表に呼ぶと fg_番号 のフラグが立ち（仲間の joinIf などで姿を出す）、bg で裏に戻すと消える。kill すると killed_番号
 */
export interface Proc {
  pid: string;
  name: string;
  /** 裏にいるときの、ps の状態（「裏で動く」「眠っている」「暴走」など） */
  state: string;
  /** この条件のときだけ、ps に出る */
  if?: Cond;
  /** fg で呼べないときのせりふ（獣など） */
  noFg?: string[];
  onFg?: Trigger;
  onBg?: Trigger;
  /** kill できる条件。満たさないときは killBlocked のせりふ */
  killIf?: Cond;
  killBlocked?: string[];
  onKill?: Trigger;
  /** 裏にいても、write で声は届く。その反応（人の onWrite と同じ書き方） */
  onWrite?: WriteRule[];
}

export interface Scenario {
  host: string;
  home: string[];
  /** 物語が始まる場所 */
  start: string[];
  startCommands: string[];
  characters: Record<string, Character>;
  companions: Companion[];
  /** cat 自分の名前 で読む、主人公自身（兄が cat {name} で話しかけてくる、など） */
  self?: FileNode;
  chapters: Chapter[];
  root: DirNode;
  commands: Record<string, CommandDoc>;
  /** プレイヤーが mkdir で作った場所のアイコン（名前 → アイコン。かばん → bag など） */
  madeIcons: Record<string, string>;
}

/**
 * 章ごとのYAMLを重ねて、1つの世界にする。
 * 最初の章は root で世界の骨組みを作り、後の章は places で前の章の場所に中身を足す。
 */
export function loadScenario(chapterYamls: string[], commandsYaml: string): Scenario {
  const raws = chapterYamls.map((y) => parse(y));
  const first = raws[0];
  const root = buildTree(first.root);
  if (root.type !== 'dir') throw new Error('root must be a dir');
  tagMarks(root, first.chapter.no);

  const scn: Scenario = {
    host: first.host,
    home: splitPath(first.home),
    start: splitPath(first.start ?? first.home),
    startCommands: first.startCommands ?? [],
    characters: {},
    companions: [],
    chapters: [],
    root,
    commands: {},
    madeIcons: {},
  };
  for (const raw of raws) {
    for (const p of raw.places ?? []) graft(root, p, raw.chapter.no);
    Object.assign(scn.characters, raw.characters);
    Object.assign(scn.madeIcons, raw.madeIcons);
    // 主人公自身。後の章で足したせりふを優先する
    if (raw.self) {
      if (scn.self) scn.self.variants = [...(raw.self.variants ?? []), ...(scn.self.variants ?? [])];
      else scn.self = buildTree({ ...raw.self, name: 'self', type: 'file' }) as FileNode;
    }
    for (const c of raw.companions ?? []) {
      // 後の章で同じ仲間が出てきたら、せりふを足す（後の章の場所ごとのせりふを優先する）
      const same = scn.companions.find((x) => x.node.name === c.name);
      if (same) same.node.variants = [...(c.variants ?? []), ...(same.node.variants ?? [])];
      else scn.companions.push({ node: buildTree({ ...c, type: 'file' }) as FileNode, joinIf: c.joinIf });
    }
    scn.chapters.push({
      no: raw.chapter.no,
      title: raw.chapter.title,
      startIf: raw.chapter.startIf,
      startAt: raw.chapter.startAt,
      intro: raw.intro ?? [],
      guide: raw.guide ?? [],
      opening: raw.opening,
      objectives: raw.objectives ?? [],
      hints: raw.hints ?? [],
      events: raw.events ?? [],
      clear: raw.clear,
      allow: raw.allow ?? [],
      procs: raw.procs ?? [],
      date: raw.date ?? [],
      cron: raw.cron,
      services: raw.services ?? [],
      ending: raw.chapter.ending,
      endingTitles: raw.endingTitles ?? [],
      epilogue: raw.epilogue ?? [],
    });
  }
  for (const c of parse(commandsYaml).commands as CommandDoc[]) scn.commands[c.name] = c;
  return scn;
}
