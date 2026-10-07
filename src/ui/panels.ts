// ターミナル以外の画面部品: 地図・目的・手帳・通知・はじめての案内・タイトル・章の見出し
import type { FoldOverrides, MapRow } from '../map';
import { splitCode } from '../text';
import { shelved, shownDoc, type CommandDoc } from '../scenario';
import type { Flags } from '../vfs';
import type { GuideStep } from '../vfs';
import type { Gender } from '../state';
import { CHAR_MS, saveSettings, settings, SPEED_LABEL, type Speed } from './settings';
import { refreshMusicVolume } from './music';
import { blip, sfx } from './sound';
import { el } from './terminal';
import { spriteImg } from './sprites';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---- 地図 ----

export class MapView {
  private seen = new Map<string, string | null>();
  private first = true;
  /** プレイヤーが手で開け閉めした場所。別のステージへ移ったら、元に戻す */
  private overrides = new Map<string, boolean>();
  private stage: string | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly onPick: (command: string) => void,
    private readonly build: (overrides: FoldOverrides) => MapRow[],
    private readonly stageNow: () => string | null,
  ) {}

  private toggle(path: string, open: boolean) {
    this.overrides.set(path, open);
    this.render();
  }

  render() {
    const stage = this.stageNow();
    if (stage !== this.stage) this.overrides.clear();
    this.stage = stage;
    const rows = this.build(this.overrides);
    const ul = el('ul', 'map-tree');
    // 中身が出ている場所は、その場所の行と中身をまとめて枠で囲む（どの場所の中にあるか、ひと目で分かるように）。
    // 段ごとに枠の色を変える。世界（いちばん外）は囲まない
    let boxes: HTMLElement[] = [ul];
    for (const [i, r] of rows.entries()) {
      boxes = boxes.slice(0, r.depth + 1);
      const container = boxes[r.depth] ?? boxes[boxes.length - 1];
      boxes[r.depth] = container;
      let parent = container;
      if (r.depth > 0 && (rows[i + 1]?.depth ?? -1) > r.depth) {
        const wrap = el('li', 'map-nest');
        const box = el('ul', `map-group lv${((r.depth - 1) % 5) + 1}`);
        wrap.append(box);
        container.append(wrap);
        parent = box;
      }
      // この場所の中身は、この場所の枠に入れる
      boxes[r.depth + 1] = parent;
      const li = el('li', `map-row kind-${r.kind}`);
      // たためる場所には ▶（閉じている）／▼（開いている）
      if (r.fold) {
        const f = el('button', 'fold');
        f.textContent = r.fold === 'open' ? '▼' : '▶';
        f.setAttribute('aria-label', r.fold === 'open' ? '閉じる' : '開く');
        f.tabIndex = -1;
        f.addEventListener('click', (e) => {
          e.stopPropagation();
          this.toggle(r.path, r.fold !== 'open');
        });
        li.append(f);
        if (r.fold === 'closed') li.classList.add('folded');
      } else li.append(el('span', 'fold-slot'));
      li.style.setProperty('--depth', String(r.depth));
      li.dataset.path = r.path;
      if (r.current) li.classList.add('current');
      if (!r.label) li.classList.add('teaser');
      else if (!r.visited && r.kind === 'dir') li.classList.add('unvisited');
      if (r.stopped) li.classList.add('stopped');
      // 新しく地図に載った場所・「？？？」が名前に変わった場所を光らせる
      if (!this.first) {
        if (!this.seen.has(r.path)) li.classList.add('appear');
        else if (this.seen.get(r.path) === null && r.label) li.classList.add('unveil');
      }

      // 物語を進めるために行く場所には、アイコンの左に赤い「!」
      if (r.mark) {
        const m = spriteImg('mark', 'mark');
        m.title = '物語を進めるには、ここへ';
        li.append(m);
        li.classList.add('marked');
      } else li.append(el('span', 'mark-slot'));
      li.append(spriteImg(r.stopped && r.kind === 'process' ? 'proc-stopped' : r.icon.replace(/^char:/, ''), 'icon'));
      const label = el('span', 'map-label');
      label.textContent = r.label ?? '？？？';
      li.append(label);
      if (r.sub) {
        const sub = el('span', 'map-sub');
        sub.textContent = r.sub;
        li.append(sub);
      }
      if (r.locked) li.append(badge('🔒', '鍵がかかっている'));
      if (r.warn) li.append(badge('⚠', 'ようすがおかしい'));
      if (r.current) li.append(badge('◀ いまここ', '', 'here'));

      if (r.fold === 'closed') {
        // 閉じている場所は、クリックでまず開く
        li.tabIndex = 0;
        li.title = 'クリックで開く';
        const open = () => this.toggle(r.path, true);
        li.addEventListener('click', open);
        li.addEventListener('keydown', (e) => e.key === 'Enter' && open());
      } else if (r.insert) {
        li.tabIndex = 0;
        li.title = `クリックで「${r.insert}」を入力`;
        const pick = () => this.onPick(r.insert!);
        li.addEventListener('click', pick);
        li.addEventListener('keydown', (e) => e.key === 'Enter' && pick());
      }
      parent.append(li);
    }
    this.root.replaceChildren(ul);
    this.seen = new Map(rows.map((r) => [r.path, r.label]));
    this.first = false;
    ul.querySelector('.current')?.scrollIntoView({ block: 'nearest' });
  }
}

