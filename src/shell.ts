// 自作シェル。入力行を解釈してコマンドを実行し、仮想ファイルシステムとフラグを操作する。
import { shelved, shownDoc, type AllowRule, type Chapter, type Companion, type Proc, type Scenario } from './scenario';
import { textVars, type FsOp, type GameState } from './state';
import { codeSegs, distance, fill, garble, msgText, normalizeInput, padEnd, parseMsg, width, type Line, type Msg, type Seg } from './text';
import {
  can,
  check,
  displayPath,
  bgmOf,
  drainedAt,
  staticAt,
  bellAt,
  isRoot,
  setRootMode,
  groupOf,
  nodeAt,
  setPlayerGroups,
  joinPath,
  partsOf,
  PLAYER,
  findChild,
  buildTree,
  resolve,
  splitPath,
  themeOf,
  visibleChildren,
  type Demo,
  type DirNode,
  type FileNode,
  type GuideStep,
  type LinkNode,
  type ProcNode,
  type ResolveError,
  type StoryPerms,
  type TimeLimit,
  type Trigger,
  type Variant,
  type VNode,
} from './vfs';

export interface ReadOpts {
  history?: string[];
  complete?: (value: string) => Completion;
  suggest?: (value: string) => Suggestion[];
}

export interface Completion {
  value: string;
  candidates?: string[];
}

/** 入力欄の上に出す候補 */
export interface Suggestion {
  label: string;
  desc?: string;
  /** 選んだときの入力欄の中身 */
  value: string;
  icon?: string;
}

/** 端末の抽象。ブラウザ実装は ui/terminal.ts、テストでは偽物を使う */
export interface Term {
  print(line?: Line, cls?: string): void;
  /** instant: 1文字ずつではなく、一気に表示する（読み直しのとき） */
  say(msgs: Msg[], instant?: boolean): Promise<void>;
  /** 入力の途中でも割りこんで、せりふを一気に出す（待たない）。ない画面では say を一気に出す */
  aside?(msgs: Msg[]): void;
  clear(): void;
  effect(name: string): Promise<void>;
  readLine(prompt: Seg[], opts?: ReadOpts): Promise<string>;
  /** 画面の一部を照らして説明する。できない画面（テストなど）では、説明をシステム表示の行として出す */
  guide?(steps: GuideStep[]): Promise<void>;
  /**
   * だれかが入力欄にゆっくりコマンドを打ってみせ、Enter を押したように表示する（実行はしない）。
   * できない画面（テストなど）では、打った行だけを出す
   */
  demo?(prompt: Seg[], text: string, opts: DemoOpts): Promise<void>;
}

export interface DemoOpts {
  /** 打つ人の名前 */
  by?: string;
  /** ここまで打ったところで止まって onPause を待つ */
  pauseAt?: string;
  onPause?: () => Promise<void>;
  /** 止まったあと、Tab キーで残りを補ってみせる */
  tab?: boolean;
  suggest?: (value: string) => Suggestion[];
  complete?: (value: string) => Completion;
}

/** 画面のほかの部分（地図・目的・手帳）への通知 */
export interface Hooks {
  restart(): void;
  /** セーブしてタイトルにもどる */
  quit?(): void;
  /** 地図や目的を描き直す */
  update(): void;
  toast(text: string, kind?: string): void;
  /** ゲームオーバー（画面を見せて、やり直しの場所から始め直す） */
  gameOver?(): Promise<void> | void;
  /** ゲームオーバーになる行動をした瞬間（せりふより前）。ステージの曲を止める */
  gameOverStart?(): void;
}

type ArgKind = 'dir' | 'readable' | 'proc' | 'any' | 'none';

interface Command {
  run: (args: string[]) => Promise<void> | void;
  /** 入力候補に出す引数の種類 */
  arg?: ArgKind;
  hidden?: boolean;
}

/** きみのかばんの名前。ホーム（~）の中に作る */
const BAG = 'かばん';

const ERR_MSG: Record<ResolveError, string> = {
  ENOENT: 'そのようなファイルやディレクトリはありません',
  ENOTDIR: 'ディレクトリではありません',
  EACCES: 'Permission denied',
  ELOOP: 'リンクがぐるぐる指し合っていて、たどりつけません',
};

/** history に残す行の数（本物の bash も、ふつう 500〜1000 行）。kill の行は、古くなっても消さない（第8章で、自分の記録を読む） */
const HISTORY_MAX = 1000;
/** 「つづきから」で読み直す会話の行数 */
const RECAP_MAX = 12;

export class Shell {
  private readonly cmds: Record<string, Command>;

  constructor(
    private readonly scn: Scenario,
    private readonly st: GameState,
    private term: Term,
    private readonly hooks: Hooks,
  ) {
    this.cmds = {
      ls: { run: (a) => this.ls(a), arg: 'dir' },
      cd: { run: (a) => this.cd(a), arg: 'dir' },
      cat: { run: (a) => this.cat(a), arg: 'readable' },
      pwd: { run: () => this.pwd() },
      kill: { run: (a) => this.kill(a), arg: 'proc' },
      find: { run: (a) => this.find(a), arg: 'dir' },
      file: { run: (a) => this.file(a), arg: 'any' },
      ln: { run: (a) => this.ln(a), arg: 'dir' },
      unlink: { run: (a) => this.unlink(a), arg: 'any' },
      chmod: { run: (a) => this.chmod(a), arg: 'any' },
      mkdir: { run: (a) => this.mkdir(a), arg: 'dir' },
      mv: { run: (a) => this.mv(a), arg: 'any' },
      cp: { run: (a) => this.cp(a), arg: 'any' },
      tar: { run: (a) => this.tar(a), arg: 'any' },
      ps: { run: () => this.ps() },
      fg: { run: (a) => this.fg(a), arg: 'none' },
      bg: { run: (a) => this.bg(a), arg: 'none' },
      chgrp: { run: (a) => this.chgrp(a), arg: 'any' },
      groups: { run: () => this.term.print(this.groups().join(' ')) },
      write: { run: (a) => this.write(a) },
      date: { run: () => this.date() },
      echo: { run: () => this.echo() },
      crontab: { run: (a) => this.crontab(a), arg: 'readable' },
      grep: { run: (a) => this.grep(a), arg: 'readable' },
      diff: { run: (a) => this.diff(a), arg: 'readable' },
      hint: { run: () => this.hint() },
      help: { run: () => this.help() },
      history: { run: () => this.history() },
      clear: { run: () => this.term.clear() },
      restart: { run: () => this.restart() },
      whoami: { run: () => this.term.print(this.st.name), hidden: true },
      rm: { run: () => this.narrate('（その呪文は、この世界では封じられている。）'), hidden: true },
      sudo: { run: (a) => this.sudo(a), hidden: true },
      systemctl: { run: (a) => this.systemctl(a) },
      exit: { run: () => this.exit() },
    };
    // 作った・運んだ・写した物を先に戻す（リンクや鍵の記録は、運んだあとの道のりで残っているので）
    this.replayOps();
    this.restoreLinks();
    this.restoreTexts();
    this.restorePerms();
    setPlayerGroups(this.groups());
  }

  /** プレイヤーが入っている組。はじめは自分だけの組 */
  groups(): string[] {
    return (this.st.groups ??= [PLAYER]);
  }

  /** 持ち主や鍵のかけ方の変更を、セーブから世界に戻す */
  private restorePerms() {
    for (const [path, p] of Object.entries(this.st.perms ?? {})) {
      const n = nodeAt(this.scn.root, path);
      if (n) Object.assign(n, p);
    }
  }

  /** 持ち主や鍵のかけ方を変えて、セーブに残す */
  private setPerm(n: VNode, change: { owner?: string; mode?: string; group?: string }) {
    Object.assign(n, change);
    const path = pathOf(n);
    (this.st.perms ??= {})[path] = { ...this.st.perms[path], ...change };
  }

  /** echo > で書いた紙の中身を、セーブから世界に戻す。紙がなければ（echo > で作った紙）、新しく作る */
  private restoreTexts() {
    for (const [path, text] of Object.entries(this.st.texts ?? {})) {
      const n = nodeAt(this.scn.root, path);
      if (n?.type === 'file') {
        n.text = [...text];
        continue;
      }
      if (n) continue;
      const parts = splitPath(path);
      const dir = nodeAt(this.scn.root, joinPath(parts.slice(0, -1)));
      if (dir?.type === 'dir') this.makePaper(dir, parts[parts.length - 1], text);
    }
  }

  /** プレイヤーが ln -s で作ったリンクを、セーブから世界に戻す */
  private restoreLinks() {
    for (const l of this.st.links ?? []) {
      const r = resolve(this.scn.root, [], l.at, this.flags, this.scn.home);
      if (!r.ok || r.node.type !== 'dir') continue;
      if (r.node.children.some((c) => c.name === l.name)) continue;
      r.node.children.push({ type: 'link', name: l.name, target: l.target, mode: 'rwxrwxrwx', owner: PLAYER, parent: r.node });
    }
  }

  private get flags() {
    return this.st.flags;
  }

  prompt(): Seg[] {
    return [
      { t: `${this.st.name}@${this.scn.host}`, c: 'p-user' },
      { t: ':' },
      { t: displayPath(this.st.cwd, this.scn.home), c: 'p-path' },
      { t: '$ ' },
    ];
  }

  /** いま手帳に載っていて使えるコマンド */
  knownCommands(): string[] {
    // sudo は、スドウに資格をもらうまでは、手帳にも候補にも出さない（唱えると「資格がない」）
    return Object.keys(this.cmds).filter(
      (n) =>
        (!this.cmds[n].hidden || (n === 'sudo' && this.st.learned.includes(n))) &&
        this.isKnown(n) &&
        !shelved(this.scn.commands[n], this.flags),
    );
  }

  private isKnown(name: string): boolean {
    return !!this.scn.commands[name]?.system || this.st.learned.includes(name);
  }

  /** demo: だれかが打ってみせたコマンド（プレイヤーの履歴には残さない） */
  async exec(input: string, demo = false): Promise<void> {
    // 全角英数字・全角スペースでも通るようにする（シナリオ側の名前は NFKC で変わらない前提）
    const line = normalizeInput(input).trim();
    if (!line) return;
    if (!demo) {
      this.st.history.push(line);
      if (this.st.history.length > HISTORY_MAX) {
        const old = this.st.history.findIndex((h) => !/^kill\s/.test(h));
        this.st.history.splice(Math.max(0, old), 1);
      }
    }

    // 時間制限に間に合わなかった（打つ前に、もう時間が切れていた）
    if (this.st.timer && Date.now() >= this.st.timer.deadline) {
      await this.timeUp();
      return;
    }
    // パイプ（history | grep kill）: 左のコマンドが出した行を、右の grep に流しこむ
    const piped = splitPipe(line);
    let cmdLine = line;
    this.stdin = null;
    this.pipeFrom = null;
    if (piped.length > 2) {
      this.term.print('bash: この世界では、| はひとつだけ書ける');
      return;
    }
    if (piped.length === 2) {
      const [left, right] = piped;
      if (tokenize(right)[0] !== 'grep' || !this.isKnown('grep')) {
        this.term.print('bash: この世界では、| のうしろに書けるのは grep だけ（例: history | grep kill）');
        return;
      }
      const [lname, ...largs] = tokenize(left);
      const lcmd = this.cmds[lname];
      if (!lname || !lcmd) {
        this.notFound(lname ?? '');
        return;
      }
      if (!lcmd.hidden && !this.isKnown(lname)) {
        this.term.print(`${lname}: その言葉を、きみはまだ知らない`);
        return;
      }
      this.rawLine = left;
      this.stdin = await this.capture(() => lcmd.run(largs));
      this.pipeFrom = lname;
      cmdLine = right;
    }
    const [name, ...args] = tokenize(cmdLine);
    this.rawLine = cmdLine;
    const cmd = this.cmds[name];
    if (!cmd) {
      this.notFound(name);
      return;
    }
    if (!cmd.hidden && !this.isKnown(name)) {
      this.term.print(`${name}: その言葉を、きみはまだ知らない`);
      return;
    }
    this.lastWrote = null;
    await cmd.run(args);
    const here = joinPath(this.st.cwd);
    for (const ev of this.chapter().events) {
      if (ev.on !== name && ev.on !== '*') continue;
      if (ev.at && here !== ev.at) continue;
      if (ev.target && !this.argsHit(args, ev.target)) continue;
      if (ev.arg && !args.some((a) => a.replace(/\/+$/, '').split('/').pop() === ev.arg)) continue;
      if (ev.found && !this.lastFound.has(ev.found)) continue;
      if (ev.wrote && this.lastWrote !== this.absPath(ev.wrote)) continue;
      if (ev.from && this.pipeFrom !== ev.from) continue;
      if (ev.identified && !this.st.identified?.includes(this.absPath(ev.identified))) continue;
      await this.fire(ev);
    }
    await this.checkTimer();
  }

  /** コマンドに書いた名前のどれかが、target の物を指しているか */
  private argsHit(args: string[], target: string): boolean {
    const t = this.resolve(target);
    if (!t.ok) return false;
    return args.some((a) => {
      if (a.startsWith('-')) return false;
      const r = this.resolve(a);
      return r.ok && r.node === t.node;
    });
  }

  private notFound(name: string) {
    this.term.print(`${name}: command not found`);
    const known = this.knownCommands();
    // 「cd村はずれ」のようにスペースを忘れたとき
    const glued = known.find((k) => name.startsWith(k) && name.length > k.length);
    if (glued) {
      this.term.print([{ t: `ヒント: コマンドと名前のあいだにはスペースが必要だよ（${glued} ${name.slice(glued.length)}）`, c: 'hint' }]);
      return;
    }
    const sorted = (x: string) => [...x].sort().join('');
    const near = known.filter(
      (k) => distance(k, name) <= 1 || (k.length > 2 && distance(k, name) <= 2) || sorted(k) === sorted(name),
    );
    if (near.length) this.term.print([{ t: `もしかして: ${near.join(' / ')}`, c: 'hint' }]);
  }

  // ---- 入力候補・補完 ----

