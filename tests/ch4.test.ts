import { describe, expect, it } from 'vitest';
import commandsYaml from '../scenario/commands.yaml?raw';
import ch0Yaml from '../scenario/ch0.yaml?raw';
import ch1Yaml from '../scenario/ch1.yaml?raw';
import ch2Yaml from '../scenario/ch2.yaml?raw';
import ch3Yaml from '../scenario/ch3.yaml?raw';
import ch4Yaml from '../scenario/ch4.yaml?raw';
import ch5Yaml from '../scenario/ch5.yaml?raw';
import ch6Yaml from '../scenario/ch6.yaml?raw';
import { stateAtChapter } from '../src/checkpoint';
import { buildMap } from '../src/map';
import { loadScenario } from '../src/scenario';
import { Shell, type Term } from '../src/shell';
import type { GameState } from '../src/state';
import { nodeAt } from '../src/vfs';
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

const load = () => loadScenario([ch0Yaml, ch1Yaml, ch2Yaml, ch3Yaml, ch4Yaml, ch5Yaml, ch6Yaml], commandsYaml);

/** 第3章を終えて、市場町イチバに着いたところから */
function setup(st?: GameState, opts: { knowAll?: boolean } = {}) {
  const scn = load();
  st ??= stateAtChapter(scn, 4, { name: 'ユウ', gender: 'boy' });
  // 物語を進めずに、この章のコマンドを試すとき
  if (opts.knowAll) for (const c of ['mv', 'mkdir', 'cp', 'cp -r']) if (!st.learned.includes(c)) st.learned.push(c);
  const term = new FakeTerm();
  const toasts: string[] = [];
  const shell = new Shell(scn, st, term, { restart() {}, update() {}, toast: (t) => toasts.push(t) });
  shell.arriveAtChapterStart();
  const run = async (cmd: string) => {
    await shell.exec(cmd);
    return term.take();
  };
  const marks = () => buildMap(shell).filter((r) => r.mark).map((r) => r.label);
  const labels = () => buildMap(shell).map((r) => r.label);
  return { scn, st, term, shell, run, toasts, marks, labels };
}

