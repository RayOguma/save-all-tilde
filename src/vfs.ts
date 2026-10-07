// 仮想ファイルシステム。シナリオYAMLから「/」を頂点とする木を組み立て、パス解決と権限判定を行う。

export type Flags = Record<string, boolean>;

/** 条件式。"flag" / "!flag" を & でつなげ、| で「または」（例: "(a & !b) | (c & !d)"）。& が先に結びつく */
export type Cond = string;

export type Theme = string | { if?: Cond; name: string }[];

export interface Trigger extends StoryPerms {
  if?: Cond;
  /** このフラグが立っていたら発火しない。発火時に立てる */
  once?: string;
  lines?: string[];
  effect?: string;
  /** effect の後に表示する行 */
  after?: string[];
  set?: string[];
  /** 手帳に追加するコマンド（"ls -a" のようにオプション単位でもよい） */
  learn?: string[];
  /** 地図に表示させる場所（絶対パス） */
  reveal?: string[];
  /** イベントの最後に、この場所へ移る（章の終わりに次の章の場所へ、など） */
  moveTo?: string;
  /** 画面の一部を枠で照らして説明する吹き出し（はじめての ls など）。effect のあと、after の前に出る */
  guide?: GuideStep[];
  /** この道のりの物が、ぜんぶあるときだけ発火する（運んだ・写した・作ったかを確かめる） */
  exists?: string[];
  /** この道のりの物が、どれもないときだけ発火する */
  missing?: string[];
  /** だれかが、ゆっくりコマンドを打ってみせる（after のあと） */
  demo?: Demo;
  /** ゲームオーバー。せりふと演出のあと、やり直しの場所（rewindPoint）から始め直す */
  gameOver?: boolean;
  /** ここを、ゲームオーバーのときのやり直しの場所にする（発火する直前の状態を取っておく）。cwd で、やり直す場所を変えられる */
  rewindPoint?: { cwd?: string };
  /** 時間制限を始める（第6章の獣から隠れる場面） */
  timeLimit?: TimeLimit;
}

/**
 * 時間制限。seconds 秒のうちに、path の場所が group の組・mode（正規表現）の鍵になれば onSuccess、
 * 間に合わなければ onTimeout。残り時間は見せず、warnings で迫ってくることを伝える
 */
export interface TimeLimit {
  seconds: number;
  path: string;
  group?: string;
  mode?: string;
  onSuccess: Trigger;
  onTimeout: Trigger;
  /** 始まってから at 秒で出す合図（足音など） */
  warnings?: { at: number; lines: string[]; effect?: string }[];
}

/** だれか（兄など）が、入力欄にゆっくりコマンドを打って実行してみせる。手本 */
export interface Demo {
  /** 打つ人。プロンプトの名前になる */
  by: string;
  steps: DemoStep[];
}

export interface DemoStep {
  /** 打つ前のせりふ */
  say?: string[];
  /** 打ちはじめる前の吹き出し（ターミナルの紹介など） */
  intro?: GuideStep[];
  /** 打つコマンド */
  type: string;
  /** ここまで打ったところで止まり、hold の吹き出しで説明する（入力候補の説明など） */
  pauseAt?: string;
  hold?: GuideStep[];
  /** 止まったあと、Tab キーで残りを補ってみせる */
  tab?: boolean;
  /** 実行したあとの吹き出し */
  guide?: GuideStep[];
  /** 実行したあとのせりふ（guide のあと） */
  after?: string[];
  /** 実行したあとに手帳に載せるコマンド */
  learn?: string[];
}

/**
 * 画面を照らして説明する吹き出しの1つ。at は照らす場所:
 * output（直前の出力の行）／ output-prev（そのひとつ前の行）／ dir（直前の出力の中の場所の名前）／
 * mark（地図の「!」）／ here（地図の、いまいる場所）／ map（地図）／ bag（かばんの欄）／ input（入力欄）／
 * prompt（入力欄の左の、名前と住所）／ suggest（入力候補。item があれば、その候補だけ）／
 * row（地図の item の場所の行）／ sub（地図の item の場所の右の住所 ~ や /usr）／ book（右のコマンド手帳）／
 * found（地図の、いまいる場所の中にある人や物。ls で見つけたもの）／ terminal（ターミナル全体）／ objective（目的の欄）／ hint（ヒントのボタン）／ bookbtn（手帳のボタン）
 */