function badge(text: string, title: string, cls = ''): HTMLElement {
  const b = el('span', `badge ${cls}`);
  b.textContent = text;
  if (title) b.title = title;
  return b;
}

// ---- 仲間 ----

export class PartyView {
  private count = 0;

  constructor(
    private readonly root: HTMLElement,
    private readonly onPick: (command: string) => void,
  ) {}

  render(members: { name: string; icon: string }[]) {
    this.root.hidden = !members.length;
    const list = el('ul', 'party-list');
    members.forEach((m, i) => {
      const li = el('li', i >= this.count && this.count >= 0 ? 'party-row joined' : 'party-row');
      li.tabIndex = 0;
      li.title = `クリックで「cat ${m.name}」を入力`;
      li.append(spriteImg(m.icon.replace(/^char:/, ''), 'icon'));
      const name = el('span', 'party-name');
      name.textContent = m.name;
      li.append(name);
      const pick = () => this.onPick(`cat ${m.name}`);
      li.addEventListener('click', pick);
      li.addEventListener('keydown', (e) => e.key === 'Enter' && pick());
      list.append(li);
    });
    const title = el('div', 'pane-title');
    title.textContent = '🐾 仲間';
    this.root.replaceChildren(title, list);
    this.count = members.length;
  }
}

/**
 * かばんの欄。見出しをクリックすると開いて、中身が並ぶ（物が増えても地図が狭くならないよう、はじめは閉じておく）。
 * 中身をクリックすると cat（場所なら ls）が、住所（~/かばん/…）つきで入る
 */
export class BagView {
  private open = false;
  private items: { name: string; icon: string; dir: boolean }[] | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly onPick: (command: string) => void,
  ) {}

  render(items: { name: string; icon: string; dir: boolean }[] | null) {
    this.items = items;
    this.root.hidden = !items;
    if (!items) return;
    const title = button(`${this.open ? '▼' : '▶'} 🎒 かばん（${items.length}）`, 'pane-title bag-toggle', () => {
      this.open = !this.open;
      this.render(this.items);
    });
    // かばんの住所。どこからでも、この住所で届く
    title.append(Object.assign(el('span', 'bag-addr'), { textContent: '~/かばん' }));
    title.setAttribute('aria-expanded', String(this.open));
    if (!this.open) {
      this.root.replaceChildren(title);
      return;
    }
    const list = el('ul', 'party-list');
    if (!items.length) {
      const empty = el('li', 'bag-empty');
      empty.textContent = '（からっぽ）';
      list.append(empty);
    }
    for (const it of items) {
      const cmd = `${it.dir ? 'ls' : 'cat'} ~/かばん/${it.name}`;
      const li = el('li', 'party-row');
      li.tabIndex = 0;
      li.title = `クリックで「${cmd}」を入力`;
      li.append(spriteImg(it.icon.replace(/^char:/, ''), 'icon'));
      const name = el('span', 'party-name');
      name.textContent = it.dir ? `${it.name}/` : it.name;
      li.append(name);
      const pick = () => this.onPick(cmd);
      li.addEventListener('click', pick);
      li.addEventListener('keydown', (e) => e.key === 'Enter' && pick());
      list.append(li);
    }
    this.root.replaceChildren(title, list);
  }
}

// ---- 目的 ----

export class ObjectiveView {
  private last = '';
  constructor(private readonly root: HTMLElement) {}

  render(text: string) {
    if (text === this.last) return;
    this.root.replaceChildren(
      ...splitCode(text).map((p) => {
        const span = document.createElement('span');
        span.textContent = p.t;
        if (p.code) span.className = 'cmd';
        return span;
      }),
    );
    if (this.last) {
      this.root.classList.remove('flash');
      void this.root.offsetWidth; // アニメーションをやり直すため
      this.root.classList.add('flash');
    }
    this.last = text;
  }
}

// ---- 通知 ----

export function toast(text: string, kind = 'learn') {
  const host = document.getElementById('toasts')!;
  const t = el('div', `toast ${kind}`);
  t.textContent = text;
  host.append(t);
  setTimeout(() => t.classList.add('out'), 3200);
  setTimeout(() => t.remove(), 3800);
}

// ---- 📖 コマンド手帳 ----

export class Handbook {
  private tab: 'cmd' | 'hist' = 'cmd';

