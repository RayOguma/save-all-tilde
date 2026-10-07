// 左の地図に出す行を組み立てる。DOMに依存しないのでテストできる。
import { pathOf, type Shell } from './shell';
import { check, joinPath, partsOf, type DirNode, type VNode } from './vfs';

export interface MapRow {
  path: string;
  depth: number;
  /** 「？？？」の行は label が null */
  label: string | null;
  /** 本物のパス（/usr など）。地図の名前の横に小さく出す */
  sub?: string;
  icon: string;
  kind: 'dir' | 'file' | 'process' | 'link';
  current: boolean;
  visited: boolean;
  locked: boolean;
  warn: boolean;
  stopped: boolean;
  /** 物語を進めるために、ここ（またはこの先）へ行く必要がある */
  mark: boolean;
  /** クリックしたとき入力欄に入れるコマンド。null ならクリックできない */
  insert: string | null;
  /** たためる場所なら 'open'（開いている）か 'closed'（閉じている）。たためないなら null */
  fold: 'open' | 'closed' | null;
}

/** 地図の開け閉めを、プレイヤーが手で変えたもの（パス → 開いているか） */
export type FoldOverrides = ReadonlyMap<string, boolean>;

/**
 * ステージ（チルダ村・迷いの森・もつれ沼…）の入口の場所。
 * 世界（/）の直下と居住区（/home）の直下の場所を、ひとつのステージとして扱う
 */
function stageOf(n: VNode, home: string): VNode | null {
  for (let x: VNode | null = n; x?.parent; x = x.parent) {
    const parent = pathOf(x.parent);
    const isAncestorOfHome = home === pathOf(x) || home.startsWith(pathOf(x) + '/');
    if ((parent === '/' && !isAncestorOfHome) || (parent !== '/' && home.startsWith(parent + '/') && parent !== home))
      return x;
  }
  return null;
}

/** 今いる場所のステージの入口（地図で、はじめから開いておく場所） */
export function currentStage(shell: Shell): string | null {
  const here = resolveHere(shell);
  const stage = here && stageOf(here, joinPath(shell.scenario.home));
  return stage ? pathOf(stage) : null;
}

function resolveHere(shell: Shell): VNode | null {
  let n: VNode = shell.scenario.root;
  for (const name of shell.state.cwd) {
    if (n.type !== 'dir') return null;
    const c: VNode | undefined = n.children.find((x) => x.name === name);
    if (!c) return null;
    n = c;
  }
  return n;
}