export interface GuideStep {
  at:
    | 'output' | 'output-prev' | 'dir' | 'mark' | 'here' | 'map' | 'bag' | 'input' | 'prompt' | 'suggest' | 'row' | 'sub' | 'book'
    | 'terminal' | 'objective' | 'hint' | 'bookbtn' | 'found';
  text: string;
  /** suggest なら候補の名前、row・sub なら地図の場所の道のり（/usr など） */
  item?: string;
  /** 吹き出しの下に小さく出す注意書き（ゲームだけのしくみ、など） */
  note?: string;
}

/** 物語の都合で、持ち主・鍵のかけ方・プレイヤーの組を変える */
export interface StoryPerms {
  chown?: { path: string; owner: string };
  chmod?: { path: string; mode: string };
  joinGroup?: string;
}

export interface Variant extends StoryPerms {
  if?: Cond;
  /** 今いる場所がこのパスの中のときだけ（仲間のせりふを場所で変える） */
  at?: string;
  lines?: string[];
  /** 元の lines を文字化けさせて表示する */
  garble?: boolean;
  /** lines のあとの演出（鈴の音など）と、そのあとの行 */
  effect?: string;
  after?: string[];
  set?: string[];
  learn?: string[];
  /** 話したあと地図に載せる物（絶対パス）。会話で棚に置かれた物など、ls しなくても分かるもの */
  reveal?: string[];
  /** 画面を照らして説明する吹き出し（lines・effect のあと、after の前） */
  guide?: GuideStep[];
  /** だれかが、ゆっくりコマンドを打ってみせる（after のあと） */
  demo?: Demo;
}

/** 条件を満たす間は入れない（村の門など）。権限とは別の、物語上の通行止め */
export interface Gate {
  if: Cond;
  lines: string[];
}

interface BaseNode {
  name: string;
  /** 地図に出す名前（/usr → 迷いの森）。なければ name */
  label?: string;
  icon?: string;
  /** "rwxr-xr-x" 形式。所有者/グループ/その他 */
  mode: string;
  owner: string;
  /** 組（グループ）。なければ持ち主と同じ名前の組 */
  group?: string;
  visibleIf?: Cond;
  /** 存在しない（visibleIf が偽の）間も、この条件なら地図に「？？？」として出す */
  teaser?: Cond;
  /** この条件の間、物語を進めるために行く・話す必要がある（地図に赤い「!」が付く） */
  mark?: Cond;
  /** ls や find で見つけた（名前が出た）ときに立てるフラグ。「見つけたら !」のように mark の条件に使う */
  seen?: string;
  /** mark を書いた章。「!」はその章の間だけ出す（寄り道で飛ばした「!」が後の章に残らないように） */
  markChapter?: number;
  /** ターミナルの枠のデザイン。中の場所は受け継ぐ。条件つきで変えるときは [{ if, name }] */
  theme?: Theme;
  /** mv で運べる（名前を変えられる）。シナリオの物はふつう動かせない。プレイヤーが作った・写した物は運べる */
  movable?: boolean;
  /** mv で運ぼうとしたときの反応。運ばずに、これを出す（第4章のアプト「おれは荷物じゃないぞ」、第5章の大きすぎる設計図） */
  onMv?: string[];
  /** この条件の間、この場所（と中の場所）では世界から色が抜ける */
  drainedIf?: Cond;
  /** この条件の間、この場所（と中の場所）では、ときどき画面が乱れて「ザザッ」と鳴る（壊れた世界） */
  staticIf?: Cond;
  /** この条件の間、この場所（と中の場所）では、1分おきに鐘が「カーン」と鳴る（第7章の、鳴りやまない塔の鐘） */
  bellIf?: Cond;
  /** この場所（と中の場所）で流す曲（public/bgm/ のファイル名から .mp3 を除いたもの）。none なら無音。条件つき: [{ if, name }] */
  bgm?: Theme;
  parent: DirNode | null;
}

export interface DirNode extends BaseNode {
  type: 'dir';
  children: VNode[];
  onEnter?: Trigger[];
  /** Permission denied のあとに出す描写 */
  deniedLines?: string[];
  /**
   * chmod で鍵のかけ方を変えたあとの反応。上から順に、can（変えたあとに、プレイヤーがその鍵を持っているか。"x" など）が合った最初のもの。
   * 例: 第3章の空き家（x がついたら「入ってみよう」）
   */
  onChmod?: (Trigger & { can?: string })[];
  gate?: Gate;
  /** リンク（飛び石）を通らないと入れない場所。直接 cd しようとしたときの描写 */
  needsLink?: string[];
  /** ln -s で飛び石を置ける場所（第2章の岩場・中州・葦の原）。ほかの場所には置けない */
  linkable?: boolean;
}