  constructor(
    private readonly root: HTMLElement,
    private readonly data: () => BookData,
    private readonly onPick: (command: string) => void,
  ) {
    root.addEventListener('click', (e) => {
      if (e.target === root) this.close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) this.close();
    });
  }

  get isOpen() {
    return !this.root.hidden;
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  open() {
    this.root.hidden = false;
    this.render();
  }

  close() {
    this.root.hidden = true;
  }

  private render() {
    const { learned, docs: raw, history, flags } = this.data();
    const docs = Object.fromEntries(Object.entries(raw).map(([k, d]) => [k, shownDoc(d, flags)]));
    const panel = el('div', 'drawer-panel');
    const head = el('div', 'drawer-head');
    const title = el('h2', '');
    title.textContent = '📖 コマンド手帳';
    const x = button('✕', 'icon-btn', () => this.close());
    x.setAttribute('aria-label', '閉じる');
    head.append(title, x);

    const tabs = el('div', 'tabs');
    tabs.append(
      button('覚えたコマンド', this.tab === 'cmd' ? 'tab on' : 'tab', () => ((this.tab = 'cmd'), this.render())),
      button('最近使ったコマンド', this.tab === 'hist' ? 'tab on' : 'tab', () => ((this.tab = 'hist'), this.render())),
    );

    const body = el('div', 'drawer-body');
    if (this.tab === 'cmd') {
      const main = Object.values(docs).filter((d) => !d.system && learned.includes(d.name) && !shelved(raw[d.name], flags));
      for (const d of main) body.append(this.card(d, learned));
      const sys = el('h3', '');
      sys.textContent = 'そのほかの操作';
      body.append(sys);
      for (const d of Object.values(docs).filter((d) => d.system)) body.append(this.card(d, learned, true));
    } else {
      const recent = [...new Set([...history].reverse())].slice(0, 30);
      if (!recent.length) body.append(Object.assign(el('p', 'muted'), { textContent: 'まだ何も打っていない。' }));
      for (const h of recent) body.append(button(h, 'hist-item', () => this.pick(h)));
    }
    panel.append(head, tabs, body);
    this.root.replaceChildren(panel);
  }

  private card(d: CommandDoc & { veiled?: boolean }, learned: string[], compact = false): HTMLElement {
    const c = el('section', d.veiled ? 'card mystery' : d.forbidden ? 'card forbidden' : 'card');
    const h = el('div', 'card-head');
    const name = el('code', 'card-name');
    name.textContent = d.name;
    const sum = el('span', 'card-sum');
    sum.textContent = d.summary;
    h.append(name, sum, button('入力する', 'mini-btn', () => this.pick(`${d.name} `)));
    c.append(h);
    if (compact) return c;

    c.append(row('書き方', code(d.usage)));
    const opts = (d.options ?? []).filter((o) => learned.includes(`${d.name} ${o.flag}`));
    if (opts.length) {
      const list = el('div', 'opts');
      for (const o of opts) list.append(Object.assign(el('div', ''), { textContent: `${o.flag} … ${o.desc}` }));
      c.append(row('オプション', list));
    }
    if (d.examples?.length) {
      const ex = el('div', 'examples');
      for (const e of d.examples) ex.append(code(e));
      c.append(row('例', ex));
    }
    if (d.real) c.append(row('本物のLinuxでは', Object.assign(el('p', 'real'), { textContent: d.real })));
    return c;
  }

  private pick(cmd: string) {
    this.close();
    this.onPick(cmd);
  }
}

/** 手帳に出すもの */
export interface BookData {
  learned: string[];
  docs: Record<string, CommandDoc>;
  history: string[];
  flags: Flags;
}

/**
 * 右に出しておくコマンド手帳。覚えたコマンドの書き方と例を、いつでも見られるようにする
 * （はじめての人がコマンドを覚えられるように。くわしい説明は「くわしく」から引き出しで）
 */
export class BookPane {
  private known = new Set<string>();
  private first = true;

  constructor(
    private readonly root: HTMLElement,
    private readonly data: () => BookData,
    private readonly onPick: (command: string) => void,
    private readonly openDetail: () => void,
  ) {}

  render() {
    const { learned, docs, flags } = this.data();
    const title = el('div', 'pane-title book-title');
    title.append(Object.assign(el('span', ''), { textContent: '📖 コマンド手帳' }));
    title.append(button('くわしく', 'mini-btn', () => this.openDetail()));
    const list = el('div', 'book-list');
    const main = Object.values(docs)
      .filter((d) => !d.system && learned.includes(d.name) && !shelved(d, flags))
      .map((d) => shownDoc(d, flags));
    for (const d of main) {
      const opts = (d.options ?? []).filter((o) => learned.includes(`${d.name} ${o.flag}`));
      const key = [d.name, d.summary, ...opts.map((o) => o.flag)].join('|');
      const card = el('section', d.veiled ? 'bk mystery' : d.forbidden ? 'bk forbidden' : 'bk');
      // 新しく覚えたコマンドや、増えたオプションを光らせる
      if (!this.first && !this.known.has(key)) card.classList.add('fresh');
      this.known.add(key);
      card.tabIndex = 0;
      card.title = `クリックで「${d.name}」を入力`;
      const head = el('div', 'bk-head');
      head.append(Object.assign(el('code', 'bk-name'), { textContent: d.name }));
      head.append(Object.assign(el('span', 'bk-sum'), { textContent: d.summary }));
      card.append(head);
      card.append(Object.assign(el('div', 'bk-usage'), { textContent: d.usage }));
      for (const o of opts) {
        const r = el('div', 'bk-opt');
        r.append(Object.assign(el('code', ''), { textContent: o.flag }), ` ${o.short ?? o.desc}`);
        card.append(r);
      }
      const pick = () => this.onPick(`${d.name} `);
      card.addEventListener('click', pick);
      card.addEventListener('keydown', (e) => e.key === 'Enter' && pick());
      list.append(card);
    }
    const foot = el('p', 'bk-foot');
    foot.append('名前は途中まで打って ', Object.assign(el('span', 'cmd'), { textContent: 'Tab' }), ' で補える。困ったら ');
    foot.append(Object.assign(el('span', 'cmd'), { textContent: 'hint' }), '。');
    this.root.replaceChildren(title, list, foot);
    this.first = false;
  }
}

function row(label: string, content: HTMLElement): HTMLElement {
  const r = el('div', 'card-row');
  const l = el('div', 'card-label');
  l.textContent = label;
  r.append(l, content);
  return r;
}

