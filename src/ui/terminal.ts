// 右側のターミナル。会話は「立ち絵＋名前＋せりふ」のかたまりで、ログの流れの中に出す。
// xterm.js ではなく DOM で組んでいるのは、日本語入力(IME)・全角文字・立ち絵や演出を素直に扱うため。
import type { DemoOpts, ReadOpts, Suggestion, Term } from '../shell';
import { normalizeInput, splitCode, type Line, type Msg, type Seg } from '../text';
import type { GuideStep } from '../vfs';
import { CHAR_MS, settings } from './settings';
import { cutMusic, holdMusic, playOnce, resumeStageMusic } from './music';
import { blip, playSound, sfx } from './sound';
import { spriteImg } from './sprites';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 文字の音の高さ（Hz）。会話は話す人ごとに characters の voice で変えられる */
const PITCH = { talk: 520, narr: 330, sys: 740, plain: 440, chapter: 440 };
/** 音を鳴らさない文字 */
const SILENT = /[\s、。，．・…「」『』（）()［］\[\]！？!?―ー〜～]/;

export interface SpeakerInfo {
  sprite: string;
  color?: string;
  voice?: number;
}

/** 入力待ちが時間制限で打ち切られたときに、readLine が返す値 */
export const INTERRUPTED = '\u0000interrupted';

export class Terminal implements Term {
  private abortRead: (() => void) | null = null;
  private readonly out: HTMLElement;
  private readonly promptEl: HTMLElement;
  /** 入力欄の左の「$」。住所（promptEl）は入力欄の上の行に出し、入力欄を横いっぱいに使えるようにする */
  private readonly markEl: HTMLElement;
  private readonly input: HTMLInputElement;
  private readonly inputLine: HTMLElement;
  private readonly suggestEl: HTMLElement;
  /** 候補の行の両端の矢印。入りきらない候補があるほうだけ出る */
  private readonly arrowL: HTMLButtonElement;
  private readonly arrowR: HTMLButtonElement;
  private busy = false;
  private skip = false;
  /** 表示し終えたせりふが、読まれるのを待っている（次に何か出す前に、スペースを待つ） */
  private pending: HTMLElement | null = null;
  /** スペースを待っている間、押されたら呼ぶ */
  private advance: (() => void) | null = null;
  private readonly bar: HTMLElement;
  private suggestions: Suggestion[] = [];
  private sel = -1;
  private suggestFn?: (v: string) => Suggestion[];
  /** だれかが手本を打っている間（入力欄は止めたまま、候補だけ出す） */
  private demoing = false;
  /** 画面の一部を照らして説明する（main.ts で panels の runGuide をつなぐ） */
  guide?: (steps: GuideStep[]) => Promise<void>;

