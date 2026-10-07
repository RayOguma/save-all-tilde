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
import ch9Yaml from '../scenario/ch9.yaml?raw';
import { stateAtChapter } from '../src/checkpoint';
import { loadScenario } from '../src/scenario';
import { Shell, type Term } from '../src/shell';
import type { GameState } from '../src/state';
import { msgText, type Line, type Msg } from '../src/text';
import { check, isRoot } from '../src/vfs';

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
  loadScenario([ch0Yaml, ch1Yaml, ch2Yaml, ch3Yaml, ch4Yaml, ch5Yaml, ch6Yaml, ch7Yaml, ch8Yaml, ch9Yaml], commandsYaml);

/** 第8章を終えて、賢者の庵に着いたところから */
function setup(st?: GameState) {
  const scn = load();
  st ??= stateAtChapter(scn, 9, { name: 'ユウ', gender: 'boy' });
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

/** 三つの試練を越えて、スドウに鍵束の力をもらうまで */
async function untilSudo(run: (cmd: string) => Promise<string>) {
  await run('cat 試練の碑');
  await run('find /root -name "*鍵*"');
  await run('chmod u+rwx /root/錆びた箱');
  await run('cd /root/錆びた箱');
  await run('tar -xzf 封じられた巻物.tar.gz');
  await run('cat 巻物');
  await run('cd /root/道しるべの辻');
  await run('unlink 西の道しるべ');
  await run('unlink 北の道しるべ');
  await run('cd /root/庵');
  return run('cat スドウ');
}

/** モリビトを動かすまで */
async function untilRevive(run: (cmd: string) => Promise<string>) {
  await untilSudo(run);
  await run('cd ~/村はずれ/柵の裏/.抜け穴');
  await run('sudo mv ~/かばん/設計図.tar.gz .');
  await run('tar -xzf 設計図.tar.gz');
  return run('sudo systemctl start モリビト');
}

describe('第9章', () => {
  it('第8章をクリアすると第9章。賢者の庵は、雲の上の枠と「悠久の空へ」', () => {
    const { shell, st } = setup();
    expect(shell.chapter().no).toBe(9);
    expect(shell.chapter().ending).toBe(true);
    expect(st.cwd).toEqual(['root']);
    expect(shell.currentPlace().theme).toBe('cloudtop');
    expect(shell.currentPlace().bgm).toBe('悠久の空へ');
  });

  it('最初から最後まで通しで遊べる', async () => {
    const { st, run, term, toasts, shell } = setup();

    // 鍵束の力は、まだない
    expect(await run('sudo ls')).toContain('まだその資格がない');

    expect(await run('ls')).toContain('試練の碑');
    expect(await run('ls')).not.toContain('.霧の奥');
    expect(await run('cat 試練の碑')).toContain('三つの試練');
    expect(await run('cd 庵')).toContain('Permission denied');

    // 一の試練: 三本の鍵（隠れた霧の奥にも）
    const keys = await run('find /root -name "*鍵*"');
    expect(keys).toContain('/root/.霧の奥/二本目の鍵');
    expect(keys).toContain('/root/風見の台/鳥の巣/三本目の鍵');
    expect(keys).toContain('三本の鍵、ぜんぶ見つけた');

    // 二の試練: 錆びた箱を開け、巻物をほどく
    expect(await run('cd 錆びた箱')).toContain('Permission denied');
    expect(await run('chmod u+rwx 錆びた箱')).toContain('錆びた錠が、外れた');
    await run('cd 錆びた箱');
    await run('tar -xzf 封じられた巻物.tar.gz');
    expect(await run('cat 巻物')).toContain('惑わしの札は、どこも指さぬ');
    expect(st.flags.trial2_done).toBe(true);

    // 三の試練: どこも指さない札を見破って抜く。庵を指す札は抜けない
    await run('cd /root/道しるべの辻');
    const signs = await run('ls -l');
    expect(signs).toContain('東の道しるべ -> /root/庵');
    expect(signs).toContain('西の道しるべ -> /root/消えた橋');
    expect(await run('unlink 東の道しるべ')).toContain('抜いてはならない');
    await run('unlink 西の道しるべ');
    const open = await run('unlink 北の道しるべ');
    expect(open).toContain('庵の扉が、ゆっくりと開いていく');
    expect(st.flags.trials_done).toBe(true);

    // 庵。スドウ。鍵束の力（sudo）と systemctl を覚える
    const meet = await run('cd 東の道しるべ');
    expect(meet).toContain('来たか');
    expect(meet).toContain('迷いの森の精霊どの'); // スドウは、コダマを知っていた
    expect(meet).toContain('しゃべる狐で、悪かったの');
    expect(shell.currentPlace().theme).toBe('hermitage');
    expect(await run('cat 守り人の原本')).toContain('systemctl start');
    const talk = await run('cat スドウ');
    expect(talk).toContain('わざと残してたんだ');
    expect(talk).toContain('作成者の手では、二度と守り人を動かせぬ'); // 自分で直さなかったわけ
    expect(talk).toContain('ありがとう、スドウさん');
    expect(talk).toContain('大きな力には、大きな責任');
    expect(toasts).toContain('📖 手帳に「sudo」が追加された');
    expect(shell.knownCommands()).toContain('sudo');
    // 書庫の札が、つながった
    expect(await run('file /var/log/守り人の棚/守り人の原本')).not.toContain('broken');

    // チルダ村へ。抜け穴はスドウの場所
    expect(await run('cd ~')).toContain('もうすぐ、元に戻すから');
    expect(await run('cd ~/村はずれ/柵の裏/.抜け穴')).toContain('鍵束の力');
    expect(await run('systemctl status モリビト')).toContain('inactive (dead)');
    const denied = await run('mv ~/かばん/設計図.tar.gz .');
    expect(denied).toContain('Permission denied');
    expect(denied).toContain('`sudo`'.replaceAll('`', ''));
    expect(await run('sudo mv ~/かばん/設計図.tar.gz .')).toContain('守り人のそばに置けた');
    expect(isRoot()).toBe(false); // 鍵束の力は、その言葉のあいだだけ

    // 設計図をほどく前は、動かない。鍵束の力がないと、動かせない
    expect(await run('sudo systemctl start モリビト')).toContain('まだ自分の姿を思い出せぬ');
    expect(await run('tar -xzf 設計図.tar.gz')).toContain('今じゃ');
    expect(await run('systemctl start モリビト')).toContain('Access denied');

    // 守り人が目をさます。村に色が戻る
    const revive = await run('sudo systemctl start モリビト');
    expect(revive).toContain('モリビトが、動きだした');
    expect(revive).toContain('家族のもとへ帰りなさい');
    expect(term.effects).toContain('revive');
    expect(term.effects).toContain('dawn'); // 真っ白から戻ると、色が戻っている
    expect(await run('systemctl status モリビト')).toContain('active (running)');
    expect(await run('ls -a')).toContain('.モリビト');
    expect(await run('kill モリビト')).toContain('もう二度と');
    expect(st.flags.morihito_revived).toBe(true);
    await run('cd ~');
    expect(shell.currentPlace().theme).toBe('sky');
    expect(shell.currentPlace().drained).toBe(false);
    expect(shell.currentPlace().bgm).toBe('水平線を見据えて');
    expect(await run('cat パン屋/ナノ')).toContain('窯に火が入ったの');

    // 家族のもとへ。お母さんと再会すると、コダマの声がして、玄関へ
    await run('cd ~/きみの家/リビング');
    expect(await run('cat バッシュ')).toContain('長い夢');
    const mom = await run('cat お母さん');
    expect(mom).toContain('おかえり');
    expect(mom).toContain('コダマの声が、耳もとでした気がする');
    expect(st.flags.ch9_clear).toBeUndefined();

    // 玄関: ls でスドウ（鍵束を託される）、ls -a で隠れたコダマ（お別れ）
    await run('cd ../玄関');
    const door = await run('ls');
    expect(door).toContain('スドウ');
    expect(door).not.toContain('.コダマ');
    const sudo = await run('cat スドウ');
    expect(sudo).toContain('本当にありがとう');
    expect(sudo).toContain('新しい見守り役じゃ');
    expect(st.flags.ch9_clear).toBeUndefined(); // コダマとも話すまでは、まだ
    expect(await run('ls -a')).toContain('.コダマ');
    const kodama = await run('cat .コダマ');
    expect(kodama).toContain('森で会えて、本当によかった');
    expect(kodama).toContain('窯の煙');
    expect(term.effects).toContain('chapterEnd');
    expect(st.flags.ch9_clear).toBe(true);
    const ch = shell.chapter();
    expect(ch.endingTitles.find((e) => check(e.if, st.flags))?.title).toBe('― 新しい見守り役 ―');
    // エンディングの最後に、スドウのせりふ（つづきをにおわせる）
    expect(ch.epilogue.join('')).toContain('警告を削り取ったのは、わしではない');
  });

  it('設計図の包みは、写して（cp）置いてもよい。抜け穴の外へは置けない', async () => {
    const { run, st } = setup();
    await untilSudo(run);
    await run('cd ~');
    expect(await run('sudo mv ~/かばん/設計図.tar.gz ~/井戸端/')).toContain('抜け穴の中へ運ぶ');
    await run('sudo cp ~/かばん/設計図.tar.gz ~/村はずれ/柵の裏/.抜け穴/');
    expect(st.flags.blueprint_moved).toBe(true);
  });

  it('玄関では、cat コダマ でもお別れできる', async () => {
    const { run, st } = setup();
    await untilRevive(run);
    await run('cd ~/きみの家/リビング');
    await run('cat お母さん');
    await run('cd ../玄関');
    expect(await run('cat コダマ')).toContain('森で会えて');
    expect(st.flags.ch9_clear).toBeUndefined();
    expect(await run('cat スドウ')).toContain('窯の煙');
    expect(st.flags.ch9_clear).toBe(true);
  });

  it('止まった村の人は、守り人が目をさますまで、止まったまま', async () => {
    const { run } = setup();
    expect(await run('cat ~/パン屋/ナノ')).not.toContain('窯に火が入ったの');
  });

  it('動きだした守り人と、選んだ道は、セーブから元に戻る（章の clear からも）', async () => {
    const first = setup();
    await untilRevive(first.run);
    const again = setup(JSON.parse(JSON.stringify(first.st)));
    expect(await again.run('systemctl status モリビト')).toContain('active (running)');
    expect(await again.run('ls ~/村はずれ/柵の裏/.抜け穴')).toContain('設計図/');

    const scn = load();
    const st = stateAtChapter(scn, 9, { name: 'ユウ', gender: 'boy' });
    const ch9 = scn.chapters.find((c) => c.no === 9)!.clear!;
    st.ops = [...(st.ops ?? []), ...ch9.ops!];
    st.perms = { ...st.perms, ...ch9.perms };
    for (const f of ch9.flags!) st.flags[f] = true;
    const { run } = setup(st);
    expect(await run('ls /root/道しるべの辻')).not.toContain('西の道しるべ');
    expect(await run('ls ~/村はずれ/柵の裏/.抜け穴')).toContain('設計図/');
  });
});
