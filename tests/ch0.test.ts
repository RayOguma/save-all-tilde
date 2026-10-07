import { describe, expect, it } from 'vitest';
import commandsYaml from '../scenario/commands.yaml?raw';
import yaml from '../scenario/ch0.yaml?raw';
import ch1Yaml from '../scenario/ch1.yaml?raw';
import ch2Yaml from '../scenario/ch2.yaml?raw';
import ch3Yaml from '../scenario/ch3.yaml?raw';
import ch4Yaml from '../scenario/ch4.yaml?raw';
import ch5Yaml from '../scenario/ch5.yaml?raw';
import ch6Yaml from '../scenario/ch6.yaml?raw';
import { buildMap } from '../src/map';
import { loadScenario } from '../src/scenario';
import { Shell, type Term } from '../src/shell';
import { newState, type Gender } from '../src/state';
import { msgText, type Line, type Msg } from '../src/text';
import type { VNode } from '../src/vfs';

class FakeTerm implements Term {
  out: string[] = [];
  effects: string[] = [];
  /** 画面を照らす説明。ないときは、説明がシステム表示の行として出る */
  guide?: Term['guide'];
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
  /** 直前までの出力を取り出して空にする */
  take(): string {
    const s = this.out.join('\n');
    this.out = [];
    return s;
  }
}

function setup(gender: Gender = 'boy') {
  const scn = loadScenario([yaml, ch1Yaml, ch2Yaml, ch3Yaml, ch4Yaml, ch5Yaml, ch6Yaml], commandsYaml);
  const st = newState('ユウ', gender, scn.start, scn.startCommands);
  const term = new FakeTerm();
  const toasts: string[] = [];
  const shell = new Shell(scn, st, term, { restart() {}, update() {}, toast: (t) => toasts.push(t) });
  const run = async (cmd: string) => {
    await shell.exec(cmd);
    return term.take();
  };
  // 章のはじめのイベント（兄が起こしに来る）
  const open = async () => {
    await shell.opening();
    return term.take();
  };
  const mapLabels = () => buildMap(shell).map((r) => r.label ?? '？？？');
  const marks = () => buildMap(shell).filter((r) => r.mark).map((r) => r.label);
  return { scn, st, term, shell, run, toasts, mapLabels, marks, open };
}