  suggest(value: string): Suggestion[] {
    // | のうしろは、そこから新しいコマンドとして候補を出す
    const bar = value.lastIndexOf('|');
    if (bar >= 0) {
      const rest = value.slice(bar + 1).replace(/^\s+/, '');
      const head = value.slice(0, value.length - rest.length);
      return this.suggest(rest).map((s) => ({ ...s, value: head + s.value }));
    }
    const m = normalizeInput(value).match(/^(\S*)(\s+)?(.*)$/)!;
    const [, name, space, rest] = m;
    if (name === 'sudo' && space && this.st.learned.includes('sudo')) {
      const head = value.slice(0, value.length - rest.length);
      return this.suggest(rest).map((s) => ({ ...s, value: head + s.value }));
    }
    if (!space) {
      if (!name) return [];
      return this.knownCommands()
        .filter((c) => c.startsWith(name) && (c !== name || this.flagForms(c).length > 0))
        .flatMap((c) => {
          // 唱え方ごと出すコマンド（tar）は、覚えた唱え方を並べる
          const forms = this.flagForms(c);
          if (forms.length) return forms.map((f) => ({ label: `${c} ${f.flag}`, desc: f.desc, value: `${c} ${f.flag} ` }));
          return [{ label: c, desc: this.doc(c)?.summary, value: `${c} ` }];
        });
    }
    const cmd = this.cmds[name];
    // echo は、> や >> のうしろにだけ、書く紙の名前を出す
    // grep は、探す言葉のうしろにだけ、紙の名前を出す
    const words = rest.split(/\s+/).slice(0, -1).filter((t) => t && !t.startsWith('-'));
    const arg: ArgKind | undefined =
      name === 'echo'
        ? /(^|\s)>>?\s*[^\s>]*$/.test(rest)
          ? 'readable'
          : 'none'
        : name === 'grep'
          ? words.length
            ? 'readable'
            : 'none'
          : cmd?.arg;
    if (!cmd || !arg || arg === 'none' || !this.isKnown(name)) return [];
    const word = rest.split(/\s+/).pop() ?? '';
    const head = value.slice(0, value.length - word.length);
    // 唱え方ごと出すコマンドで、まだ唱え方（-〇）を書いていなければ、先に唱え方を出す
    const forms = this.flagForms(name);
    if (forms.length && !rest.split(/\s+/).slice(0, -1).some((a) => a.startsWith('-')) && (word === '' || word.startsWith('-'))) {
      const hits = forms.filter((f) => f.flag.startsWith(word));
      if (hits.length) return hits.map((f) => ({ label: `${name} ${f.flag}`, desc: f.desc, value: `${head}${f.flag} ` }));
    }
    const slash = word.lastIndexOf('/');
    const dirPart = word.slice(0, slash + 1);
    const prefix = word.slice(slash + 1);
    const dir = this.lookup(dirPart || '.');
    if (!dir || dir.type !== 'dir' || !can(dir, 'r')) return [];

    const items: Suggestion[] = [];
    if (arg === 'dir' && !dirPart && '..'.startsWith(prefix) && dir.parent) {
      items.push({ label: '..', desc: 'ひとつ上へ戻る', value: `${head}..`, icon: 'up' });
    }
    if (name === 'cd' && !dirPart && '-'.startsWith(prefix) && this.st.prevCwd && this.st.learned.includes('cd -')) {
      items.push({ label: '-', desc: `さっきいた場所へ（${joinPath(this.st.prevCwd)}）`, value: `${head}-`, icon: 'up' });
    }

    for (const c of visibleChildren(dir, this.flags)) {
      // ls などで見つけていないものは、候補に出さない（地図に出ていないものの名前を明かさない）
      if (!this.isDiscovered(c)) continue;
      // 動いているもの（.モリビト）は、kill で書く名前（モリビト）でも探す
      if (!c.name.startsWith(prefix) && !(c.type === 'process' && c.pname.startsWith(prefix))) continue;
      const real = c.type === 'link' ? this.lookup(dirPart + c.name) : c;
      // 見破る前のリンク切れは、ls と同じく場所のふりをする（入れるかどうかは、行ってみないと分からない）
      const kind = real?.type ?? (this.isIdentified(c) ? 'file' : 'dir');
      const ok = arg === 'any' || (arg === 'dir' ? kind === 'dir' : arg === 'proc' ? kind === 'process' : kind !== 'dir');
      if (!ok) continue;
      const label = arg === 'proc' ? (c as ProcNode).pname : c.name;
      items.push({ label, value: head + dirPart + label + (c.type === 'dir' ? '/' : ''), icon: this.iconOf(c) });
    }
    // いまいる場所の物のあとに、どこからでも届くもの（ついてきている仲間・かばん）を出す
    if (arg === 'readable' && !dirPart && !PAPER_CMDS.includes(name)) {
      for (const c of this.party())
        if (c.node.name.startsWith(prefix))
          items.push({ label: c.node.name, desc: '仲間', value: head + c.node.name, icon: this.iconOf(c.node) });
    }
    // かばんは、仲間と同じく、どこにいても候補に出す。選ぶと住所（~/かばん/）が入る
    if (!dirPart && arg !== 'proc' && this.bag() && BAG.startsWith(prefix) && !findChild(dir, BAG, this.flags)) {
      items.push({ label: BAG, desc: `~/${BAG}`, value: `${head}~/${BAG}/`, icon: 'bag' });
    }
    return items;
  }

  complete(value: string): Completion {
    value = normalizeInput(value);
    const bar = value.lastIndexOf('|');
    if (bar >= 0) {
      const rest = value.slice(bar + 1).replace(/^\s+/, '');
      const head = value.slice(0, value.length - rest.length);
      const c = this.complete(rest);
      return { ...c, value: head + c.value };
    }
    const m = value.match(/^(.*?)(\S*)$/)!;
    const [, head, word] = m;
    if (!head.trim()) {
      return pick(head, '', word, this.knownCommands().map((c) => ({ name: c, dir: false })));
    }
    const slash = word.lastIndexOf('/');
    const dirPart = word.slice(0, slash + 1);
    const prefix = word.slice(slash + 1);
    const dir = this.lookup(dirPart || '.');
    if (!dir || dir.type !== 'dir' || !can(dir, 'r')) return { value };
    const entries = visibleChildren(dir, this.flags)
      .filter((c) => (!c.name.startsWith('.') || prefix.startsWith('.')) && this.isDiscovered(c))
      .map((c) => ({ name: c.name, dir: c.type === 'dir' }));
    return pick(head, dirPart, prefix, entries);
  }

  iconOf(n: VNode): string {
    if (n.type === 'link') {
      if (this.isIdentified(n)) return 'link';
      const real = this.linkTarget(n);
      return n.icon ?? (real && real.type !== 'link' ? this.iconOf(real) : 'house');
    }
    // 隠れている人（.コダマ）も、その人の立ち絵で出す
    const who = this.scn.characters[n.name.replace(/^\./, '')];
    if (n.type === 'file' && who) return `char:${who.sprite}`;
    if (n.icon) return n.icon;
    return n.type === 'dir' ? 'house' : n.type === 'process' ? 'proc' : 'item';
  }

  // ---- 地図のための情報 ----

  /**
   * リンク（飛び石）を通らないと入れない、遠くの場所（第2章の中州・葦の原・向こう岸）。
   * 入った場所のそばにあっても、地図に自動では載らず、ls にも出ない。find で見つけるか、飛び石で渡ると分かる
   */
  isFar(n: VNode): boolean {
    return n.type === 'dir' && !!n.needsLink;
  }

  /**
   * 見つけたか。ls・ls 場所・find で見たものと、通った・いた場所だけ。
   * 地図に載せるのも、入力候補・Tab・住所の案内に出すのも、見つけたものだけ（本物の Linux に地図はない。見渡すのは ls）
   */
  isDiscovered(n: VNode): boolean {
    return this.st.discovered.includes(pathOf(n));
  }

  isVisited(n: VNode): boolean {
    return this.st.visited.includes(pathOf(n));
  }

  isDenied(n: VNode): boolean {
    return this.st.denied.includes(pathOf(n));
  }

  /** 今この人・ものに cat すると文字化けするか */
  isGarbled(n: VNode): boolean {
    if (n.type === 'dir' || n.type === 'link') return false;
    return !!this.pickVariant(n.variants)?.garble;
  }

  /** 条件と場所（at）が合う、いちばん上の差し替え */
  private pickVariant(variants?: Variant[]): Variant | undefined {
    const here = joinPath(this.st.cwd);
    return variants?.find((v) => check(v.if, this.flags) && (!v.at || here === v.at || here.startsWith(v.at + '/')));
  }

  /** いま進めている章。startIf を満たす、いちばん後の章 */
  chapter(): Chapter {
    return [...this.scn.chapters].reverse().find((c) => check(c.startIf, this.flags)) ?? this.scn.chapters[0];
  }

  /** 旅についてきている仲間 */
  party(): Companion[] {
    return this.scn.companions.filter((c) => check(c.joinIf, this.flags));
  }

  isStopped(n: VNode): boolean {
    return n.type === 'process' && !!n.stoppedIf && check(n.stoppedIf, this.flags);
  }

  get state(): GameState {
    return this.st;
  }

  get scenario(): Scenario {
    return this.scn;
  }

  /** 今いる場所の枠のデザインと、枠に出す場所の名前・アイコン、世界から色が抜けているか */
  currentPlace(): {
    theme: string;
    label: string;
    icon: string;
    drained: boolean;
    glitchy: boolean;
    belling: boolean;
    bgm: string | null;
  } {
    const n = this.cwdNode();
    return {
      theme: themeOf(n, this.flags),
      label: n.label ?? n.name,
      icon: this.iconOf(n),
      drained: drainedAt(n, this.flags),
      glitchy: staticAt(n, this.flags),
      belling: bellAt(n, this.flags),
      bgm: bgmOf(n, this.flags),
    };
  }

  currentObjective(): string {
    return this.chapter().objectives.find((o) => check(o.if, this.flags))?.text ?? '';
  }

  // ---- コマンド ----

  private async ls(args: string[]) {
    const opts = new Set(args.filter((a) => a.startsWith('-')).flatMap((a) => [...a.slice(1)]));
    const targets = args.filter((a) => !a.startsWith('-'));
    if (!targets.length) targets.push('.');

    for (const target of targets) {
      const r = this.resolve(target);
      if (!r.ok) {
        this.term.print(`ls: '${target}' にアクセスできません: ${ERR_MSG[r.err]}`);
        if (r.err === 'ENOENT') await this.guideTo('ls', target);
        continue;
      }
      if (targets.length > 1) this.term.print(`${target}:`);
      if (r.node.type !== 'dir') {
        this.term.print(opts.has('l') ? this.longEntry(r.node, r.node.name) : [this.entrySeg(r.node, r.node.name)]);
        continue;
      }
      if (this.blockedByGate(r.node)) {
        await this.narrate(...r.node.gate!.lines);
        continue;
      }
      if (!can(r.node, 'r')) {
        this.term.print(`ls: ディレクトリ '${target}' を開けません: Permission denied`);
        continue;
      }
      // ls 場所 でのぞいた場所も、そこへの道のりごと地図に載せる（cd と同じく、村の外は物語で開けるまで伏せる）
      this.discoverPath(r.node);
      // 沼の向こうのような、まだ見つけていない「遠くの場所」は、見渡しても見えない
      const children = visibleChildren(r.node, this.flags).filter(
        (c) => (opts.has('a') || !c.name.startsWith('.')) && !(this.isFar(c) && !this.isDiscovered(c)),
      );
      this.discover(...children);
      const entries: [VNode, string][] = children.map((c) => [c, c.name]);
      if (opts.has('a')) entries.unshift([r.node, '.'], [r.node.parent ?? r.node, '..']);

      if (opts.has('l')) {
        const ownerW = Math.max(0, ...entries.map(([n]) => width(n.owner)));
        const groupW = Math.max(0, ...entries.map(([n]) => width(groupOf(n))));
        for (const [n, label] of entries) this.term.print(this.longEntry(n, label, ownerW, groupW));
      } else if (entries.length) {
        this.term.print(
          entries.flatMap(([n, label], i) => (i ? [{ t: '  ' }, this.entrySeg(n, label)] : [this.entrySeg(n, label)])),
        );
      } else {
        this.term.print([{ t: '（何も見当たらない）', c: 'narr' }]);
      }
    }
  }

  private entrySeg(n: VNode, label: string): Seg {
    if (n.type === 'dir') return { t: label === '.' || label === '..' ? label : `${label}/`, c: 'dir' };
    if (n.type === 'link') {
      if (this.isIdentified(n)) return { t: label, c: this.linkTarget(n) ? 'link' : 'link broken' };
      // 見破るまでは、指している先（リンク切れなら、ふつうの場所）のふりをする
      const real = this.linkTarget(n);
      if (!real || real.type === 'dir') return { t: `${label}/`, c: 'dir' };
      return this.entrySeg(real, label);
    }
    if (n.type === 'process') return { t: label, c: 'proc' };
    if (this.scn.characters[n.name.replace(/^\./, '')]) return { t: label, c: 'person' };
    return { t: label };
  }

  private longEntry(n: VNode, label: string, ownerW = width(n.owner), groupW = width(groupOf(n))): Seg[] {
    const typeChar = n.type === 'dir' ? 'd' : n.type === 'process' ? 'p' : n.type === 'link' ? 'l' : '-';
    const segs: Seg[] = [
      { t: `${typeChar}${n.mode}  ${padEnd(n.owner, ownerW)}  ${padEnd(groupOf(n), groupW)}  ` },
      this.entrySeg(n, label),
    ];
    if (n.type === 'link') {
      segs[1] = { t: label, c: this.linkTarget(n) ? 'link' : 'link broken' };
      segs.push({ t: ` -> ${n.target}`, c: 'link-target' });
      this.identify(n);
    }
    return segs;
  }

  /** リンクの正体を見破ったか。自分で作ったリンクは、はじめから分かっている */
  isIdentified(n: VNode): boolean {
    return n.type !== 'link' || n.owner === PLAYER || !!this.st.identified?.includes(pathOf(n));
  }

  private identify(n: VNode) {
    if (n.type !== 'link' || this.isIdentified(n)) return;
    (this.st.identified ??= []).push(pathOf(n));
  }