describe('第4章', () => {
  it('第3章をクリアすると第4章。市場町イチバは、にぎやかな枠', () => {
    const { shell, st } = setup();
    expect(shell.chapter().no).toBe(4);
    expect(st.cwd).toEqual(['tmp']);
    expect(shell.currentPlace()).toMatchObject({ theme: 'market', drained: false });
  });

  it('最初から最後まで通しで遊べる', async () => {
    const { st, run, term, toasts, shell, marks, labels } = setup();

    // 着いたばかりの市場には、人がいっぱい
    const market = await run('ls');
    expect(market).toContain('アプトの露店/');
    expect(market).toContain('呼びこみの男');
    expect(await run('cat 呼びこみの男')).toContain('アプト');
    expect(marks()).toEqual(['アプトの露店']);

    // アプトに頼まれて、木箱を隣の果物屋へ運ぶ（mv）
    await run('cd アプトの露店');
    await run('ls');
    expect(await run('cat アプト')).toContain('mv 木箱 ../果物屋/');
    expect(toasts).toContain('📖 手帳に「mv」が追加された');
    expect(marks()).toEqual(['木箱']);
    expect(await run('mv アプト ../果物屋/')).toContain('おれは荷物じゃないぞ'); // 人を運ぼうとすると、本人が注意する
    const moved = await run('mv 木箱 ../果物屋/');
    expect(moved).toContain('木箱、届いたよ');
    expect(await run('ls')).not.toContain('木箱'); // 運んだ物は、元の場所からなくなる
    expect(await run('ls ../果物屋')).toContain('木箱');
    expect(marks()).toEqual(['アプト']); // 露店の中にいても、アプト本人に「!」

    // かばんを作る（mkdir）。どこから来たかを聞いてから、ふるさと（~）に作る理由を教わる
    const bagTalk = await run('cat アプト');
    expect(bagTalk).toContain('どこから来たんだい');
    expect(bagTalk).toContain('どこに置いたか忘れちまう');
    expect(bagTalk).toContain('mkdir ~/かばん');
    expect(toasts).toContain('📖 手帳に「mkdir」が追加された');
    const made = await run('mkdir ~/かばん');
    expect(made).toContain('ここから手が届く');
    expect(made).toContain('住所は ~/かばん'); // 使い方の紹介（画面では、枠と吹き出し）
    expect(made).not.toContain('ゲームだけ'); // 特別なしくみではない
    expect(made).not.toContain('ふくらんだ');
    // 露店で作ったら、アプトとの会話がそのままつづく。行き先を聞かれ、山道の関所で要る通行証をもらう
    expect(made).toContain('どこへ向かう');
    expect(made).toContain('関所');
    expect(st.flags.pass_given).toBe(true);
    // 地図では、ほかのステージ（チルダ村）はたたまれている。開くと、かばんが見える
    const opened = buildMap(shell, new Map([['/home/チルダ村', true]]));
    expect(opened.find((r) => r.label === 'かばん')?.icon).toBe('bag');
    expect(await run('mkdir ~/かばん')).toContain('もうある');

    // もらった通行証を、かばんにしまう。かばんには住所（~/かばん）で届く
    expect(marks()).toEqual(['通行証']);
    const stored = await run('mv 通行証 ~/かばん/');
    expect(stored).toContain('通行証を、かばんにしまった');
    expect(stored).toContain('ありがとう、アプト'); // しまってから、お礼を言って地図のことを聞く
    expect(stored).toContain('看板屋のリネ');
    expect(await run('ls ~/かばん')).toBe('通行証');
    expect(await run('ls かばん')).toContain('そのようなファイル'); // 名前だけでは届かない（本物と同じ）
    // この先は地図がいる。困っている人を手伝いながら聞いてまわる
    expect(shell.currentObjective()).toContain('地図のありか');
    expect(marks()).toEqual(['看板屋', '広場']);

    // 書写屋には、まだ用がない（地図のことを知らない）。金庫は鍵が全部閉まっていて、のぞけも入れもしない
    expect(await run('cat /tmp/書写屋/ディディ爺')).not.toContain('cp');
    expect(await run('ls -l /tmp/書写屋')).toContain('drwx------  ディディ爺');
    expect(await run('cd /tmp/書写屋/金庫')).toContain('Permission denied');
    expect(await run('ls /tmp/書写屋/金庫')).toContain('Permission denied');

    // 看板の名前を変える（mv）。地図の名前も変わる。先に手伝ったリネは、地図を知らない
    await run('cd /tmp/看板屋');
    expect(await run('cat リネ')).toContain('mv 八百尾 八百屋');
    await run('cd ..');
    const fixed = await run('mv 八百尾 八百屋');
    expect(fixed).toContain('「八百屋」になってる');
    expect(fixed).toContain('わかんないや');
    expect(labels()).toContain('八百屋');
    expect(labels()).not.toContain('八百尾');
    expect(await run('cat 八百屋/野菜の山')).toContain('立派な八百屋'); // 中身はそのまま

    // 広場に舞台を作る（mkdir）。あとに手伝ったピップが、書写屋を教えてくれる
    await run('cd 広場');
    expect(await run('cat ピップ')).toContain('mkdir 舞台');
    const stage = await run('mkdir 舞台');
    expect(stage).toContain('ほんとうに舞台ができた');
    expect(stage).toContain('ディディ爺さん');
    expect(term.effects).toContain('bell');
    expect(marks()).toEqual(['書写屋']);

    // ディディ爺に、ていねいに頼む → 店の宝 → 村を救うため → 写しなら
    await run('cd /tmp/書写屋');
    const ask = await run('cat ディディ爺');
    expect(ask).toContain('見せていただけませんか');
    expect(ask).toContain('店の宝');
    expect(ask).toContain('村が、止まってしまった');
    expect(ask).toContain('スドウっていう、賢者らしい'); // ここで初めて、スドウの名を出す
    expect(ask).not.toContain('覚え書き');
    // 棚は奥が深いので、地図の巻物を find で探す（第1章のおさらい）
    expect(ask).toContain('森で覚えた find');
    expect(shell.currentObjective()).toContain('find');
    const found = await run('find . -name "*地図*"');
    expect(found).toContain('./棚/奥の段/地図の巻物');
    expect(found).toContain('cp 棚/奥の段/地図の巻物 ~/かばん/');
    const copied = await run('cp 棚/奥の段/地図の巻物 ~/かばん/');
    expect(copied).toContain('元の巻物は、ちゃんと棚に残っておる');
    expect(await run('ls 棚/奥の段')).toContain('地図の巻物');
    expect(await run('cat ~/かばん/地図の巻物')).toContain('廃墟山道');

    // スドウの名を聞いて、ディディ爺が自分の金庫を開けてくれる（持ち主だけが鍵を変えられる）
    expect(copied).toContain('chmod o+rx 金庫');
    expect(await run('ls -l')).toContain('drwx---r-x  ディディ爺');
    expect(marks()).toEqual(['金庫']);
    const vault = await run('cd 金庫');
    expect(vault).toContain('スドウどのの覚え書き');
    expect(toasts).toContain('📖 手帳に「cp -r」が追加された');
    expect(await run('ls')).toBe('スドウの覚え書き/');

    // 覚え書きは場所なので、-r がないと写せない
    expect(await run('cp スドウの覚え書き ~/かばん/')).toContain('-r がないので');
    const notes = await run('cp -r スドウの覚え書き ~/かばん/');
    expect(notes).toContain('束ごと、ちゃんと写せた');
    expect(notes).toContain('宿屋の女将に聞いてみる'); // 宿屋へ行くわけ
    expect(await run('ls ~/かばん/スドウの覚え書き')).toBe('一枚目  二枚目  三枚目');
    expect(await run('cat ~/かばん/スドウの覚え書き/二枚目')).toContain('鍵束');

    // 宿屋の女将から、スドウの噂
    expect(marks()).toEqual(['宿屋']);
    await run('cd /tmp/宿屋');
    const rumor = await run('cat 宿屋の女将');
    expect(rumor).toContain('鍵束');
    expect(rumor).toContain('片づけ番のじいさん');
    expect(await run('cat ~/かばん/地図の巻物')).not.toContain('急ごう'); // 片づけ番に会うまでは、章は終わらない

    // 広場の片づけ番は、弱っている。スドウは山道へ
    expect(shell.currentObjective()).toContain('片づけ番');
    await run('cd /tmp/広場');
    const cleaner = await run('cat 片づけ番');
    expect(cleaner).toContain('朝までに終わらん');
    expect(cleaner).toContain('山道のほうへ');

    // かばんの地図の巻物を読むと、章の終わり
    const end = await run('cat ~/かばん/地図の巻物');
    expect(end).toContain('片づけ番の弱りよう');
    expect(end).not.toContain('売れ残りが、片づかぬ');
    expect(end).toContain('急ごう');
    expect(term.effects).toContain('chapterEnd');
    expect(st.flags.ch4_clear).toBe(true);
  });

  it('舞台を先に作ったら、あとに手伝ったリネが書写屋を教えてくれる', async () => {
    const { run, st } = setup(undefined, { knowAll: true });
    Object.assign(st.flags, { pass_in_bag: true, met_pip: true, met_rine: true });
    expect(await run('mkdir /tmp/広場/舞台')).toContain('来たばかり');
    expect(st.flags.told_dd).toBeUndefined();
    await run('cd /tmp');
    expect(await run('mv 八百尾 八百屋')).toContain('ディディ爺さん');
    expect(st.flags.told_dd).toBe(true);
  });

  it('かばんは住所（~/かばん）で届く。入力候補には、どこにいても出て、選ぶと住所が入る', async () => {
    const { run, shell, st } = setup(undefined, { knowAll: true });
    expect(shell.bagItems()).toBeNull(); // 作る前は、欄も出ない
    expect(shell.suggest('ls かば')).toEqual([]);
    st.flags.told_bag = true;
    await run('mkdir ~/かばん');
    await run('cd /usr');
    expect(await run('ls ~/かばん')).toBe('（何も見当たらない）'); // からっぽ
    expect(await run('ls かばん')).toContain('そのようなファイル'); // 名前だけでは届かない（本物と同じ）
    expect(await run('cd かばん')).toContain('そのようなファイル');
    expect(shell.complete('ls かば').value).toBe('ls かば'); // Tab も本物と同じ
    expect(shell.suggest('ls かば')).toMatchObject([{ label: 'かばん', desc: '~/かばん', value: 'ls ~/かばん/' }]);
    // 仲間とかばんは、いまいる場所の物のあと
    await run('cd /tmp');
    await run('ls');
    const labels = shell.suggest('cd ').map((s) => s.label);
    expect(labels[labels.length - 1]).toBe('かばん');
    const cats = shell.suggest('cat ').map((s) => s.label);
    expect(cats.slice(-2)).toEqual(['コダマ', 'かばん']);
    st.flags.map_copied = true;
    st.perms = { '/tmp/書写屋/金庫': { mode: 'rwx---r-x' } };
    Object.assign(nodeAt(shell.scenario.root, '/tmp/書写屋/金庫')!, { mode: 'rwx---r-x' });
    await run('cp -r /tmp/書写屋/金庫/スドウの覚え書き ~/かばん/');
    expect(shell.bagItems()).toEqual([{ name: 'スドウの覚え書き', icon: 'scroll', dir: true }]);
  });

  it('物語で頼まれていない mkdir・mv・cp・ln はできない（世界を散らかさない）', async () => {
    const { run, st, shell } = setup(undefined, { knowAll: true });
    expect(await run('mkdir /tmp/屋台')).toContain('新しい場所を作る用事はない');
    expect(await run('mv /tmp/アプトの露店/麻袋 /tmp/果物屋/')).toContain('麻袋 を動かす用事はない');
    expect(await run('mv /home/チルダ村/パン屋 /tmp/')).toContain('用事はない');
    expect(await run('cp /tmp/書写屋/棚/奥の段/地図の巻物 /tmp/写し')).toContain('写しをとる用事はない');
    expect(await run('ln -s /usr 近道')).toContain('飛び石を置く用事はない');
    expect(await run('ls /tmp')).not.toContain('屋台');
    expect(await run('ls /tmp')).not.toContain('近道');
    // 人は、頼まれていても荷物ではない
    expect(await run('mv /tmp/アプトの露店/アプト /tmp/果物屋/')).toContain('おれは荷物じゃないぞ');
    expect(await run('mv /tmp/宿屋/宿屋の女将 /tmp/果物屋/')).toContain('宿屋の女将は、荷物じゃない');
    expect(await run('cp /tmp/アプトの露店/アプト /tmp/果物屋/')).toContain('人の写しは、とれない');
    // 名前は合っているのに場所がちがうと、頼んだ人が正しい場所を教えてくれる
    st.flags.told_bag = true;
    await run('cd /tmp/アプトの露店');
    expect(await run('mkdir かばん')).toContain('の中に作るんだ');
    expect(shell.bagItems()).toBeNull();
    expect(await run('ls')).not.toContain('かばん');
    st.flags.met_apt = true;
    expect(await run('mv 木箱 /tmp/広場/')).toContain('隣の果物屋へ頼むよ');
    expect(await run('ls')).toContain('木箱');
  });

  it('作った・運んだ・写した物は、セーブから元に戻る。運んだら、地図の道のりも書きかわる', async () => {
    const a = setup(undefined, { knowAll: true });
    Object.assign(a.st.flags, { met_apt: true, told_bag: true, met_dd: true, met_rine: true });
    await a.run('cd /tmp');
    await a.run('mv アプトの露店/木箱 果物屋/');
    await a.run('mkdir ~/かばん');
    await a.run('cp 書写屋/棚/奥の段/地図の巻物 ~/かばん/');
    await a.run('mv 八百尾 八百屋');
    expect(a.st.discovered).toContain('/tmp/八百屋');
    expect(a.st.discovered).not.toContain('/tmp/八百尾');
    const saved: GameState = JSON.parse(JSON.stringify(a.st));

    const b = setup(saved);
    expect(await b.run('ls ~/かばん')).toBe('地図の巻物');
    expect(await b.run('ls /tmp/果物屋')).toContain('木箱');
    expect(await b.run('ls /tmp')).toContain('八百屋/');
    expect(await b.run('ls /tmp')).not.toContain('八百尾');
  });

  it('写しは中身だけ。「!」などの物語の仕掛けは写さない', async () => {
    const { run, scn, st } = setup(undefined, { knowAll: true });
    Object.assign(st.flags, { told_bag: true, met_dd: true });
    await run('mkdir ~/かばん');
    await run('cp /tmp/書写屋/棚/奥の段/地図の巻物 ~/かばん/');
    const copy = nodeAt(scn.root, '/home/チルダ村/かばん/地図の巻物')!;
    expect(copy.mark).toBeUndefined();
    expect(await run('cat ~/かばん/地図の巻物')).toContain('廃墟山道');
  });

  it('ほかの場所でかばんを作ったら、アプトに話しかけたときに通行証の話になる', async () => {
    const { run, st } = setup(undefined, { knowAll: true });
    Object.assign(st.flags, { met_apt: true, box_moved: true, told_bag: true });
    const made = await run('mkdir ~/かばん'); // 市場の真ん中で作る
    expect(made).toContain('ここから手が届く');
    expect(made).not.toContain('関所');
    expect(st.flags.pass_given).toBeUndefined();
    const talk = await run('cat /tmp/アプトの露店/アプト');
    expect(talk).toContain('関所');
    expect(st.flags.pass_given).toBe(true);
  });

  it('章の clear から、次の章の始まりの状態が作れる（かばんができている）', () => {
    const scn = load();
    const st = stateAtChapter(scn, 4, { name: 'ユウ', gender: 'boy' });
    Object.assign(st, { ops: scn.chapters.find((c) => c.no === 4)!.clear!.ops });
    for (const f of scn.chapters.find((c) => c.no === 4)!.clear!.flags!) st.flags[f] = true;
    const { run } = setup(st);
    return run('ls ~/かばん').then((out) => {
      expect(out).toBe('通行証  地図の巻物  スドウの覚え書き/');
    });
  });
});
