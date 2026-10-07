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

/** 第5章を終えて、坑道アナグラに着いたところから */
function setup(st?: GameState) {
  const scn = load();
  st ??= stateAtChapter(scn, 6, { name: 'ユウ', gender: 'boy' });
  const term = new FakeTerm();
  const toasts: string[] = [];
  let gameOvers = 0;
  const shell = new Shell(scn, st, term, {
    restart() {},
    update() {},
    toast: (t) => toasts.push(t),
    gameOver: () => {
      gameOvers++;
    },
  });
  shell.arriveAtChapterStart();
  const run = async (cmd: string) => {
    await shell.exec(cmd);
    return term.take();
  };
  return { scn, st, term, shell, run, toasts, gameOvers: () => gameOvers };
}

/** 獣が現れるところまで進める */
async function untilBeast(run: (cmd: string) => Promise<string>) {
  await run('cat 点呼板');
  await run('ps');
  await run('write ノーハップ "こんにちは"');
  await run('fg 0231');
  await run('cat ノーハップ');
  await run('fg 0455');
  await run('cat ミナシゴ');
  await run('bg 0455');
  await run('cd /proc/深い坑道');
  return run('cd 分かれ道');
}

/** 隠れ場を作る */
async function hide(run: (cmd: string) => Promise<string>) {
  await run('mkdir 隠れ場');
  await run('chgrp ムラガレ 隠れ場');
  return run('chmod g+rwx,o-rwx 隠れ場');
}