  /** リンクが指している先。リンク切れなら undefined */
  linkTarget(n: LinkNode): VNode | undefined {
    const r = resolve(this.scn.root, partsOf(n.parent!), n.target, this.flags, this.scn.home);
    return r.ok ? r.node : undefined;
  }

  private async cd(args: string[]) {
    let target = args[0] ?? '~';
    // 本物と同じく、cd だけならホームへ帰る。はじめてのときだけ、そう教える
    if (!args.length && !this.flags.cd_home_tip) {
      this.flags.cd_home_tip = true;
      this.term.print([{ t: 'ヒント: cd だけを打つと、ホーム（~）に帰ってくる', c: 'hint' }]);
    }
    // cd - は、ひとつ前にいた場所へ戻る。本物と同じく、戻った先を表示する
    const back = target === '-';
    if (back) {
      if (!this.st.prevCwd) {
        this.term.print('cd: 戻る場所が、まだない（ひとつ前にいた場所がない）');
        return;
      }
      target = joinPath(this.st.prevCwd);
    }
    const r = this.resolve(target);
    if (!r.ok) {
      this.term.print(`cd: ${target}: ${ERR_MSG[r.err]}`);
      // リンク切れの道しるべに入ろうとしたときは、その場所の反応を出す（住所の案内はしない。道しるべはそこにあるので）
      const l = this.resolve(target, false);
      if (l.ok && l.node.type === 'link' && !this.linkTarget(l.node)) {
        if (l.node.onBroken) await this.fire(l.node.onBroken);
        return;
      }
      if (r.err === 'ENOENT' && !back) await this.guideTo('cd', target);
      return;
    }
    if (r.node.type !== 'dir') {
      this.term.print(`cd: ${target}: ${ERR_MSG.ENOTDIR}`);
      return;
    }
    if (this.blockedByGate(r.node)) {
      await this.narrate(...r.node.gate!.lines);
      return;
    }
    if (r.node.needsLink && !r.via) {
      await this.narrate(...r.node.needsLink);
      return;
    }
    if (!can(r.node, 'x')) {
      this.term.print(`cd: ${target}: Permission denied`);
      const p = pathOf(r.node);
      if (!this.st.denied.includes(p)) this.st.denied.push(p);
      this.hooks.update();
      await this.term.effect('shake');
      if (r.node.deniedLines) await this.narrate(...r.node.deniedLines);
      return;
    }
    if (back) this.term.print([{ t: target, c: 'dir' }]);
    // リンクをたどったときは、つないだ先の本当の場所にいることにする（本物の cd -P と同じ）
    const dest = partsOf(r.node);
    // いままでいた場所も、地図に残す（ls しないまま離れても、いたことは分かっている）
    const left = this.lookup('.');
    if (left) this.discoverPath(left);
    if (joinPath(dest) !== joinPath(this.st.cwd)) this.st.prevCwd = this.st.cwd;
    this.st.cwd = dest;
    this.discoverPath(r.node);
    // 入った場所の中にある物は、ls（や find）で見るまで地図に載せない（本物の Linux にも地図はない。見渡すのは ls）
    const here = pathOf(r.node);
    if (!this.st.visited.includes(here)) this.st.visited.push(here);
    this.hooks.update();
    for (const t of r.node.onEnter ?? []) await this.fire(t);
  }

  /** pwd: 住所を出し、地図の名前でも読み下す。はじめてのときだけ、住所の読み方を教える */
  private async pwd() {
    this.term.print(joinPath(this.st.cwd));
    // 地図の名前で読み下す。地図でまだ「？？？」の場所（村の門が開くまでの世界・居住区）は、ここでも「？？？」
    const home = joinPath(this.scn.home);
    const nameOf = (n: VNode) => {
      const p = pathOf(n);
      const known = this.isDiscovered(n) || p === home || p === joinPath(this.st.cwd);
      return known ? n.label ?? (n.name || '世界') : '？？？';
    };
    let n: VNode = this.scn.root;
    const names = [nameOf(n)];
    for (const name of this.st.cwd) {
      if (n.type !== 'dir') break;
      n = n.children.find((c) => c.name === name) ?? n;
      names.push(nameOf(n));
    }
    this.term.print([{ t: `（${names.join(' › ')}）`, c: 'hint' }]);
    if (this.flags.pwd_tip || !this.st.cwd.length) return;
    this.flags.pwd_tip = true;
    const outside = names[0] === '？？？';
    await this.showGuide([
      {
        at: 'output-prev',
        text: outside
          ? 'これが、いまいる場所の「住所」。`/` は「の中の」と読む。左へいくほど、外側の場所だ。'
          : 'これが、いまいる場所の「住所」。`/` は「の中の」と読む。いちばん左の `/` は、世界そのものだ。',
      },
      {
        at: 'output',
        text: outside
          ? `地図の名前で読むと、こう。${names.join('の中の、')}。……村の外のことは、まだ「？？？」。`
          : `地図の名前で読むと、こう。${names.join('の中の、')}。`,
      },
      { at: 'here', text: '左の地図では、ここ。一段右にずれるたびに、住所の `/` がひとつ増える。' },
    ]);
  }

  /** 画面を照らして説明する。照らせない画面（テストなど）では、システム表示の行として出す */
  private async showGuide(steps: GuideStep[]) {
    // 照らす前に、地図の「!」などを今の状態に描き直しておく
    this.hooks.update();
    const filled = steps.map((g) => ({ ...g, text: fill(g.text, textVars(this.st)) }));
    if (this.term.guide) await this.term.guide(filled);
    else await this.term.say(filled.flatMap((g) => [`[${g.text}]`, ...(g.note ? [`[${g.note}]`] : [])]).map(parseMsg));
  }

  /**
   * 名前だけで書いたものが、いまいる場所の中になかったとき。
   * 地図に載っている（見つけたことのある）ものなら、その住所と書き方を教える
   */
  private async guideTo(cmd: 'cd' | 'ls' | 'cat', target: string) {
    const name = target.replace(/\/+$/, '').split('/').pop();
    if (!name || ['.', '..', '~'].includes(name)) return;
    const home = joinPath(this.scn.home);
    const hits: VNode[] = [];
    const walk = (n: VNode) => {
      if (!check(n.visibleIf, this.flags)) return;
      // リンク切れには行けないので、行き方を教えない
      const fits =
        cmd === 'cd' ? n.type === 'dir' || (n.type === 'link' && !!this.linkTarget(n)) : cmd === 'cat' ? n.type !== 'dir' : true;
      if (n.name === name && fits && (this.isDiscovered(n) || pathOf(n) === home)) hits.push(n);
      if (n.type === 'dir') n.children.forEach(walk);
    };
    walk(this.scn.root);
    if (!hits.length || hits.length > 3) return;
    const here = this.lookup('.');
    const hereName = here ? (here.label ?? here.name) || '世界' : 'ここ';
    const verb = { cd: '行ける', ls: 'のぞける', cat: '届く' }[cmd];
    const lines = [
      target.includes('/')
        ? `[その道のりの先に、${name} はない。]`
        : `[${name} は、ここ（${hereName}）の中にはない。名前だけで届くのは、いまいる場所の中にあるもの（\`ls\` で見えるもの）だけだ。]`,
    ];
    // ~ を教わるまでは、村の中の場所は .. と名前だけの道のりで教える（はじめは .. で歩く）
    const tilde = this.st.learned.includes('cd ~');
    for (const h of hits) {
      const abs = pathOf(h);
      if (!tilde && (abs === home || abs.startsWith(home + '/'))) {
        const rel = relPath(this.st.cwd, partsOf(h));
        lines.push(rel === '.' ? `[いまいる場所が、${name} だ。]` : `[ここからなら \`${cmd} ${rel}\`（${readRel(rel)}）で${verb}。]`);
        continue;
      }
      const addr = abs === home ? '~' : abs.startsWith(home + '/') ? '~' + abs.slice(home.length) : abs;
      const full = addr === abs ? '' : `（世界から書くと \`${abs}\`）`;
      lines.push(`[${name} の住所は \`${addr}\`${full}。\`${cmd} ${addr}\` と書けば、どこからでも${verb}。]`);
    }
    await this.narrate(...lines);
  }

  private async cat(args: string[]) {
    if (!args.length) {
      this.term.print('cat: 何を読むか指定してね（例: cat 掲示板）');
      return;
    }
    for (const target of args) {
      // 自分の名前は、自分自身（だれかに cat されたときは、話しかけられる）
      if (target === this.st.name && this.scn.self && !this.resolve(target).ok) {
        await this.readNode(this.scn.self);
        continue;
      }
      // 仲間は、どこにいても話せる
      const buddy = this.party().find((c) => c.node.name === target);
      if (buddy) {
        await this.readNode(buddy.node);
        continue;
      }
      const r = this.resolve(target);
      if (!r.ok) {
        this.term.print(`cat: ${target}: ${ERR_MSG[r.err]}`);
        if (r.err === 'ENOENT') await this.guideTo('cat', target);
        continue;
      }
      if (r.node.type === 'dir') {
        this.term.print(`cat: ${target}: ディレクトリです（入るなら cd ${target}）`);
        continue;
      }
      if (r.node.type === 'link') continue;
      if (!can(r.node, 'r')) {
        this.term.print(`cat: ${target}: Permission denied`);
        continue;
      }
      await this.readNode(r.node);
    }
  }

  private async readNode(node: FileNode | ProcNode) {
    // 紙に書かれた字は、せりふではなく、字のまま出す
    if (node.type === 'file' && node.text) {
      if (node.text.length) for (const t of node.text) this.term.print(t, 'paper');
      else this.term.print([{ t: '（何も書かれていない）', c: 'narr' }]);
    }
    const v = this.pickVariant(node.variants);
    const lines = v?.lines ?? node.lines;
    const msgs = this.toMsgs(lines);
    await this.term.say(v?.garble ? msgs.map(garbleMsg) : msgs);
    const sets = (v ? v.set : node.set) ?? [];
    const learns = (v ? v.learn : node.learn) ?? [];
    // 物語が進んだ会話だけを覚えておく（寄り道の雑談や、2回目以降の同じ会話では上書きしない）
    const progressed = sets.some((f) => !this.flags[f]) || learns.some((c) => !this.st.learned.includes(c));
    for (const f of sets) this.flags[f] = true;
    for (const p of v?.reveal ?? []) if (!this.st.discovered.includes(p)) this.st.discovered.push(p);
    if (node.type === 'file') this.applyStoryPerms(v ?? node);
    if (v?.effect) await this.term.effect(v.effect);
    if (v?.guide) await this.showGuide(v.guide);
    this.learn(...learns);
    this.hooks.update();
    if (v?.after) await this.term.say(this.toMsgs(v.after));
    if (progressed && !v?.garble) this.remember([...lines, ...(v?.after ?? [])]);
    if (v?.demo) await this.runDemo(v.demo);
  }

  /** だれかが、ゆっくりコマンドを打って実行してみせる（兄の手本など） */
  private async runDemo(demo: Demo) {
    for (const step of demo.steps) {
      if (step.say) await this.term.say(this.toMsgs(step.say));
      if (step.intro) await this.showGuide(step.intro);
      const typed = fill(step.type, textVars(this.st));
      const prompt: Seg[] = [{ t: `${demo.by}@${this.scn.host}`, c: 'p-demo' }, ...this.prompt().slice(1)];
      const onPause = step.hold ? () => this.showGuide(step.hold!) : undefined;
      if (this.term.demo) {
        await this.term.demo(prompt, typed, {
          by: demo.by,
          pauseAt: step.pauseAt,
          onPause,
          tab: step.tab,
          suggest: (v) => this.suggest(v),
          complete: (v) => this.complete(v),
        });
      } else {
        this.term.print([...prompt, { t: typed, c: 'typed' }], 'echo');
        await onPause?.();
      }
      await this.exec(typed, true);
      this.hooks.update();
      this.learn(...(step.learn ?? []));
      if (step.guide) await this.showGuide(step.guide);
      if (step.after) await this.term.say(this.toMsgs(step.after));
    }
  }

  /** file 名前: そのものの正体を調べる。リンクはたどらずに、何を指しているかを教える */
  private async file(args: string[]) {
    if (!args.length) {
      this.term.print('file: 何を調べるか指定してね（例: file カエル弟）');
      return;
    }
    for (const target of args) {
      const r = this.resolve(target, false);
      if (!r.ok) {
        this.term.print(`${target}: ${ERR_MSG[r.err]}`);
        continue;
      }
      const n = r.node;
      const desc =
        n.type === 'link'
          ? `${this.linkTarget(n) ? '' : 'broken '}symbolic link to ${n.target}` +
            (this.linkTarget(n) ? '（リンク）' : '（行き先が消えたリンク）')
          : n.type === 'dir'
            ? '場所（ディレクトリ）'
            : n.type === 'process'
              ? '動いているもの（プロセス）'
              : (n.fileDesc ??
                (n.archive || n.packed
                  ? 'gzip compressed data（ぎゅっと縛った包み）'
                  : this.scn.characters[n.name.replace(/^\./, '')]
                    ? '人（ふつうのファイル）'
                    : 'もの（ふつうのファイル）'));
      this.term.print([{ t: `${target}: ` }, { t: desc, c: n.type === 'link' ? 'link' : undefined }]);
      this.discover(n);
      this.identify(n);
      if (n.type === 'link' && n.onFile) await this.fire(n.onFile);
    }
    this.hooks.update();
  }

