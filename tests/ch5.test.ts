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

/** 第4章を終えて、廃墟山道の入口に着いたところから */
function setup(st?: GameState) {
  const scn = load();
  st ??= stateAtChapter(scn, 5, { name: 'ユウ', gender: 'boy' });
  const term = new FakeTerm();
  const toasts: string[] = [];
  const shell = new Shell(scn, st, term, { restart() {}, update() {}, toast: (t) => toasts.push(t) });
  shell.arriveAtChapterStart();
  const run = async (cmd: string) => {
    await shell.exec(cmd);
    return term.take();
  };
  const marks = () => buildMap(shell).filter((r) => r.mark).map((r) => r.label);
  return { scn, st, term, shell, run, toasts, marks };
}

/** 関所を通ったところまで進める */
async function passGate(run: (cmd: string) => Promise<string>) {
  await run('cat ~/かばん/通行証');
}

describe('第5章', () => {
  it('第4章をクリアすると第5章。廃墟山道は、崩れた石垣の枠', () => {
    const { shell, st, marks } = setup();
    expect(shell.chapter().no).toBe(5);
    expect(st.cwd).toEqual(['var', 'backups']);
    expect(shell.currentPlace().theme).toBe('ruins');
    expect(marks()).toEqual(['廃墟山道']); // まだ見渡していないので、ここで ls する合図
  });

  it('最初から最後まで通しで遊べる', async () => {
    const { st, run, term, toasts, shell } = setup();

    // 関所。通行証を見せないと、奥へは通れない
    expect(await run('ls')).toContain('崩れた宿場/');
    expect(await run('cd 崩れた宿場')).toContain('関所の柵');
    expect(await run('cat イプタ')).toContain('通行証を見せな');
    const pass = await run('cat ~/かばん/通行証'); // 第4章でかばんにしまった通行証
    expect(pass).toContain('アプトの通行証か');
    expect(st.flags.pass_shown).toBe(true);

    // 崩れた宿場。寝息がする。そばの書き置きで、包みのことと tar の唱え方を知る
    const inn = await run('cd 崩れた宿場');
    expect(inn).toContain('寝息');
    expect(inn).toContain('書きつけてある');
    const note = await run('cat スドウの書き置き');
    expect(note).toContain('まず中をあらためよ');
    expect(note).toContain('包みを作るときも、そう名づけよ'); // .tar.gz をつける決まりは、書き置きから
    expect(note).toContain('あの寝息は');
    expect(toasts).toContain('📖 手帳に「tar」が追加された');

    // まず中をあらためる（ほどかずに中を見る）
    const listed = await run('tar -tzf 瓦礫の山/カヤ.tar.gz');
    expect(listed.split('\n')[0]).toBe('カヤ');
    expect(listed).toContain('人の名前だ');
    // 包みのそばでないと、ほどけない（中の物が散らばる）
    expect(await run('tar -xzf 瓦礫の山/カヤ.tar.gz')).toContain('置いてある場所でほどこう');

    // ほどくと、カヤが目を覚ます
    await run('cd 瓦礫の山');
    expect(await run('tar -xzf カヤ.tar.gz')).toContain('ゆっくりと身を起こした');
    expect(await run('ls')).toBe('カヤ.tar.gz  カヤ'); // 包みは残る（本物と同じ）
    expect(await run('tar -xzf カヤ.tar.gz')).toContain('もうほどいてある');

    // カヤの話。鼓動が止まった日は、主人公が kill した日だった。言い出せない
    const kaya = await run('cat カヤ');
    expect(kaya).toContain('耳石っていう大きな石があるんだ');
    expect(kaya).toContain('ぷつりと止まった');
    expect(kaya).toContain('kill と唱えた');
    expect(kaya).toContain('顔色が悪いぞ');
    expect(kaya).toContain('なんでもない');
    expect(kaya).toContain('少しこわかった');
    // もう一度話すと、スドウを探していると話す。もういないが、祠に箱を置いていった（中身は知らない）
    const shrine = await run('cat カヤ');
    expect(shrine).toContain('スドウを探して');
    expect(shrine).toContain('もう、ここにはいない');
    expect(shrine).toContain('あとを継ぐ者を探さねば');
    expect(shrine).toContain('箱をひとつ置いていった');
    expect(shrine).not.toContain('tar -czf'); // まとめ方は、中身を見てから
    expect(shrine).not.toContain('紙の束');
    expect(shell.currentObjective()).toContain('古い祠');

    // 古い祠は崖の向こう。沼の飛び石を思い出すが、行き先の住所が分からない →「祠」とつく場所を探す
    expect(await run('cd /var/backups/古い祠')).toContain('崖にへだてられて');
    const cliff = await run('cd /var/backups/崖の上');
    expect(cliff).toContain('沼でも');
    expect(cliff).toContain('飛び石でしょ');
    expect(cliff).toContain('「祠」とつく場所');
    expect(cliff).not.toContain('find');
    expect(await run('find /var/backups -name "*祠*"')).toBe('/var/backups/古い祠');
    await run('ln -s /var/backups/古い祠 飛び石');
    expect(await run('cd 飛び石')).toContain('祠にたどりついた');
    expect(st.cwd).toEqual(['var', 'backups', '古い祠']);

    // 古い箱の中は、人ではなく、紙の束と添え書き。なにかは分からない
    const box = await run('tar -tzf 古い箱.tar.gz');
    expect(box).toContain('紙の束/');
    expect(box).toContain('紙の束/三枚目');
    expect(box).toContain('添え書き');
    expect(box).not.toContain('設計図');
    const opened = await run('tar -xzf 古い箱.tar.gz');
    expect(opened).toContain('設計図のように見える');
    expect(opened).not.toContain('モリビトの設計図');
    expect(await run('cat 紙の束/二枚目')).toContain('耳石');

    // 紙の束は大きすぎて、かばんに入らない。まず「設計図」と名札をつける（mv で名前を変える）
    expect(await run('mv 紙の束 ~/かばん/')).toContain('大きすぎて');
    expect(await run('mv 紙の束 設計図')).toContain('名札をつけた');
    expect(await run('cat 設計図/三枚目')).toContain('鍵束の形をした印');
    // 添え書きで、まとめ方を知る
    expect(await run('cat 添え書き')).toContain('まとめ直してゆけ');
    expect(toasts).toContain('📖 手帳に「tar -czf」が追加された');
    // 名前は、書き置きの決まり（.tar.gz）と、自分でつけた名札（設計図）から
    expect(await run('tar -czf 設計図 設計図')).toContain('.tar.gz を添えよ');
    expect(await run('tar -czf 設計図.tgz 設計図')).toContain('.tar.gz を添えよ');
    const other = await run('tar -czf 地図.tar.gz 設計図');
    expect(other).toContain('それと分かるように');
    expect(other).not.toContain('設計図.tar.gz'); // 名前そのものは言わない
    expect(await run('ls')).not.toContain('地図.tar.gz');
    expect(await run('tar -czf 設計図.tar.gz 設計図')).toContain('小さな包みになった');
    expect(await run('ls')).toContain('設計図.tar.gz');

    // かばんへしまう
    expect(await run('cd /var/backups/狭い抜け道')).toContain('やり残したこと');
    await run('cd /var/backups/古い祠');
    expect(await run('mv 設計図.tar.gz ~/かばん/')).toContain('カヤに、知らせてゆこう');
    expect(await run('ls ~/かばん')).toContain('設計図.tar.gz');
    expect(await run('tar -tzf ~/かばん/設計図.tar.gz')).toContain('設計図/一枚目'); // 中身もいっしょ

    // カヤに知らせないと、先へは進まない。知らせると、この先の道を教えてくれる
    expect(await run('cd /var/backups/狭い抜け道')).toContain('やり残したこと');
    const report = await run('cat /var/backups/崩れた宿場/瓦礫の山/カヤ');
    expect(report).toContain('なにかの設計図');
    expect(report).toContain('坑道アナグラに出る');
    expect(report).toContain('どこまで行ったのかは、分からない');

    // 狭い抜け道から坑道へ。章の終わり
    const end = await run('cd /var/backups/狭い抜け道');
    expect(end).toContain('坑道アナグラ');
    expect(end).toContain('向き合わなきゃ');
    expect(end).not.toContain('追いついて');
    expect(term.effects).toContain('chapterEnd');
    expect(st.flags.ch5_clear).toBe(true);
  });

  it('寄り道: 瓦礫のすきまに隠れた包み（ls -a）は、包みの中にまた包み', async () => {
    const { run, st } = setup();
    await passGate(run);
    await run('cd /var/backups/崩れた宿場');
    expect(await run('ls')).not.toContain('崩れた荷');
    expect(await run('cat 耳石')).toContain('瓦礫のすきまから、小さな寝息');
    expect(await run('ls -a')).toContain('.崩れた荷.tar.gz');
    await run('cat スドウの書き置き');
    expect(await run('tar -tzf .崩れた荷.tar.gz')).toBe('ジップ.tar.gz');
    expect(await run('tar -xzf .崩れた荷.tar.gz')).toContain('もうひとつ小さな包み');
    expect(await run('tar -xzf ジップ.tar.gz')).toContain('ぱちりと目を開けた');
    expect(st.flags.rescued_zip).toBe(true);
    expect(await run('cat ジップ')).toContain('包みの中に包み');
  });

  it('寄り道: 石工メイクと羊飼いヤムも助けられる', async () => {
    const { run, st } = setup();
    await passGate(run);
    await run('cat /var/backups/崩れた宿場/スドウの書き置き');
    await run('cd /var/backups/崩れた宿場/崩れた家の跡');
    expect(await run('tar -tzf 石工.tar.gz')).toContain('だれかいる');
    expect(await run('tar -xzf 石工.tar.gz')).toContain('よく寝た');
    expect(await run('cat メイク')).toContain('石工');
    await run('cd ../崩れた井戸');
    expect(await run('tar xzf 羊飼い.tar.gz')).toContain('羊たちは'); // 本物と同じく - なしでもよい
    expect(await run('cat ヤム')).toContain('坑道のほうへ');
    expect(st.flags.rescued_make && st.flags.rescued_yam).toBe(true);
  });

  it('tar は、入力候補に覚えた唱え方ごと出る（ls・ln は今のまま）', async () => {
    const { run, shell, st } = setup();
    await passGate(run);
    await run('cat /var/backups/崩れた宿場/スドウの書き置き'); // tar -tzf と tar -xzf を覚える
    expect(shell.suggest('ta').map((s) => s.label)).toEqual(['tar -tzf', 'tar -xzf']);
    expect(shell.suggest('tar').map((s) => s.value)).toEqual(['tar -tzf ', 'tar -xzf ']);
    expect(shell.suggest('tar ').map((s) => s.label)).toEqual(['tar -tzf', 'tar -xzf']);
    expect(shell.suggest('tar -x').map((s) => s.value)).toEqual(['tar -xzf ']);
    st.learned.push('tar -czf');
    expect(shell.suggest('tar').map((s) => s.label)).toEqual(['tar -tzf', 'tar -xzf', 'tar -czf']);
    // 唱え方を書いたあとは、ふつうに包みの名前が候補に出る
    await run('cd /var/backups/崩れた宿場/瓦礫の山');
    await run('ls');
    expect(shell.suggest('tar -tzf ').map((s) => s.label)).toContain('カヤ.tar.gz');
    // ほかのコマンドは、名前だけ
    expect(shell.suggest('ln').map((s) => s.label)).toEqual([]);
    expect(shell.suggest('l').map((s) => s.label)).toContain('ln');
  });

  it('tar の書き方の間違いを教えてくれる。頼まれていない物はまとめられない', async () => {
    const { run } = setup();
    await passGate(run);
    await run('cat /var/backups/崩れた宿場/スドウの書き置き');
    await run('cd /var/backups/崩れた宿場');
    expect(await run('tar 瓦礫の山/カヤ.tar.gz')).toContain('どれかひとつ');
    expect(await run('tar -tz 瓦礫の山/カヤ.tar.gz')).toContain('-f のうしろ');
    expect(await run('tar -tzf 耳石')).toContain('包み（.tar.gz）ではありません');
    expect(await run('tar -tzf ない.tar.gz')).toContain('そのようなファイル');
    expect(await run('file 瓦礫の山/カヤ.tar.gz')).toContain('gzip compressed data');
    expect(await run('tar -czf 石.tar.gz 耳石')).toContain('まとめる用事はない');
    expect(await run('ls')).not.toContain('石.tar.gz');
  });

  it('設計図は、かばんの中に直接まとめてもよい', async () => {
    const { run, st, scn } = setup();
    Object.assign(st.flags, { pass_shown: true, read_note: true, rescued_kaya: true, kaya_told: true, told_shrine: true });
    st.learned.push('tar', 'tar -tzf', 'tar -xzf', 'tar -czf');
    await run('ln -s /var/backups/古い祠 /var/backups/崖の上/飛び石');
    await run('cd /var/backups/崖の上/飛び石');
    await run('tar -xzf 古い箱.tar.gz');
    await run('mv 紙の束 設計図');
    await run('cat 添え書き');
    expect(await run('tar -czf ~/かばん/設計図.tar.gz 設計図')).toContain('かばんにしまった');
    expect(st.flags.blueprint_in_bag && st.flags.blueprint_packed).toBe(true);
    expect(scn.root).toBeDefined();
  });

  it('ほどいた・まとめた物は、セーブから元に戻る', async () => {
    const a = setup();
    await passGate(a.run);
    await a.run('cat /var/backups/崩れた宿場/スドウの書き置き');
    await a.run('cd /var/backups/崩れた宿場/瓦礫の山');
    await a.run('tar -xzf カヤ.tar.gz');
    await a.run('cat カヤ');
    await a.run('cat カヤ');
    await a.run('ln -s /var/backups/古い祠 /var/backups/崖の上/飛び石');
    await a.run('cd /var/backups/崖の上/飛び石');
    await a.run('tar -xzf 古い箱.tar.gz');
    await a.run('mv 紙の束 設計図');
    await a.run('cat 添え書き');
    await a.run('tar -czf 設計図.tar.gz 設計図');
    await a.run('mv 設計図.tar.gz ~/かばん/');
    const saved: GameState = JSON.parse(JSON.stringify(a.st));

    const b = setup(saved);
    expect(await b.run('ls /var/backups/崩れた宿場/瓦礫の山')).toBe('カヤ.tar.gz  カヤ');
    expect(await b.run('ls /var/backups/古い祠')).toBe('古い箱.tar.gz  添え書き  設計図/');
    expect(await b.run('tar -tzf ~/かばん/設計図.tar.gz')).toContain('設計図/一枚目');
  });

  it('章の clear から、次の章の始まりの状態が作れる（設計図の包みがかばんにある）', async () => {
    const scn = load();
    const st = stateAtChapter(scn, 5, { name: 'ユウ', gender: 'boy' });
    const ch5 = scn.chapters.find((c) => c.no === 5)!.clear!;
    st.ops = [...(st.ops ?? []), ...ch5.ops!];
    for (const f of ch5.flags!) st.flags[f] = true;
    const { run } = setup(st);
    expect(await run('ls ~/かばん')).toBe('通行証  地図の巻物  スドウの覚え書き/  設計図.tar.gz');
    expect(await run('ls /var/backups/崩れた宿場/瓦礫の山')).toContain('カヤ');
  });
});