  constructor(
    private readonly log: HTMLElement,
    inputBar: HTMLElement,
    private readonly speaker: (name: string) => SpeakerInfo | undefined,
  ) {
    this.out = el('div', 'output');
    log.append(this.out);
    this.bar = inputBar;

    this.suggestEl = el('ul', 'suggest');
    this.suggestEl.setAttribute('role', 'listbox');
    this.inputLine = el('div', 'input-line');
    this.promptEl = el('div', 'prompt');
    this.markEl = el('span', 'prompt-mark');
    this.input = document.createElement('input');
    Object.assign(this.input, { autocomplete: 'off', spellcheck: false, autocapitalize: 'off', enterKeyHint: 'send' });
    this.input.setAttribute('aria-label', 'コマンド入力');
    const row = el('div', 'input-row');
    row.append(this.markEl, this.input);
    this.inputLine.append(this.promptEl, row);
    // 候補の行は、スクロールバーを出さずに、両端の矢印で横に送る
    const arrow = (dir: -1 | 1) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `suggest-arrow ${dir < 0 ? 'left' : 'right'}`;
      // 文字の ‹ › は線が細くて見づらいので、太めの線で描く
      b.innerHTML =
        `<svg width="14" height="16" viewBox="0 0 14 16" aria-hidden="true"><path d="${dir < 0 ? 'M10 2 4 8l6 6' : 'M4 2l6 6-6 6'}" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      b.tabIndex = -1;
      b.setAttribute('aria-label', dir < 0 ? '前の候補を見る' : '次の候補を見る');
      // 押しても入力欄から文字入力の場所が外れないようにする
      b.addEventListener('mousedown', (e) => e.preventDefault());
      b.addEventListener('click', () => {
        this.suggestEl.scrollBy({ left: dir * this.suggestEl.clientWidth * 0.7, behavior: 'smooth' });
      });
      return b;
    };
    this.arrowL = arrow(-1);
    this.arrowR = arrow(1);
    const suggestWrap = el('div', 'suggest-wrap');
    suggestWrap.append(this.arrowL, this.suggestEl, this.arrowR);
    this.suggestEl.addEventListener('scroll', () => this.updateArrows());
    window.addEventListener('resize', () => this.updateArrows());
    inputBar.append(suggestWrap, this.inputLine);
    this.setEnabled(false);

    log.addEventListener('click', () => {
      if (this.advance) this.advance();
      else if (this.busy) this.skip = true;
      else if (!window.getSelection()?.toString()) this.input.focus();
    });
    // 会話の表示中にキーを押すと、残りを一気に表示する。表示し終えたせりふは、スペース（か Enter）で次へ
    document.addEventListener('keydown', (e) => {
      // ほかの入力欄（手帳の検索など）で打っている文字は、会話を進めるのに使わない
      const t = e.target as HTMLElement | null;
      if (t !== this.input && (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement)) return;
      if (this.advance) {
        if ((e.key === ' ' || e.key === 'Enter') && !e.repeat && !this.overlayOpen()) {
          e.preventDefault();
          this.advance();
        }
        return;
      }
      if (this.busy) this.skip = true;
    });
    this.input.addEventListener('input', (e) => {
      if (!(e as InputEvent).isComposing) this.fixIme();
      this.refreshSuggest();
    });
    // 横に並んだ候補は、マウスのホイール（縦）でも横にスクロールできるようにする
    this.suggestEl.addEventListener(
      'wheel',
      (e) => {
        if (!e.deltaY || e.deltaX) return;
        e.preventDefault();
        this.suggestEl.scrollLeft += e.deltaY;
      },
      { passive: false },
    );
    this.input.addEventListener('compositionend', () => {
      this.fixIme();
      this.refreshSuggest();
    });
  }

  /** 日本語入力のまま打った「・」「。」や全角文字を、入力欄の中で / や . に直す（カーソルの位置はそのまま） */
  private fixIme() {
    const v = this.input.value;
    const fixed = normalizeInput(v);
    if (fixed === v) return;
    const pos = this.input.selectionStart ?? v.length;
    const head = normalizeInput(v.slice(0, pos)).length;
    this.input.value = fixed;
    this.input.setSelectionRange(head, head);
  }

  print(line: Line = '', cls?: string): void {
    const div = el('div', cls ? `line ${cls}` : 'line');
    if (typeof line === 'string') div.textContent = line;
    else div.append(...segs(line));
    this.out.append(div);
    this.scroll();
  }

  /**
   * せりふを1つずつ出す。1つ出し終えたら ▼ を出して、スペースを押すまで次を出さない（読み直しの instant は待たない）。
   * 最後のせりふは、次に何か出すとき（せりふ・吹き出し・演出・手本）に待つ。そのまま入力待ちになるなら待たない
   */
  async say(msgs: Msg[], instant = false): Promise<void> {
    if (instant) this.pending = null;
    let block = null as { speaker: string; body: HTMLElement; wrap: HTMLElement } | null;
    for (const m of msgs) {
      // 演出は、前のせりふを読み終えてから。読み直し（instant）では鳴らさない
      if (m.kind === 'fx') {
        if (!instant) await this.effect(m.text);
        block = null;
        continue;
      }
      if (!instant) await this.flush();
      this.busy = true;
      this.skip = instant;
      let target: HTMLElement;
      let marker: HTMLElement;
      if (m.kind === 'talk') {
        if (block?.speaker !== m.speaker) block = { speaker: m.speaker, ...this.talkBlock(m.speaker, !!m.garbled) };
        target = el('div', 'talk-text');
        block.body.append(target);
        marker = block.wrap;
      } else {
        block = null;
        target = el('div', `line ${m.kind}`);
        this.out.append(target);
        marker = target;
      }
      const pitch = m.kind === 'talk' ? (this.speaker(m.speaker)?.voice ?? PITCH.talk) : PITCH[m.kind];
      await this.type(target, m.text, pitch);
      this.busy = false;
      if (!instant) this.pending = marker;
    }
  }

  /**
   * 入力の途中でも割りこんで、せりふを一気に出す（▼ で待たない）。時間制限の合図（獣のうなり声など）に使う。
   * 進んでいる会話の状態（pending・busy）にはさわらない
   */
  aside(msgs: Msg[]): void {
    let block = null as { speaker: string; body: HTMLElement } | null;
    for (const m of msgs) {
      if (m.kind === 'fx') {
        void this.effect(m.text);
        continue;
      }
      let target: HTMLElement;
      if (m.kind === 'talk') {
        if (block?.speaker !== m.speaker) block = { speaker: m.speaker, ...this.talkBlock(m.speaker, !!m.garbled) };
        target = el('div', 'talk-text');
        block.body.append(target);
      } else {
        block = null;
        target = el('div', `line ${m.kind}`);
        this.out.append(target);
      }
      for (const p of splitCode(m.text)) {
        const span = document.createElement('span');
        if (p.code) span.className = 'cmd';
        span.textContent = p.t;
        target.append(span);
      }
    }
    this.scroll();
  }

  /** 表示し終えたせりふがあれば、▼ を出してスペースを待つ。しばらく押されなければ「スペースで次へ」も出す */
  async flush(): Promise<void> {
    const at = this.pending;
    this.pending = null;
    if (!at || !at.isConnected) return;
    const mark = el('span', 'advance');
    const tip = el('span', 'advance-tip');
    tip.textContent = 'スペースで次へ';
    mark.append(tip, Object.assign(el('span', 'advance-arrow'), { textContent: '▼' }));
    at.classList.add('has-advance');
    at.append(mark);
    this.scroll();
    const timer = setTimeout(() => mark.classList.add('tip'), 2500);
    await new Promise<void>((r) => (this.advance = r));
    this.advance = null;
    clearTimeout(timer);
    mark.remove();
    at.classList.remove('has-advance');
  }

  /** 吹き出し・確認の窓などが開いている間は、スペースで会話を進めない（そちらのボタンが押せるように） */
  private overlayOpen(): boolean {
    return ['tour', 'drawer', 'settings', 'menu'].some((id) => !document.getElementById(id)?.hidden) || !!document.querySelector('.confirm');
  }

  private talkBlock(name: string, garbled: boolean): { body: HTMLElement; wrap: HTMLElement } {
    const info = this.speaker(name);
    const wrap = el('div', garbled ? 'talk garbled' : 'talk');
    if (info) wrap.append(spriteImg(info.sprite, 'portrait'));
    const body = el('div', 'talk-body');
    const nameEl = el('div', 'talk-name');
    nameEl.textContent = name;
    if (info?.color) nameEl.style.color = info.color;
    body.append(nameEl);
    wrap.append(body);
    this.out.append(wrap);
    return { body, wrap };
  }

  private async type(target: HTMLElement, text: string, pitch: number) {
    const ms = CHAR_MS[settings.speed];
    // `…` で囲んだコマンドは、枠つきの span にする
    const parts = splitCode(text).map((p) => {
      const span = document.createElement('span');
      if (p.code) span.className = 'cmd';
      target.append(span);
      return { span, chars: [...p.t] };
    });
    const fillAll = () => parts.forEach((p) => (p.span.textContent = p.chars.join('')));
    if (this.skip || ms === 0) {
      fillAll();
      this.scroll();
      return;
    }
    // 速いときに毎文字鳴らすとうるさいので、1文字おきにする
    const every = ms < 30 ? 2 : 1;
    let n = 0;
    for (const p of parts) {
      for (const ch of p.chars) {
        if (this.skip) {
          fillAll();
          this.scroll();
          return;
        }
        p.span.textContent += ch;
        if (n % every === 0 && !SILENT.test(ch)) blip(pitch);
        if (n % 2 === 0) this.scroll();
        n++;
        await sleep(ms);
      }
    }
    this.scroll();
  }

  clear(): void {
    this.out.replaceChildren();
  }

  async effect(name: string): Promise<void> {
    await this.flush();
    const b = document.body.classList;
    switch (name) {
      case 'glitch':
        cutMusic();
        sfx('static', 1.4);
        b.add('fx-glitch');
        await sleep(1500);
        b.remove('fx-glitch');
        b.add('fx-silence');
        await sleep(2600);
        b.remove('fx-silence');
        break;
      case 'stomp':
        // ずしーん。足音と同時に、画面を大きく揺らす
        sfx('stomp');
        b.add('fx-stomp');
        await sleep(600);
        b.remove('fx-stomp');
        break;
      case 'roar':
        // 獣の叫び声。叫んでいる間、画面が細かく震える
        sfx('roar');
        b.add('fx-roar');
        await sleep(1300);
        b.remove('fx-roar');
        break;
      case 'shake':
        b.add('fx-shake');
        await sleep(350);
        b.remove('fx-shake');
        break;
      case 'reveal':
        b.add('fx-reveal');
        await sleep(1200);
        setTimeout(() => b.remove('fx-reveal'), 1500);
        break;
      case 'bell':
        sfx('bell');
        await sleep(1400);
        break;
      case 'towerbell':
        // 塔の鐘「カーン」
        playSound('towerbell');
        await sleep(2500);
        break;
      case 'tick':
        // 大時計が動きだす。カチ、コチ、と秒針の音
        playSound('clock', 3000);
        await sleep(3000);
        break;
      case 'shadow':
        // 記録の影。曲が消え、画面が暗く沈み、ザザッと乱れる（light まで暗いまま）
        holdMusic(1200);
        sfx('static', 1.2);
        b.add('fx-shadow');
        await sleep(1500);
        break;
      case 'light':
        // 首飾りの光。影がはらわれて、まばゆく光る
        b.remove('fx-shadow');
        sfx('bell');
        b.add('fx-light');
        await sleep(1600);
        b.remove('fx-light');
        break;
      case 'revive': {
        // 守り人が動きだす。「復活の祈り」を一度だけ流しながら、画面が真っ白になる（白いまま、次の dawn まで）。
        // 白いあいだに、村の色と曲が戻る。曲が終わったら、その場所のふだんの曲へ
        holdMusic(300);
        const prayer = playOnce('復活の祈り２', 8000);
        void prayer.done.then(() => resumeStageMusic());
        b.add('fx-white');
        await sleep(2600);
        break;
      }
      case 'dawn':
        // 真っ白から、ゆっくり戻る（戻ると、色が戻っている）
        b.remove('fx-white');
        await sleep(2600);
        break;
      case 'unlock':
        // 扉の錠が、カチャリとはずれる
        sfx('unlock');
        await sleep(1200);
        break;
      case 'chapterEnd':
        // 暗くなったまま、章の終わりの画面へつなぐ（明るさは、その画面が出たあとで戻す）。ステージの曲も消す
        holdMusic(2000);
        b.add('fx-fadeout');
        await sleep(2200);
        break;
      default:
        await sleep(800);
    }
  }

  /**
   * だれか（兄など）が、入力欄にゆっくりコマンドを打ってみせる。打つたびに入力候補が出る。
   * pauseAt まで打ったら止まって説明を待ち、tab なら Tab キーで残りを補ってみせる。最後に Enter を押したように表示する
   */
  async demo(prompt: Seg[], text: string, o: DemoOpts): Promise<void> {
    await this.flush();
    // キーを押すと速く打つ（会話と同じ）。いっしゅんの設定でも、打っている様子は見せる
    const ms = Math.max(40, Math.min(160, CHAR_MS[settings.speed] * 3 || 40));
    this.setPrompt(prompt);
    this.input.value = '';
    this.suggestFn = o.suggest;
    this.demoing = true;
    this.inputLine.classList.remove('waiting');
    this.inputLine.classList.add('demo');
    // 入力欄を枠で囲んで、だれが打っているかの札を出す（気づけるように）
    this.bar.classList.add('demoing');
    const badge = el('div', 'demo-badge');
    badge.textContent = `⌨ ${o.by ?? '手本'}が入力中……`;
    this.bar.append(badge);
    this.busy = true;
    this.skip = false;
    let paused = !o.pauseAt;
    await sleep(400);
    for (;;) {
      const v = this.input.value;
      if (!paused && (v === o.pauseAt || !text.startsWith(o.pauseAt!))) {
        paused = true;
        await sleep(500);
        // 吹き出しを読んでいる間のキーで、残りを飛ばさないようにする
        this.busy = false;
        await o.onPause?.();
        this.busy = true;
        this.skip = false;
        if (o.tab && o.complete) {
          const r = o.complete(this.input.value);
          if (text.startsWith(r.value) && r.value.length > this.input.value.length) {
            await this.pressKey('Tab', 'Tab キーを押すと、名前の残りを補ってくれる');
            this.input.value = r.value;
            this.refreshSuggest();
            await sleep(700);
          }
        }
        continue;
      }
      if (v === text) break;
      const rest = text.slice(v.length);
      const ch = String.fromCodePoint(rest.codePointAt(0)!);
      this.input.value = v + ch;
      this.refreshSuggest();
      if (ch !== ' ') blip(760);
      await sleep(this.skip ? 10 : ms);
    }
    await sleep(this.skip ? 100 : 400);
    await this.pressKey('Enter', 'Enter キーを押すと、コマンドを実行する');
    this.demoing = false;
    this.inputLine.classList.remove('demo');
    this.bar.classList.remove('demoing');
    badge.remove();
    this.input.value = '';
    this.setPrompt([]);
    this.setEnabled(false);
    this.busy = false;
    this.print([...prompt, { t: text, c: 'typed' }], 'echo demo');
  }

  /**
   * 手本で押すキーを、入力欄の上に大きく出す。「このキーを押すよ」と見せてから、押す
   * （キーを押していれば、少し早く進む）
   */
  private async pressKey(name: string, caption: string) {
    const box = el('div', 'key-callout');
    const cap = el('div', 'key-caption');
    cap.textContent = caption;
    const key = el('div', 'key-cap');
    key.textContent = name;
    box.append(key, cap);
    this.bar.append(box);
    await sleep(this.skip ? 700 : 1600);
    key.classList.add('pressed');
    blip(880);
    await sleep(450);
    box.classList.add('out');
    await sleep(250);
    box.remove();
  }

  /** ヒントボタンなど、ボタンからコマンドを実行する。入力待ちでなければ何もしない */
  submit(text: string) {
    if (this.input.disabled) return;
    this.input.value = text;
    this.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
  }

  /** 地図や手帳から、入力欄にコマンドを入れる（実行はしない） */
  insert(text: string) {
    if (this.input.disabled) return;
    this.input.value = text;
    this.input.focus();
    this.refreshSuggest();
  }

  /** 入力欄の上の行に住所を、入力欄の左に「$」を出す（空なら、どちらも消す） */
  private setPrompt(prompt: Seg[]) {
    const last = prompt[prompt.length - 1];
    const mark = last && last.t.trim() === '$';
    this.promptEl.replaceChildren(...segs(mark ? prompt.slice(0, -1) : prompt));
    this.markEl.textContent = mark ? '$' : '';
  }

  /** 入力待ちを、外から打ち切る（時間制限）。readLine は INTERRUPTED を返す */
  interrupt() {
    this.abortRead?.();
  }

  readLine(prompt: Seg[], opts: ReadOpts = {}): Promise<string> {
    const history = opts.history ?? [];
    let hIndex = history.length;
    let draft = '';
    this.suggestFn = opts.suggest;
    // そのまま入力待ちになるときは、最後のせりふのスペースは待たない
    this.pending = null;

    this.setPrompt(prompt);
    this.input.value = '';
    this.setEnabled(true);
    this.refreshSuggest();
    this.input.focus();

    return new Promise((resolve) => {
      this.abortRead = () => {
        this.abortRead = null;
        this.input.removeEventListener('keydown', onKey);
        this.input.value = '';
        this.setPrompt([]);
        this.setEnabled(false);
        this.suggestions = [];
        this.renderSuggest();
        resolve(INTERRUPTED);
      };
      const onKey = (e: KeyboardEvent) => {
        // IME 変換中の Enter は確定なので無視する
        if (e.isComposing || e.keyCode === 229) return;
        e.stopPropagation();
        const v = this.input.value;
        const open = this.suggestions.length > 0;

        // 候補は横に並ぶ。↓/↑ で次/前へ。候補を選んでいる間は ←/→ でも動ける（選んでいないときの ←/→ は文字の間を動く）
        const next = e.key === 'ArrowDown' || (this.sel >= 0 && e.key === 'ArrowRight');
        const prev = e.key === 'ArrowUp' || (this.sel >= 0 && e.key === 'ArrowLeft');
        if (open && (next || prev)) {
          e.preventDefault();
          const n = this.suggestions.length;
          this.sel = next ? (this.sel + 1) % n : (this.sel - 1 + n) % n;
          this.renderSuggest();
        } else if (open && (e.key === 'Tab' || (e.key === 'Enter' && this.sel >= 0))) {
          e.preventDefault();
          this.accept(this.suggestions[Math.max(this.sel, 0)]);
        } else if (open && e.key === 'Escape') {
          // 選んでいる候補があれば選ぶのをやめる。もう一度押すと候補を閉じる
          if (this.sel >= 0) {
            this.sel = -1;
            this.renderSuggest();
          } else this.closeSuggest();
        } else if (e.key === 'Enter' || (e.key === 'c' && e.ctrlKey && !window.getSelection()?.toString())) {
          e.preventDefault();
          const cancelled = e.key !== 'Enter';
          this.abortRead = null;
          this.input.removeEventListener('keydown', onKey);
          this.input.value = '';
          this.setPrompt([]);
          this.setEnabled(false);
          this.print([...prompt, { t: cancelled ? `${v}^C` : v, c: 'typed' }], 'echo');
          resolve(cancelled ? '' : v);
        } else if (e.key === 'Tab') {
          e.preventDefault();
          if (!opts.complete) return;
          const res = opts.complete(v);
          if (res.candidates) this.print(res.candidates.join('  '));
          this.input.value = res.value;
          this.refreshSuggest();
        } else if (e.key === 'ArrowUp' && hIndex > 0) {
          e.preventDefault();
          if (hIndex === history.length) draft = v;
          this.input.value = history[--hIndex];
        } else if (e.key === 'ArrowDown' && hIndex < history.length) {
          e.preventDefault();
          hIndex++;
          this.input.value = hIndex === history.length ? draft : history[hIndex];
        } else if (e.key === 'l' && e.ctrlKey) {
          e.preventDefault();
          this.clear();
        }
      };
      this.input.addEventListener('keydown', onKey);
    });
  }

  // ---- 入力候補 ----

  private refreshSuggest() {
    const v = this.input.value;
    this.suggestions = this.suggestFn && (!this.input.disabled || this.demoing) ? this.suggestFn(v) : [];
    this.sel = -1;
    this.renderSuggest();
  }

  private renderSuggest() {
    this.suggestEl.replaceChildren(
      ...this.suggestions.map((s, i) => {
        const li = el('li', i === this.sel ? 'sel' : '');
        li.setAttribute('role', 'option');
        if (s.icon) li.append(spriteImg(s.icon.replace(/^char:/, ''), 'icon'));
        const label = el('span', 'sg-label');
        label.textContent = s.label;
        li.append(label);
        if (s.desc) {
          const d = el('span', 'sg-desc');
          d.textContent = s.desc;
          li.append(d);
        }
        li.addEventListener('mousedown', (e) => {
          e.preventDefault();
          this.accept(s);
        });
        return li;
      }),
    );
    // 候補の行はいつも場所を空けておく（hidden にしない）。選んだ候補が見えるように横へスクロールする
    const sel = this.suggestEl.querySelector<HTMLElement>('.sel');
    if (sel) this.suggestEl.scrollLeft = Math.max(0, sel.offsetLeft - this.suggestEl.offsetLeft - this.suggestEl.clientWidth / 2 + sel.offsetWidth / 2);
    else this.suggestEl.scrollLeft = 0;
    this.updateArrows();
  }

  /** 左右に、まだ見えていない候補があるときだけ矢印を出す */
  private updateArrows() {
    const s = this.suggestEl;
    this.arrowL.classList.toggle('show', s.scrollLeft > 1);
    this.arrowR.classList.toggle('show', s.scrollLeft + s.clientWidth < s.scrollWidth - 1);
  }

  private accept(s: Suggestion) {
    this.input.value = s.value;
    this.input.focus();
    this.refreshSuggest();
  }

  private closeSuggest() {
    this.suggestions = [];
    this.renderSuggest();
  }

  private setEnabled(on: boolean) {
    this.input.disabled = !on;
    this.inputLine.classList.toggle('waiting', !on);
    if (!on) this.closeSuggest();
  }

  private scroll() {
    this.log.scrollTop = this.log.scrollHeight;
  }
}

export function el(tag: string, cls: string): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
}

function segs(line: Seg[]): HTMLElement[] {
  return line.map((s) => {
    const span = document.createElement('span');
    span.textContent = s.t;
    if (s.c) span.className = s.c;
    return span;
  });
}