  /** ln -s 行き先 名前: 行き先を指すリンク（飛び石）を作る。書きこめる場所にだけ作れる */
  private async ln(args: string[]) {
    const rest = args.filter((a) => a !== '-s');
    if (!args.includes('-s')) {
      this.term.print('ln: この世界では、-s をつけて唱える（ln -s 行き先 名前）');
      return;
    }
    if (rest.length !== 2) {
      this.term.print('ln: 行き先と名前の2つが必要です（例: ln -s /lib/中州 飛び石）');
      return;
    }
    const [target, name] = rest;
    const slash = name.lastIndexOf('/');
    const where = slash >= 0 ? name.slice(0, slash) || '/' : '.';
    const base = name.slice(slash + 1);
    const r = this.resolve(where);
    if (!r.ok || r.node.type !== 'dir') {
      this.term.print(`ln: '${name}' を作れません: ${r.ok ? ERR_MSG.ENOTDIR : ERR_MSG[r.err]}`);
      return;
    }
    const dir = r.node;
    if (!base || base === '.' || base === '..') {
      this.term.print('ln: 作るリンクの名前を書いてね');
      return;
    }
    if (dir.children.some((c) => c.name === base && check(c.visibleIf, this.flags))) {
      this.term.print(`ln: '${name}' はもうある（切るなら unlink ${name}）`);
      return;
    }
    if (!can(dir, 'w')) {
      this.term.print(`ln: '${name}' を作れません: Permission denied`);
      await this.narrate('（Permission denied――「ここに石を置いてはならぬ」と、沼に言われた気がした。）');
      return;
    }
    if (!dir.linkable) {
      await this.narrate('（ここに飛び石を置く用事はない。）');
      return;
    }
    const link: LinkNode = { type: 'link', name: base, target, mode: 'rwxrwxrwx', owner: PLAYER, parent: dir };
    dir.children.push(link);
    (this.st.links ??= []).push({ at: pathOf(dir), name: base, target });
    this.discover(link);
    this.hooks.update();
    if (!this.linkTarget(link)) {
      await this.narrate('（……つないだ先が見つからない。このリンクは、どこにもつながっていないようだ。）');
    }
  }

  // ---- 場所を作る・物を運ぶ・写しをとる（第4章） ----

  /** 人（と動いているもの）は荷物ではない。運べないし、写せない */
  private isPerson(n: VNode): boolean {
    return n.type === 'process' || (n.type === 'file' && !!this.scn.characters[n.name.replace(/^\./, '')]);
  }

  /** その道のりの物があるか（イベントの exists / missing） */
  private existsAt(path: string): boolean {
    // リンクは、たどらずに、札そのものがあるかで見る（リンク切れの札も「ある」）
    return resolve(this.scn.root, [], path, this.flags, this.scn.home, false).ok;
  }

  /**
   * 物語で頼まれた mkdir・mv・cp か。頼まれていなければ、できない（オートセーブなので、取り消せないことはさせない）。
   * 名前は合っているのに場所がちがうときは、頼んだ人のせりふで正しい場所を教える
   */
  /** シナリオに書いた道のり（~ から書いてもよい）を、/ から書いた道のりにする */
  private absPath(p: string): string {
    const home = joinPath(this.scn.home);
    return p === '~' ? home : p.startsWith('~/') ? home + p.slice(1) : p;
  }

  private async allowed(
    cmd: 'mkdir' | 'mv' | 'cp' | 'tar' | 'echo',
    from: string | null,
    to: string,
    name: string,
    quiet = false,
  ): Promise<boolean> {
    const home = joinPath(this.scn.home);
    const abs = (p: string) => (p === '~' ? home : p.startsWith('~/') ? home + p.slice(1) : p);
    const base = (p: string) => p.slice(p.lastIndexOf('/') + 1);
    const rules = this.chapter().allow.filter((r) => r.cmd === cmd && check(r.if, this.flags));
    const sameThing = (r: AllowRule) =>
      cmd === 'mkdir' || cmd === 'echo' ? base(abs(r.to)) === base(to) : abs(r.from ?? '') === from;
    if (rules.some((r) => sameThing(r) && abs(r.to) === to)) return true;
    if (quiet) return false;
    const near = rules.find((r) => sameThing(r) && r.wrong);
    if (near) await this.narrate(...near.wrong!);
    else
      await this.narrate(
        cmd === 'mkdir'
          ? '（いまは、新しい場所を作る用事はない。）'
          : cmd === 'mv'
            ? `（いまは、${name} を動かす用事はない。）`
            : cmd === 'tar'
              ? `（いまは、${name} をまとめる用事はない。）`
              : cmd === 'echo'
                ? `（いまは、${name} に書きつける用事はない。）`
                : `（いまは、${name} の写しをとる用事はない。）`,
      );
    return false;
  }

  /** 「場所/名前」を、入れ物の場所と名前に分ける。入れ物がなければエラーの文を返す */
  private splitTarget(path: string): { dir: DirNode; base: string } | { err: string } {
    const trimmed = path.length > 1 ? path.replace(/\/+$/, '') : path;
    const slash = trimmed.lastIndexOf('/');
    const where = slash >= 0 ? trimmed.slice(0, slash) || '/' : '.';
    const base = trimmed.slice(slash + 1);
    if (!base || base === '.' || base === '..' || base === '~') return { err: '名前を書いてね' };
    const r = this.resolve(where);
    if (!r.ok) return { err: ERR_MSG[r.err] };
    if (r.node.type !== 'dir') return { err: ERR_MSG.ENOTDIR };
    return { dir: r.node, base };
  }

  /** 行き先: 場所を書いたらその中へ（名前はそのまま）、まだない名前を書いたら、その名前で */
  private destOf(dst: string, name: string): { dir: DirNode; base: string } | { err: string } {
    const d = this.resolve(dst);
    if (d.ok && d.node.type === 'dir') return { dir: d.node, base: name };
    if (d.ok) return { err: 'もうある' };
    return this.splitTarget(dst);
  }

  private nameTaken(dir: DirNode, name: string, self?: VNode): boolean {
    return dir.children.some((c) => c !== self && c.name === name && check(c.visibleIf, this.flags));
  }

  private makeDir(dir: DirNode, name: string): DirNode {
    const node: DirNode = {
      type: 'dir',
      name,
      icon: this.scn.madeIcons[name],
      mode: 'rwxr-xr-x',
      owner: PLAYER,
      movable: true,
      children: [],
      parent: dir,
    };
    dir.children.push(node);
    return node;
  }

  private moveNode(n: VNode, dir: DirNode, name: string) {
    n.parent!.children = n.parent!.children.filter((c) => c !== n);
    n.parent = dir;
    if (n.name !== name) {
      n.name = name;
      n.label = undefined; // 札を掛けかえたら、地図にも新しい名前で出す
    }
    dir.children.push(n);
  }

  /** 写しを作る。中身（せりふ）だけを写し、フラグ・手帳・「!」などの物語の仕掛けは写さない */
  private cloneNode(n: VNode, parent: DirNode, name: string): VNode {
    const base = { name, icon: n.icon, owner: PLAYER, movable: true, parent };
    if (n.type === 'dir') {
      const d: DirNode = { ...base, type: 'dir', mode: 'rwxr-xr-x', children: [] };
      d.children = visibleChildren(n, this.flags)
        .filter((c) => !this.isPerson(c))
        .map((c) => this.cloneNode(c, d, c.name));
      return d;
    }
    if (n.type === 'link') return { ...base, type: 'link', mode: 'rwxrwxrwx', target: n.target };
    const f = n as FileNode;
    return {
      ...base,
      type: 'file',
      mode: 'rw-r--r--',
      lines: [...f.lines],
      text: f.text && [...f.text],
      variants: f.variants?.map((v) => ({ if: v.if, at: v.at, lines: v.lines, garble: v.garble })),
      // 包みは、包みのまま写す（中身もいっしょに）
      archive: f.archive,
      packed: f.packed,
    };
  }

  /** 運んだら、地図やセーブに残っている道のりも新しい道のりに書きかえる */
  private renamePaths(from: string, to: string) {
    const fix = (p: string) => (p === from ? to : p.startsWith(from + '/') ? to + p.slice(from.length) : p);
    const st = this.st;
    st.discovered = st.discovered.map(fix);
    st.visited = st.visited.map(fix);
    st.denied = st.denied.map(fix);
    if (st.identified) st.identified = st.identified.map(fix);
    if (st.texts) st.texts = Object.fromEntries(Object.entries(st.texts).map(([k, v]) => [fix(k), v]));
    if (st.perms) st.perms = Object.fromEntries(Object.entries(st.perms).map(([k, v]) => [fix(k), v]));
    for (const l of st.links ?? []) l.at = fix(l.at);
    if (st.prevCwd) st.prevCwd = splitPath(fix(joinPath(st.prevCwd)));
  }

  /** セーブに残っている mkdir・mv・cp を、同じ順でやり直す */
  private replayOps() {
    const root = this.scn.root;
    const split = (p: string) => {
      const parts = splitPath(p);
      return { where: joinPath(parts.slice(0, -1)), base: parts[parts.length - 1] };
    };
    for (const o of this.st.ops ?? []) {
      if (o.op === 'unlink') {
        const l = nodeAt(root, o.path);
        if (l?.type === 'link' && l.parent) l.parent.children = l.parent.children.filter((c) => c !== l);
        continue;
      }
      if (o.op === 'untar') {
        const a = nodeAt(root, o.path);
        const d = nodeAt(root, o.to);
        if (a && d?.type === 'dir' && this.isArchive(a)) this.extractInto(a, d);
        continue;
      }
      const { where, base } = split(o.op === 'mkdir' ? o.path : o.to);
      const dir = nodeAt(root, where);
      if (dir?.type !== 'dir' || dir.children.some((c) => c.name === base)) continue;
      if (o.op === 'mkdir') this.makeDir(dir, base);
      else if (o.op === 'tar') {
        const src = nodeAt(root, o.from);
        if (src) this.makeArchive(src, dir, base);
      } else {
        const n = nodeAt(root, o.from);
        if (!n) continue;
        if (o.op === 'mv') this.moveNode(n, dir, base);
        else dir.children.push(this.cloneNode(n, dir, base));
      }
    }
  }

  private record(op: FsOp) {
    (this.st.ops ??= []).push(op);
  }

  /** mkdir 名前: 書きこめる場所の中に、新しい場所を作る */
  private async mkdir(args: string[]) {
    const names = args.filter((a) => !a.startsWith('-'));
    if (!names.length) {
      this.term.print('mkdir: 作る場所の名前を書いてね（例: mkdir 舞台）');
      return;
    }
    for (const name of names) {
      const t = this.splitTarget(name);
      if ('err' in t) {
        this.term.print(`mkdir: '${name}' を作れません: ${t.err}`);
        continue;
      }
      if (this.nameTaken(t.dir, t.base)) {
        this.term.print(`mkdir: '${name}' はもうある`);
        continue;
      }
      if (!(await this.allowed('mkdir', null, childPath(t.dir, t.base), t.base))) continue;
      if (!can(t.dir, 'w')) {
        this.term.print(`mkdir: '${name}' を作れません: Permission denied`);
        await this.narrate('（ここに場所を作る許しは、きみにはない。）');
        continue;
      }
      const node = this.makeDir(t.dir, t.base);
      this.record({ op: 'mkdir', path: pathOf(node) });
      this.discover(node);
      this.hooks.update();
    }
  }

  /** mv 元 先: 物を運ぶ（先が場所ならその中へ）。まだない名前を書けば、名前を変える */
  private async mv(args: string[]) {
    const rest = args.filter((a) => !a.startsWith('-'));
    if (rest.length !== 2) {
      this.term.print('mv: 運ぶ物と行き先の2つが必要です（例: mv 木箱 ../果物屋/）');
      return;
    }
    const [src, dst] = rest;
    const r = this.resolve(src, false);
    if (!r.ok) {
      this.term.print(`mv: '${src}' を運べません: ${ERR_MSG[r.err]}`);
      return;
    }
    const n = r.node;
    if (this.isPerson(n) && !n.onMv) {
      await this.narrate(`（${n.name.replace(/^\./, '')}は、荷物じゃない。）`);
      return;
    }
    if (!n.parent) return;
    const from = pathOf(n);
    const here = joinPath(this.st.cwd);
    if (here === from || here.startsWith(from + '/')) {
      this.term.print(`mv: いまいる場所（${n.name}）は運べない。外に出てから運ぼう`);
      return;
    }
    const d = this.destOf(dst, n.name);
    if ('err' in d) {
      this.term.print(`mv: '${dst}' へ運べません: ${d.err}`);
      return;
    }
    const destPath = pathOf(d.dir);
    if (destPath === from || destPath.startsWith(from + '/')) {
      this.term.print(`mv: 場所を、その中へは運べない`);
      return;
    }
    if (this.nameTaken(d.dir, d.base, n)) {
      this.term.print(`mv: '${d.base}' はもうある`);
      return;
    }
    // 運ばれそうになった人が言い返す、大きすぎて入らない、など（onMv）。物語で頼まれた運び方なら、ふつうに運ぶ
    if (n.onMv && !(await this.allowed('mv', from, childPath(d.dir, d.base), n.name, true))) {
      await this.narrate(...n.onMv);
      return;
    }
    if (!(await this.allowed('mv', from, childPath(d.dir, d.base), n.name))) return;
    if (!n.movable) {
      await this.narrate(`（${n.name} は、ここから動かせない。）`);
      return;
    }
    if (!can(n.parent, 'w') || !can(d.dir, 'w')) {
      this.term.print(`mv: '${src}' を運べません: Permission denied`);
      return;
    }
    this.moveNode(n, d.dir, d.base);
    const to = pathOf(n);
    this.record({ op: 'mv', from, to });
    this.renamePaths(from, to);
    this.discover(n);
    this.hooks.update();
  }

  // ---- 包み（tar） ----

  /** 包み（.tar.gz）か */
  private isArchive(n: VNode): n is FileNode {
    return n.type === 'file' && (!!n.archive || !!n.packed);
  }

  /** tar -t で出す、包みの中の道のり（場所は / をつけて、その中身も） */
  private archiveEntries(a: FileNode): string[] {
    const out: string[] = [];
    const walkRaw = (r: any, pre: string) => {
      out.push(pre + r.name + (r.children ? '/' : ''));
      for (const c of r.children ?? []) walkRaw(c, `${pre}${r.name}/`);
    };
    const walkNode = (n: VNode, pre: string) => {
      out.push(pre + n.name + (n.type === 'dir' ? '/' : ''));
      if (n.type === 'dir') for (const c of n.children) walkNode(c, `${pre}${n.name}/`);
    };
    if (a.packed) a.packed.forEach((n) => walkNode(n, ''));
    else (a.archive ?? []).forEach((r) => walkRaw(r, ''));
    return out;
  }

