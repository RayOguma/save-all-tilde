import { describe, expect, it } from 'vitest';
import commandsYaml from '../scenario/commands.yaml?raw';
import ch0Yaml from '../scenario/ch0.yaml?raw';
import ch1Yaml from '../scenario/ch1.yaml?raw';
import ch2Yaml from '../scenario/ch2.yaml?raw';
import ch3Yaml from '../scenario/ch3.yaml?raw';
import ch4Yaml from '../scenario/ch4.yaml?raw';
import ch5Yaml from '../scenario/ch5.yaml?raw';
import ch6Yaml from '../scenario/ch6.yaml?raw';
import { buildMap } from '../src/map';
import { loadScenario } from '../src/scenario';
import { Shell, type Term } from '../src/shell';
import { newState } from '../src/state';
import { msgText, type Line, type Msg } from '../src/text';

class FakeTerm implements Term {
  out: string[] = [];
  effects: string[] = [];
  print(line: Line = '') {
    this.out.push(typeof line === 'string' ? line : line.map((s) => s.t).join(''));
  }
  async say(msgs: Msg[], _instant?: boolean) {
    msgs.forEach((m) => this.print(msgText(m)));
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

/** 第0章を終えて、森の入口に立ったところから */
function setup() {
  const scn = loadScenario([ch0Yaml, ch1Yaml, ch2Yaml, ch3Yaml, ch4Yaml, ch5Yaml, ch6Yaml], commandsYaml);
  const st = newState('ユウ', 'boy', ['usr'], [...scn.startCommands, 'pwd', 'ls -a', 'kill']);
  Object.assign(st.flags, {
    morihito_killed: true,
    saw_mom_frozen: true,
    quest_given: true,
    world_revealed: true,
    ch0_clear: true,
  });
  st.discovered.push('/', '/home', '/usr');
  const term = new FakeTerm();
  const toasts: string[] = [];
  const shell = new Shell(scn, st, term, { restart() {}, update() {}, toast: (t) => toasts.push(t) });
  const run = async (cmd: string) => {
    await shell.exec(cmd);
    return term.take();
  };
  const marks = () => buildMap(shell).filter((r) => r.mark).map((r) => r.label);
  return { scn, st, term, shell, run, toasts, marks };
}

describe('第1章', () => {
  it('第0章をクリアすると第1章になる', () => {
    const { shell } = setup();
    expect(shell.chapter().no).toBe(1);
    expect(shell.currentPlace().theme).toBe('forest');
    expect(shell.currentPlace().drained).toBe(false); // 森には色がある
  });

  it('村はモリビトが止まったまま、色が抜けてどす黒い空', async () => {
    const { shell, run } = setup();
    await run('cd ~');
    expect(shell.currentPlace()).toMatchObject({ theme: 'dusk', drained: true });
  });

  it('最初から最後まで通しで遊べる', async () => {
    const { st, run, term, toasts, shell, marks } = setup();

    await run('ls');
    expect(marks()).toEqual(['リス']);
    expect(await run('cat リス')).toContain('見ようとしない人には見えない');
    expect(shell.currentObjective()).toContain('森の精');
    expect(marks()).toEqual(['大きな切り株']); // 隠れたコダマへ続く場所に「!」

    // コダマは ls -a でしか見えない
    await run('cd 大きな切り株');
    expect(await run('ls')).not.toContain('コダマ');
    expect(marks()).toEqual(['フクロウ']); // 見えるところで迷わないよう、フクロウに「!」
    // ls -a は第0章で習っているので、フクロウは言葉では言わずに思い出させる
    const owl = await run('cat フクロウ');
    expect(owl).toContain('隠れたもの');
    expect(owl).not.toContain('ls -a');
    expect(owl).not.toContain('霧の谷'); // 精霊を探しているときは、精霊の話だけ
    expect(await run('cat フクロウ')).toContain('隠れたもの'); // 2回目も教えてくれる
    expect(await run('ls -a')).toContain('.コダマ');
    expect(marks()).toEqual(['.コダマ']); // 見つけたら、フクロウの「!」は消える
    const meet = await run('cat .コダマ');
    expect(meet).toContain('われはコダマ');
    expect(meet).toContain('find /usr -name 鈴'); // はじめから森の入口から探すよう教わる
    expect(toasts).toContain('📖 手帳に「find」が追加された');

    // find はその場所から下しか探さない
    const here = await run('find . -name 鈴');
    expect(here).toContain('何も見つからなかった');
    expect(here).toContain('森の入口');
    expect(await run('find . -name 鈴')).not.toContain('森の入口'); // 案内は1回だけ
    const bellFound = await run('find /usr -name 鈴');
    expect(bellFound.split('\n')[0]).toBe('/usr/倒木/うろ/枯れ葉の山/鈴');
    expect(bellFound).toContain('取ってきてはくれぬか'); // 見つけたら、取りに行くよう頼まれる
    expect(shell.currentObjective()).toContain('鈴を取りに');
    expect(marks()).toEqual([]); // 探し物には「!」を付けない

    await run('cd /usr/倒木/うろ/枯れ葉の山');
    expect(await run('cat 鈴')).toContain('cd - と唱える');
    expect(toasts).toContain('📖 手帳に「cd -」が追加された');
    expect(await run('ls')).not.toContain('鈴');
    expect(marks()).toEqual(['大きな切り株']);
    // cd - で、さっきいた切り株へ一気に戻れる
    expect(await run('cd -')).toBe('/usr/大きな切り株');
    expect(st.cwd).toEqual(['usr', '大きな切り株']);

    // 鈴を返すと、チリーン
    const bell = await run('cat /usr/大きな切り株/.コダマ');
    expect(bell).toContain('チリーン');
    expect(bell).toContain('find . -name 首飾り'); // find . と find /usr のちがいを教わる
    expect(bell).toContain('わかった！ 探してみるよ！');
    expect(bell).not.toContain('道しるべ'); // 道しるべの話は、首飾りを見せてから
    expect(term.effects).toContain('bell');
    expect(shell.currentObjective()).toContain('首飾り');
    expect(await run('cat .コダマ')).toContain('find . -name 首飾り'); // もう一度話しても、首飾りの話

    // 切り株の下だけを探せば、首飾りが見つかる。道しるべは切り株の下にはない
    expect(marks()).toEqual([]);
    expect(await run('find . -name 首飾り')).toBe('./根っこ/根の奥/土のくぼみ/首飾り');
    expect(marks()).toEqual(['根っこ']); // 見つけたら「!」
    expect(await run('find . -name "道しるべ*"')).not.toContain('道しるべ_');
    expect(await run('cat ./根っこ/根の奥/土のくぼみ/首飾り')).toContain('ちゃんと見つかった');
    expect(marks()).toEqual(['.コダマ']);

    // 首飾りを見せると、道しるべの話。1回目は * のことだけ
    const signTalk = await run('cat .コダマ');
    expect(signTalk).toContain('災いから守って');
    expect(signTalk).toContain('道しるべ*');
    expect(signTalk).not.toContain('find /usr -name "道しるべ*"'); // どこから探すかは自分で考える
    expect(toasts).toContain('📖 手帳に「find *」が追加された');
    expect(await run('cat .コダマ')).toContain('find /usr -name "道しるべ*"'); // もう一度話すと教えてくれる

    expect(marks()).toEqual([]); // 探す前は、道しるべの場所に「!」はない
    // * で道しるべを3枚まとめて探し、cd せずに読む
    const signs = (await run('find /usr -name "道しるべ*"')).split('\n');
    expect(signs).toEqual(['/usr/茂み/茂みの奥/小さな茂み/道しるべ_西', '/usr/小川/野営のあと/道しるべ_北', '/usr/小川/水辺/道しるべ_東']);
    // 見つけた道しるべへ続く場所に「!」
    expect(marks()).toEqual(expect.arrayContaining(['茂み', '小川']));
    // 道しるべを集めても、門のある崖の下には行っていない（門は find -type d で見つける）
    expect(st.visited.some((p) => p.includes('崖の下'))).toBe(false);
    // 深い霧は迷路。門はずっと奥にある
    await run('cd /usr/霧の谷/深い霧');
    expect(await run('ls')).toBe('白い霧/  灰色の霧/  濃い霧/  冷たい霧/');
    await run('cd /usr');

    // 道しるべを読む前は、門は霧で通れない
    expect(await run('cd /usr/霧の谷/深い霧/濃い霧/霧の小道/崖の下/岩かげ/苔むした門')).toContain('霧が深くて');
    for (const p of signs.slice(0, 2)) await run(`cat ${p}`);
    expect(marks()).toEqual(['小川']); // 読んだ道しるべの「!」は消える（残りは東）
    const last = await run(`cat ${signs[2]}`);
    expect(last).toContain('出口は 苔むした 門のむこう');
    expect(last).toContain('-type d');
    expect(toasts).toContain('📖 手帳に「find -type d」が追加された');

    // -type d がないと、日記や絵もまざる
    const all = await run('find /usr -name "*門*"');
    expect(all).toContain('門番の日記');
    expect(all).toContain('じゃあ、行こう'); // 門も見つかったので、コダマと行こうと話す（どれが門かも教わる）
    expect(shell.currentObjective()).toContain('苔むした門へ');
    const gate = await run('find /usr -type d -name "*門*"');
    expect(gate).toBe('/usr/霧の谷/深い霧/濃い霧/霧の小道/崖の下/岩かげ/苔むした門'); // 会話は1回だけ

    // 出口。コダマが仲間になる
    const exit = await run('cd /usr/霧の谷/深い霧/濃い霧/霧の小道/崖の下/岩かげ/苔むした門');
    expect(exit).toContain('スドウ、と名乗っていた');
    expect(st.flags.ch1_clear).toBe(true); // 「完」は章の終わりの画面で出す
    expect(term.effects).toContain('chapterEnd');
    expect(shell.party().map((c) => c.node.name)).toEqual(['コダマ']);
    expect(st.flags.ch1_clear).toBe(true);
    // 門をくぐると、沼の入口へ出る
    expect(st.cwd).toEqual(['lib']);
    expect(shell.chapter().no).toBe(2);
    expect(shell.currentPlace().theme).toBe('swamp');
  });

  it('仲間のコダマとは、どこにいても話せる。場所でせりふが変わる', async () => {
    const { st, run, shell } = setup();
    st.flags.kodama_joined = true;
    expect(await run('cat コダマ')).toContain('この森とも、しばしの別れ');
    await run('cd ~/パン屋');
    expect(await run('cat コダマ')).toContain('時が、止まっておるな');
    expect(shell.suggest('cat コ').map((s) => s.label)).toContain('コダマ');
    // 切り株にいた .コダマ はもういない
    expect(await run('ls -a /usr/大きな切り株')).not.toContain('.コダマ');
  });

  it('つづきからのとき、前回の最後の指示と目的をもう一度出す', async () => {
    const { st, run, shell } = setup();
    await run('cd 大きな切り株');
    await run('ls -a');
    await run('cat .コダマ');
    await run('cat フクロウ'); // 寄り道の会話では上書きされない
    await run('find /usr -name 鈴');
    await run('cat /usr/倒木/うろ/枯れ葉の山/鈴');
    await run('cat /usr/大きな切り株/.コダマ');
    await run('cat /usr/大きな切り株/根っこ/根の奥/土のくぼみ/首飾り');
    await run('cat /usr/大きな切り株/.コダマ');
    await run('cat /usr/小川/水辺/道しるべ_東');
    await run('cat /usr/大きな切り株/.コダマ'); // 2回目の同じ会話でも上書きされない
    await run('cat /usr/倒木/うろ/枯れ葉の山/どんぐり');
    expect(st.recap?.join('\n')).toContain('道しるべ*');

    const term = new FakeTerm();
    const again = new Shell(shell.scenario, st, term, { restart() {}, update() {}, toast() {} });
    await again.recap();
    const out = term.take();
    expect(out).toContain('前回のつづき');
    expect(out).toContain('道しるべ*');
    expect(out).toContain('🎯 目的: 3枚の道しるべを探そう');
  });

  it('cd - は、ひとつ前にいた場所と行ったり来たりする', async () => {
    const { st, run } = setup();
    expect(await run('cd -')).toContain('戻る場所が、まだない');
    await run('cd /usr/倒木/うろ');
    expect(await run('cd -')).toBe('/usr');
    expect(await run('cd -')).toBe('/usr/倒木/うろ');
    await run('cd ..'); // ひとつ上（倒木）。cd - とはちがう
    expect(st.cwd).toEqual(['usr', '倒木']);
    expect(await run('cd -')).toBe('/usr/倒木/うろ');
  });

  it('フクロウが「ls 場所」でのぞいてから進むよう教えてくれる（ls 場所 は第0章のピコで覚える）', async () => {
    const { run } = setup();
    expect(await run('cat /usr/大きな切り株/フクロウ')).toContain('ls /usr/霧の谷');
    expect(await run('ls /usr/霧の谷')).toContain('深い霧/');
  });

  it('先にコダマに会っていても、フクロウの1回目は「ls 場所」の話', async () => {
    const { st, run, shell } = setup();
    st.flags.met_kodama = true;
    expect(await run('cat /usr/大きな切り株/フクロウ')).toContain('ls のうしろに場所を書けば');
    expect(await run('cat /usr/大きな切り株/フクロウ')).toContain('唱えた場所から下しか');
    // cd - を覚えたら、入力候補にも出る
    st.learned.push('cd -');
    await run('cd /usr/倒木');
    expect(shell.suggest('cd ').map((s) => s.label)).toContain('-');
  });

  it('仲間がいると、ヒントは仲間の声になる', async () => {
    const { st, run } = setup();
    st.flags.kodama_joined = true;
    expect(await run('hint')).toMatch(/^コダマ: /);
  });

  it('苔の道で迷っても、pwd と cd .. で戻れる', async () => {
    const { st, run } = setup();
    for (let i = 0; i < 4; i++) await run('cd 苔の道');
    expect((await run('pwd')).split('\n')[0]).toBe('/usr/苔の道/苔の道/苔の道/苔の道');
    expect(await run('cat 迷子のメモ')).toContain('pwd と唱えよ');
    await run('cd ..');
    expect(st.cwd).toEqual(['usr', '苔の道', '苔の道', '苔の道']);
  });

  it('find の書き方の間違いを教えてくれる', async () => {
    const { run, st } = setup();
    st.learned.push('find');
    expect(await run('find /usr -name')).toContain('-name のあとに値が必要');
    expect(await run('find /usr -type x')).toContain('d（場所）か f（人やもの）');
    expect(await run('find /usr -size 1')).toContain('まだ知らない');
    expect(await run('find /どこか -name 鈴')).toContain('そのようなファイルやディレクトリはありません');
  });

  it('find -type f は人やものだけ', async () => {
    const { run, st } = setup();
    st.learned.push('find');
    const out = await run('find /usr/霧の谷 -type f -name "門*"');
    expect(out.split('\n').sort()).toEqual(['/usr/霧の谷/門の絵', '/usr/霧の谷/門番の日記']);
  });
});