export interface FileNode extends BaseNode, StoryPerms {
  type: 'file';
  lines: string[];
  /**
   * 紙に書かれた字（第7章の予定表など）。cat すると、せりふではなく字のまま出る（そのあとに lines）。
   * echo > で書き直せる紙もある（書いた中身はセーブの texts に残る）
   */
  text?: string[];
  /** chmod で鍵のかけ方を変えたあとの反応（場所の onChmod と同じ書き方） */
  onChmod?: (Trigger & { can?: string })[];
  /** echo > で書こうとして、Permission denied だったときの描写 */
  deniedLines?: string[];
  variants?: Variant[];
  set?: string[];
  learn?: string[];
  /** file で調べたときの正体（「カエル（ふつうのファイル）」など） */
  fileDesc?: string;
  /** write で声を届けられたときの反応。上から順に、条件と言葉が合った最初のものを使う */
  onWrite?: WriteRule[];
  /**
   * 包み（.tar.gz）の中身。シナリオの包みは、ふつうのノードの書き方（raw）のまま持つ。
   * tar -xzf でほどくと、いまいる場所に、これと同じ物ができる（第5章の宿場の人たち・設計図）
   */
  archive?: unknown[];
  /** プレイヤーが tar -czf でまとめた包みの中身（写しなので、物語の仕掛けは持たない） */
  packed?: VNode[];
  /** tar -tzf で中をのぞいたときのイベント */
  onList?: Trigger;
  /** tar -xzf でほどいたときのイベント */
  onExtract?: Trigger;
}

/** write の反応。has のどれかの言葉が入っていたら（has がなければ、いつでも） */
export interface WriteRule extends Trigger {
  has?: string[];
}

/** シンボリックリンク。target の場所や物を指さしている。target はリンクのある場所から見た道のり */
export interface LinkNode extends BaseNode {
  type: 'link';
  target: string;
  /** file で正体を調べたときのイベント */
  onFile?: Trigger;
  /** リンク切れのまま cd しようとして、入れなかったときのイベント（第2章の渡り道A） */
  onBroken?: Trigger;
  /** unlink で抜こうとしたときに、抜かずに出すせりふ（第9章の、まことの道しるべ） */
  noUnlink?: string[];
}

export interface ProcNode extends BaseNode {
  type: 'process';
  /** この条件のときは、kill を唱えようとしても唱えない（killBlocked のせりふ）。第9章、動きだしたモリビト */
  killBlockedIf?: Cond;
  killBlocked?: string[];
  /** kill などで指定する名前（先頭の . を除いたもの） */
  pname: string;
  lines: string[];
  variants?: Variant[];
  set?: string[];
  learn?: string[];
  stoppedIf?: Cond;
  onKill?: Trigger;
}

export type VNode = DirNode | FileNode | ProcNode | LinkNode;

/** プレイヤー自身のユーザー名。owner がこれなら所有者の権限で判定する */
export const PLAYER = 'きみ';

export function check(cond: Cond | undefined, flags: Flags): boolean {
  if (!cond) return true;
  return cond.split('|').some((alt) =>
    alt
      .replace(/[()]/g, '')
      .split('&')
      .map((s) => s.trim())
      .every((t) => (t.startsWith('!') ? !flags[t.slice(1)] : !!flags[t])),
  );
}

export function buildTree(raw: any, parent: DirNode | null = null): VNode {
  const type = raw.type ?? (raw.link !== undefined ? 'link' : raw.children ? 'dir' : 'file');
  const base = {
    name: String(raw.name),
    label: raw.label,
    icon: raw.icon,
    owner: raw.owner ?? 'root',
    group: raw.group,
    visibleIf: raw.visibleIf,
    teaser: raw.teaser,
    mark: raw.mark,
    seen: raw.seen,
    movable: raw.movable,
    onMv: raw.onMv,
    theme: raw.theme,
    drainedIf: raw.drainedIf,
    staticIf: raw.staticIf,
    bellIf: raw.bellIf,
    bgm: raw.bgm,
    parent,
  };
  switch (type) {
    case 'dir': {
      const dir: DirNode = {
        ...base,
        type,
        mode: raw.mode ?? 'rwxr-xr-x',
        children: [],
        onEnter: raw.onEnter,
        deniedLines: raw.deniedLines,
        onChmod: raw.onChmod,
        gate: raw.gate,
        needsLink: raw.needsLink,
        linkable: raw.linkable,
      };
      dir.children = (raw.children ?? []).map((c: unknown) => buildTree(c, dir));
      return dir;
    }
    case 'file':
      return {
        ...base,
        type,
        mode: raw.mode ?? 'rw-r--r--',
        lines: raw.lines ?? [],
        text: raw.text?.map(String),
        onChmod: raw.onChmod,
        deniedLines: raw.deniedLines,
        variants: raw.variants,
        set: raw.set,
        learn: raw.learn,
        fileDesc: raw.fileDesc,
        onWrite: raw.onWrite,
        archive: raw.archive,
        onList: raw.onList,
        onExtract: raw.onExtract,
        chown: raw.chown,
        chmod: raw.chmod,
        joinGroup: raw.joinGroup,
      };
    case 'link':
      return {
        ...base,
        type,
        mode: 'rwxrwxrwx',
        target: String(raw.link),
        onFile: raw.onFile,
        onBroken: raw.onBroken,
        noUnlink: raw.noUnlink,
      };
    case 'process':
      return {
        ...base,
        type,
        mode: raw.mode ?? 'r--r--r--',
        pname: raw.pname ?? base.name.replace(/^\./, ''),
        lines: raw.lines ?? [],
        variants: raw.variants,
        set: raw.set,
        learn: raw.learn,
        stoppedIf: raw.stoppedIf,
        onKill: raw.onKill,
        killBlockedIf: raw.killBlockedIf,
        killBlocked: raw.killBlocked,
      };
    default:
      throw new Error(`unknown node type: ${type} (${base.name})`);
  }
}