  /** 包みをほどいて、dir の中に中身を出す。もうある名前の物は出さない。出した物を返す */
  private extractInto(a: FileNode, dir: DirNode): VNode[] {
    const made = a.packed
      ? a.packed.map((c) => this.cloneNode(c, dir, c.name))
      : (a.archive ?? []).map((raw) => buildTree(raw, dir));
    const fresh = made.filter((n) => !this.nameTaken(dir, n.name));
    dir.children.push(...fresh);
    return fresh;
  }

  /** src をまとめた包みを、dir の中に name で作る（中身は写し。物語の仕掛けは持たない） */
  private makeArchive(src: VNode, dir: DirNode, name: string): FileNode {
    const holder: DirNode = { type: 'dir', name: '', mode: 'rwxr-xr-x', owner: PLAYER, children: [], parent: null };
    const a: FileNode = {
      type: 'file',
      name,
      icon: 'package',
      mode: 'rw-r--r--',
      owner: PLAYER,
      movable: true,
      parent: dir,
      lines: ['（ぎゅっと縛った、小さな包みだ。`tar` でほどけば、中身が出てくる。）'],
      packed: [this.cloneNode(src, holder, src.name)],
    };
    dir.children.push(a);
    return a;
  }

  /**
   * tar: 包みの中をのぞく（-t）・ほどく（-x）・まとめる（-c）。-z は gzip（ぎゅっと縛る）、-f のうしろに包みの名前。
   * 本物と同じく、最初の言葉は - なしでもよい（tar xzf 包み）。ほどくのは、包みの置いてある場所で
   */
  private async tar(args: string[]) {
    let rest = [...args];
    let flags = '';
    if (rest[0] && /^[ctxzvf]+$/.test(rest[0])) flags += rest.shift();
    flags += rest
      .filter((a) => a.startsWith('-'))
      .map((a) => a.replace(/^-+/, ''))
      .join('');
    rest = rest.filter((a) => !a.startsWith('-'));
    const modes = [...new Set(flags.replace(/[^ctx]/g, ''))];
    if (modes.length !== 1) {
      this.term.print('tar: -t（中をのぞく）・-x（ほどく）・-c（まとめる）の、どれかひとつを書いてね（例: tar -tzf 包み.tar.gz）');
      return;
    }
    if (!flags.includes('f') || !rest.length) {
      this.term.print('tar: -f のうしろに、包みの名前を書いてね（例: tar -tzf 包み.tar.gz）');
      return;
    }
    if (modes[0] === 'c') {
      await this.tarCreate(rest[0], rest.slice(1));
      return;
    }
    const r = this.resolve(rest[0]);
    if (!r.ok) {
      this.term.print(`tar: ${rest[0]}: ${ERR_MSG[r.err]}`);
      return;
    }
    const a = r.node;
    if (!this.isArchive(a)) {
      this.term.print(`tar: ${rest[0]}: 包み（.tar.gz）ではありません`);
      return;
    }
    this.discover(a);
    if (modes[0] === 't') {
      for (const e of this.archiveEntries(a)) this.term.print(e);
      this.hooks.update();
      if (a.onList) await this.fire(a.onList);
      return;
    }
    // ほどく。本物では、いまいる場所に中身が出てくる。包みのそばでほどかないと、中の物が散らばってしまう
    const here = this.cwdNode();
    if (a.parent !== here) {
      await this.narrate('（包みは、置いてある場所でほどこう。ここでほどくと、中の物が、ここに散らばってしまう。）');
      return;
    }
    const made = this.extractInto(a, here);
    if (!made.length) {
      await this.narrate('（この包みは、もうほどいてある。）');
      return;
    }
    this.record({ op: 'untar', path: pathOf(a), to: pathOf(here) });
    this.discover(...made);
    this.hooks.update();
    if (a.onExtract) await this.fire(a.onExtract);
  }

  /** tar -czf 新しい包み まとめる物 */
  private async tarCreate(name: string, sources: string[]) {
    if (sources.length !== 1) {
      this.term.print('tar: 包みの名前のうしろに、まとめる物をひとつ書いてね（例: tar -czf 荷物.tar.gz 荷物）');
      return;
    }
    const r = this.resolve(sources[0]);
    if (!r.ok) {
      this.term.print(`tar: ${sources[0]}: ${ERR_MSG[r.err]}`);
      return;
    }
    const src = r.node;
    if (this.isPerson(src)) {
      await this.narrate('（人を包むなんて、できない。）');
      return;
    }
    const t = this.splitTarget(name);
    if ('err' in t) {
      this.term.print(`tar: ${name}: ${t.err}`);
      return;
    }
    // 包みの名前に .tar.gz を添え忘れたら、物語で教わった決まりを思い出させる（noExt）
    const rule = this.chapter().allow.find(
      (a) => a.cmd === 'tar' && check(a.if, this.flags) && this.absPath(a.from ?? '') === pathOf(src),
    );
    if (rule?.noExt && !t.base.endsWith('.tar.gz')) {
      await this.narrate(...rule.noExt);
      return;
    }
    if (this.nameTaken(t.dir, t.base)) {
      this.term.print(`tar: '${t.base}' はもうある`);
      return;
    }
    if (!(await this.allowed('tar', pathOf(src), childPath(t.dir, t.base), src.name))) return;
    const a = this.makeArchive(src, t.dir, t.base);
    this.record({ op: 'tar', from: pathOf(src), to: pathOf(a) });
    this.discover(a);
    this.hooks.update();
  }

  /** cp 元 先: 写しをとる（元は残る）。場所を写すには -r がいる */
  private async cp(args: string[]) {
    const recursive = args.some((a) => /^-[a-zA-Z]*[rR]/.test(a));
    const rest = args.filter((a) => !a.startsWith('-'));
    if (rest.length !== 2) {
      this.term.print('cp: 写す物と行き先の2つが必要です（例: cp 地図の巻物 ~/かばん/）');
      return;
    }
    const [src, dst] = rest;
    const r = this.resolve(src);
    if (!r.ok) {
      this.term.print(`cp: '${src}' を写せません: ${ERR_MSG[r.err]}`);
      return;
    }
    const n = r.node;
    if (this.isPerson(n)) {
      await this.narrate('（人の写しは、とれない。）');
      return;
    }
    if (n.type === 'dir' && !recursive) {
      this.term.print(`cp: -r がないので、場所 '${src}' は写せない（場所ごと写すなら cp -r ${src} ${dst}）`);
      return;
    }
    if (!can(n, 'r')) {
      this.term.print(`cp: '${src}' を写せません: Permission denied`);
      return;
    }
    const d = this.destOf(dst, n.name);
    if ('err' in d) {
      this.term.print(`cp: '${dst}' へ写せません: ${d.err}`);
      return;
    }
    const from = pathOf(n);
    const destPath = pathOf(d.dir);
    if (n.type === 'dir' && (destPath === from || destPath.startsWith(from + '/'))) {
      this.term.print('cp: 場所を、その中へは写せない');
      return;
    }
    if (this.nameTaken(d.dir, d.base)) {
      this.term.print(`cp: '${d.base}' はもうある`);
      return;
    }
    if (!(await this.allowed('cp', from, childPath(d.dir, d.base), n.name))) return;
    if (!can(d.dir, 'w')) {
      this.term.print(`cp: '${dst}' へ写せません: Permission denied`);
      return;
    }
    const copy = this.cloneNode(n, d.dir, d.base);
    d.dir.children.push(copy);
    this.record({ op: 'cp', from, to: pathOf(copy) });
    // 紙の写しは、写したときの字を残す（あとで元の紙を書き直しても、写しは変わらない）
    if (copy.type === 'file' && copy.text) (this.st.texts ??= {})[pathOf(copy)] = [...copy.text];
    // 写した場所と、その中の場所を地図に載せる
    const walk = (x: VNode) => {
      this.discover(x);
      if (x.type === 'dir') x.children.filter((c) => c.type === 'dir').forEach(walk);
    };
    walk(copy);
    this.hooks.update();
  }

  /** unlink 名前: リンクだけを切る（rm は封じられている） */
  private async unlink(args: string[]) {
    if (args.length !== 1) {
      this.term.print('unlink: 切るリンクの名前をひとつ書いてね（例: unlink 飛び石）');
      return;
    }
    const [name] = args;
    const r = this.resolve(name, false);
    if (!r.ok) {
      this.term.print(`unlink: '${name}': ${ERR_MSG[r.err]}`);
      return;
    }
    const n = r.node;
    if (n.type !== 'link') {
      this.term.print(`unlink: '${name}' はリンクではない（この世界で切れるのは、リンクだけ）`);
      return;
    }
    if (n.noUnlink) {
      await this.narrate(...n.noUnlink);
      return;
    }
    if (!can(n.parent!, 'w')) {
      this.term.print(`unlink: '${name}' を切れません: Permission denied`);
      return;
    }
    const at = pathOf(n.parent!);
    // シナリオの札を抜いたことも、セーブに残す（読みこみ直したときに、また抜く）
    if (n.owner !== PLAYER) this.record({ op: 'unlink', path: pathOf(n) });
    n.parent!.children = n.parent!.children.filter((c) => c !== n);
    this.st.links = (this.st.links ?? []).filter((l) => !(l.at === at && l.name === n.name));
    this.hooks.update();
  }

  /** chmod 記号 名前: 自分の物の鍵のかけ方を変える（u＝自分・g＝家族・o＝よその人・a＝みんな、+ 開ける・- 閉める・= そのとおりに） */
  private async chmod(args: string[]) {
    if (args.length < 2) {
      this.term.print('chmod: 鍵のかけ方と名前が必要です（例: chmod u+x 空き家）');
      return;
    }
    const [spec, ...targets] = args;
    const clauses = spec.split(',').map((c) => c.match(/^([ugoa]*)([+\-=])([rwx]*)$/));
    if (clauses.some((m) => !m)) {
      this.term.print(`chmod: '${spec}' という書き方は分かりません（例: u+x、g+r、o-w、a+rx）`);
      return;
    }
    for (const target of targets) {
      const r = this.resolve(target);
      if (!r.ok) {
        this.term.print(`chmod: '${target}': ${ERR_MSG[r.err]}`);
        continue;
      }
      const n = r.node;
      if (n.owner !== PLAYER && !isRoot()) {
        this.term.print(`chmod: '${target}' の鍵を変えられません: Operation not permitted`);
        await this.narrate(`（「おまえの家ではない」と、扉に言われた気がした。鍵を変えられるのは、持ち主の${n.owner}だけだ。）`);
        continue;
      }
      const bits = [...n.mode];
      for (const m of clauses) {
        const [, who, op, perms] = m!;
        const slots = (who || 'a').replace('a', 'ugo');
        for (const w of new Set(slots)) {
          const base = { u: 0, g: 3, o: 6 }[w as 'u' | 'g' | 'o'];
          ['r', 'w', 'x'].forEach((p, i) => {
            const has = perms.includes(p);
            if (op === '+' && has) bits[base + i] = p;
            if (op === '-' && has) bits[base + i] = '-';
            if (op === '=') bits[base + i] = has ? p : '-';
          });
        }
      }
      this.setPerm(n, { mode: bits.join('') });
      this.term.print([{ t: `（${n.name} の鍵のかけ方が変わった: ${n.type === 'dir' ? 'd' : '-'}${n.mode}）`, c: 'narr' }]);
      this.hooks.update();
      if (n.type === 'dir' || n.type === 'file') {
        const t = n.onChmod?.find((o) => [...(o.can ?? '')].every((p) => can(n, p as 'r' | 'w' | 'x')));
        if (t) await this.fire(t);
      }
    }
    this.hooks.update();
  }

  /** write 名前 ことば: 閉じた扉ごしに、その人へ声を届ける */
  private async write(args: string[]) {
    const [who, ...words] = args;
    if (!who || !words.length) {
      this.term.print('write: 相手の名前と、届けることばが必要です（例: write 薬屋のじいさん "開けてください"）');
      return;
    }
    // 見えている人のほか、目に見えずに裏で動いている者（坑道の者たち）にも、声は届く
    const rules = this.findPerson(this.scn.root, who)?.onWrite ?? this.liveProcs().find((p) => p.name === who)?.onWrite;
    if (!rules && !this.findPerson(this.scn.root, who) && !this.liveProcs().some((p) => p.name === who)) {
      this.term.print(`write: ${who} という人は、見当たらない`);
      return;
    }
    const message = words.join(' ');
    await this.narrate(`（${who}に、声を届けた。「${message}」）`);
    const rule = rules?.find((w) => check(w.if, this.flags) && (!w.has || w.has.some((h) => message.includes(h))));
    if (!rule) {
      await this.narrate('（……返事はない。）');
      return;
    }
    await this.fire(rule);
  }

  private findPerson(dir: DirNode, name: string): FileNode | undefined {
    for (const c of visibleChildren(dir, this.flags)) {
      if (c.type === 'file' && c.name === name && this.scn.characters[name]) return c;
      if (c.type === 'dir') {
        const hit = this.findPerson(c, name);
        if (hit) return hit;
      }
    }
    return undefined;
  }

  // ---- 紙に書く・時刻・予定表（第7章） ----

  /** いま打った行（正規化したもの）。echo は、" で囲んだかどうかを自分で読む */
  private rawLine = '';
  /** さっきの echo > で書いた紙の道のり（イベントの wrote に使う） */
  private lastWrote: string | null = null;

  /** date: 今の日時。章ごとの date から（止まった塔では、何度見ても同じ時刻） */
  private date() {
    const ch = [...this.scn.chapters].reverse().filter((c) => c.no <= this.chapter().no);
    const hit = ch.flatMap((c) => c.date).find((d) => check(d.if, this.flags));
    this.term.print(hit?.text ?? '（日時を教えてくれるものが、見当たらない）');
  }

  /** echo > で作る紙。持ち主はきみ */
  private makePaper(dir: DirNode, name: string, text: string[]): FileNode {
    const paper: FileNode = {
      type: 'file',
      name,
      icon: this.scn.madeIcons[name] ?? 'scroll',
      mode: 'rw-r--r--',
      owner: PLAYER,
      movable: true,
      parent: dir,
      lines: [],
      text: [...text],
    };
    dir.children.push(paper);
    return paper;
  }

