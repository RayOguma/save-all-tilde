import { describe, expect, it } from 'vitest';
import commandsYaml from '../scenario/commands.yaml?raw';
import ch0Yaml from '../scenario/ch0.yaml?raw';
import ch1Yaml from '../scenario/ch1.yaml?raw';
import ch2Yaml from '../scenario/ch2.yaml?raw';
import ch3Yaml from '../scenario/ch3.yaml?raw';
import ch4Yaml from '../scenario/ch4.yaml?raw';
import ch5Yaml from '../scenario/ch5.yaml?raw';
import ch6Yaml from '../scenario/ch6.yaml?raw';
import ch7Yaml from '../scenario/ch7.yaml?raw';
import ch8Yaml from '../scenario/ch8.yaml?raw';
import { stateAtChapter } from '../src/checkpoint';
import { loadScenario } from '../src/scenario';
import { diffLines, Shell, splitPipe, type Term } from '../src/shell';
import type { GameState } from '../src/state';
import { msgText, type Line, type Msg } from '../src/text';

class FakeTerm implements Term {
  out: string[] = [];
  effects: string[] = [];
  print(line: Line = '') {
    this.out.push(typeof line === 'string' ? line : line.map((s) => s.t).join(''));
  }
  async say(msgs: Msg[], _instant?: boolean) {
    for (const m of msgs) {
      if (m.kind === 'fx') this.effects.push(m.text);
      else this.print(msgText(m));
    }
  }
  clear() {
    this.out = [];
  }
  async effect(name: string) {
    this.effects.push(name);
  }
  async readLine() {
    return '';
  }
  take(): string {
    const s = this.out.join('\n');
    this.out = [];
    return s;
  }
}

const load = () =>
  loadScenario([ch0Yaml, ch1Yaml, ch2Yaml, ch3Yaml, ch4Yaml, ch5Yaml, ch6Yaml, ch7Yaml, ch8Yaml], commandsYaml);

/** 第7章を終えて、記憶の書庫に着いたところから */
function setup(st?: GameState) {
  const scn = load();
  st ??= stateAtChapter(scn, 8, { name: 'ユウ', gender: 'boy' });
  const term = new FakeTerm();
  const toasts: string[] = [];
  const shell = new Shell(scn, st, term, { restart() {}, update() {}, toast: (t) => toasts.push(t) });
  shell.arriveAtChapterStart();
  const run = async (cmd: string) => {
    await shell.exec(cmd);
    return term.take();
  };
  return { scn, st, term, shell, run, toasts };
}

