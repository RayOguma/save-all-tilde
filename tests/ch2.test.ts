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

/** 第1章を終えて、もつれ沼の入口に立ったところから */
function setup(st?: GameState) {
  const scn = loadScenario([ch0Yaml, ch1Yaml, ch2Yaml, ch3Yaml, ch4Yaml, ch5Yaml, ch6Yaml], commandsYaml);
  st ??= (() => {
    const s = newState('ユウ', 'boy', ['lib'], [...scn.startCommands, 'pwd', 'ls -a', 'kill', 'find', 'find -name', 'find *', 'find -type d', 'cd -', 'ls 場所']);
    Object.assign(s.flags, {
      morihito_killed: true,
      saw_mom_frozen: true,
      quest_given: true,
      ch0_clear: true,
      kodama_joined: true,
      ch1_clear: true,
    });
    s.discovered.push('/', '/home', '/usr', '/lib');
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

describe('第2章', () => {
  it('第1章をクリアすると第2章。沼の枠', () => {
    const { shell } = setup();
    expect(shell.chapter().no).toBe(2);
    expect(shell.currentPlace().theme).toBe('swamp');
  });

  it('最初から最後まで通しで遊べる', async () => {
    const { st, run, term, toasts, shell, marks } = setup();

    // 同じ姿の二本道。見た目では区別がつかないが、A はリンク切れで入れない
    expect(await run('ls')).toContain('渡り道A/  渡り道B/');
    expect(buildMap(shell).find((r) => r.label === '渡り道A')).toMatchObject({ kind: 'dir', sub: undefined, stopped: false });
    expect(marks()).toEqual(['渡り道A', '渡り道B']); // どちらも調べるべき道
    // 入れるかどうかは行ってみないと分からないので、cd の候補にはどちらも出る
    expect(shell.suggest('cd 渡り道').map((s) => s.label)).toEqual(['渡り道A', '渡り道B']);
    const tried = await run('cd 渡り道A');
    expect(tried).toContain('そのようなファイルやディレクトリはありません');
    expect(tried).toContain('進めるとは限らぬ');
    expect(tried).not.toContain('住所は'); // 道しるべはそこにあるので、行き方の案内は出さない
    expect(await run('cd 渡り道A')).not.toContain('進めるとは限らぬ'); // 2回目は出ない
    expect(marks()).toEqual(['渡り道B']);

    // ツナギに ls -l を教わる
    await run('cd 渡り道B/岩場');
    expect(await run('cat ツナギ')).toContain('-l をつけて');
    expect(toasts).toContain('📖 手帳に「ls -l」が追加された');
    expect(await run('ls -l /lib')).toContain('渡り道A -> 沈んだ祠');
    expect(marks()).toEqual(['浮き草']);

    // カエル兄弟。どちらにも「!」。弟に話しかけても、兄が答える
    await run('cd /lib/浮き草');
    await run('ls');
    expect(marks()).toEqual(['カエル兄', 'カエル弟']);
    const ani = await run('cat カエル兄');
    expect(ani).toContain('別のカエルだぞ');
    expect(ani).not.toContain('あれ？'); // 1回目は、まだおかしいと気づかない
    expect(toasts).not.toContain('📖 手帳に「file」が追加された');
    expect(await run('cat カエル兄')).not.toContain('二匹、と言うが'); // 同じ名前で呼んでも、気づかない
    const otouto = await run('cat カエル弟');
    expect(otouto).toContain('おいらはカエル兄');
    expect(otouto).toContain('いま、弟が呼ばれたよな？');
    expect(otouto).toContain('二匹、と言うが');
    expect(toasts).toContain('📖 手帳に「file」が追加された');
    expect(marks()).toEqual(['カエル弟']); // 次は、弟の正体を file で
    await run('cd /lib/渡り道B/岩場');
    expect(await run('file /lib/浮き草/カエル兄')).toContain('カエル（ふつうのファイル）');
    const reveal = await run('file /lib/浮き草/カエル弟');
    expect(reveal).toContain('symbolic link to カエル兄');
    expect(reveal).toContain('おまえは、おいらだったのか');
    expect(reveal).toContain('シンボリックリンク'); // 用語は、この世界の例えで説明する
    expect(reveal).toContain('名札');
    expect(await run('file /lib/渡り道A')).toContain('broken symbolic link to 沈んだ祠');
    await run('ls');
    expect(marks()).toEqual(['ツナギ']); // 岩場にいるので、ツナギ本人に「!」

    // ツナギに ln -s と unlink を教わる
    expect(await run('cat ツナギ')).toContain('ln -s /lib/中州 飛び石');
    expect(toasts).toContain('📖 手帳に「ln」が追加された');
    expect(toasts).toContain('📖 手帳に「unlink」が追加された');

    // 飛び石なしでは渡れない
    expect(await run('cd /lib/中州')).toContain('道をつなげば、渡れるかもしれない');
    expect(st.cwd).toEqual(['lib', '渡り道B', '岩場']);

    // 間違えてつないでも、unlink で切れる
    expect(await run('ln -s /lib/なかす 飛び石')).toContain('どこにもつながっていない');
    expect(await run('ln -s /lib/中州 飛び石')).toContain('もうある');
    await run('unlink 飛び石');
    expect(await run('ls')).not.toContain('飛び石');

    // つないで渡る。着いた先は本当の場所
    await run('ln -s /lib/中州 飛び石');
    expect(await run('ls -l')).toContain('飛び石 -> /lib/中州');
    const crossed = await run('cd 飛び石');
    expect(crossed).toContain('リンクって、道にもなるんだ');
    expect(crossed).toContain('次は葦の原へつなげば');
    expect((await run('pwd')).split('\n')[0]).toBe('/lib/中州');

    // 2か所目: 立て札に行き先が書いてある
    expect(await run('cat 立て札')).toContain('/lib/葦の原');
    await run('ln -s /lib/葦の原 飛び石');
    expect(await run('cd 飛び石')).toContain('鈴を探したとき');
    expect((await run('pwd')).split('\n')[0]).toBe('/lib/葦の原');

    // 3か所目: 行き先を自分で探す
    const found = await run('find /lib -type d -name "*岸*"');
    expect(found.split('\n')[0]).toBe('/lib/向こう岸');
    expect(found).toContain('石を置けば');
    await run('ln -s /lib/向こう岸 飛び石');
    expect(await run('cd 飛び石')).toContain('向こう岸に渡りきった');
    expect(marks()).toEqual(['向こう岸']); // 着いただけでは、中の物は地図に出ない。見渡す合図に、いまいる場所に「!」
    await run('ls');
    expect(marks()).toEqual(['ムラガレへの近道']);

    // リンクをたどって、チルダ村の隣の村へ
    const end = await run('cd ムラガレへの近道');
    expect(end).toContain('チルダ村のすぐ隣');
    expect(st.flags.ch2_clear).toBe(true);
    expect(term.effects).toContain('chapterEnd');
    expect(st.cwd).toEqual(['home', 'ムラガレ']);
    expect(shell.currentPlace()).toMatchObject({ theme: 'dusk', drained: true });
  });

  it('自分で沼へ来ていても、導入を見ていなければ、つづきからで導入を出す', async () => {
    const { st, shell } = setup();
    delete st.introSeen; // 導入の記録がない古いセーブ
    expect(shell.needsChapterStart()).toBe(true);
    shell.arriveAtChapterStart();
    expect(st.cwd).toEqual(['lib']); // もう着いているので動かさない
    expect(shell.needsChapterStart()).toBe(false);
    expect(st.introSeen).toEqual([0, 1, 2]);
  });

  it('沼の向こうの場所は、find で見つけるか飛び石で渡るまで、地図にも ls にも出ない', async () => {
    const { run, shell } = setup();
    await run('cd /lib');
    const labels = () => buildMap(shell).map((r) => r.label);
    const first = await run('ls');
    for (const far of ['中州', '葦の原', '向こう岸']) {
      expect(first).not.toContain(far);
      expect(labels()).not.toContain(far);
    }
    expect(await run('find /lib -type d -name "*岸*"')).toBe('/lib/向こう岸');
    expect(labels()).toContain('向こう岸'); // 見つけたら地図に載る
    expect(await run('ls /lib')).toContain('向こう岸/');
    expect(labels()).not.toContain('中州');
  });

  it('沼で最初に ls すると、コダマが二本道に気づく（1回だけ）', async () => {
    const { run } = setup();
    expect(await run('ls')).toContain('どちらかは、偽りやもしれぬ');
    expect(await run('ls')).not.toContain('どちらかは、偽りやもしれぬ');
  });

  it('カエルは、弟→兄の順に呼んでも気づく', async () => {
    const { run, st } = setup();
    st.flags.met_tsunagi = true;
    await run('cd 浮き草');
    expect(await run('cat カエル弟')).not.toContain('あれ？');
    const ani = await run('cat カエル兄');
    expect(ani).toContain('答えてたのは、おいらだったような');
    expect(ani).toContain('二匹、と言うが');
    expect(st.learned).toContain('file');
  });

  it('kill は、第0章が終わると手帳にも候補にも出ない（唱えることはできる）', () => {
    const { shell, st } = setup();
    expect(st.learned).toContain('kill');
    expect(shell.knownCommands()).not.toContain('kill');
    expect(shell.suggest('ki')).toEqual([]);
  });

  it('門で沼へ移る前に第1章をクリアした古いセーブでも、第2章の始まり（沼の入口）へ移る', async () => {
    const { st, shell } = setup();
    delete st.introSeen;
    st.cwd = ['usr', '霧の谷', '深い霧', '濃い霧', '霧の小道', '崖の下', '岩かげ', '苔むした門'];
    st.visited = st.visited.filter((p) => p !== '/lib');
    expect(shell.needsChapterStart()).toBe(true);
    shell.arriveAtChapterStart();
    expect(st.cwd).toEqual(['lib']);
    expect(st.discovered).toContain('/lib');
    expect(st.discovered).not.toContain('/lib/渡り道B'); // 中の場所は、ls で見渡すまで地図に載らない
    expect(shell.needsChapterStart()).toBe(false); // 2回目は移さない
  });

  it('寄り道: リンク切れの行き先、沈んだ祠を探す', async () => {
    const { run } = setup();
    expect(await run('find /lib -name 沈んだ祠')).toBe('/lib/沼の底/沈んだ祠');
    await run('cd /lib/沼の底/沈んだ祠');
    expect(await run('cat 古い石')).toContain('モリビト 試作一号');
  });

  it('カエル弟は、正体を見破るまで人として見える', async () => {
    const { run, st } = setup();
    await run('cd 浮き草');
    expect(await run('ls')).toBe('カエル兄  カエル弟');
    st.learned.push('file');
    await run('file カエル弟');
    expect(await run('ls -l')).toContain('カエル弟 -> カエル兄');
  });

  it('リンクを作れるのは、置ける場所だけ', async () => {
    const { run, st } = setup();
    st.learned.push('ln', 'unlink', 'file');
    expect(await run('ln -s /lib/中州 飛び石')).toContain('Permission denied'); // 沼の入口には置けない
    expect(await run('ln /lib/中州 飛び石')).toContain('-s をつけて');
    expect(await run('unlink /lib/浮き草/カエル兄')).toContain('リンクではない');
    expect(await run('unlink /lib/浮き草/カエル弟')).toContain('Permission denied'); // 人の作ったリンクは切れない
  });

  it('作ったリンクはセーブに残り、つづきからでも使える', async () => {
    const a = setup();
    a.st.learned.push('ln');
    a.st.cwd = ['lib', '渡り道B', '岩場'];
    await a.run('ln -s /lib/中州 飛び石');
    const saved: GameState = JSON.parse(JSON.stringify(a.st));

    const b = setup(saved); // 世界を読み直す（セーブから再開）
    expect(await b.run('ls -l')).toContain('飛び石 -> /lib/中州');
    await b.run('cd 飛び石');
    expect(b.st.cwd).toEqual(['lib', '中州']);
  });

  it('ぐるぐる指し合うリンクは、たどりつけないと教える', async () => {
    const { run, st } = setup();
    st.learned.push('ln');
    st.cwd = ['lib', '中州'];
    await run('ln -s /lib/中州/B A');
    await run('ln -s /lib/中州/A B');
    expect(await run('cd A')).toContain('ぐるぐる指し合って');
  });

  it('前の章で飛ばした「!」は、後の章に残らない', async () => {
    const { marks, run } = setup(); // 第1章のリスとは話していない
    await run('ls');
    expect(marks()).not.toContain('迷いの森');
  });

  it('地図: 今いるステージだけ開き、ほかのステージは閉じている', async () => {
    const { run, shell, st } = setup();
    st.discovered.push('/usr/倒木', '/home/チルダ村/パン屋');
    await run('ls');
    const rows = buildMap(shell);
    const row = (label: string) => rows.find((r) => r.label === label);
    expect(row('もつれ沼')?.fold).toBe('open');
    expect(row('迷いの森')?.fold).toBe('closed');
    expect(row('チルダ村')?.fold).toBe('closed');
    expect(row('倒木')).toBeUndefined(); // 閉じたステージの中は出ない
    expect(row('渡り道B')).toBeDefined();

    // 手で開けば、中が見える
    const opened = buildMap(shell, new Map([['/usr', true]]));
    expect(opened.find((r) => r.label === '倒木')).toBeDefined();

    // 別のステージへ移ると、そちらが開く
    await run('cd /usr');
    const inForest = buildMap(shell);
    expect(inForest.find((r) => r.label === '迷いの森')?.fold).toBe('open');
    expect(inForest.find((r) => r.label === 'もつれ沼')?.fold).toBe('closed');
  });

  it('地図: リンクには「→ 行き先」が出て、リンク切れは取り消し線', async () => {
    const { run, shell } = setup();
    await run('ls');
    await run('ls -l'); // 正体を見破る
    const rows = buildMap(shell);
    const a = rows.find((r) => r.label === '渡り道A')!;
    expect(a).toMatchObject({ kind: 'link', sub: '→ 沈んだ祠', stopped: true });
    expect(await run('ls')).toContain('渡り道A  渡り道B/'); // 見破ったあとは、ls でもリンクとして出る
  });
});