function code(text: string): HTMLElement {
  const c = el('code', 'code');
  c.textContent = text;
  return c;
}

export function button(text: string, cls: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = cls;
  b.textContent = text;
  b.addEventListener('click', onClick);
  return b;
}

// ---- ⚙ 設定 ----

const PREVIEW = 'いらっしゃい！ 今日もいい焼き色でしょ？';

export class SettingsView {
  private previewRun = 0;

  constructor(private readonly root: HTMLElement) {
    root.addEventListener('click', (e) => {
      if (e.target === root) this.close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !root.hidden) this.close();
    });
  }

  toggle() {
    if (this.root.hidden) this.open();
    else this.close();
  }

  open() {
    this.root.hidden = false;
    this.render();
  }

  close() {
    this.root.hidden = true;
    this.previewRun++;
  }

  private render() {
    const panel = el('div', 'modal-panel');
    const head = el('div', 'drawer-head');
    const title = el('h2', '');
    title.textContent = '⚙ 設定';
    const x = button('✕', 'icon-btn', () => this.close());
    x.setAttribute('aria-label', '閉じる');
    head.append(title, x);

    const preview = el('div', 'preview');
    const speed = segmented(
      (Object.keys(SPEED_LABEL) as Speed[]).map((k) => [k, SPEED_LABEL[k]]),
      settings.speed,
      (v) => {
        settings.speed = v as Speed;
        saveSettings();
        void this.playPreview(preview);
      },
    );
    const sound = segmented(
      [
        ['on', 'オン'],
        ['off', 'オフ'],
      ],
      settings.sound ? 'on' : 'off',
      (v) => {
        settings.sound = v === 'on';
        saveSettings();
        void this.playPreview(preview);
      },
    );
    const effects = segmented(
      [
        ['on', 'オン'],
        ['off', 'オフ'],
      ],
      settings.sfx ? 'on' : 'off',
      (v) => {
        settings.sfx = v === 'on';
        saveSettings();
        if (settings.sfx) sfx('bell');
      },
    );
    const music = segmented(
      [
        ['on', 'オン'],
        ['off', 'オフ'],
      ],
      settings.bgm ? 'on' : 'off',
      (v) => {
        settings.bgm = v === 'on';
        saveSettings();
        refreshMusicVolume();
      },
    );
    const vol = document.createElement('input');
    vol.type = 'range';
    vol.min = '0';
    vol.max = '1';
    vol.step = '0.05';
    vol.value = String(settings.volume);
    vol.setAttribute('aria-label', '音量');
    vol.addEventListener('input', () => {
      settings.volume = Number(vol.value);
      saveSettings();
      refreshMusicVolume();
    });
    vol.addEventListener('change', () => void this.playPreview(preview));

    const body = el('div', 'drawer-body');
    body.append(
      setting('文字の速さ', speed),
      setting('文字の音', sound),
      setting('効果音', effects),
      setting('BGM', music),
      setting('音量', vol),
      setting('見本', preview),
    );
    panel.append(head, body);
    this.root.replaceChildren(panel);
    void this.playPreview(preview);
  }

  /** 今の設定で、見本のせりふを表示してみせる */
  private async playPreview(target: HTMLElement) {
    const run = ++this.previewRun;
    target.textContent = '';
    const ms = CHAR_MS[settings.speed];
    for (const [i, ch] of [...PREVIEW].entries()) {
      if (run !== this.previewRun) return;
      target.textContent += ch;
      if (ms && (ms >= 30 || i % 2 === 0) && !/[\s、。！？]/.test(ch)) blip(560);
      if (ms) await sleep(ms);
    }
  }
}

function segmented(options: [string, string][], current: string, onChange: (v: string) => void): HTMLElement {
  const group = el('div', 'segmented');
  group.setAttribute('role', 'radiogroup');
  for (const [value, label] of options) {
    const b = button(label, value === current ? 'seg on' : 'seg', () => {
      group.querySelectorAll('.seg').forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
      b.setAttribute('aria-checked', 'true');
      onChange(value);
    });
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(value === current));
    group.append(b);
  }
  return group;
}

function setting(label: string, control: HTMLElement): HTMLElement {
  const r = el('div', 'setting-row');
  const l = el('div', 'setting-label');
  l.textContent = label;
  r.append(l, control);
  return r;
}

// ---- はじめての人向けの案内 ----

const TOUR = [
  { target: '#side', text: '左は「地図」。いまいる場所と、行ける場所が表示される。一段右にずれている場所は、上の場所の「中」にある。まだ知らない場所は「？？？」。赤い「!」は、物語を進めるために次に行く場所・話す相手のしるし。クリックすると、そこへ行くコマンドが入力欄に入る。' },
  { target: '#termwrap', text: 'まん中は「ターミナル」。下の入力欄にコマンドを打って Enter を押すと、世界に働きかけられる。打ちはじめると、入力候補が出てくる。' },
  { target: '#bookpane', text: '右は「コマンド手帳」。覚えたコマンドの書き方が、ここにたまっていく。何を打てばいいか忘れたら、ここを見よう。クリックすると、入力欄にコマンドが入る。' },
  { target: '#tools', text: '困ったら「💡 ヒント」で次にやることを聞ける。「📖 手帳」で、手帳を閉じたり開いたりできる。文字の速さや音は「⚙ 設定」で変えられる。' },
];