  /**
   * echo ことば: 言ったことが、そのまま返ってくる（こだま）。
   * echo ことば > 紙 で紙を書き直し、>> 紙 で紙のいちばん下に書き足す。書けるのは、物語で頼まれた紙だけ
   */
  private async echo() {
    const p = parseEcho(this.rawLine.replace(/^\S+\s*/, ''));
    if ('err' in p) {
      this.term.print(`bash: ${p.err}`);
      return;
    }
    // 本物では、" で囲まない * は、まわりの物の名前に化けてしまう
    if (p.bareStar) {
      await this.narrate(
        '（`*` を `"` で囲まずに唱えると、本物では、`*` が、まわりの物の名前に化けてしまう。）',
        '[`*` を使うときは、ことばを `"` で囲もう（例: `echo "* * * * *"`）。]',
      );
      return;
    }
    const said = p.words.join(' ');
    if (!p.to) {
      this.term.print(said);
      return;
    }
    const r = this.resolve(p.to);
    let paper: FileNode;
    if (r.ok) {
      const n = r.node;
      if (n.type === 'dir') {
        this.term.print(`bash: ${p.to}: ディレクトリです`);
        return;
      }
      if (this.isPerson(n) || n.type !== 'file') {
        await this.narrate(`（${n.name.replace(/^\./, '')}に、字は書けない。）`);
        return;
      }
      if (!(await this.allowed('echo', null, pathOf(n), n.name))) return;
      if (!can(n, 'w')) {
        this.term.print(`bash: ${p.to}: Permission denied`);
        if (n.deniedLines) await this.narrate(...n.deniedLines);
        return;
      }
      paper = n;
      const old = n.text ?? [];
      n.text = p.op === '>>' ? [...old, said] : [said];
    } else {
      const t = this.splitTarget(p.to);
      if ('err' in t) {
        this.term.print(`bash: ${p.to}: ${t.err}`);
        return;
      }
      if (!(await this.allowed('echo', null, childPath(t.dir, t.base), t.base))) return;
      if (!can(t.dir, 'w')) {
        this.term.print(`bash: ${p.to}: Permission denied`);
        return;
      }
      paper = this.makePaper(t.dir, t.base, [said]);
    }
    const path = pathOf(paper);
    (this.st.texts ??= {})[path] = [...paper.text!];
    this.lastWrote = path;
    this.discover(paper);
    this.hooks.update();
  }

