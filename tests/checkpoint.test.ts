import { describe, expect, it } from 'vitest';
import commandsYaml from '../scenario/commands.yaml?raw';
import ch0Yaml from '../scenario/ch0.yaml?raw';
import ch1Yaml from '../scenario/ch1.yaml?raw';
import ch2Yaml from '../scenario/ch2.yaml?raw';
import ch3Yaml from '../scenario/ch3.yaml?raw';
import ch4Yaml from '../scenario/ch4.yaml?raw';
import ch5Yaml from '../scenario/ch5.yaml?raw';
import ch6Yaml from '../scenario/ch6.yaml?raw';
import { fillChapterCheckpoint, snapshot, startAtChapter, stateAtChapter } from '../src/checkpoint';
import { loadScenario } from '../src/scenario';
import { Shell, type Term } from '../src/shell';
import type { GameState } from '../src/state';
import { msgText, type Line, type Msg } from '../src/text';
import { joinPath } from '../src/vfs';

class FakeTerm implements Term {
  out: string[] = [];
  print(line: Line = '') {
    this.out.push(typeof line === 'string' ? line : line.map((s) => s.t).join(''));
  }
  async say(msgs: Msg[], _instant?: boolean) {
    msgs.forEach((m) => this.print(msgText(m)));
  }
  clear() {}
  async effect() {}
  async readLine() {
    return '';
  }
  take() {
    const s = this.out.join('\n');
    this.out = [];
    return s;
  }
}

const load = () => loadScenario([ch0Yaml, ch1Yaml, ch2Yaml, ch3Yaml, ch4Yaml, ch5Yaml, ch6Yaml], commandsYaml);

function play(st: GameState) {
  const scn = load();
  const term = new FakeTerm();
  const shell = new Shell(scn, st, term, { restart() {}, update() {}, toast() {} });
  const run = async (cmd: string) => {
    await shell.exec(cmd);
    return term.take();
  };
  return { shell, run, st };
}

describe('章を選んで始める', () => {
  it.each([1, 2, 3])('第%i章の最初から始められる', (no) => {
    const scn = load();
    const st = stateAtChapter(scn, no, { name: 'ユウ', gender: 'boy' });
    const { shell } = play(st);
    const ch = scn.chapters.find((c) => c.no === no)!;
    expect(shell.chapter().no).toBe(no);
    expect(joinPath(st.cwd)).toBe(ch.startAt);
    expect(shell.needsChapterStart()).toBe(true); // 導入から始まる
    expect(shell.currentObjective()).not.toBe('');
  });

  it('組み立てた第3章のはじめから、最後まで遊べる', async () => {
    const { run, st } = play(stateAtChapter(load(), 3, { name: 'ハナ', gender: 'girl' }));
    await run('cat ハル');
    await run('cat グロウプ婆の家/グロウプ婆');
    await run('chmod u+rwx 空き家');
    await run('cd 空き家');
    await run('write 薬屋のじいさん "ハルの薬をください"');
    await run('cat /home/ムラガレ/物置/棚/下の段/干した薬草');
    await run('write 薬屋のじいさん "薬草を持ってきました"');
    await run('cat /home/ムラガレ/薬屋/薬屋のじいさん');
    await run('cat /home/ムラガレ/ハル');
    expect(await run('cat /home/ムラガレ/グロウプ婆の家/グロウプ婆')).toContain('市場町イチバ');
    expect(st.flags.ch3_clear).toBe(true);
  });

  it('組み立てた第2章のはじめでは、コダマが仲間で、find を知っている', async () => {
    const { run, shell } = play(stateAtChapter(load(), 2, { name: 'ユウ', gender: 'boy' }));
    expect(shell.party().map((c) => c.node.name)).toEqual(['コダマ']);
    expect(await run('find /lib -name 沈んだ祠')).toBe('/lib/沼の底/沈んだ祠');
  });

  it('着いたことのある章は、そのときの状態から始まる（チェックポイント）', () => {
    const scn = load();
    const at2 = stateAtChapter(scn, 2, { name: 'ミオ', gender: 'girl' });
    at2.introSeen = [0, 1, 2];
    at2.history.push('ls');
    const later: GameState = { ...stateAtChapter(scn, 3, { name: 'ミオ', gender: 'girl' }), checkpoints: { 2: snapshot(at2, 2) } };

    const st = startAtChapter(scn, 2, later);
    expect(st.name).toBe('ミオ');
    expect(st.history.at(-1)).toBe('ls'); // 着いたあとに打ったコマンドも残る
    expect(st.history).toContain('kill .モリビト'); // 前の章の clear の history も積んである
    expect(st.introSeen).toEqual([0, 1]); // 選んだ章の導入は、もう一度見る
    expect(st.checkpoints?.[2]).toBeDefined(); // チェックポイントは残る
    expect(st.flags.ch2_clear).toBeUndefined();
  });

  it('章の終わりで「セーブして終わる」を選んだセーブでも、次の章を選べる', () => {
    const scn = load();
    // 第1章をクリアして、第2章が始まる前にやめたセーブ（第2章の導入はまだ見ていない）
    const saved: GameState = { ...stateAtChapter(scn, 2, { name: 'ミオ', gender: 'girl' }), checkpoints: { 1: snapshot(stateAtChapter(scn, 1, { name: 'ミオ', gender: 'girl' }), 1) } };
    expect(fillChapterCheckpoint(scn, saved)).toBe(true);
    expect(saved.checkpoints?.[2]).toBeDefined();

    const { shell } = play(startAtChapter(scn, 2, saved));
    expect(shell.chapter().no).toBe(2);
    expect(shell.needsChapterStart()).toBe(true); // 導入から始まる

    // もう始まっている章には、足さない（章のはじめのチェックポイントを、途中の状態で上書きしない）
    const started: GameState = { ...stateAtChapter(scn, 2, { name: 'ミオ', gender: 'girl' }), introSeen: [0, 1, 2] };
    expect(fillChapterCheckpoint(scn, started)).toBe(false);
    expect(started.checkpoints?.[2]).toBeUndefined();
  });

  it('?dev のテストプレイでは、遊んだ記録を使わず、いつも新しく組み立てる', () => {
    const scn = load();
    const at2 = stateAtChapter(scn, 2, { name: 'ミオ', gender: 'girl' });
    at2.history.push('ls');
    at2.discovered.push('/lib/渡り道A'); // 前のしくみで地図に載った場所
    const later: GameState = { ...stateAtChapter(scn, 3, { name: 'ミオ', gender: 'girl' }), checkpoints: { 2: snapshot(at2, 2) } };

    const st = startAtChapter(scn, 2, later, true);
    expect(st.name).toBe('ミオ'); // 名前と性別は、今のセーブのまま
    expect(st.gender).toBe('girl');
    expect(st.history).toEqual(stateAtChapter(scn, 2, { name: 'ミオ', gender: 'girl' }).history); // 組み立てなおした記録（遊んだ ls はない）
    expect(st.discovered).not.toContain('/lib/渡り道A');
    expect(st.checkpoints?.[2]).toBeDefined(); // 遊んだ記録そのものは消さない
  });
});