describe('第0章', () => {
  it('最初から最後まで通しで遊べる', async () => {
    const { st, run, term, toasts, shell, marks, open } = setup();
    const at = (...p: string[]) => expect(st.cwd).toEqual(['home', 'チルダ村', ...p]);

    // 自分の部屋で目を覚ます。家の中の枠は木目、外は青空
    at('きみの家', '自分の部屋');
    expect(shell.currentPlace().theme).toBe('wood');
    expect(shell.currentObjective()).toContain('バッシュ');

    // 章のはじめに、兄が起こしに来る。ls・cat {name}・cd 本棚・cd .. をやってみせ、そのままパン屋まで
    const opening = await open();
    expect(opening).toContain('部屋の扉が開いた');
    expect(opening).toContain('バッシュ: ls……っと'); // 呪文をせりふとして言いながら入ってくる
    expect(opening).toContain('ユウ: ……うーん……兄ちゃん……？');
    expect(opening.indexOf('どうやって行くのか、よくわからない')).toBeLessThan(opening.indexOf('バッシュ@moribito')); // 手本は、そのあと
    expect(opening).toContain('バッシュ@moribito:~/きみの家/自分の部屋$ ls');
    expect(opening).toContain('本棚/');
    expect(opening).toContain('バッシュ@moribito:~/きみの家/自分の部屋$ cat 窓');
    expect(opening).toContain('バッシュ@moribito:~/きみの家/自分の部屋$ cd 本棚');
    expect(opening).toContain('基本情報技術者試験の参考書');
    expect(opening).toContain('バッシュ@moribito:~/きみの家/自分の部屋/本棚$ cd ..');
    expect(opening).toContain('入力候補'); // 候補の説明（吹き出し）
    expect(opening).toContain('バッシュ@moribito:~/きみの家$ cd ../パン屋/');
    expect(opening).toContain('Tab キー');
    expect(opening).toContain('焼きたてのパンの香り'); // パン屋に入った
    expect(opening).toContain('ここからは、おまえがやってみな');
    at('パン屋');
    expect(st.history).not.toContain('cd ..'); // 兄が打ったものは、プレイヤーの履歴に残さない
    expect(toasts).toContain('📖 手帳に「cd ..」が追加された');
    expect(shell.party().map((c) => c.node.name)).toEqual(['バッシュ']); // パン屋の間は、ついてくる
    expect(marks()).toEqual(['ナノ']);
    expect(await run('hint')).toContain('バッシュ:'); // ヒントは兄がくれる

    // パン屋でパンを受け取る。兄は「移動はバッチリだな」と言って先に帰る
    const bread = await run('cat ナノ');
    expect(bread).toContain('焼きたてのパンを受け取った');
    expect(bread).not.toContain('バッチリ'); // まだ自分で歩いていないので、家に帰ってから
    expect(bread).toContain('cd ../きみの家/リビング'); // 教わった ../ で、つなげて帰る
    expect(shell.party()).toEqual([]);
    expect(toasts).toContain('📖 手帳に「pwd」が追加された');
    const pwd = await run('pwd');
    expect(pwd.split('\n')[0]).toBe('/home/チルダ村/パン屋');
    expect(pwd).toContain('？？？ › ？？？ › チルダ村 › パン屋'); // 住所を地図の名前で読み下す。村の外は地図と同じく「？？？」
    expect(pwd).toContain('「の中の」と読む'); // はじめてだけ（画面では、住所の行・読み下し・地図を照らして説明する）
    expect(pwd).toContain('？？？の中の、？？？の中の、チルダ村の中の、パン屋');
    expect(await run('pwd')).not.toContain('「の中の」と読む');
    expect(marks()).toEqual(['きみの家', 'リビング']); // お母さんへ続く道すじに「!」

    // 村の門は閉ざされている
    await run('cd ..');
    at();
    expect(shell.currentPlace().theme).toBe('sky');
    expect(await run('cd ..')).toContain('村の門は閉ざされている');
    at();

    // 家に届けると、おすそわけを頼まれる。兄が ~ を教えてくれる
    await run('cd きみの家/リビング');
    const home = await run('cat お母さん');
    expect(home).toContain('これで移動はバッチリだな');
    expect(home).toContain('本当のLinux？ なにそれ？');
    expect(home).toContain('ピコちゃんを探しに行くなら');
    expect(home).toContain('おすそわけ');
    expect(home).toContain('「チルダ村」の短い呼び名'); // 地図の ~ を照らして説明
    expect(toasts).toContain('📖 手帳に「cd ~」が追加された');
    expect(await run('cat 食卓')).toContain('焼きたてのパン');
    expect(await run('cat バッシュ')).toContain('~/チョウン爺の家');
    await run('cd ~/チョウン爺の家');
    expect(await run('cat チョウン爺')).toContain('立入禁止');
    expect(marks()).toEqual(['井戸端']); // 兄の手本の ls .. で、村の中は見渡してある

    // 立入禁止には正面から入れない
    await run('cd ~/村はずれ');
    expect(await run('cd 立入禁止')).toContain('Permission denied');
    expect(term.effects).toContain('shake');
    at('村はずれ');

    // ピコから抜け穴の話を聞く。入る前に、のぞける
    expect(await run('cat ~/井戸端/ピコ')).toContain('ls ~/村はずれ/柵の裏');
    expect(toasts).toContain('📖 手帳に「ls 場所」が追加された');
    expect(await run('ls 柵の裏')).toBe('古い柵');
    expect(await run('ls ~/村はずれ/柵の裏')).toBe('古い柵'); // どちらも同じ場所
    expect(marks()).toEqual(['柵の裏']); // まだ見つけていない抜け穴へ続く場所に「!」
    await run('cd 柵の裏');
    expect(await run('ls')).not.toContain('抜け穴');
    expect(await run('ls -a')).toContain('.抜け穴/');
    expect(marks()).toEqual(['.抜け穴']);
    const hole = await run('cd .抜け穴');
    expect(hole).toContain('立入禁止の奥');
    expect(hole).toContain('ユウ: ……ほんとうに、あった……！'); // 主人公のリアクション

    // 石碑を読むまで kill は使えない
    expect(await run('kill モリビト')).toContain('まだ知らない');
    const stone = await run('cat 古い石碑');
    expect(stone).toContain('kill と唱うることなかれ'); // 唱えるなとは書くが
    expect(stone).not.toContain('眠り'); // 何が起こるかは書かない
    expect(toasts).toContain('📖 手帳に「kill」が追加された');
    expect(shell.doc('kill')?.summary).toContain('？？？'); // 唱えるまでは、正体の分からない言葉
    // 見つけるまでは唱えられない。もう一度石碑を読むと、ピコの話を思い出す（ls -a するまで、何度でも）
    expect(await run('kill モリビト')).toContain('そのようなプロセスはありません');
    expect(await run('ls')).not.toContain('モリビト'); // ふつうの ls では見えない
    expect(marks()).toEqual(['古い石碑']); // 見つけるまでは、石碑に「!」
    expect(await run('cat 古い石碑')).toContain('ピコが言ってた');
    expect(await run('cat 古い石碑')).toContain('ピコが言ってた');
    expect(await run('ls -a')).toContain('.モリビト');
    expect(await run('cat 古い石碑')).toContain('kill .モリビト'); // 見つけたあとは、言葉が頭に浮かぶ
    expect(marks()).toEqual(['.モリビト']);
    expect(await run('cat .モリビト')).toContain('実行中のプロセス');

    // 禁忌
    const killed = await run('kill モリビト');
    expect(killed).toContain('モリビトを停止しました');
    expect(killed).toContain('どうしよう');
    expect(term.effects).toContain('glitch');
    expect(shell.doc('kill')?.summary).toContain('止める'); // 唱えたあとで、正体が分かる
    expect(await run('kill モリビト')).toContain('すでに停止しています');

    // 村の異変。まずお母さんのところへ
    expect(shell.currentPlace().theme).toBe('dusk');
    expect(shell.currentPlace().glitchy).toBe(true); // ときどき画面が乱れる
    expect(shell.currentObjective()).toContain('お母さん');
    expect(marks()).toEqual(['きみの家', 'リビング']);
    expect(await run('cat ~/パン屋/ナノ')).not.toContain('いらっしゃい');
    // お母さんに会う前にチョウン爺のところへ行っても、話は進まない
    expect(await run('cat ~/チョウン爺の家/チョウン爺')).toContain('じっと動かない');
    expect(st.flags.quest_given).toBeUndefined();
    await run('cd ~/きみの家/リビング');
    expect(shell.currentPlace().theme).toBe('wood');
    const frozen = await run('cat お母さん');
    expect(frozen).toContain('止まっている');
    expect(frozen).toContain('兄ちゃんまで');
    expect(shell.currentObjective()).toContain('チョウン爺');
    expect(marks()).toEqual(['チョウン爺の家']);

    // 村長から頼まれる → 世界が開ける
    await run('cd ~/チョウン爺の家');
    expect(shell.currentPlace().theme).toBe('wood');
    const quest = await run('cat チョウン爺');
    expect(quest).toContain('スドウという賢者');
    expect(quest).toContain('地図に新しい場所が現れた');
    expect(quest).toContain('/home/チルダ村'); // ~ の本当の住所
    expect(quest).toContain('右に書いてある住所を打つ'); // 地図の /usr を照らして、ステージへの行き方を教える
    expect(toasts).toContain('📖 手帳に「cd /usr」が追加された');
    expect(await run('pwd')).toContain('世界 › 居住区 › チルダ村 › チョウン爺の家'); // 世界が開けたら、名前で読める
    expect(marks()).toEqual(['迷いの森']);

    expect(await run('cd /usr')).toContain('賢者スドウを探す旅に出る');
    expect(shell.currentPlace().theme).toBe('forest');
    expect(st.flags.ch0_clear).toBe(true);
    expect(term.effects).toContain('chapterEnd');
    expect(marks()).toEqual(['迷いの森']); // 第1章の始まり。森の中はまだ見渡していないので、ls の合図
  });

  it('地図: 最初は村だけ、外の世界は「？？？」', async () => {
    const { run, mapLabels, shell } = setup();
    await run('cd ~');
    const labels = mapLabels();
    // 名前を知っているふるさとの場所も、ls で見渡すまでは地図に出ない。いた場所（自分の部屋）は残る
    expect(labels.slice(0, 5)).toEqual(['？？？', '？？？', 'チルダ村', 'きみの家', '自分の部屋']);
    expect(labels).not.toContain('村はずれ');
    await run('ls');
    expect(mapLabels()).toContain('村はずれ');
    expect(labels).not.toContain('柵の裏'); // まだ見ていない
    expect(labels).not.toContain('迷いの森');

    await run('cd 村はずれ');
    expect(mapLabels()).not.toContain('柵の裏'); // 入っただけでは、中の場所は分からない（ls で見渡す）
    await run('ls');
    expect(mapLabels()).toContain('柵の裏');
    expect(mapLabels().slice(0, 2)).toEqual(['？？？', '？？？']); // 村の中を歩いても、外の世界は伏せたまま
    await run('cd 柵の裏');
    expect(mapLabels()).not.toContain('.抜け穴');
    await run('ls -a');
    expect(mapLabels()).toContain('.抜け穴');

    // いまいる場所の人やものだけが出る
    await run('cd ~/パン屋');
    await run('ls ../きみの家');
    await run('ls');
    const rows = buildMap(shell);
    expect(rows.find((r) => r.label === 'ナノ')?.insert).toBe('cat ナノ');
    // ~ を教わるまでは、.. と名前で書く
    expect(rows.find((r) => r.label === '井戸端')?.insert).toBe('cd ../井戸端');
    expect(rows.find((r) => r.label === 'チルダ村')?.insert).toBe('cd ..');
    expect(rows.find((r) => r.label === 'リビング')?.insert).toBe('cd ../きみの家/リビング');
    shell.learn('cd ~');
    const after = buildMap(shell);
    expect(after.find((r) => r.label === '井戸端')?.insert).toBe('cd ~/井戸端');
    expect(after.find((r) => r.label === 'リビング')?.insert).toBe('cd ~/きみの家/リビング');
  });

  it('地図: 村長に頼まれると世界が開ける', async () => {
    const { st, run, mapLabels } = setup();
    Object.assign(st.flags, { morihito_killed: true, saw_mom_frozen: true });
    await run('cat ~/チョウン爺の家/チョウン爺');
    const labels = mapLabels();
    expect(labels.slice(0, 2)).toEqual(['世界', '居住区']);
    expect(labels).toContain('迷いの森');
    expect(labels.filter((l) => l === '？？？').length).toBe(7); // ムラガレと先の章の6か所
  });

  it('入力候補', async () => {
    const { shell, run } = setup();
    // 地図に出ていない人や物は、ls で見つけるまで候補にも補完にも出さない
    expect(shell.suggest('cat ').map((s) => s.label)).toEqual([]);
    expect(shell.complete('cat 窓').value).toBe('cat 窓');
    expect(shell.complete('cat ベ').value).toBe('cat ベ');
    await run('ls');
    expect(shell.suggest('cat ').map((s) => s.label)).toContain('窓');
    expect(shell.complete('cat ベ').value).toBe('cat ベッド ');
    await run('cd ~');
    expect(shell.suggest('c').map((s) => s.label)).toEqual(['cd', 'cat', 'clear']);
    expect(shell.suggest('k')).toEqual([]); // kill はまだ知らない
    // 候補に出るのは、地図に出ている（見つけた）ものだけ。いまは、通ってきたきみの家だけ
    expect(shell.suggest('cd ').map((s) => s.label)).toEqual(['..', 'きみの家']);
    expect(shell.suggest('cat ')).toEqual([]);
    await run('ls');
    expect(shell.suggest('cd ').map((s) => s.label)).toEqual(['..', 'きみの家', 'チョウン爺の家', 'パン屋', '井戸端', '村はずれ']);
    expect(shell.suggest('cat ').map((s) => s.label)).toEqual(['掲示板', 'キャット']);
    expect(shell.suggest('cd パ')[0].value).toBe('cd パン屋/');

    await run('cd ~/村はずれ/柵の裏');
    expect(shell.suggest('cd ').map((s) => s.label)).toEqual(['..']); // 隠し場所はまだ出ない
    await run('ls -a');
    expect(shell.suggest('cd ').map((s) => s.label)).toContain('.抜け穴');

    // 日本語入力のまま打った「・」「。」は / と . として読む
    await run('cd ~');
    expect(shell.suggest('cd ～・').map((s) => s.label)).toContain('井戸端');
    await run('cd ～・村はずれ・柵の裏・。抜け穴');
    expect(shell.state.cwd.at(-1)).toBe('.抜け穴');
    // kill の候補は、. を書かなくても（モ だけでも）出る
    shell.learn('kill');
    await run('ls -a');
    expect(shell.suggest('kill モ').map((s) => s.label)).toEqual(['モリビト']);
  });

  it('兄の手本は、画面を照らして説明する。本棚は中に入れる場所', async () => {
    const { run, shell, term, open } = setup();
    const steps: string[] = [];
    term.guide = async (s) => {
      steps.push(...s.map((g) => g.at));
    };
    const log = await open();
    // 画面の部品は、それにまつわるコマンドを使うときに紹介する
    expect(steps.slice(0, 6)).toEqual(['terminal', 'output', 'dir', 'found', 'book', 'input']); // ターミナル → ls の結果・地図・手帳 → cat 名前
    expect(steps.slice(6, 10)).toEqual(['suggest', 'suggest', 'here', 'map']); // cd のうしろ（入力候補・矢印キーで選ぶ）→ 地図
    expect(steps.slice(-5)).toEqual(['mark', 'objective', 'book', 'hint', 'bookbtn']); // ひとりで動きはじめるとき
    expect(log).not.toContain('入力候補」がここに出る'); // 説明は吹き出しで出すので、ログには残さない
    expect(await open()).toBe(''); // 1回だけ

    await run('cd ~/きみの家/自分の部屋/本棚');
    expect(await run('cat 応用情報技術者試験の参考書')).toContain('もう少し大きくなってから');
    await run('cd ..');
    expect(shell.state.cwd.at(-1)).toBe('自分の部屋');
    // 自分に cat すると、自分のこと（起こされたあとは、ふつうの独り言）
    expect(await run('cat ユウ')).toContain('今日も、元気');
  });

  it('名前だけで届かないときは、地図に載っているものの住所を教える', async () => {
    const { run, shell } = setup();
    await run('cd ~');
    // / を忘れた書き方
    const noSlash = await run('ls home/チルダ村');
    expect(noSlash).toContain('その道のりの先に、チルダ村 はない');
    expect(noSlash).toContain('いまいる場所が、チルダ村 だ'); // ~ を教わるまでは、.. と名前で教える
    expect(await run('ls 井戸端')).not.toContain('ls ../井戸端'); // 見つけていないものの住所は教えない
    await run('ls');
    await run('cd パン屋');
    expect(await run('ls 井戸端')).toContain('ls ../井戸端');
    await run('cd ..');
    // ~ を教わったあとは、~ と / から書く住所を教える
    shell.learn('cd ~');
    await run('cd きみの家/自分の部屋');
    const tilde = await run('ls home/チルダ村');
    expect(tilde).toContain('ls ~');
    expect(tilde).toContain('/home/チルダ村');
    await run('cd ~');
    // まだ見つけていないもの（ナノはパン屋で ls するまで地図にない）は教えない
    const nano = await run('cat ナノ');
    expect(nano).toContain('そのようなファイル');
    expect(nano).not.toContain('住所');
    await run('ls パン屋');
    expect(await run('cat ナノ')).toContain('cat ~/パン屋/ナノ');
  });

  it('exit で、セーブしてタイトルにもどる（y のときだけ）', async () => {
    const scn = loadScenario([yaml, ch1Yaml, ch2Yaml, ch3Yaml, ch4Yaml, ch5Yaml, ch6Yaml], commandsYaml);
    const st = newState('ユウ', 'boy', scn.start, scn.startCommands);
    const answers = ['n', 'y'];
    const term = new FakeTerm();
    term.readLine = async () => answers.shift()!;
    let quits = 0;
    const shell = new Shell(scn, st, term, { restart() {}, update() {}, toast() {}, quit: () => quits++ });
    await shell.exec('exit');
    expect(quits).toBe(0);
    await shell.exec('exit');
    expect(quits).toBe(1);
  });

  it('cd だけならホームへ帰り、はじめてのときだけそう教える', async () => {
    const { shell, run } = setup();
    expect(await run('cd')).toContain('ホーム（~）に帰ってくる');
    expect(shell.state.cwd.join('/')).toBe('home/チルダ村');
    await run('cd きみの家');
    expect(await run('cd')).not.toContain('ホーム（~）に帰ってくる');
  });

  it('章のはじめのイベントの途中で閉じたら、もう一度はじめから', async () => {
    const { shell, open } = setup();
    expect(shell.needsOpening()).toBe(true);
    await open();
    expect(shell.needsOpening()).toBe(false);
  });

  it('主人公の一人称は、男の子なら「ぼく」、女の子なら「わたし」', async () => {
    const boy = setup('boy');
    await boy.run('cd ~/村はずれ/柵の裏/.抜け穴');
    await boy.run('cat 古い石碑');
    await boy.run('ls -a');
    expect(await boy.run('kill モリビト')).toContain('ぼく、いま、なにを');

    const girl = setup('girl');
    await girl.run('cd ~/村はずれ/柵の裏/.抜け穴');
    await girl.run('cat 古い石碑');
    await girl.run('ls -a');
    const out = await girl.run('kill モリビト');
    expect(out).toContain('わたし、いま、なにを');
    expect(out).not.toContain('ぼく');
  });

  it('石碑を読む前に ls -a で守り人を見つけても、石碑を読めば kill を覚えて唱えられる', async () => {
    const { run, shell, toasts, marks } = setup();
    await run('cd ~/村はずれ/柵の裏/.抜け穴');
    expect(await run('ls -a')).toContain('.モリビト');
    expect(shell.currentObjective()).toContain('古い石碑'); // まだ読んでいないので、「頭から離れない」とは言わない
    expect(marks()).toContain('古い石碑'); // 読むまでは、石碑に「!」
    expect(await run('kill モリビト')).toContain('まだ知らない');
    const stone = await run('cat 古い石碑');
    expect(stone).toContain('kill と唱うることなかれ'); // 石碑の文は、はじめて読むときに出す
    expect(stone).toContain('kill .モリビト');
    expect(toasts).toContain('📖 手帳に「kill」が追加された');
    expect(shell.currentObjective()).toContain('頭から離れない');
    expect(await run('kill モリビト')).toContain('モリビトを停止しました');
  });

  it('ヒントは3段階', async () => {
    const { run } = setup();
    expect(await run('hint')).toContain('1/3');
    expect(await run('hint')).toContain('2/3');
    expect(await run('hint')).toContain('ls と打って');
    expect(await run('hint')).toContain('3/3');
  });

  it('打ち間違いを教えてくれる', async () => {
    const { run } = setup();
    expect(await run('sl')).toContain('もしかして: ls');
    expect(await run('cdリビング')).toContain('cd リビング');
  });

  it('全角で打っても通る', async () => {
    const { st, run } = setup();
    await run('ｃｄ　～／村はずれ');
    expect(st.cwd).toEqual(['home', 'チルダ村', '村はずれ']);
  });

  it('ls -l で権限と所有者が見える', async () => {
    const { run } = setup();
    expect(await run('ls -l ~/村はずれ')).toMatch(/drwx------\s+チョウン爺\s+チョウン爺\s+立入禁止\//) // 持ち主・組・名前;
  });

  it('シナリオの名前は NFKC 正規化で変わらない', () => {
    const { scn } = setup();
    const walk = (n: VNode): string[] => [n.name, ...(n.type === 'dir' ? n.children.flatMap(walk) : [])];
    for (const name of walk(scn.root)) expect(name.normalize('NFKC')).toBe(name);
  });

  it('会話の話し手には全員立ち絵がある', () => {
    const { scn } = setup();
    const speakers = new Set([...yaml.matchAll(/^\s*- "([^"（「\[―:：]{1,12})[:：]/gm)].map((m) => m[1]));
    for (const s of speakers) if (s !== '{name}') expect(scn.characters[s], s).toBeDefined(); // 主人公は別扱い
  });
});