  /**
   * crontab 紙: 紙に書いた予定表を、塔に渡す（塔は、そのとおりに毎日の仕事を回す）。crontab -l で、渡した予定を見る。
   * 行の形がおかしいと、本物と同じく受け取らない
   */
  private async crontab(args: string[]) {
    if (args.includes('-l')) {
      if (!this.st.crontab?.length) this.term.print('crontab: まだ、予定表を渡していない（no crontab）');
      else for (const l of this.st.crontab) this.term.print(l, 'paper');
      return;
    }
    const target = args.find((a) => !a.startsWith('-'));
    if (!target) {
      this.term.print('crontab: 渡す予定表（紙）の名前を書いてね（例: crontab 予定表）。渡した予定を見るなら crontab -l');
      return;
    }
    const r = this.resolve(target);
    if (!r.ok) {
      this.term.print(`crontab: ${target}: ${ERR_MSG[r.err]}`);
      return;
    }
    const n = r.node;
    if (n.type !== 'file' || !n.text || this.isPerson(n)) {
      this.term.print(`crontab: ${target}: 予定表として読めない（字の書かれた紙を渡そう）`);
      return;
    }
    if (!can(n, 'r')) {
      this.term.print(`crontab: ${target}: Permission denied`);
      return;
    }
    const entries: { time: string; task: string }[] = [];
    for (const [i, line] of n.text.entries()) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const e = parseCronLine(t);
      if ('err' in e) {
        this.term.print(`crontab: ${target} の ${i + 1}行目「${t}」: ${e.err}`);
        this.term.print('crontab: 予定表に、まちがいがある。塔には渡せなかった（errors in crontab file, can\'t install）');
        // 直し方を教えてもらう（章の cron.onError）
        const help = this.chapter().cron?.onError?.find((o) => check(o.if, this.flags) && !(o.once && this.flags[o.once]));
        if (help) await this.fire(help);
        return;
      }
      entries.push(e);
    }
    this.st.crontab = [...n.text];
    this.term.print([{ t: '（予定表を、塔に渡した。）', c: 'narr' }]);
    const spec = this.chapter().cron;
    if (!spec) return;
    for (const j of spec.jobs) {
      const mine = entries.filter((e) => e.task.includes(j.key));
      this.flags[`${j.flag}_written`] = mine.length > 0;
      const fits = (e: { time: string }) => j.at.some((a) => a.trim().split(/\s+/).join(' ') === e.time);
      this.flags[j.flag] = mine.length > 0 && (j.all ? mine.every(fits) : mine.some(fits));
    }
    this.hooks.update();
    const t = spec.onInstall.find((o) => check(o.if, this.flags) && !(o.once && this.flags[o.once]));
    if (t) await this.fire(t);
  }

  // ---- 記録を探す・見比べる（第8章） ----

  /** パイプで流しこまれた行（history | grep の、history が出した行）。なければ null */
  private stdin: string[] | null = null;
  /** パイプの左のコマンドの名前（イベントの from に使う） */
  private pipeFrom: string | null = null;

  /** コマンドが画面に出すはずの行を、出さずに集める（パイプの左） */
  private async capture(run: () => Promise<void> | void): Promise<string[]> {
    const out: string[] = [];
    const real = this.term;
    this.term = {
      print: (l: Line = '') => void out.push(typeof l === 'string' ? l : l.map((s) => s.t).join('')),
      say: async (msgs: Msg[]) => {
        for (const m of msgs) if (m.kind !== 'fx') out.push(msgText(m));
      },
      clear: () => {},
      effect: async () => {},
      readLine: async () => '',
    };
    try {
      await run();
    } finally {
      this.term = real;
    }
    return out.flatMap((l) => l.split('\n'));
  }

  /** 紙の名前の * を、いまの場所の名前に広げる（*.log → .log で終わる紙ぜんぶ）。合う物がなければ、そのまま */
  private expandGlob(arg: string): string[] {
    if (!arg.includes('*')) return [arg];
    const slash = arg.lastIndexOf('/');
    const dirPart = arg.slice(0, slash + 1);
    const base = arg.slice(slash + 1);
    const dir = this.lookup(dirPart || '.');
    if (!dir || dir.type !== 'dir' || !can(dir, 'r')) return [arg];
    const re = globToRegExp(base);
    const names = visibleChildren(dir, this.flags)
      .map((c) => c.name)
      .filter((n) => re.test(n) && (!n.startsWith('.') || base.startsWith('.')))
      .sort((a, b) => a.localeCompare(b, 'ja'));
    return names.length ? names.map((n) => dirPart + n) : [arg];
  }

  /** grep・diff で読む紙の字。読めなければ、わけを出して null */
  private readPaper(cmd: string, target: string): { node: FileNode; text: string[] } | null {
    const r = this.resolve(target);
    if (!r.ok) {
      this.term.print(`${cmd}: ${target}: ${ERR_MSG[r.err]}`);
      return null;
    }
    const n = r.node;
    if (n.type === 'dir') {
      this.term.print(`${cmd}: ${target}: ディレクトリです`);
      return null;
    }
    if (n.type !== 'file' || !n.text) {
      this.term.print(`${cmd}: ${target}: 字の書かれた記録や紙ではない（人や物には、cat で話しかけよう）`);
      return null;
    }
    if (!can(n, 'r')) {
      this.term.print(`${cmd}: ${target}: Permission denied`);
      return null;
    }
    return { node: n, text: n.text };
  }

  /**
   * grep 言葉 紙...: 紙の中から、言葉を含む行だけを抜き出す。紙が2枚以上なら、行の前に紙の名前。-n で行の番号、-i で大文字小文字を区別しない。
   * history | grep 言葉 のように、流しこまれた行からも探せる
   */
  private grep(args: string[]) {
    const opts = args.filter((a) => /^-[a-zA-Z]+$/.test(a)).join('');
    const [pattern, ...files] = args.filter((a) => !/^-[a-zA-Z]+$/.test(a));
    if (!pattern) {
      this.term.print('grep: 探したい言葉と、探す記録の名前を書いてね（例: grep モリビト チルダ村.log）');
      return;
    }
    const icase = opts.includes('i');
    const num = opts.includes('n');
    const has = (s: string) => (icase ? s.toLowerCase().includes(pattern.toLowerCase()) : s.includes(pattern));
    const show = (where: string, i: number, line: string) => {
      const at = icase ? line.toLowerCase().indexOf(pattern.toLowerCase()) : line.indexOf(pattern);
      const segs: Seg[] = [];
      if (where) segs.push({ t: where, c: 'grep-file' }, { t: ':' });
      if (num) segs.push({ t: String(i + 1), c: 'grep-num' }, { t: ':' });
      segs.push({ t: line.slice(0, at) }, { t: line.slice(at, at + pattern.length), c: 'grep-hit' }, { t: line.slice(at + pattern.length) });
      this.term.print(segs.filter((s) => s.t));
    };
    this.lastFound.clear();
    let hits = 0;
    if (this.stdin && !files.length) {
      this.stdin.forEach((l, i) => {
        if (!has(l)) return;
        hits++;
        show('', i, l);
      });
    } else {
      if (!files.length) {
        this.term.print('grep: 言葉のうしろに、探す記録の名前を書いてね（例: grep モリビト チルダ村.log、ぜんぶなら *.log）');
        return;
      }
      const targets = files.flatMap((f) => this.expandGlob(f));
      for (const t of targets) {
        const p = this.readPaper('grep', t);
        if (!p) continue;
        p.text.forEach((l, i) => {
          if (!has(l)) return;
          hits++;
          this.lastFound.add(pathOf(p.node));
          show(targets.length > 1 ? t : '', i, l);
        });
      }
    }
    if (!hits) this.term.print([{ t: '（その言葉を含む行は、見つからなかった）', c: 'narr' }]);
  }

  /** diff 紙1 紙2: 二枚の紙を見比べて、ちがう行だけを出す（< は紙1だけ、> は紙2だけにある行） */
  private diff(args: string[]) {
    const files = args.filter((a) => !a.startsWith('-'));
    if (files.length !== 2) {
      this.term.print('diff: 見比べる記録を2つ書いてね（例: diff 古い記録 新しい記録）');
      return;
    }
    const a = this.readPaper('diff', files[0]);
    const b = this.readPaper('diff', files[1]);
    if (!a || !b) return;
    const out = diffLines(a.text, b.text);
    if (!out.length) {
      this.term.print([{ t: '（二つは、まったく同じだ）', c: 'narr' }]);
      return;
    }
    for (const l of out) this.term.print(l, l.startsWith('<') ? 'diff-old' : l.startsWith('>') ? 'diff-new' : 'diff-head');
  }

  // ---- 鍵束の力と、守り人を動かす言葉（第9章） ----

  /**
   * sudo コマンド: 鍵束の力で、どの鍵も開いた状態で唱える（本物の root）。
   * スドウに資格をもらうまでは「資格がない」
   */
  private async sudo(args: string[]) {
    if (!this.st.learned.includes('sudo')) {
      await this.narrate('（きみには、まだその資格がない。）');
      return;
    }
    if (!args.length) {
      this.term.print('sudo: 鍵束の力で唱える言葉を、うしろに書いてね（例: sudo systemctl start モリビト）');
      return;
    }
    if (args[0] === 'sudo') {
      this.term.print('sudo: 鍵束の力は、一度でじゅうぶん');
      return;
    }
    const inner = this.rawLine.replace(/^\s*sudo\s+/, '');
    setRootMode(true);
    try {
      await this.exec(inner, true);
    } finally {
      setRootMode(false);
    }
  }

  /** systemctl start 名前（鍵束の力がいる）・systemctl status 名前 */
  private async systemctl(args: string[]) {
    const [verb, raw] = args;
    if (!verb || !raw) {
      this.term.print('systemctl: start か status と、名前を書いてね（例: systemctl status モリビト）');
      return;
    }
    const name = raw.replace(/\.service$/, '');
    const svc = this.scn.chapters.flatMap((c) => c.services).find((s) => s.name === name);
    if (!svc) {
      this.term.print(`Unit ${name}.service could not be found.（${name} という者は、見当たらない）`);
      return;
    }
    const active = check(svc.activeIf, this.flags);
    if (verb === 'status') {
      this.term.print([{ t: '● ', c: active ? 'diff-new' : 'diff-old' }, { t: `${name}.service - ${svc.desc}` }]);
      this.term.print(
        active
          ? [{ t: '     Active: ' }, { t: 'active (running)', c: 'diff-new' }, { t: '（動いている）' }]
          : [{ t: '     Active: ' }, { t: 'inactive (dead)', c: 'diff-old' }, { t: `${svc.since ? ` since ${svc.since}` : ''}（止まっている）` }],
      );
      return;
    }
    if (verb !== 'start') {
      this.term.print('systemctl: この世界では、start と status だけを唱えられる');
      return;
    }
    if (!isRoot()) {
      this.term.print(`Failed to start ${name}.service: Access denied`);
      await this.narrate('（守り人を動かす言葉には、鍵束の力がいる。言葉の前に `sudo` をつけて唱えよう。）');
      return;
    }
    if (active) {
      this.term.print([{ t: `（${name}は、もう動いている）`, c: 'narr' }]);
      return;
    }
    const t = svc.onStart.find(
      (o) =>
        check(o.if, this.flags) &&
        !(o.once && this.flags[o.once]) &&
        !(o.exists ?? []).some((p) => !this.existsAt(p)) &&
        !(o.missing ?? []).some((p) => this.existsAt(p)),
    );
    if (t) await this.fire(t);
  }

  /** さっきの find で見つけた物の道のり（イベントの found に使う） */
  private lastFound = new Set<string>();

  /** find 場所... [-name 名前] [-type d|f]。本物と同じく、場所の中を奥の奥までたどる */
  private find(args: string[]) {
    const starts: string[] = [];
    let pattern: RegExp | null = null;
    let type: 'd' | 'f' | 'l' | null = null;
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === '-name' || a === '-type') {
        const v = args[++i];
        if (v === undefined) {
          this.term.print(`find: ${a} のあとに値が必要です（例: find . ${a === '-name' ? '-name 鈴' : '-type d'}）`);
          return;
        }
        if (a === '-name') pattern = globToRegExp(v);
        else if (v === 'd' || v === 'f' || v === 'l') type = v;
        else {
          this.term.print('find: -type には d（場所）か f（人やもの）を書きます');
          return;
        }
      } else if (a.startsWith('-')) {
        this.term.print(`find: '${a}' という書き方は、まだ知らない`);
        return;
      } else starts.push(a);
    }
    if (!starts.length) starts.push('.');

    let hits = 0;
    this.lastFound.clear();
    const walk = (n: VNode, shown: string) => {
      const typeOk = !type || (type === 'd' ? n.type === 'dir' : type === 'l' ? n.type === 'link' : n.type !== 'dir' && n.type !== 'link');
      if (typeOk && (!pattern || pattern.test(n.name))) {
        // 本物の find と同じく、場所の名前にも / は付けない
        this.term.print([{ ...this.entrySeg(n, shown), t: shown }]);
        this.discover(n);
        this.lastFound.add(pathOf(n));
        hits++;
      }
      if (n.type !== 'dir') return;
      if (!can(n, 'r') || !can(n, 'x')) {
        this.term.print(`find: '${shown}': Permission denied`);
        return;
      }
      const base = shown.endsWith('/') ? shown : `${shown}/`;
      for (const c of visibleChildren(n, this.flags)) walk(c, base + c.name);
    };
    for (const start of starts) {
      const r = this.resolve(start);
      if (!r.ok) this.term.print(`find: '${start}': ${ERR_MSG[r.err]}`);
      else walk(r.node, start);
    }
    // 見つからなかったことをシナリオから分かるようにしておく（「その場所から下しか探さない」の案内に使う）
    this.flags.last_find_empty = hits === 0;
    if (!hits) this.term.print([{ t: '（何も見つからなかった）', c: 'narr' }]);
    this.hooks.update();
  }

  private async kill(args: string[]) {
    if (!args.length) {
      this.term.print(this.chapter().procs.length ? 'kill: 番号を書いてね（kill 番号。番号は ps で分かる）' : 'kill: 名前を書いてね（kill 名前）');
      return;
    }
    const cwd = this.cwdNode();
    for (const arg of args) {
      // 番号（PID）で書いたら、目に見えずに動いている者たちから探す
      if (/^\d+$/.test(arg)) {
        await this.killPid(arg);
        continue;
      }
      // 坑道の者たちは、名前ではなく番号で
      if (this.chapter().procs.some((p) => p.name === arg && check(p.if, this.flags))) {
        this.term.print(`kill: 名前ではなく、番号（PID）で書いてね。番号は ps で分かる`);
        continue;
      }
      const name = arg.replace(/^\./, '');
      // 見つけていない（隠れていて、まだ ls -a で見ていない）ものには、唱えられない
      const proc = visibleChildren(cwd, this.flags).find(
        (c): c is ProcNode => c.type === 'process' && (c.pname === name || c.name === arg) && this.isDiscovered(c),
      );
      if (!proc) {
        this.term.print(`kill: (${arg}) - そのようなプロセスはありません`);
        continue;
      }
      if (this.isStopped(proc)) {
        this.term.print(`kill: (${arg}) - すでに停止しています`);
        continue;
      }
      if (proc.killBlockedIf && check(proc.killBlockedIf, this.flags)) {
        await this.narrate(...(proc.killBlocked ?? []));
        continue;
      }
      if (proc.onKill) await this.fire(proc.onKill);
      else this.term.print(`${proc.pname}を停止しました。`);
    }
  }

  // ---- 目に見えずに動いている者たち（ps・fg・bg・kill 番号） ----

  /** いま ps に出る者たち（止められた者は出ない） */
  private liveProcs(): Proc[] {
    return this.chapter().procs.filter((p) => check(p.if, this.flags) && !this.flags[`killed_${p.pid}`]);
  }

  private procByPid(pid: string): Proc | undefined {
    return this.liveProcs().find((p) => p.pid === pid);
  }

  /** ps: 動いている者たちの、番号（PID）・状態・名前 */
  private ps() {
    const procs = this.liveProcs();
    if (!procs.length) {
      this.term.print([{ t: '（動いている者は、見当たらない）', c: 'narr' }]);
      return;
    }
    const state = (p: Proc) => (this.flags[`fg_${p.pid}`] ? '表で動く' : p.state);
    const w = Math.max(4, ...procs.map((p) => width(state(p))));
    this.term.print(`PID   ${padEnd('状態', w)}  名前`);
    for (const p of procs) this.term.print(`${p.pid}  ${padEnd(state(p), w)}  ${p.name}`);
  }

  /** fg 番号: 裏で動いている者を、表（目の前）に呼ぶ */
  private async fg(args: string[]) {
    const pid = args[0];
    if (!pid) {
      this.term.print('fg: 番号を書いてね（fg 番号。番号は ps で分かる）');
      return;
    }
    const p = this.procByPid(pid);
    if (!p) {
      this.term.print(`fg: ${pid}: そのような番号の者は、いない`);
      return;
    }
    if (p.noFg) {
      await this.narrate(...p.noFg);
      return;
    }
    if (this.flags[`fg_${p.pid}`]) {
      this.term.print(`fg: ${p.name} は、もう表にいる`);
      return;
    }
    this.flags[`fg_${p.pid}`] = true;
    this.hooks.update();
    if (p.onFg) await this.fire(p.onFg);
  }

  /** bg 番号: 表の者を、裏に戻す */
  private async bg(args: string[]) {
    const pid = args[0];
    if (!pid) {
      this.term.print('bg: 番号を書いてね（bg 番号）');
      return;
    }
    const p = this.procByPid(pid);
    if (!p) {
      this.term.print(`bg: ${pid}: そのような番号の者は、いない`);
      return;
    }
    if (!this.flags[`fg_${p.pid}`]) {
      this.term.print(`bg: ${p.name} は、もう裏にいる`);
      return;
    }
    this.flags[`fg_${p.pid}`] = false;
    this.hooks.update();
    if (p.onBg) await this.fire(p.onBg);
  }

  /** kill 番号。まちがえて止めるとゲームオーバーになることもあるので、唱える前の状態を取っておく */
  private async killPid(pid: string) {
    const p = this.procByPid(pid);
    if (!p) {
      this.term.print(`kill: (${pid}) - そのようなプロセスはありません`);
      return;
    }
    if (!check(p.killIf, this.flags)) {
      if (p.killBlocked) await this.narrate(...p.killBlocked);
      return;
    }
    this.saveRewind();
    this.flags[`killed_${p.pid}`] = true;
    this.flags[`fg_${p.pid}`] = false;
    this.hooks.update();
    if (p.onKill) await this.fire(p.onKill);
    else this.term.print(`${p.name}を停止しました。`);
  }

  /** chgrp 組 場所: 自分の物の組（家族）を変える。自分が入っている組にだけ変えられる */
  private async chgrp(args: string[]) {
    const rest = args.filter((a) => !a.startsWith('-'));
    if (rest.length < 2) {
      this.term.print('chgrp: 組の名前と、場所が必要です（例: chgrp 組 場所）');
      return;
    }
    const [group, ...targets] = rest;
    if (!this.groups().includes(group)) {
      this.term.print(`chgrp: 組 '${group}' には入っていないので、その組にはできません（入っている組は groups で分かる）`);
      return;
    }
    for (const target of targets) {
      const r = this.resolve(target);
      if (!r.ok) {
        this.term.print(`chgrp: '${target}': ${ERR_MSG[r.err]}`);
        continue;
      }
      const n = r.node;
      if (n.owner !== PLAYER && !isRoot()) {
        this.term.print(`chgrp: '${target}' の組を変えられません: Operation not permitted`);
        continue;
      }
      this.setPerm(n, { group });
      this.term.print([{ t: `（${n.name} の組が、${group} になった）`, c: 'narr' }]);
    }
    this.hooks.update();
  }

  private async hint() {
    const ch = this.chapter();
    const h = ch.hints.find((h) => check(h.if, this.flags));
    if (!h) {
      this.term.print([{ t: 'ヒント: まわりをよく見てみよう。', c: 'hint' }]);
      return;
    }
    const key = `${ch.no}:${h.if ?? ''}`;
    const step = Math.min(this.st.hintSteps[key] ?? 0, h.steps.length - 1);
    const text = fill(h.steps[step], textVars(this.st));
    const count = `（${step + 1}/${h.steps.length}）`;
    // 仲間がいるときは、仲間がヒントをくれる
    const buddy = this.party()[0];
    if (buddy) await this.term.say([{ kind: 'talk', speaker: buddy.node.name, text: `${text} ${count}` }]);
    else this.term.print(codeSegs(`ヒント${count}: ${text}`, 'hint'));
    this.st.hintSteps[key] = step + 1;
    if (step + 1 < h.steps.length) this.term.print(codeSegs('もう一度 `hint` と打つと、もっと詳しく教えてもらえる。', 'narr'));
  }

  private help() {
    this.term.print('知っているコマンド:');
    const docs = this.knownCommands().map((n) => this.doc(n)).filter((d) => !!d);
    const w = Math.max(...docs.map((d) => width(d.usage)));
    for (const d of docs) this.term.print(`  ${padEnd(d.usage, w)}  ${d.summary}`);
    this.term.print([{ t: 'くわしい説明は右上の「📖 手帳」から。Tab キーで名前を補完、↑↓ で前のコマンドを呼び出せる。', c: 'hint' }]);
  }

  private history() {
    this.st.history.forEach((h, i) => this.term.print(`${String(i + 1).padStart(4)}  ${h}`));
  }

  /** exit: セーブしてタイトルにもどる（本物の exit は、ターミナルを閉じる） */
  private async exit() {
    const ans = await this.term.readLine([{ t: 'セーブして、タイトルにもどる？ (y/N) ' }]);
    if (ans.trim().toLowerCase() === 'y') this.hooks.quit?.();
  }

  private async restart() {
    const ans = await this.term.readLine([{ t: '本当にはじめからやり直す？ (y/N) ' }]);
    if (ans.trim().toLowerCase() === 'y') this.hooks.restart();
  }

  // ---- 共通 ----

  private resolve(path: string, followLast = true) {
    return resolve(this.scn.root, this.st.cwd, path, this.flags, this.scn.home, followLast);
  }

  // ---- かばん ----

  /**
   * きみのかばん（mkdir ~/かばん で作る）。まだなければ undefined。
   * 届き方は本物と同じ（どこからでも ~/かばん で届く）。入力候補と画面のかばんの欄にだけ、いつも出す
   */
  bag(): DirNode | undefined {
    const n = nodeAt(this.scn.root, joinPath([...this.scn.home, BAG]));
    return n?.type === 'dir' ? n : undefined;
  }

  /** 画面のかばんの欄に出す中身 */
  bagItems(): { name: string; icon: string; dir: boolean }[] | null {
    const b = this.bag();
    if (!b) return null;
    return visibleChildren(b, this.flags).map((c) => ({ name: c.name, icon: this.iconOf(c), dir: c.type === 'dir' }));
  }

  private lookup(path: string): VNode | undefined {
    const r = this.resolve(path);
    return r.ok ? r.node : undefined;
  }

  private cwdNode(): DirNode {
    const n = this.lookup('.');
    if (n?.type === 'dir') return n;
    // シナリオ更新などで今いる場所が消えていたらホームに戻す
    this.st.cwd = [...this.scn.home];
    return this.lookup('.') as DirNode;
  }

  private blockedByGate(d: DirNode): boolean {
    return !!d.gate && check(d.gate.if, this.flags);
  }

  /** その場所と、そこへの道のりを地図に載せる。ただしホームより上（村の外）は、物語で開けるまで伏せておく */
  private discoverPath(node: VNode) {
    const home = joinPath(this.scn.home);
    for (let n: VNode | null = node; n; n = n.parent) if (!home.startsWith(pathOf(n) + '/') && pathOf(n) !== '/') this.discover(n);
  }

  private discover(...nodes: VNode[]) {
    for (const n of nodes) {
      if (n.seen) this.flags[n.seen] = true;
      const p = pathOf(n);
      if (!this.st.discovered.includes(p)) this.st.discovered.push(p);
    }
  }

  learn(...names: string[]) {
    for (const n of names) {
      if (this.st.learned.includes(n)) continue;
      this.st.learned.push(n);
      const d = this.doc(n.split(' ')[0]);
      this.hooks.toast(`📖 手帳に「${n}」が追加された`, d?.veiled ? 'mystery' : d?.forbidden ? 'forbidden' : 'learn');
    }
  }

  /** 今の進み具合で見せる、コマンドの説明（kill のように、正体を伏せているものもある） */
  /** 入力候補に出す、覚えた唱え方（suggestFlags のコマンドだけ。手帳のオプションのうち、覚えたもの） */
  private flagForms(name: string): { flag: string; desc: string }[] {
    const d = this.scn.commands[name];
    if (!d?.suggestFlags) return [];
    return (d.options ?? [])
      .filter((o) => this.st.learned.includes(`${name} ${o.flag}`))
      .map((o) => ({ flag: o.flag, desc: o.short ?? o.desc }));
  }

  doc(name: string) {
    const d = this.scn.commands[name];
    return d && shownDoc(d, this.flags);
  }

  private async fire(t: Trigger) {
    if (!check(t.if, this.flags)) return;
    if (t.exists?.some((p) => !this.existsAt(p))) return;
    if (t.missing?.some((p) => this.existsAt(p))) return;
    if (t.rewindPoint) this.saveRewind(t.rewindPoint.cwd);
    if (t.once) {
      if (this.flags[t.once]) return;
      this.flags[t.once] = true;
    }
    if (t.set?.length || t.learn?.length || t.once) this.remember([...(t.lines ?? []), ...(t.after ?? [])]);
    for (const f of t.set ?? []) this.flags[f] = true;
    this.applyStoryPerms(t);
    if (t.gameOver) this.hooks.gameOverStart?.();
    if (t.lines) await this.term.say(this.toMsgs(t.lines));
    if (t.effect) await this.term.effect(t.effect);
    // 地図に載せてから照らす（現れた場所を吹き出しで説明できるように）
    for (const p of t.reveal ?? []) if (!this.st.discovered.includes(p)) this.st.discovered.push(p);
    if (t.guide) await this.showGuide(t.guide);
    this.learn(...(t.learn ?? []));
    this.hooks.update();
    if (t.after) await this.term.say(this.toMsgs(t.after));
    if (t.moveTo) this.moveTo(t.moveTo);
    if (t.demo) await this.runDemo(t.demo);
    if (t.timeLimit) this.startTimer(t.timeLimit);
    if (t.gameOver) {
      this.st.timer = undefined;
      this.hooks.update();
      await this.hooks.gameOver?.();
    }
  }

  // ---- ゲームオーバーと、やり直し ----

  /** いまの状態を、ゲームオーバーのときのやり直しの場所として取っておく */
  private saveRewind(cwd?: string) {
    const { rewind: _r, checkpoints: _c, ...rest } = this.st;
    const snap: GameState = JSON.parse(JSON.stringify(rest));
    if (cwd) snap.cwd = splitPath(cwd);
    this.st.rewind = snap;
  }

  /** ゲームオーバーのとき、やり直す状態（なければ undefined） */
  rewindState(): GameState | undefined {
    return this.st.rewind;
  }

  // ---- 時間制限 ----

  private startTimer(spec: TimeLimit) {
    const now = Date.now();
    this.st.timer = { startedAt: now, deadline: now + spec.seconds * 1000, spec, warned: [] };
  }

  /** 進んでいる時間制限（画面の側で、締め切りと合図の時刻を見る） */
  timerInfo(): { startedAt: number; deadline: number; warnings: number[] } | null {
    const t = this.st.timer;
    if (!t) return null;
    return { startedAt: t.startedAt, deadline: t.deadline, warnings: (t.spec.warnings ?? []).map((w) => w.at) };
  }

  /** 迫ってくる合図（足音など）を出す。残り時間は見せない */
  async warn(i: number) {
    const t = this.st.timer;
    const w = t?.spec.warnings?.[i];
    if (!t || !w || t.warned.includes(i)) return;
    t.warned.push(i);
    const msgs = this.toMsgs(w.lines);
    if (this.term.aside) this.term.aside(msgs);
    else await this.term.say(msgs, true);
    if (w.effect) await this.term.effect(w.effect);
  }

  /** 時間切れ */
  async timeUp() {
    const t = this.st.timer;
    if (!t) return;
    this.st.timer = undefined;
    await this.fire(t.spec.onTimeout);
  }

  /** 時間内に、決められた場所が決められた組・鍵になったか */
  private async checkTimer() {
    const t = this.st.timer;
    if (!t) return;
    const n = nodeAt(this.scn.root, this.absPath(t.spec.path));
    if (!n) return;
    if (t.spec.group && groupOf(n) !== t.spec.group) return;
    if (t.spec.mode && !new RegExp(t.spec.mode).test(n.mode)) return;
    this.st.timer = undefined;
    await this.fire(t.spec.onSuccess);
  }

  /**
   * 今の章の導入を、まだ見ていないか。
   * 古いセーブ（導入の記録がない）では、今の章より前の章は見たことにして、今の章の導入だけをもう一度出す
   */
  needsChapterStart(): boolean {
    const no = this.chapter().no;
    this.st.introSeen ??= this.scn.chapters.map((c) => c.no).filter((n) => n < no || n === 0);
    return !this.st.introSeen.includes(no);
  }

  /** 章のはじめのイベント（兄が起こしに来る、など）を、まだ見ていないか */
  needsOpening(): boolean {
    const o = this.chapter().opening;
    return !!o && !!o.once && !this.flags[o.once];
  }

  /** 章のはじめのイベントを起こす */
  async opening() {
    const o = this.chapter().opening;
    if (o) await this.fire(o);
  }

  /** 章の導入を見たことにして、始まりの場所にまだ行ったことがなければ、そこへ移す */
  arriveAtChapterStart() {
    const ch = this.chapter();
    if (ch.startAt && !this.st.visited.includes(ch.startAt)) this.moveTo(ch.startAt);
    // 「章を選ぶ」で始めたときも、始まりの場所への道のりを地図に載せる（/var/backups なら /var も）
    const start = ch.startAt ? nodeAt(this.scn.root, ch.startAt) : undefined;
    if (start) this.discoverPath(start);
    if (!this.st.introSeen?.includes(ch.no)) (this.st.introSeen ??= []).push(ch.no);
  }

  private applyStoryPerms(t: StoryPerms) {
    if (t.chown) this.setPerm(this.mustFind(t.chown.path), { owner: t.chown.owner });
    if (t.chmod) this.setPerm(this.mustFind(t.chmod.path), { mode: t.chmod.mode });
    if (t.joinGroup && !this.groups().includes(t.joinGroup)) this.groups().push(t.joinGroup);
  }

  private mustFind(path: string): VNode {
    const n = nodeAt(this.scn.root, path);
    if (!n) throw new Error(`${path} が見つからない`);
    return n;
  }

  /** 物語の都合で、プレイヤーを別の場所へ移す */
  private moveTo(path: string) {
    const r = this.resolve(path);
    if (!r.ok || r.node.type !== 'dir') throw new Error(`moveTo: ${path} へ移れない`);
    this.st.prevCwd = this.st.cwd;
    this.st.cwd = partsOf(r.node);
    // 移った先と、そこへの道のりを地図に載せる（/var/backups なら /var も）。中にある物は、ls で見るまで載せない（cd と同じ）
    this.discoverPath(r.node);
    const here = pathOf(r.node);
    if (!this.st.visited.includes(here)) this.st.visited.push(here);
    this.hooks.update();
  }

  private remember(lines: string[]) {
    // 指示になるのは、誰かのせりふか［システムの案内］。道しるべの文字やナレーションだけのときは上書きしない
    if (!lines.map(parseMsg).some((m) => m.kind === 'talk' || m.kind === 'sys')) return;
    this.st.recap = lines.slice(-RECAP_MAX).map((l) => fill(l, textVars(this.st)));
  }

  /** 「つづきから」で読み直す、前回の最後の会話と今の目的 */
  async recap() {
    this.term.print([{ t: '― 前回のつづき ―', c: 'chapter-sub' }], 'chapter');
    if (this.st.recap?.length) await this.term.say(this.st.recap.map(parseMsg), true);
    const goal = this.currentObjective();
    if (goal) this.term.print(codeSegs(`🎯 目的: ${goal}`, 'hint'));
  }

  private toMsgs(lines: string[]): Msg[] {
    return lines.map((l) => parseMsg(fill(l, textVars(this.st))));
  }

  private narrate(...lines: string[]) {
    return this.term.say(this.toMsgs(lines));
  }
}