describe('第6章', () => {
  it('第5章をクリアすると第6章。坑道アナグラは、暗い坑道の枠', () => {
    const { shell, st } = setup();
    expect(shell.chapter().no).toBe(6);
    expect(st.cwd).toEqual(['proc']);
    expect(shell.currentPlace().theme).toBe('mine');
  });

  it('最初から最後まで通しで遊べる', async () => {
    const { st, run, term, toasts, shell } = setup();

    // 真っ暗な坑道。番号のついた通路と、点呼板。人の姿は見えない
    const look = await run('ls');
    expect(look).toContain('0231番通路/');
    expect(look).toContain('点呼板');
    expect(look).not.toContain('ノーハップ');
    expect(await run('ps')).toContain('まだ知らない');

    // 点呼板で ps を覚える。番号は、通路の名前と同じ
    expect(await run('cat 点呼板')).toContain('点呼は ps');
    expect(toasts).toContain('📖 手帳に「ps」が追加された');
    const ps = await run('ps');
    expect(ps).toMatch(/0231\s+裏で動く\s+ノーハップ/);
    expect(ps).toMatch(/0999\s+暴走\s+影の獣/);
    expect(ps).toContain('通路の番号と、同じだ');
    expect(ps).toMatch(/0000\s+？/); // 伏線: 名のない者

    // 裏で働くノーハップに、write で声をかける（コダマは write とは言わない）
    const tunnel = await run('cd 0231番通路');
    expect(tunnel).toContain('声なら届こう');
    expect(tunnel).not.toContain('write');
    expect(await run('write ノーハップ "ハルから、薬を預かってきました"')).toContain('fg で呼べ');
    expect(toasts).toContain('📖 手帳に「fg」が追加された');
    expect(await run('fg 0000')).toContain('何も返ってこない'); // 名のない者は、呼んでも何も分からない

    // fg で表に呼ぶ。薬を渡し、ムラガレの組の話。出口まで案内してくれる
    expect(await run('fg 0231')).toContain('すすだらけの青年');
    expect(await run('ps')).toMatch(/0231\s+表で動く\s+ノーハップ/);
    expect(await run('fg 0231')).toContain('もう表にいる');
    const talk = await run('cat ノーハップ');
    expect(talk).toContain('薬を、ノーハップに渡した');
    expect(talk).toContain('ムラガレの組に入れてもらった');
    expect(talk).toContain('出口まで、おれが案内してやる');
    expect(shell.party().map((c) => c.node.name)).toContain('ノーハップ'); // 一緒に来る

    // 案内は、ミナシゴを隠してから
    expect(await run('cd /proc/深い坑道')).toContain('案内してもらいたい');

    // ミナシゴ。守り人さまが拾ってくれるはずだった（主人公は言い出せない）。励まして、bg で裏に隠す
    expect(await run('fg 0455')).toContain('泣いている');
    const child = await run('cat ミナシゴ');
    expect(child).toContain('守り人さまが拾ってくれるはず');
    expect(child).toContain('賢者に会いに行く');
    expect(toasts).toContain('📖 手帳に「bg」が追加された');
    expect(await run('bg 0455')).toContain('cd /proc/深い坑道');
    expect(shell.party().map((c) => c.node.name)).not.toContain('ミナシゴ');

    // まだ、獣は止められない。表にも呼べない
    expect(await run('fg 0999')).toContain('ひとたまりもない');
    expect(await run('kill 0999')).toContain('まだ早い');
    expect(shell.knownCommands()).not.toContain('kill'); // 手帳にはまだしまってある

    // ノーハップの案内で奥へ。分かれ道で獣が現れる（3分の時間制限）
    expect(await run('cd /proc/深い坑道')).toContain('cd 分かれ道');
    const beast = await run('cd 分かれ道');
    expect(beast).toContain('影の獣だ');
    expect(beast).toContain('ムラガレの組に入ったって言ってたよな');
    expect(beast).toContain('chgrp ムラガレ 隠れ場');
    expect(term.effects).toContain('stomp');
    expect(st.timer).toBeDefined();
    expect(toasts).toContain('📖 手帳に「chgrp」が追加された');

    // 隠れ場を作る。組をムラガレにして、家族に開け、よその者に閉める
    expect(await run('mkdir 隠れ場')).not.toContain('用事はない');
    expect(await run('chgrp ムラガレ 隠れ場')).toContain('の組が、ムラガレ になった');
    expect(st.flags.hid_together).toBeUndefined(); // まだ、よその者にも開いている
    const hid = await run('chmod g+rwx,o-rwx 隠れ場');
    expect(hid).toContain('通りすぎていく');
    expect(hid).toContain('kill するしかないか');
    expect(hid).not.toContain('手帳に、kill が戻ってきた');
    expect(st.timer).toBeUndefined();
    expect(await run('ls -l')).toMatch(/drwxrwx---\s+きみ\s+ムラガレ\s+隠れ場\//);
    expect(shell.knownCommands()).toContain('kill'); // 番号で止める言葉として戻る

    // 正しい kill。名前ではなく番号で
    expect(await run('kill 影の獣')).toContain('番号（PID）で書いてね');
    const killed = await run('kill 0999');
    expect(killed).toContain('ム……ラ……ガ……レ');
    expect(killed).toContain('古い竪坑');
    expect(await run('ps')).not.toContain('影の獣');
    expect(await run('kill 0000')).toContain('はじかれた'); // 名のない者は、止められない
    expect(await run('ps')).toMatch(/0000\s+？/);

    // 出口の古い竪坑を find で探して抜ける
    expect(await run('find /proc -name "*竪坑*"')).toBe('/proc/深い坑道/分かれ道/下り坂/崩れた横穴/古い竪坑');
    const end = await run('cd /proc/深い坑道/分かれ道/下り坂/崩れた横穴/古い竪坑');
    expect(end).toContain('ここで、お別れだ');
    expect(term.effects).toContain('chapterEnd');
    expect(st.flags.ch6_clear).toBe(true);
  });

  it('時間内に隠れられないと、ゲームオーバー。獣が現れる前（深い坑道）からやり直せる', async () => {
    const { st, run, shell, gameOvers } = setup();
    await untilBeast(run);
    await run('mkdir 隠れ場');
    expect(await run('cat ノーハップ')).toContain('急げ');
    // 時間切れ（打つ前に、もう時間が切れていた）
    st.timer!.deadline = Date.now() - 1;
    const caught = await run('chgrp ムラガレ 隠れ場');
    expect(caught).toContain('間に合わなかった');
    expect(caught).not.toContain('組が、ムラガレ'); // 時間切れのあとの言葉は届かない
    expect(gameOvers()).toBe(1);
    const back = shell.rewindState()!;
    expect(back.cwd).toEqual(['proc', '深い坑道']);
    expect(back.flags.beast_appeared).toBeUndefined();
    expect(back.ops ?? []).not.toContainEqual({ op: 'mkdir', path: '/proc/深い坑道/分かれ道/隠れ場' });

    // やり直すと、もう一度、分かれ道で獣が現れる
    const again = setup(JSON.parse(JSON.stringify(back)));
    expect(await again.run('cd 分かれ道')).toContain('影の獣だ');
    expect(await hide(again.run)).toContain('通りすぎていく');
  });

  it('時間制限の合図（足音）は、残り時間を見せずに迫ってくる', async () => {
    const { run, shell, term } = setup();
    await untilBeast(run);
    const t = shell.timerInfo()!;
    expect(t.deadline - t.startedAt).toBe(180_000);
    expect(t.warnings).toEqual([20, 45, 70, 95, 120, 145, 165]);
    await shell.warn(1);
    expect(term.take()).toContain('足音が、近づいてくる');
    await shell.warn(1);
    expect(term.take()).toBe(''); // 同じ合図は、一度だけ
  });

  it('番号をまちがえてノーハップやミナシゴを止めると、ゲームオーバー。唱える前からやり直せる', async () => {
    const { st, run, shell, gameOvers } = setup();
    await untilBeast(run);
    await hide(run);
    const wrong = await run('kill 0231');
    expect(wrong).toContain('番号、を');
    expect(wrong).toContain('一歩も動けなくなった');
    expect(gameOvers()).toBe(1);
    const back = shell.rewindState()!;
    expect(back.flags.killed_0231).toBeUndefined();
    expect(back.flags.hid_together).toBe(true);
    expect(st.flags.killed_0231).toBe(true);

    const again = setup(JSON.parse(JSON.stringify(back)));
    expect(await again.run('kill 0455')).toContain('一歩も動けなくなった');
  });

  it('chgrp は、自分の物を、自分が入っている組にだけ変えられる', async () => {
    const { run, st } = setup();
    st.learned.push('chgrp');
    expect(await run('chgrp 知らない組 点呼板')).toContain('入っていない');
    expect(await run('chgrp ムラガレ 点呼板')).toContain('Operation not permitted');
    expect(await run('chgrp ムラガレ')).toContain('組の名前と、場所が必要');
  });

  it('作った隠れ場と組・鍵は、セーブから元に戻る（章の clear からも）', async () => {
    const scn = load();
    const st = stateAtChapter(scn, 6, { name: 'ユウ', gender: 'boy' });
    const ch6 = scn.chapters.find((c) => c.no === 6)!.clear!;
    st.ops = [...(st.ops ?? []), ...ch6.ops!];
    st.perms = { ...st.perms, ...ch6.perms };
    for (const f of ch6.flags!) st.flags[f] = true;
    const { run } = setup(st);
    expect(await run('ls -l /proc/深い坑道/分かれ道')).toMatch(/drwxrwx---\s+きみ\s+ムラガレ\s+隠れ場\//);
  });
});