export async function runTour(): Promise<void> {
  const overlay = document.getElementById('tour')!;
  // 見えていない部品（せまい画面で閉じている手帳など）は飛ばす
  const steps = TOUR.filter((s) => document.querySelector(s.target)?.getClientRects().length);
  for (const [i, step] of steps.entries()) {
    const target = document.querySelector<HTMLElement>(step.target)!;
    target.classList.add('spot');
    const bubble = el('div', 'tour-bubble');
    const p = el('p', '');
    p.textContent = step.text;
    const foot = el('div', 'tour-foot');
    const count = el('span', 'muted');
    count.textContent = `${i + 1} / ${steps.length}`;
    let done!: () => void;
    const next = new Promise<void>((r) => (done = r));
    foot.append(count, button(i + 1 < steps.length ? '次へ' : 'はじめる', 'primary-btn', () => done()));
    bubble.append(p, foot);
    // 吹き出しは強調した部品より上に出すため、body 直下に置く
    overlay.hidden = false;
    document.body.append(bubble);
    placeBubble(bubble, target.getBoundingClientRect());
    (foot.querySelector('button') as HTMLButtonElement).focus();
    await next;
    bubble.remove();
    target.classList.remove('spot');
  }
  overlay.hidden = true;
}

// ---- 画面の一部を照らして説明する（はじめての ls など。シナリオのイベントの guide） ----

/** 照らす場所。直前の出力の行や、その中の場所の名前のように、小さな部分も照らせる */
function guideTarget(at: GuideStep['at'], item?: string): HTMLElement | HTMLElement[] | null {
  const last = document.querySelector<HTMLElement>('#log .output > :last-child');
  const row = item ? document.querySelector<HTMLElement>(`#map li[data-path="${CSS.escape(item)}"]`) : null;
  switch (at) {
    case 'prompt': {
      // 入力待ちなら入力欄の左の住所、そうでなければ、さっき打った行の住所
      const live = document.querySelector<HTMLElement>('#inputbar .prompt .p-path');
      if (live?.getClientRects().length) return live;
      const echoes = document.querySelectorAll<HTMLElement>('#log .line.echo');
      return echoes[echoes.length - 1]?.querySelector<HTMLElement>('.p-path') ?? null;
    }
    case 'suggest': {
      const items = [...document.querySelectorAll<HTMLElement>('#inputbar .suggest li')];
      const hit = item ? items.find((li) => li.querySelector('.sg-label')?.textContent === item) : null;
      return hit ?? document.querySelector<HTMLElement>('#inputbar .suggest-wrap');
    }
    case 'row':
      return row;
    case 'sub':
      return row?.querySelector<HTMLElement>('.map-sub') ?? row;
    case 'book':
      return document.getElementById('bookpane');
    case 'found': {
      // 地図の、いまいる場所の中にある人や物（ls で見つけたもの）
      const here = document.querySelector<HTMLElement>('#map li.current')?.dataset.path;
      if (here === undefined) return null;
      const base = here === '/' ? '/' : `${here}/`;
      const rows = [...document.querySelectorAll<HTMLElement>('#map li.map-row')].filter((li) => {
        const p = li.dataset.path ?? '';
        return p.startsWith(base) && !p.slice(base.length).includes('/');
      });
      return rows.length ? rows : null;
    }
    case 'terminal':
      return document.getElementById('termwrap');
    case 'objective':
      return document.getElementById('objective-box');
    case 'hint':
      return document.getElementById('btn-hint');
    case 'bookbtn':
      return document.getElementById('btn-book');
    case 'output':
      return last;
    case 'output-prev':
      return (last?.previousElementSibling as HTMLElement | null) ?? null;
    case 'dir':
      return last?.querySelector<HTMLElement>('.dir') ?? null;
    case 'mark':
      return document.querySelector<HTMLElement>('#map li.marked');
    case 'here':
      return document.querySelector<HTMLElement>('#map li.current');
    case 'map':
      return document.getElementById('side');
    case 'bag':
      return document.getElementById('bag');
    case 'input':
      return document.getElementById('inputbar');
  }
}

/**
 * 照らす部品の上に穴の空いた幕をかけ、吹き出しで説明する。
 * 部品そのものは動かさない（小さな行や文字だけを照らせるように、まわりを影で暗くする）
 */
