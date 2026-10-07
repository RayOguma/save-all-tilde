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
import { newState, type GameState } from '../src/state';
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

/** 第2章を終えて、ムラガレに着いたところから */
function setup(st?: GameState) {
  const scn = loadScenario([ch0Yaml, ch1Yaml, ch2Yaml, ch3Yaml, ch4Yaml, ch5Yaml, ch6Yaml], commandsYaml);
  st ??= (() => {
    const s = newState('ユウ', 'girl', ['home', 'ムラガレ'], [
      ...scn.startCommands, 'pwd', 'ls -a', 'kill', 'find', 'find -name', 'find *', 'find -type d', 'cd -', 'ls 場所',
      'ls -l', 'file', 'ln', 'unlink',
    ]);
    Object.assign(s.flags, {
      morihito_killed: true, saw_mom_frozen: true, quest_given: true, ch0_clear: true,
      kodama_joined: true, ch1_clear: true, reached_far_shore: true, ch2_clear: true,
    });
    s.discovered.push('/', '/home', '/usr', '/lib', '/home/ムラガレ');
    return s;
  })();
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

describe('第3章', () => {
  it('第2章をクリアすると第3章', () => {
    const { shell } = setup();
    expect(shell.chapter().no).toBe(3);
    expect(shell.currentPlace()).toMatchObject({ theme: 'dusk', drained: true, glitchy: false });
  });

  it('最初から最後まで通しで遊べる', async () => {
    const { st, run, term, toasts, shell, marks } = setup();

    // 家々は閉ざされている
    await run('ls');
    expect(await run('cd 薬屋')).toContain('Permission denied');
    expect(marks()).toEqual(['ハル']);

    // ハルは咳をしている。兄の話は、まだ出ない（グロウプ婆が空き家で話す）
    const haru = await run('cat ハル');
    expect(haru).toContain('グロウプ婆に会うといいよ');
    expect(haru).not.toContain('兄');

    // グロウプ婆に鍵の読み方を教わり、空き家を譲られる
    await run('cd グロウプ婆の家');
    const groupu = await run('cat グロウプ婆');
    expect(groupu).toContain('r は、窓から中をのぞける');
    expect(groupu).toContain('先頭の一文字は鍵ではない'); // drwx------ の d も説明する
    expect(groupu).not.toContain('うちだけではない');
    expect(groupu).toContain('「だれの」「開けるか閉めるか」「どの鍵を」'); // chmod の唱え方を、順に教える
    expect(groupu).toContain('chmod u+rwx ../空き家');
    expect(groupu).toContain('お前の村の長も、そういう名だろう');
    expect(toasts).toContain('📖 手帳に「chmod」が追加された');
    expect(await run('ls -l /home/ムラガレ')).toMatch(/d---------\s+きみ\s+ムラガレ\s+空き家\//);

    // 他人の家の鍵は変えられない
    expect(await run('chmod o+x /home/ムラガレ/薬屋')).toContain('Operation not permitted');

    // 自分の家は chmod で開けられる。x がつくまでは入れない
    expect(await run('chmod u+r /home/ムラガレ/空き家')).toContain('まだ中へは入れぬ');
    const unlocked = await run('chmod u+rwx /home/ムラガレ/空き家');
    expect(unlocked).toContain('錠がはずれる');
    expect(unlocked).toContain('入ってみるがよい');
    expect(shell.currentObjective()).toContain('空き家に入ってみよう');
    expect(await run('ls -l /home/ムラガレ')).toMatch(/drwx------\s+きみ\s+ムラガレ\s+空き家\//);
    const akiya = await run('cd /home/ムラガレ/空き家');
    expect(akiya).toContain('この村の一員じゃ');
    expect(akiya).toContain('グロウプ婆: write ユウ'); // 扉の外から write で話しかけてくる
    expect(akiya).toContain('鍛冶屋'); // ハルの兄の話は、ここで
    expect(akiya).toContain('ハルの薬を、頼んでみてくれんか'); // ハルのために薬を頼まれる
    expect(toasts).toContain('📖 手帳に「write」が追加された');
    expect(await run('groups')).toBe('きみ ムラガレ');

    // write で薬屋のじいさんに声を届ける。書いた言葉で反応が変わる
    expect(await run('write 薬屋のじいさん "こんにちは"')).toContain('用件はなんじゃ');
    expect(await run('write 薬屋のじいさん "早く開けろ"')).toContain('口のきき方');
    const asked = await run('write 薬屋のじいさん "ハルの薬をください"');
    expect(asked).toContain('咳の音が、ここまで聞こえとった');
    expect(asked).toContain('干した薬草');
    expect(shell.currentObjective()).toContain('物置');

    // 物置は組の者だけ入れる。中はごちゃごちゃで、薬草は find で探す（第1章のおさらい）
    expect(await run('cd /home/ムラガレ/物置')).toContain('森で覚えた言葉');
    expect(await run('cat 干した薬草')).toContain('そのようなファイル'); // 棚の奥にある
    const herb = await run('find . -name "*薬草*"');
    expect(herb).toContain('./棚/下の段/干した薬草');
    expect(herb).toContain('下の段だ');
    expect(await run('cat 棚/下の段/干した薬草')).toContain('ひと束');

    // 薬草を届けると、じいさんが扉を開けてくれる
    const open = await run('write 薬屋のじいさん "薬草を持ってきました"');
    expect(open).toContain('ガチャリ');
    expect(open).toContain('ごりごりと薬を挽く');
    expect(await run('ls -l /home/ムラガレ')).toMatch(/drwx---r-x\s+薬屋のじいさん\s+薬屋のじいさん\s+薬屋\//);
    await run('cd /home/ムラガレ/薬屋');
    const medicine = await run('cat 薬屋のじいさん');
    expect(medicine).toContain('胸の薬を受け取った');
    expect(medicine).toContain('いずれ通ることになろう'); // 坑道へ行く理由
    expect(medicine).toContain('兄の分の薬も、預かった');

    // ハルに薬を届ける
    expect(shell.currentObjective()).toContain('ハルに薬を届けよう');
    const gave = await run('cat /home/ムラガレ/ハル');
    expect(gave).toContain('咳がおさまってきた');
    expect(gave).toContain('顔を出すように言ってたよ'); // グロウプ婆のところへ行く導線
    expect(shell.currentObjective()).toContain('グロウプ婆に知らせよう'); 

    // グロウプ婆に知らせると、コダマと話して章の終わり
    await run('cd /home/ムラガレ/グロウプ婆の家');
    const end = await run('cat グロウプ婆');
    expect(end).toContain('ハルに、薬を届けてくれた');
    expect(end).toContain('なんでこの村へ来なすった'); // 何をしに来たかを聞いてから、行き先を教える
    expect(end).toContain('市場町イチバを通っていく');
    expect(end).not.toContain('賢者');
    expect(end).toContain('偶然とは思えぬ');
    expect(term.effects).toContain('chapterEnd');
    expect(st.flags.ch3_clear).toBe(true);
  });

  it('組に入る前は、物置に入れない（家族の鍵）', async () => {
    const { run } = setup();
    expect(await run('ls -l')).toMatch(/drwxrwx---\s+グロウプ婆\s+ムラガレ\s+物置\//);
    expect(await run('cd 物置')).toContain('Permission denied');
  });

  it('鍛冶場は、のぞけるけど入れない（r だけ）', async () => {
    const { run } = setup();
    expect(await run('ls 鍛冶場')).toContain('坑道へ行ってくる_兄より');
    expect(await run('cd 鍛冶場')).toContain('Permission denied');
  });

  it('chmod の書き方の間違いを教えてくれる', async () => {
    const { run, st } = setup();
    st.learned.push('chmod');
    expect(await run('chmod 空き家')).toContain('鍵のかけ方と名前が必要');
    expect(await run('chmod u+z 空き家')).toContain('分かりません');
  });

  it('グロウプ婆の家から、教わったとおり chmod u+rwx ../空き家 で開けられる', async () => {
    const { run } = setup();
    await run('cat ハル');
    await run('cd グロウプ婆の家');
    await run('cat グロウプ婆');
    expect(await run('chmod u+rwx ../空き家')).toContain('錠がはずれる');
    expect(await run('cd ../空き家')).toContain('この村の一員じゃ');
  });

  it('変えた持ち主・鍵・組は、つづきからでも残る', async () => {
    const a = setup();
    await a.run('cat ハル');
    await a.run('cat グロウプ婆の家/グロウプ婆');
    await a.run('chmod u+rwx 空き家');
    await a.run('cd 空き家');
    const saved: GameState = JSON.parse(JSON.stringify(a.st));
    const b = setup(saved);
    expect(await b.run('ls -l /home/ムラガレ')).toMatch(/drwx------\s+きみ\s+ムラガレ\s+空き家\//);
    expect(await b.run('cd /home/ムラガレ/物置')).not.toContain('Permission denied');
  });

  it('write で、知らない人や返事のない人には届かない', async () => {
    const { run, st } = setup();
    st.learned.push('write');
    expect(await run('write だれか "やあ"')).toContain('見当たらない');
    expect(await run('write ハル "やあ"')).toContain('返事はない');
    expect(await run('write 薬屋のじいさん')).toContain('届けることばが必要');
  });
});