export function buildMap(shell: Shell, overrides: FoldOverrides = new Map()): MapRow[] {
  const { scenario: scn, state: st } = shell;
  const cwd = joinPath(st.cwd);
  const home = joinPath(scn.home);
  const rows: MapRow[] = [];
  const here = currentStage(shell);
  // ステージの入口は、今いるステージだけ開いておく。中の場所は、はじめは開いている
  const isOpen = (n: VNode) => {
    const p = pathOf(n);
    if (overrides.has(p)) return overrides.get(p)!;
    return stageOf(n, home) !== n || p === here;
  };

  const onPathTo = (dir: DirNode, target: string) => {
    const p = pathOf(dir);
    return p === '/' || target === p || target.startsWith(p + '/');
  };

  // 「!」は、印の付いた人・ものと、そこへ続く場所に付ける。ただし今いる場所とその上には付けない
  const marked = new Map<VNode, boolean>();
  const chapterNo = shell.chapter().no;
  const hasMark = (n: VNode): boolean => {
    if (marked.has(n)) return marked.get(n)!;
    const visible = check(n.visibleIf, st.flags);
    const own =
      visible && !!n.mark && (n.markChapter === undefined || n.markChapter === chapterNo) && check(n.mark, st.flags);
    const r = own || (visible && n.type === 'dir' && n.children.some(hasMark));
    marked.set(n, r);
    return r;
  };

  /** この場所が地図に出るか（名前か「？？？」で） */
  const shown = (n: VNode, parentPath: string) => {
    const visible = check(n.visibleIf, st.flags);
    const path = pathOf(n);
    const ancestorOfHome = n.type === 'dir' && onPathTo(n, home);
    const named = visible && (shell.isDiscovered(n) || path === cwd || path === home);
    const teaser = (!visible && !!n.teaser && check(n.teaser, st.flags)) || (visible && !named && ancestorOfHome);
    // 人やものは、いまいる場所の中身だけを出す（場所とリンクは、見つけていればいつも出す）
    const placeLike = n.type === 'dir' || n.type === 'link';
    return (named || teaser) && (placeLike || parentPath === cwd);
  };

  const walk = (n: VNode, depth: number) => {
    const visible = check(n.visibleIf, st.flags);
    const path = pathOf(n);
    const ancestorOfHome = n.type === 'dir' && onPathTo(n, home);
    const named = visible && (shell.isDiscovered(n) || path === cwd || path === home);
    const teaser = (!visible && !!n.teaser && check(n.teaser, st.flags)) || (visible && !named && ancestorOfHome);
    if (!named && !teaser) return;
    const canDescend = n.type === 'dir' && visible && (named || ancestorOfHome);
    const hasKids = canDescend && n.children.some((c) => shown(c, path));
    const open = !hasKids || isOpen(n);

    rows.push({
      path,
      depth,
      label: named ? (n.label ?? n.name) : null,
      sub:
        named && n.type === 'link'
          ? shell.isIdentified(n)
            ? `→ ${n.target}`
            : undefined
          : named && n.type === 'dir'
            ? path === home
              ? '~'
              : n.label
                ? path
                : undefined
            : undefined,
      icon: named ? shell.iconOf(n) : 'unknown',
      // 正体を見破るまでは、リンクも見た目どおりのものとして出す
      kind: n.type === 'link' && !shell.isIdentified(n) ? (shell.linkTarget(n)?.type === 'dir' || !shell.linkTarget(n) ? 'dir' : 'file') : n.type,
      current: path === cwd,
      visited: shell.isVisited(n),
      locked: shell.isDenied(n),
      warn: shell.isGarbled(n),
      // リンク切れは、止まったプロセスと同じく取り消し線で出す
      stopped: shell.isStopped(n) || (n.type === 'link' && shell.isIdentified(n) && !shell.linkTarget(n)),
      // 今いる場所とその上には付けない。ただし、中の「!」の物をまだ見渡していない（地図に出ていない）ときは付ける（ls すれば見える合図）。
      // 隠れた物（. で始まる）は、物語で気づかせるので数えない
      mark:
        named &&
        hasMark(n) &&
        !(
          n.type === 'dir' &&
          onPathTo(n, cwd) &&
          !n.children.some((c) => !c.name.startsWith('.') && hasMark(c) && !shown(c, path))
        ),
      insert: named ? insertFor(n, st.cwd, scn.home, st.learned.includes('cd ~')) : null,
      // 世界（/）はたたまない
      fold: hasKids && path !== '/' ? (open ? 'open' : 'closed') : null,
    });

    if (!canDescend || !open) return;
    for (const c of n.children) if (shown(c, path)) walk(c, depth + 1);
  };

  walk(scn.root, 0);
  return rows;
}

/**
 * 地図をクリックしたときに入力するコマンド。できるだけ短い相対パスにして、パスの書き方を覚えやすくする。
 * ~ を教わるまでは、村の中の場所は .. と名前だけで書く
 */
function insertFor(n: VNode, cwd: string[], home: string[], tilde: boolean): string {
  const parts = partsOf(n);
  if (n.type === 'link') return `cd ${relPath(parts, cwd, home, tilde)}`;
  if (n.type !== 'dir') {
    const parent = parts.slice(0, -1);
    return `cat ${samePath(parent, cwd) ? n.name : relPath(parts, cwd, home, tilde)}`;
  }
  if (samePath(parts, cwd)) return 'ls';
  return `cd ${relPath(parts, cwd, home, tilde)}`;
}

function relPath(parts: string[], cwd: string[], home: string[], tilde: boolean): string {
  if (samePath(parts, cwd.slice(0, -1))) return '..';
  if (samePath(parts.slice(0, -1), cwd)) return parts[parts.length - 1];
  const inHome = (p: string[]) => samePath(p.slice(0, home.length), home);
  if (!tilde && inHome(parts) && inHome(cwd)) {
    let i = 0;
    while (i < parts.length && i < cwd.length && parts[i] === cwd[i]) i++;
    return [...Array<string>(cwd.length - i).fill('..'), ...parts.slice(i)].join('/');
  }
  if (samePath(parts, home)) return '~';
  if (samePath(parts.slice(0, home.length), home)) return `~/${parts.slice(home.length).join('/')}`;
  return joinPath(parts);
}

function samePath(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}