export async function runGuide(steps: GuideStep[]): Promise<void> {
  // 見えていない部品（スマホで閉じている地図など）は飛ばす
  const shown = steps
    .map((s) => ({ ...s, targets: [guideTarget(s.at, s.item)].flat().filter((t): t is HTMLElement => !!t?.getClientRects().length) }))
    .filter((s) => s.targets.length);
  const overlay = document.getElementById('tour')!;
  overlay.classList.add('clear');
  overlay.hidden = false;
  for (const [i, step] of shown.entries()) {
    step.targets[0].scrollIntoView({ block: 'nearest' });
    // いくつかを照らすときは、ぜんぶを囲む四角にする
    const rects = step.targets.map((t) => t.getBoundingClientRect());
    const left = Math.min(...rects.map((x) => x.left));
    const top = Math.min(...rects.map((x) => x.top));
    const r = new DOMRect(left, top, Math.max(...rects.map((x) => x.right)) - left, Math.max(...rects.map((x) => x.bottom)) - top);
    const pad = 6;
    const hole = el('div', 'guide-hole');
    Object.assign(hole.style, {
      left: `${r.left - pad}px`,
      top: `${r.top - pad}px`,
      width: `${r.width + pad * 2}px`,
      height: `${r.height + pad * 2}px`,
    });
    const bubble = el('div', 'tour-bubble');
    const p = el('p', '');
    for (const part of splitCode(step.text)) {
      const span = document.createElement('span');
      if (part.code) span.className = 'cmd';
      span.textContent = part.t;
      p.append(span);
    }
    const foot = el('div', 'tour-foot');
    const count = el('span', 'muted');
    count.textContent = `${i + 1} / ${shown.length}`;
    let done!: () => void;
    const next = new Promise<void>((res) => (done = res));
    foot.append(count, button(i + 1 < shown.length ? '次へ' : 'わかった', 'primary-btn', () => done()));
    bubble.append(p);
    if (step.note) {
      const note = el('p', 'guide-note');
      for (const part of splitCode(step.note)) {
        const span = document.createElement('span');
        if (part.code) span.className = 'cmd';
        span.textContent = part.t;
        note.append(span);
      }
      bubble.append(note);
    }
    bubble.append(foot);
    document.body.append(hole, bubble);
    placeBubble(bubble, hole.getBoundingClientRect());
    (foot.querySelector('button') as HTMLButtonElement).focus();
    await next;
    hole.remove();
    bubble.remove();
  }
  overlay.hidden = true;
  overlay.classList.remove('clear');
}

/**
 * 吹き出しを、照らした部品に重ならない場所へ置く。
 * 小さな部品（行や文字）は下・上・右・左、大きな部品（地図など）は右・左・下・上の順に、画面に収まるところを探す。
 * どこにも収まらないほど大きな部品のときだけ、部品の中の左上に重ねる
 */
function placeBubble(b: HTMLElement, r: DOMRect) {
  const W = b.offsetWidth;
  const H = b.offsetHeight;
  const gap = 16;
  const margin = 8;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const clampX = (x: number) => Math.max(margin, Math.min(x, vw - W - margin));
  const clampY = (y: number) => Math.max(margin, Math.min(y, vh - H - margin));
  const below = { left: clampX(r.left), top: r.bottom + gap, fits: r.bottom + gap + H <= vh - margin };
  const above = { left: clampX(r.left), top: r.top - gap - H, fits: r.top - gap - H >= margin };
  const right = { left: r.right + gap, top: clampY(r.top), fits: r.right + gap + W <= vw - margin };
  const left = { left: r.left - gap - W, top: clampY(r.top), fits: r.left - gap - W >= margin };
  const order = r.height < 120 ? [below, above, right, left] : [right, left, below, above];
  const spot = order.find((o) => o.fits) ?? { left: clampX(r.left + 24), top: clampY(r.top + 48) };
  b.style.left = `${spot.left}px`;
  b.style.top = `${spot.top}px`;
}

// ---- タイトル・章の見出し ----

export type TitleChoice = 'new' | 'continue' | 'select';

export async function showTitle(hasSave: boolean, canSelect: boolean): Promise<TitleChoice> {
  const t = document.getElementById('title')!;
  // タイトルは、ターミナルに打つように1文字ずつ出す。下に小さく、英語の読み（-a は all、~ はチルダ村）
  const logo = el('h1', 'title-logo');
  logo.setAttribute('aria-label', 'save -a ~');
  const sub = el('p', 'title-sub');
  sub.textContent = 'save all of Tilde';
  const menu = el('div', 'title-menu');
  // 村の一枚絵（16:9）。タイトルの文字とボタンは、絵の空のところに重ねる。絵は読みこめたら、ふわっと出す
  const art = el('div', 'title-art');
  const bg = el('div', 'title-art-bg');
  const url = `${import.meta.env.BASE_URL}title.webp`;
  bg.style.backgroundImage = `url("${url}")`;
  const img = new Image();
  img.onload = () => bg.classList.add('in');
  img.src = url;
  const inner = el('div', 'title-art-inner');
  inner.append(logo, sub, menu);
  art.append(bg, inner);
  t.replaceChildren(art);
  t.hidden = false;

  await sleep(500);
  for (const ch of 'save -a ~') {
    logo.textContent += ch;
    await sleep(110);
  }
  await sleep(250);
  sub.classList.add('in');
  await sleep(400);

  return new Promise((resolve) => {
    const choose = async (c: TitleChoice) => {
      // ターミナルへ戻るのは「つづきから」だけ。ほかは、この暗い画面のまま次の画面に入れ替える
      if (c === 'continue') await fadeOut(t);
      resolve(c);
    };
    if (hasSave) menu.append(button('つづきから', 'primary-btn', () => choose('continue')));
    if (canSelect) menu.append(button('章を選ぶ', 'ghost-btn', () => choose('select')));
    menu.append(button('はじめから', hasSave ? 'ghost-btn' : 'primary-btn', () => choose('new')));
    (menu.querySelector('button') as HTMLButtonElement).focus();
  });
}