/** その場所の枠のデザイン。自分に指定がなければ外側の場所から受け継ぐ */
export function themeOf(node: VNode, flags: Flags): string {
  for (let n: VNode | null = node; n; n = n.parent) {
    if (!n.theme) continue;
    if (typeof n.theme === 'string') return n.theme;
    const hit = n.theme.find((t) => check(t.if, flags));
    if (hit) return hit.name;
  }
  return 'plain';
}

/** その場所で流す曲。自分に指定がなければ外側の場所から受け継ぐ。none・指定なしなら null（無音） */
export function bgmOf(node: VNode, flags: Flags): string | null {
  for (let n: VNode | null = node; n; n = n.parent) {
    if (!n.bgm) continue;
    const name = typeof n.bgm === 'string' ? n.bgm : n.bgm.find((t) => check(t.if, flags))?.name;
    if (!name) continue;
    return name === 'none' ? null : name;
  }
  return null;
}

/** その場所で、1分おきに鐘が鳴るか。外側の場所の bellIf も受け継ぐ */
export function bellAt(node: VNode, flags: Flags): boolean {
  for (let n: VNode | null = node; n; n = n.parent) if (n.bellIf) return check(n.bellIf, flags);
  return false;
}

/** その場所で、ときどき画面が乱れるか。外側の場所の staticIf も受け継ぐ */
export function staticAt(node: VNode, flags: Flags): boolean {
  for (let n: VNode | null = node; n; n = n.parent) if (n.staticIf) return check(n.staticIf, flags);
  return false;
}

/** その場所で世界から色が抜けているか。外側の場所の drainedIf も受け継ぐ */
export function drainedAt(node: VNode, flags: Flags): boolean {
  for (let n: VNode | null = node; n; n = n.parent) if (n.drainedIf) return check(n.drainedIf, flags);
  return false;
}

/** 木の中の mark に、書いた章の番号を付ける */
export function tagMarks(n: VNode, chapter: number) {
  if (n.mark && n.markChapter === undefined) n.markChapter = chapter;
  if (n.type === 'dir') n.children.forEach((c) => tagMarks(c, chapter));
}

/** 後の章のシナリオが、前の章で作った場所に中身や設定を足す（places: [{ path, ...設定, children }]） */
export function graft(root: DirNode, raw: any, chapter: number) {
  let node: VNode = root;
  for (const name of splitPath(raw.path)) {
    if (node.type !== 'dir') throw new Error(`graft: ${raw.path} はディレクトリではない`);
    const next: VNode | undefined = node.children.find((c) => c.name === name);
    if (!next) throw new Error(`graft: ${raw.path} が見つからない`);
    node = next;
  }
  // 人や物（ファイル・プロセス）: せりふの差し替え（variants）は前に足し（後の章のものを優先）、ほかの設定は上書きする
  if (node.type !== 'dir') {
    const { path: _p, variants, ...rest } = raw;
    Object.assign(node, rest);
    if (variants && (node.type === 'file' || node.type === 'process')) node.variants = [...variants, ...(node.variants ?? [])];
    return;
  }
  const { path: _path, children = [], onEnter, ...props } = raw;
  Object.assign(node, props);
  if (props.mark) node.markChapter = chapter;
  if (onEnter) node.onEnter = [...(node.onEnter ?? []), ...onEnter];
  for (const c of children) {
    const child = buildTree(c, node);
    tagMarks(child, chapter);
    node.children.push(child);
  }
}

