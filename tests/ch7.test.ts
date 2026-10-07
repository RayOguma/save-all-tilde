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
import { stateAtChapter } from '../src/checkpoint';
import { loadScenario } from '../src/scenario';
import { parseCronLine, parseEcho, Shell, type Term } from '../src/shell';
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

const load = () => loadScenario([ch0Yaml, ch1Yaml, ch2Yaml, ch3Yaml, ch4Yaml, ch5Yaml, ch6Yaml, ch7Yaml], commandsYaml);

/** 第6章を終えて、物見の塔に着いたところから */
function setup(st?: GameState) {
  const scn = load();
  st ??= stateAtChapter(scn, 7, { name: 'ユウ', gender: 'boy' });
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

/** 予定表を書けるようになるまで進める */
async function untilWritable(run: (cmd: string) => Promise<string>) {
  await run('ls');
  await run('cat クロン');
  await run('date');
  await run('cat クロン');
  await run('cat 予定表');
  await run('cp 予定表 予定表.bak');
  return run('chmod u+w 予定表');
}

/** 鐘を直すところまで */
async function untilBell(run: (cmd: string) => Promise<string>) {
  await untilWritable(run);
  await run('echo "0 9 * * * 鐘を鳴らす" > 予定表');
  return run('crontab 予定表');
}

describe('第7章', () => {
  it('第6章をクリアすると第7章。物見の塔は、石の塔の枠と「時の風」', () => {
    const { shell, st } = setup();
    expect(shell.chapter().no).toBe(7);
    expect(st.cwd).toEqual(['etc']);
    expect(shell.currentPlace().theme).toBe('tower');
    expect(shell.currentPlace().bgm).toBe('時の風');
    expect(shell.currentPlace().belling).toBe(true); // 鐘が鳴りやまない
  });

  it('最初から最後まで通しで遊べる', async () => {
    const { st, run, term, toasts, shell } = setup();

    const look = await run('ls');
    expect(look).toContain('クロン');
    expect(look).toContain('予定表');
    expect(look).toContain('銅の扉/');

    // 塔の記録は、紙の字のまま出る
    const log = await run('cat 塔の記録');
    expect(log).toContain('09:00 鐘を鳴らす');
    expect(log).toContain('ずっと、9時');

    // 塔守クロン。date を覚える
    expect(await run('cat クロン')).toContain('`date` と唱えれば'.replaceAll('`', ''));
    expect(toasts).toContain('📖 手帳に「date」が追加された');

    // 何度見ても、同じ時刻
    expect(await run('date')).toContain('7月12日 火曜日 09:00:00');
    const twice = await run('date');
    expect(twice).toContain('09:00:00');
    expect(twice).toContain('1秒も変わってない');

    // 予定表の読み方。写しを頼まれる
    expect(await run('cat クロン')).toContain('予定表を、読んでみてくれんか');
    const cron = await run('cat 予定表');
    expect(cron).toContain('* * * * * 鐘を鳴らす');
    expect(cron).toContain('分 時 日 月 曜日');
    expect(cron).toContain('0が日曜、1が月曜'); // 曜日も数で書く、と先に教わる
    expect(cron).toContain('予定表.bak');

    // 書き直す前に、写し（cp のおさらい）。予定表を預かる
    expect(await run('cp 予定表 写し')).toContain('予定表.bak');
    const backed = await run('cp 予定表 予定表.bak');
    expect(backed).toContain('持ち主は、お前さんじゃ');
    expect(await run('cat 予定表.bak')).toContain('* * * * * 鐘を鳴らす');

    // 鍵を確かめて、自分に書く鍵を開ける（ls -l・chmod のおさらい）。echo を覚える
    expect(await run('ls -l')).toMatch(/-r--r--r--\s+きみ\s+\S+\s+予定表/);
    const unlocked = await run('chmod u+w 予定表');
    expect(unlocked).toContain('われの名のもとになった言葉');
    expect(toasts).toContain('📖 手帳に「echo」が追加された');

    // こだまのように返ってくる
    const echoed = await run('echo やっほー');
    expect(echoed).toContain('やっほー');
    expect(echoed).toContain('われと同じ、こだま');

    // * を " で囲まないと、書かない
    expect(await run('echo 0 9 * * * 鐘を鳴らす > 予定表')).toContain('で囲もう');
    expect(await run('cat 予定表')).toContain('* * * * * 鐘を鳴らす');

    // 書き直す。crontab を覚える
    const wrote = await run('echo "0 9 * * * 鐘を鳴らす" > 予定表');
    expect(wrote).toContain('crontab 予定表');
    expect(await run('cat 予定表')).not.toContain('* * * * *');
    expect(toasts).toContain('📖 手帳に「crontab」が追加された');

    // 塔に渡すと、時が動きだす
    const bell = await run('crontab 予定表');
    expect(bell).toContain('時が、動いた');
    expect(term.effects).toContain('towerbell');
    expect(st.flags.bell_fixed).toBe(true);
    expect(term.effects).toContain('tick');
    expect(shell.currentPlace().belling).toBe(false); // 鐘は鳴りやむ
    expect(await run('date')).toContain('09:00:41');
    expect(await run('crontab -l')).toBe('0 9 * * * 鐘を鳴らす');

    // 銅の扉: >> で書き足す
    expect(await run('cat 銅の扉の札')).toContain('>>');
    expect(toasts).toContain('📖 手帳に「echo >>」が追加された');
    await run('echo "0 9 * * * 銅の扉を開ける" >> 予定表');
    expect(await run('cat 予定表')).toBe('0 9 * * * 鐘を鳴らす\n0 9 * * * 銅の扉を開ける');
    expect(await run('crontab 予定表')).toContain('銅の扉が、ゴゴゴ');

    // 銀の扉: 30分のち。扉の中から、住所で書く
    await run('cd 銅の扉');
    expect(await run('cat 銀の扉の札')).toContain('30分ののち');
    // 名前だけだと、銅の扉の中に新しい紙を作ろうとしてしまう
    expect(await run('echo "30 9 * * * 銀の扉を開ける" >> 予定表')).toContain('/etc');
    await run('echo "30 9 * * * 銀の扉を開ける" >> /etc/予定表');
    expect(await run('crontab /etc/予定表')).toContain('銀の扉が、ゆっくりと開いた');

    // 金の扉: 今日（date）の正午。はじめの日（12日）のまま書くと、開かない
    await run('cd 銀の扉');
    expect(await run('cat 金の扉の札')).toContain('今日という日の');
    await run('echo "0 12 12 7 * 金の扉を開ける" >> /etc/予定表');
    expect(await run('crontab /etc/予定表')).toContain('大時計に聞いてみなされ');
    expect(await run('date')).toContain('7月13日 水曜日');
    await run('echo "0 12 13 7 * 金の扉を開ける" >> /etc/予定表');
    expect(await run('crontab /etc/予定表')).toContain('金の扉が、ゆっくりと開いた');

    // 頂上。地図の「？？？」が名前に変わる
    const top = await run('cd 金の扉/頂上');
    expect(top).toContain('窯に火を入れる');
    expect(top).toContain('モリビトさまじゃ');
    expect(top).toContain('やはり、そうであったか');
    expect(top).toContain('また動かせる');
    expect(top).toContain('記憶の書庫');
    expect(term.effects).toContain('reveal');
    expect(term.effects).toContain('chapterEnd');
    expect(st.discovered).toContain('/var/log');
    expect(st.discovered).toContain('/root');
    expect(st.flags.ch7_clear).toBe(true);
    expect(shell.currentObjective()).toContain('制作中');
  });

  it('扉の行を > で書くと、鐘の行が消えて、大時計がまた止まる', async () => {
    const { run, st } = setup();
    await untilBell(run);
    await run('cat 銅の扉の札');
    await run('echo "0 9 * * * 銅の扉を開ける" > 予定表');
    const lost = await run('crontab 予定表');
    expect(lost).toContain('鐘の行が消えておる');
    expect(st.flags.door1_open).toBeUndefined();
    expect(await run('date')).toContain('09:00:00');
    expect(await run('hint')).toContain('予定表から、鐘の行が消えてしまった');
    // 書き直して、書き足せば開く
    await run('echo "0 9 * * * 鐘を鳴らす" > 予定表');
    await run('echo "0 9 * * * 銅の扉を開ける" >> 予定表');
    expect(await run('crontab 予定表')).toContain('銅の扉が、ゴゴゴ');
  });

  it('鐘の行の刻がちがう・毎分の行が残っている・形がおかしいと、時は動かない', async () => {
    const { run, st } = setup();
    await untilWritable(run);
    await run('echo "9 0 * * * 鐘を鳴らす" > 予定表');
    expect(await run('crontab 予定表')).toContain('刻のちがうもの');
    // 古い行を残したまま書き足すと、鐘は毎分鳴りつづける
    await run('echo "* * * * * 鐘を鳴らす" > 予定表');
    await run('echo "0 9 * * * 鐘を鳴らす" >> 予定表');
    expect(await run('crontab 予定表')).toContain('刻のちがうもの');
    await run('echo "0 9 * * 鐘を鳴らす" > 予定表');
    const bad = await run('crontab 予定表');
    expect(bad).toContain('欄');
    expect(bad).toContain('渡せなかった');
    expect(bad).toContain('紙をまっさらにしてから書く'); // 直し方を教わる
    expect(await run('crontab 予定表')).toContain('まちがえた予定表は'); // 2回目からは短く
    expect(st.flags.bell_fixed).toBeUndefined();
  });

  it('頼まれていない紙には書けない。予定表も、鍵が開くまでは書けない', async () => {
    const { run, st } = setup();
    st.learned.push('echo', 'echo >');
    expect(await run('echo "やっほー" > 落書き')).toContain('書きつける用事はない');
    await run('cat クロン');
    await run('date');
    await run('cat クロン');
    await run('cat 予定表');
    await run('cp 予定表 予定表.bak');
    st.flags.cron_writable = true; // 鍵を開ける前に、書けることにだけしておく
    const denied = await run('echo "0 9 * * * 鐘を鳴らす" > 予定表');
    expect(denied).toContain('Permission denied');
    expect(denied).toContain('紙の鍵を、確かめてみよ');
  });

  it('書いた予定表と写しは、セーブから元に戻る（章の clear からも）', async () => {
    const first = setup();
    await untilBell(first.run);
    const saved: GameState = JSON.parse(JSON.stringify(first.st));
    const again = setup(saved);
    expect(await again.run('cat /etc/予定表')).toBe('0 9 * * * 鐘を鳴らす');
    expect(await again.run('cat /etc/予定表.bak')).toContain('* * * * * 鐘を鳴らす');

    const scn = load();
    const st8 = stateAtChapter(scn, 7, { name: 'ユウ', gender: 'boy' });
    const ch7 = scn.chapters.find((c) => c.no === 7)!.clear!;
    st8.ops = [...(st8.ops ?? []), ...ch7.ops!];
    st8.perms = { ...st8.perms, ...ch7.perms };
    st8.texts = { ...ch7.texts };
    for (const f of ch7.flags!) st8.flags[f] = true;
    const { run } = setup(st8);
    expect(await run('cat /etc/予定表')).toContain('0 12 13 7 * 金の扉を開ける');
    expect(await run('ls -l /etc')).toMatch(/-rw-r--r--\s+きみ\s+\S+\s+予定表\.bak/);
    expect(await run('ls /var')).toContain('log/');
  });

  it('echo の読み方: " で囲んだところはそのまま、> と >> で紙に書く', () => {
    expect(parseEcho('やっほー')).toEqual({ words: ['やっほー'], op: undefined, to: undefined, bareStar: false });
    expect(parseEcho('"0 9 * * * 鐘" > 予定表')).toEqual({ words: ['0 9 * * * 鐘'], op: '>', to: '予定表', bareStar: false });
    expect(parseEcho('"a">>紙')).toEqual({ words: ['a'], op: '>>', to: '紙', bareStar: false });
    expect(parseEcho('0 9 * * * 鐘 > 紙')).toMatchObject({ bareStar: true });
    expect(parseEcho('"閉じていない')).toHaveProperty('err');
    expect(parseEcho('ことば >')).toHaveProperty('err');
  });

  it('予定表の1行の読み方', () => {
    expect(parseCronLine('0 9 * * * 鐘を鳴らす')).toEqual({ time: '0 9 * * *', task: '鐘を鳴らす' });
    expect(parseCronLine('00 09 13 07 * 金の扉を開ける')).toEqual({ time: '0 9 13 7 *', task: '金の扉を開ける' });
    expect(parseCronLine('0 9 * * 鐘')).toHaveProperty('err');
    expect(parseCronLine('0 25 * * * 鐘')).toHaveProperty('err');
    expect(parseCronLine('a 9 * * * 鐘')).toHaveProperty('err');
    // 曜日を漢字で書いたら、数での書き方を教える
    expect(parseCronLine('0 12 13 7 水 扉')).toEqual({ err: expect.stringContaining('0が日曜') });
  });

  it('echo の入力候補は、> のうしろにだけ紙の名前を出す', async () => {
    const { run, shell, st } = setup();
    await run('ls');
    st.learned.push('echo', 'crontab');
    expect(shell.suggest('echo 予')).toEqual([]);
    expect(shell.suggest('echo "a" > 予').map((s) => s.label)).toContain('予定表');
    expect(shell.suggest('crontab 予').map((s) => s.label)).toContain('予定表');
  });
});