/** 章を選ぶ画面。選んだ章の番号を返す。もどるなら null */
export function chooseChapter(items: { no: number; title: string; available: boolean }[]): Promise<number | null> {
  const t = document.getElementById('title')!;
  const heading = el('h2', 'choose-title');
  heading.textContent = '章を選ぶ';
  const list = el('div', 'chapter-list');
  const note = el('p', 'choose-note');
  note.textContent = '選んだ章の、はじめから遊べます（その章のはじめに戻ります）';
  const back = button('もどる', 'ghost-btn', () => {});
  t.replaceChildren(heading, list, note, back);
  t.hidden = false;
  return new Promise((resolve) => {
    const done = (v: number | null) => resolve(v);
    for (const it of items) {
      const b = button(`第${it.no}章　${it.title}`, 'chapter-item', () => done(it.no));
      if (!it.available) {
        b.disabled = true;
        b.textContent = `第${it.no}章　？？？`;
      }
      list.append(b);
    }
    back.addEventListener('click', () => done(null));
    (list.querySelector('button:not([disabled])') as HTMLButtonElement | null)?.focus();
  });
}

/** 画面全体の案内（タイトルなど）を消す。消え終わってから次へ進むので、続けて同じ場所に別の画面を出せる */
async function fadeOut(e: HTMLElement) {
  e.classList.add('out');
  await sleep(600);
  e.hidden = true;
  e.classList.remove('out');
}

/** 「はじめから」のあとに、主人公を男の子・女の子から選んでもらう */
export function chooseGender(): Promise<Gender> {
  const t = document.getElementById('title')!;
  const heading = el('h2', 'choose-title');
  heading.textContent = 'きみは、どっち？';
  const row = el('div', 'choose-row');
  const options: [Gender, string][] = [
    ['boy', '男の子'],
    ['girl', '女の子'],
  ];
  const cards = options.map(([g, label]) => {
    const b = button('', 'choose-card', () => {});
    b.dataset.gender = g;
    const name = el('span', 'choose-label');
    name.textContent = label;
    b.append(spriteImg(`player-${g}`, 'choose-portrait'), name);
    row.append(b);
    return b;
  });
  const note = el('p', 'choose-note');
  note.textContent = '← → で選んで Enter、またはクリック';
  t.replaceChildren(heading, row, note);
  t.hidden = false;
  cards[0].focus();

  return new Promise((resolve) => {
    const done = async (g: Gender) => {
      document.removeEventListener('keydown', onKey);
      await fadeOut(t);
      resolve(g);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const i = cards.indexOf(document.activeElement as HTMLButtonElement);
        cards[(i + (e.key === 'ArrowRight' ? 1 : cards.length - 1)) % cards.length].focus();
      }
    };
    document.addEventListener('keydown', onKey);
    cards.forEach((c) => c.addEventListener('click', () => done(c.dataset.gender as Gender)));
  });
}

/** 暗い画面（章の見出し・章の終わり）を出す。もう出ていれば、中身だけを入れ替える（間でターミナルを見せない） */
function showCard(c: HTMLElement, children: HTMLElement[]) {
  c.replaceChildren(...children);
  c.classList.remove('in', 'out');
  void c.offsetWidth; // 文字の浮かび上がりを、もう一度はじめから
  c.hidden = false;
  c.classList.add('in');
  // 暗い画面の下にあるものは、もう見せなくてよい（タイトル・章の終わりの暗転）
  document.getElementById('title')!.hidden = true;
  document.body.classList.remove('fx-fadeout');
}

/** 章の見出し・章の終わりの画面を消して、ターミナルを見せる */
export async function hideChapterCard() {
  const c = document.getElementById('chapter-card')!;
  if (c.hidden) return;
  c.classList.remove('in');
  c.classList.add('out');
  await sleep(700);
  c.classList.remove('out');
  c.hidden = true;
}

/**
 * 章の終わりの画面。「第0章 チルダ村 ― 完 ―」を出し、つづけるか、セーブして終わるかを選んでもらう。
 * 選んだあとも画面は出したままにする（つづけるなら次の章の見出しに入れ替え、終わるならそのままタイトルへ）
 */
export async function showChapterEnd(no: number, title: string, scene: HTMLElement | null = null): Promise<'continue' | 'quit'> {
  const c = document.getElementById('chapter-card')!;
  const menu = el('div', 'title-menu cc-menu');
  let choose!: (v: 'continue' | 'quit') => void;
  const chosen = new Promise<'continue' | 'quit'>((r) => (choose = r));
  menu.append(
    button('つづける', 'primary-btn', () => choose('continue')),
    button('セーブして終わる', 'ghost-btn', () => choose('quit')),
  );
  const note = Object.assign(el('p', 'cc-note'), { textContent: 'セーブして終わっても、タイトルの「つづきから」で次の章から遊べます' });
  showCard(c, [
    ...(scene ? [scene] : []),
    Object.assign(el('div', 'cc-no'), { textContent: `第${no}章` }),
    Object.assign(el('div', 'cc-title'), { textContent: title }),
    Object.assign(el('div', 'cc-end'), { textContent: '― 完 ―' }),
    menu,
    note,
  ]);
  await sleep(1200);
  (menu.querySelector('button') as HTMLButtonElement).focus();
  const v = await chosen;
  menu.querySelectorAll('button').forEach((b) => (b.disabled = true));
  return v;
}

/** ゲームオーバーの画面。「やり直す」を押すまで待つ */
export async function showGameOver(): Promise<void> {
  const c = document.getElementById('chapter-card')!;
  const menu = el('div', 'title-menu cc-menu');
  let go!: () => void;
  const chosen = new Promise<void>((r) => (go = r));
  menu.append(button('やり直す', 'primary-btn', () => go()));
  showCard(c, [
    Object.assign(el('div', 'cc-title'), { textContent: '…………' }),
    Object.assign(el('div', 'cc-end'), { textContent: 'ゲームオーバー' }),
    menu,
    Object.assign(el('p', 'cc-note'), { textContent: '少し前の場面から、やり直せます' }),
  ]);
  sfx('gameover');
  await sleep(1200);
  (menu.querySelector('button') as HTMLButtonElement).focus();
  await chosen;
  menu.querySelectorAll('button').forEach((b) => (b.disabled = true));
}