/** プレイヤーが入っている組（グループ）。シェルが作られるときにセーブから入れる */
let playerGroups: string[] = [];

export function setPlayerGroups(groups: string[]) {
  playerGroups = groups;
}

export function groupOf(node: VNode): string {
  return node.group ?? node.owner;
}

/** 鍵束の力（sudo）で唱えている間。どの鍵も開いている（本物の root と同じ） */
let rootMode = false;

export function setRootMode(on: boolean) {
  rootMode = on;
}

export function isRoot(): boolean {
  return rootMode;
}

/** 鍵の3組: 持ち主なら左の3文字、同じ組（家族）なら真ん中、それ以外（よその人）なら右。sudo の間は、いつでも開いている */
export function can(node: VNode, perm: 'r' | 'w' | 'x'): boolean {
  if (rootMode) return true;
  const bits =
    node.owner === PLAYER
      ? node.mode.slice(0, 3)
      : playerGroups.includes(groupOf(node))
        ? node.mode.slice(3, 6)
        : node.mode.slice(6, 9);
  return bits.includes(perm);
}

/** 見えるかどうかに関係なく、道のりの場所を探す（セーブの反映用） */
export function nodeAt(root: DirNode, path: string): VNode | undefined {
  let n: VNode = root;
  for (const name of splitPath(path)) {
    if (n.type !== 'dir') return undefined;
    const c: VNode | undefined = n.children.find((x) => x.name === name);
    if (!c) return undefined;
    n = c;
  }
  return n;
}

export function visibleChildren(dir: DirNode, flags: Flags): VNode[] {
  return dir.children.filter((c) => check(c.visibleIf, flags));
}

export function findChild(dir: DirNode, name: string, flags: Flags): VNode | undefined {
  return visibleChildren(dir, flags).find((c) => c.name === name);
}

export function splitPath(path: string): string[] {
  return path.split('/').filter(Boolean);
}

export function joinPath(parts: string[]): string {
  return '/' + parts.join('/');
}

/** 根からノードまでの名前の列 */
export function partsOf(node: VNode): string[] {
  const parts: string[] = [];
  for (let n: VNode | null = node; n?.parent; n = n.parent) parts.unshift(n.name);
  return parts;
}

export type ResolveError = 'ENOENT' | 'ENOTDIR' | 'EACCES' | 'ELOOP';
/** via: 途中でリンクをたどったか（飛び石を渡ったか） */
export type Resolved = { ok: true; node: VNode; parts: string[]; via: boolean } | { ok: false; err: ResolveError };

/** リンクをたどる回数の上限（リンクがぐるぐる指し合っているとき用） */
const MAX_LINKS = 8;

/**
 * cwd（根からの名前の列）を基準に path を解決する。途中のディレクトリには x 権限が必要。
 * 途中のリンクはたどる。最後がリンクのときは followLast が true ならたどる（ls -l・file・unlink はたどらない）
 */
export function resolve(
  root: DirNode,
  cwd: string[],
  path: string,
  flags: Flags,
  home: string[],
  followLast = true,
  depth = 0,
): Resolved {
  let parts: string[];
  let rest = path;
  if (path === '~' || path.startsWith('~/')) {
    parts = [...home];
    rest = path.slice(1);
  } else {
    parts = path.startsWith('/') ? [] : [...cwd];
  }
  for (const seg of rest.split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') parts.pop();
    else parts.push(seg);
  }

  let node: VNode = root;
  let via = false;
  for (const [i, name] of parts.entries()) {
    if (node.type !== 'dir') return { ok: false, err: 'ENOTDIR' };
    if (!can(node, 'x')) return { ok: false, err: 'EACCES' };
    let child = findChild(node, name, flags);
    if (!child) return { ok: false, err: 'ENOENT' };
    if (child.type === 'link' && (i < parts.length - 1 || followLast)) {
      if (depth >= MAX_LINKS) return { ok: false, err: 'ELOOP' };
      const r = resolve(root, partsOf(node), child.target, flags, home, true, depth + 1);
      if (!r.ok) return r;
      child = r.node;
      via = true;
    }
    node = child;
  }
  return { ok: true, node, parts, via };
}

/** プロンプト用の表示。ホームの中なら ~ で始める */
export function displayPath(parts: string[], home: string[]): string {
  if (home.every((h, i) => parts[i] === h)) {
    const rest = parts.slice(home.length);
    return rest.length ? `~/${rest.join('/')}` : '~';
  }
  return joinPath(parts);
}