describe('第8章', () => {
  it('第7章をクリアすると第8章。記憶の書庫は、本棚の枠と「湖上の社」', () => {
    const { shell, st } = setup();
    expect(shell.chapter().no).toBe(8);
    expect(st.cwd).toEqual(['var', 'log']);
    expect(shell.currentPlace().theme).toBe('library');
    expect(shell.currentPlace().bgm).toBe('湖上の社');
    // 「章を選ぶ」で始めても、自分の記録には、これまでの言葉が残っている
    expect(st.history).toContain('kill .モリビト');
    expect(st.history).toContain('kill 0999');
  });

  it('最初から最後まで通しで遊べる', async () => {
    const { st, run, term, toasts, shell } = setup();

    expect(await run('ls')).toContain('シスロ');
    expect(await run('cat 書庫の掟')).toContain('.1 をつけ');

    // 番人シスロ。grep を覚えて、仲間になる。森で * を使ったことも、記録で知っている
    const syslo = await run('cat シスロ');
    expect(syslo).toContain('探したい言葉と、探す記録の名前');
    expect(syslo).toContain('この書庫に記録されています');
    expect(syslo).toContain('スドウ様の歩みだけは'); // 行き先を聞かれて、先にスドウのことに答える
    expect(toasts).toContain('📖 手帳に「grep」が追加された');
    expect(await run('ls')).not.toContain('シスロ'); // ついてきてくれる
    expect(await run('cat シスロ')).toContain('スドウ');

    // 守り人の棚は、書庫番の組の者しか入れない
    expect(await run('cd 守り人の棚')).toContain('書庫番の組の者しか');

    // 村々の記録を、言葉で探す
    await run('cd 村々の記録');
    const one = await run('grep モリビト チルダ村.log');
    expect(one).toContain('7月12日 09:00 モリビト、停止');
    expect(one).not.toContain('チルダ村.log:'); // 1つなら、記録の名前は出ない
    // 伏線: 7月11日の夜の一行だけ、読めない
    expect(await run('cat チルダ村.log')).toContain('何度書き直しても');
    const all = await run('grep モリビト *.log');
    expect(all).toContain('ムラガレ.log:7月12日 09:00 モリビト、停止');
    expect(all).toContain('書庫.log:7月15日 16:20 スドウ、モリビトの記録を書き換える');
    expect(all).not.toContain('ナノ、朝のパン'); // モリビトを含まない行は出ない
    expect(all).toContain('書庫番の組に入れて');
    expect(await run('groups')).toContain('書庫番');
    expect(await run('grep スドウ *.log')).toContain('宿場の人々を包みにまとめる');
    expect(await run('grep 庵 *.log')).not.toContain('庵へ帰る'); // 行き先は、記録からは分からない

    // 守り人の記録。作成者が「不明」
    await run('cd ../守り人の棚');
    expect(await run('ls')).not.toContain('.守り人.log.1');
    const rec = await run('cat 守り人.log');
    expect(rec).toContain('作成者: 不明');
    expect(rec).toContain('隠されておるのやもしれぬ');
    expect(rec).toContain('原本は、作成者の手元に置く決まり'); // 何の原本かを、先に教わる

    // ls -a で、隠された古い版。diff を覚える
    const hidden = await run('ls -a');
    expect(hidden).toContain('.守り人.log.1');
    expect(toasts).toContain('📖 手帳に「diff」が追加された');

    // 見比べる。スドウが作り、一度止め、動かしなおした
    const d = await run('diff .守り人.log.1 守り人.log');
    expect(d).toContain('2c2\n< 作成者: スドウ\n---\n> 作成者: 不明');
    expect(d).toContain('< 記: 作成者みずから、一度だけ守り人を止めたことがある');
    expect(d).toContain('モリビトは直せる');

    // 昔の記録。直すには、設計図と、作成者の鍵束
    await run('cd ../昔の記録');
    const old = await run('grep モリビト *.log');
    expect(old).toContain('十年前.log:4月13日 09:00 モリビト、ふたたび動きだす');
    expect(old).toContain('かばんに入れたままだ');

    // かばんに、設計図はある（ls 場所 のおさらい）
    const bag = await run('ls ~/かばん');
    expect(bag).toContain('設計図.tar.gz');
    expect(bag).toContain('スドウに会えば、モリビトを直せる');
    expect(bag).toContain('札の行き先は、スドウ様の住まいのはず'); // 原本は、作成者の手元に置く決まり

    // 守り人の原本の札は、作成者（スドウ）の住まい /root を指している（file のおさらい）
    expect(await run('cd /var/log/奥の間')).toContain('閉ざされている');
    await run('cd /var/log/守り人の棚');
    const origin = await run('file 守り人の原本');
    expect(origin).toContain('broken symbolic link to /root/庵/守り人の原本');
    expect(origin).toContain('スドウ様は、庵にいらっしゃる');
    expect(await run('ls')).toContain('守り人の原本'); // 札は、抜かずに残す

    // 奥の間。自分の記録
    expect(await run('cd /var/log/奥の間')).toContain('ひとつ残らず');
    expect(shell.currentPlace().bgm).toBe('レクイエム');
    expect(await run('cat スドウの記録')).toContain('破り取られている'); // スドウの歩みは、消されている
    expect(await run('cat きみの記録')).toContain('history');
    const hist = await run('history');
    expect(hist).toContain('kill .モリビト');
    expect(hist).toContain('あの日の言葉を、自分の目で確かめておきたい');
    expect(hist).toContain('あなたが、モリビトを');

    // | で、kill の行だけ。記録の影が襲い、首飾りが守る
    const kills = await run('history | grep kill');
    expect(kills).toMatch(/\d+\s+kill \.モリビト/);
    expect(kills).toMatch(/\d+\s+kill 0999/);
    expect(kills).not.toContain('cat シスロ');
    expect(kills).toContain('オマエガ……トメタ');
    expect(kills).toContain('首飾りが、まばゆく光った');
    expect(kills).toContain('モリビトを動かしなおし、チルダ村を元に戻すため'); // 旅の目的を思い出す
    expect(term.effects).toEqual(expect.arrayContaining(['shadow', 'light', 'chapterEnd']));
    expect(st.flags.ch8_clear).toBe(true);
    expect(shell.currentObjective()).toContain('制作中');
  });

  it('ls -a を先にしてから記録を読んでも、diff を教わって進める', async () => {
    const { run, st } = setup();
    await run('cat シスロ');
    await run('cd 村々の記録');
    await run('grep モリビト *.log');
    await run('cd ../守り人の棚');
    await run('ls -a');
    expect(st.flags.told_diff).toBeUndefined();
    expect(await run('cat 守り人.log')).toContain('隠れてた');
    expect(st.flags.told_diff).toBe(true);
    expect(await run('diff 守り人.log .守り人.log.1')).toContain('> 作成者: スドウ'); // 逆に見比べても
  });

  it('ls -l で札の正体を見破っても進める', async () => {
    const { run, st } = setup();
    await run('cat シスロ');
    await run('cd 村々の記録');
    await run('grep モリビト *.log');
    await run('cd ../守り人の棚');
    await run('cat 守り人.log');
    await run('ls -a');
    await run('diff .守り人.log.1 守り人.log');
    await run('cd ../昔の記録');
    await run('grep スドウ *.log'); // スドウで探しても
    expect(st.flags.restart_known).toBe(true);
    await run('ls ~/かばん');
    await run('cd ../守り人の棚');
    expect(await run('ls -l')).toContain('守り人の原本 -> /root/庵/守り人の原本');
    expect(st.flags.found_origin).toBe(true);
  });

  it('grep・diff の使いかたをまちがえたとき', async () => {
    const { run, st } = setup();
    st.learned.push('grep', 'diff');
    expect(await run('grep')).toContain('探したい言葉');
    expect(await run('grep モリビト')).toContain('探す記録の名前');
    expect(await run('grep モリビト シスロ')).toContain('字の書かれた記録や紙ではない');
    expect(await run('grep モリビト 村々の記録')).toContain('ディレクトリです');
    expect(await run('grep だれもいない 村々の記録/*.log')).toContain('見つからなかった');
    expect(await run('diff 書庫の掟')).toContain('2つ');
    expect(await run('diff 書庫の掟 書庫の掟')).toContain('まったく同じ');
    expect(await run('ls | cat')).toContain('grep だけ');
  });

  it('| のうしろの入力候補は、そこからのコマンドとして出る', () => {
    const { shell, st } = setup();
    st.learned.push('grep');
    expect(shell.suggest('history | gr').map((s) => s.value)).toContain('history | grep ');
    expect(shell.suggest('grep モ')).toEqual([]); // 探す言葉の場所には、紙の名前を出さない
  });

  it('記録の history は、kill の行を古くなっても消さない', async () => {
    const { st, run } = setup();
    st.history = ['kill .モリビト', ...Array.from({ length: 999 }, () => 'ls')];
    await run('pwd');
    expect(st.history.length).toBe(1000);
    expect(st.history[0]).toBe('kill .モリビト');
    expect(st.history.at(-1)).toBe('pwd');
  });

  it('diff と | の読み方', () => {
    expect(diffLines(['a', 'b', 'c'], ['a', 'x', 'c'])).toEqual(['2c2', '< b', '---', '> x']);
    expect(diffLines(['a', 'b', 'c'], ['a', 'c'])).toEqual(['2d1', '< b']);
    expect(diffLines(['a', 'c'], ['a', 'b', 'c'])).toEqual(['1a2', '> b']);
    expect(diffLines(['a'], ['a'])).toEqual([]);
    expect(splitPipe('history | grep kill')).toEqual(['history', 'grep kill']);
    expect(splitPipe('echo "a|b"')).toEqual(['echo "a|b"']);
  });
});