/**
 * ゲームの画面に合わせた確認の窓（ブラウザの confirm のかわり）。
 * 「やめておく」に最初から合わせておき、Esc や外側のクリックでも、やめたことにする
 */
export function confirmDialog(o: {
  title: string;
  message: string;
  note?: string;
  ok: string;
  cancel: string;
  /** 取り消せないこと（進み具合が消えるなど）なら、決定のボタンを赤くする */
  danger?: boolean;
}): Promise<boolean> {
  const root = el('div', 'confirm');
  root.setAttribute('role', 'alertdialog');
  root.setAttribute('aria-modal', 'true');
  const panel = el('div', 'modal-panel confirm-panel');
  const title = el('h2', 'confirm-title');
  title.textContent = o.title;
  const msg = el('p', 'confirm-msg');
  msg.textContent = o.message;
  const parts: HTMLElement[] = [title, msg];
  if (o.note) parts.push(Object.assign(el('p', 'confirm-note'), { textContent: o.note }));
  const row = el('div', 'confirm-actions');
  parts.push(row);
  panel.append(...parts);
  root.append(panel);
  document.body.append(root);
  return new Promise((resolve) => {
    const close = (v: boolean) => {
      document.removeEventListener('keydown', onKey, true);
      root.remove();
      resolve(v);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      close(false);
    };
    const cancel = button(o.cancel, 'ghost-btn', () => close(false));
    const ok = button(o.ok, o.danger ? 'ghost-btn danger' : 'primary-btn', () => close(true));
    row.append(cancel, ok);
    root.addEventListener('click', (e) => e.target === root && close(false));
    document.addEventListener('keydown', onKey, true);
    cancel.focus();
  });
}

/** メニュー（セーブしてタイトルへ・はじめからやり直す） */
export class MenuView {
  constructor(
    private readonly root: HTMLElement,
    private readonly actions: { quit: () => void; restart: () => void },
  ) {
    root.addEventListener('click', (e) => {
      if (e.target === root) this.close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !root.hidden) this.close();
    });
  }

  toggle() {
    if (this.root.hidden) this.open();
    else this.close();
  }

  open() {
    const panel = el('div', 'modal-panel');
    const head = el('div', 'drawer-head');
    const title = el('h2', '');
    title.textContent = '☰ メニュー';
    const x = button('✕', 'icon-btn', () => this.close());
    x.setAttribute('aria-label', '閉じる');
    head.append(title, x);
    const body = el('div', 'menu-body');
    const note = el('p', 'menu-note');
    note.textContent = '進み具合は、コマンドを打つたびに自動でセーブされています。';
    const actions = el('div', 'menu-actions');
    const quit = button('セーブしてタイトルへ', 'primary-btn', () => this.actions.quit());
    const restart = button('はじめからやり直す', 'ghost-btn danger', async () => {
      const ok = await confirmDialog({
        title: '本当に、はじめからやり直す？',
        message: 'いまの進み具合は消えて、第0章のはじめからになります。',
        note: '章の最初からやり直したいだけなら、タイトルの「章を選ぶ」からもできます。',
        ok: 'はじめからやり直す',
        cancel: 'やめておく',
        danger: true,
      });
      if (ok) this.actions.restart();
    });
    actions.append(quit, restart);
    const tip = el('p', 'menu-tip');
    tip.append('ターミナルで ', Object.assign(el('span', 'cmd'), { textContent: 'exit' }), ' と打っても、セーブしてタイトルにもどれます。');
    body.append(note, actions, tip);
    panel.append(head, body);
    this.root.replaceChildren(panel);
    this.root.hidden = false;
    quit.focus();
  }

  close() {
    this.root.hidden = true;
  }
}

/**
 * 章の始まりの見出し。scene があれば、その章の幕の絵を上に出す。
 * music（幕の曲）があれば、鳴り終わるまで出す。クリックかキーを押すと、先へ進める
 */
export async function showChapterCard(
  no: number,
  title: string,
  scene: HTMLElement | null = null,
  music: { done: Promise<void>; skip: () => void } | null = null,
) {
  const c = document.getElementById('chapter-card')!;
  const hint = Object.assign(el('p', 'cc-note cc-skip'), { textContent: 'クリックで先へ' });
  showCard(c, [
    ...(scene ? [scene] : []),
    Object.assign(el('div', 'cc-no'), { textContent: `第${no}章` }),
    Object.assign(el('div', 'cc-title'), { textContent: title }),
    ...(music ? [hint] : []),
  ]);
  if (music) {
    // 出てすぐの操作で飛ばしてしまわないように、少し待ってから受けつける
    await sleep(800);
    const skip = () => music.skip();
    c.addEventListener('click', skip);
    document.addEventListener('keydown', skip);
    await Promise.all([music.done, sleep(1600)]);
    c.removeEventListener('click', skip);
    document.removeEventListener('keydown', skip);
  } else await sleep(scene ? 3600 : 2400);
  await hideChapterCard();
}