/** いまいる場所から、その場所への道のり（.. と名前だけで書く） */
function relPath(from: string[], to: string[]): string {
  let i = 0;
  while (i < from.length && i < to.length && from[i] === to[i]) i++;
  const parts = [...Array<string>(from.length - i).fill('..'), ...to.slice(i)];
  return parts.join('/') || '.';
}

const COUNT = ['', 'ひとつ', 'ふたつ', 'みっつ', 'よっつ', 'いつつ', 'むっつ'];

/** 道のりを言葉で読む（../../パン屋 → ふたつ外の中の、パン屋） */
function readRel(rel: string): string {
  const words: string[] = [];
  let ups = 0;
  const flush = () => {
    if (ups) words.push(`${COUNT[ups] ?? ups + 'つ'}外`);
    ups = 0;
  };
  for (const p of rel.split('/')) {
    if (p === '..') ups++;
    else {
      flush();
      words.push(p);
    }
  }
  flush();
  return words.join('の中の、');
}

/** 場所の中の、その名前の道のり */
function childPath(dir: DirNode, name: string): string {
  const p = pathOf(dir);
  return p === '/' ? `/${name}` : `${p}/${name}`;
}

export function pathOf(n: VNode): string {
  const parts: string[] = [];
  for (let x: VNode | null = n; x?.parent; x = x.parent) parts.unshift(x.name);
  return joinPath(parts);
}

/** find -name の名前。* は「なんでも」、? は「どれか1文字」 */
function globToRegExp(glob: string): RegExp {
  const body = [...glob].map((ch) => (ch === '*' ? '.*' : ch === '?' ? '.' : ch.replace(/[.+^${}()|[\]\\]/g, '\\$&'))).join('');
  return new RegExp(`^${body}$`);
}

function garbleMsg(m: Msg): Msg {
  return m.kind === 'talk' ? { ...m, text: garble(m.text), garbled: true } : { ...m, text: garble(m.text) };
}

/**
 * echo のうしろを読む。" や ' で囲んだところは、そのまま（* も化けない）。囲んでいないところは、空白で区切る。
 * > 紙 なら書き直し、>> 紙 なら書き足し
 */
export function parseEcho(s: string): { words: string[]; op?: '>' | '>>'; to?: string; bareStar: boolean } | { err: string } {
  const words: string[] = [];
  let op: '>' | '>>' | undefined;
  let to: string | undefined;
  let bareStar = false;
  let cur: string | null = null;
  let quoted = false;
  const push = () => {
    if (cur === null) return;
    if (op) {
      if (to !== undefined) words.push(cur);
      else to = cur;
    } else words.push(cur);
    if (!quoted && cur.includes('*') && !(op && to === cur)) bareStar = true;
    cur = null;
    quoted = false;
  };
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '"' || ch === "'") {
      const end = s.indexOf(ch, i + 1);
      if (end < 0) return { err: `${ch} が閉じていない（ことばは ${ch}…${ch} で囲む）` };
      cur = (cur ?? '') + s.slice(i + 1, end);
      quoted = true;
      i = end;
    } else if (ch === '>') {
      push();
      if (op) return { err: '> は、ひとつだけ書く' };
      op = s[i + 1] === '>' ? '>>' : '>';
      if (op === '>>') i++;
    } else if (/\s/.test(ch)) push();
    else cur = (cur ?? '') + ch;
  }
  push();
  if (op && !to) return { err: `${op} のうしろに、書く紙の名前がない（例: echo "ことば" ${op} 紙）` };
  return { words, op, to, bareStar };
}

/** 予定表の1行「分 時 日 月 曜日 仕事」を読む。* は「いつでも」。数の範囲をはみ出したら、まちがい */
export function parseCronLine(line: string): { time: string; task: string } | { err: string } {
  const parts = line.split(/\s+/);
  if (parts.length < 6) return { err: '欄が足りない（分 時 日 月 曜日 のあとに、仕事を書く）' };
  const names = ['分', '時', '日', '月', '曜日'];
  const range: [number, number][] = [[0, 59], [0, 23], [1, 31], [1, 12], [0, 7]];
  for (let i = 0; i < 5; i++) {
    const f = parts[i];
    if (f === '*') continue;
    if (!/^\d+$/.test(f))
      return { err: `${names[i]}の欄「${f}」は、数か * で書く${i === 4 ? '（曜日は、0が日曜、1が月曜……6が土曜）' : ''}` };
    const v = Number(f);
    if (v < range[i][0] || v > range[i][1]) return { err: `${names[i]}の欄「${f}」は、${range[i][0]}〜${range[i][1]} で書く` };
  }
  return { time: parts.slice(0, 5).map((f) => (f === '*' ? f : String(Number(f)))).join(' '), task: parts.slice(5).join(' ') };
}

/** echo・crontab・grep・diff は、紙を相手にする（入力候補に、仲間を出さない） */
const PAPER_CMDS = ['echo', 'crontab', 'grep', 'diff'];

/** " や ' で囲んでいない | で、行を分ける */
export function splitPipe(line: string): string[] {
  const parts: string[] = [];
  let cur = '';
  let quote: string | null = null;
  for (const ch of line) {
    if (quote) {
      if (ch === quote) quote = null;
      cur += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      cur += ch;
    } else if (ch === '|') {
      parts.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  parts.push(cur.trim());
  return parts;
}

/**
 * 二枚の紙のちがい（本物の diff と同じ書き方）。「2c2」は紙1の2行目が紙2の2行目に変わった、
 * 「5d4」は紙1の5行目がなくなった、「3a4」は紙2の4行目が足された。< は紙1の行、> は紙2の行
 */
export function diffLines(a: string[], b: string[]): string[] {
  const n = a.length;
  const m = b.length;
  // 後ろから数えた、いちばん長い共通の並び
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--) lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const out: string[] = [];
  const range = (s: number, e: number) => (e - s === 1 ? `${s + 1}` : `${s + 1},${e}`);
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    const i0 = i;
    const j0 = j;
    while ((i < n || j < m) && !(i < n && j < m && a[i] === b[j])) {
      if (j >= m || (i < n && lcs[i + 1][j] >= lcs[i][j + 1])) i++;
      else j++;
    }
    const del = a.slice(i0, i);
    const add = b.slice(j0, j);
    if (del.length && add.length) out.push(`${range(i0, i)}c${range(j0, j)}`, ...del.map((l) => `< ${l}`), '---', ...add.map((l) => `> ${l}`));
    else if (del.length) out.push(`${range(i0, i)}d${j0}`, ...del.map((l) => `< ${l}`));
    else out.push(`${i0}a${range(j0, j)}`, ...add.map((l) => `> ${l}`));
  }
  return out;
}

function tokenize(line: string): string[] {
  return [...line.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)].map((m) => m[1] ?? m[2] ?? m[3]);
}

function pick(head: string, dirPart: string, prefix: string, entries: { name: string; dir: boolean }[]): Completion {
  const hits = entries.filter((e) => e.name.startsWith(prefix));
  if (!hits.length) return { value: head + dirPart + prefix };
  if (hits.length === 1) {
    const e = hits[0];
    return { value: head + dirPart + e.name + (e.dir ? '/' : ' ') };
  }
  const common = hits.map((e) => e.name).reduce((a, b) => {
    let i = 0;
    while (i < a.length && a[i] === b[i]) i++;
    return a.slice(0, i);
  });
  return {
    value: head + dirPart + common,
    candidates: common === prefix ? hits.map((e) => e.name + (e.dir ? '/' : '')) : undefined,
  };
}
