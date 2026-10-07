// シナリオYAMLから、読み物としての台本（Markdown）を書き出す。
// 使い方: npm run script   （scenario/ch*.yaml → docs/chapters/ch*_script.md）
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { parse } from 'yaml';

const COND_WORDS: Record<string, string> = {
  did_ls: 'はじめて ls した',
  looked_window: '窓の外を見た',
  mom_called: 'お母さんに呼ばれた',
  errand_bread: 'パンのおつかいを頼まれた',
  got_bread: 'パンを受け取った',
  bread_delivered: 'パンを家に届けた',
  gave_share: 'チョウン爺におすそわけした',
  talked_chown: 'チョウン爺と話した',
  talked_cat: 'キャットと話した',
  talked_vim: 'ヴィム婆と話した',
  talked_emacs: 'イーマ爺と話した',
  world_revealed: '世界が開けた',
  read_board: '掲示板を読んだ',
  talked_nano: 'ナノと話した',
  talked_piko: 'ピコと話した',
  found_hole: '抜け穴を見つけた',
  saw_stone: '石碑を読んだ',
  morihito_killed: 'モリビトを止めた',
  saw_mom_frozen: '止まったお母さんを見た',
  talked_squirrel: 'リスと話した',
  met_kodama: 'コダマに会った',
  got_bell: '鈴を拾った',
  returned_bell: '鈴を返した',
  sign_e: '道しるべ・東を読んだ',
  sign_n: '道しるべ・北を読んだ',
  sign_w: '道しるべ・西を読んだ',
  signs_done: '道しるべがそろった',
  last_find_empty: '直前の find で何も見つからなかった',
  kodama_joined: 'コダマが仲間になった',
  ch1_clear: '第1章クリア',
  met_tsunagi: 'ツナギに会った',
  talked_frog: 'カエルと話した',
  frog_hint: 'file を教わった',
  frog_revealed: 'カエル弟の正体が分かった',
  learned_ln: 'ln -s を教わった',
  crossed_1: '中州に渡った',
  crossed_2: '葦の原に渡った',
  reached_far_shore: '向こう岸に着いた',
  found_shrine: '沈んだ祠を見つけた',
  ch2_clear: '第2章クリア',
  talked_haru: 'ハルと話した',
  met_groupu: 'グロウプ婆に会った',
  entered_akiya: '空き家に入った',
  asked_herb: '薬草を頼まれた',
  got_herb: '薬草を手に入れた',
  medicine_open: '薬屋が扉を開けた',
  asked_medicine: 'ハルの薬を頼まれた',
  got_medicine: '薬を受け取った',
  gave_haru: 'ハルに薬を届けた',
  ch3_clear: '第3章クリア',
  quest_given: '村長に旅を頼まれた',
  ch0_clear: '第0章クリア',
  seen_kodama: '隠れたコダマを見つけた',
  found_necklace: '首飾りを見つけた',
  got_necklace: '首飾りを拾った',
  told_signs: '道しるべの話を聞いた',
  met_apt: 'アプトに会った',
  box_moved: '木箱を運んだ',
  told_bag: 'かばんの話を聞いた',
  bag_made: 'かばんを作った',
  pass_given: '通行証をもらった',
  pass_in_bag: '通行証をかばんにしまった',
  met_dd: 'ディディ爺に会った',
  map_copied: '地図の巻物を写した',
  notes_copied: 'スドウの覚え書きを写した',
  met_rine: 'リネに会った',
  sign_fixed: '八百屋の看板を直した',
  met_pip: 'ピップに会った',
  stage_built: '舞台を作った',
  heard_rumor: 'スドウの噂を聞いた',
  map_found: '地図の巻物を見つけた',
  saw_cleaner: '片づけ番に会った',
  ch4_clear: '第4章クリア',
  tried_path_a: '渡り道Aに入れなかった',
  heard_ani: 'カエル兄と呼んだ',
  heard_otouto: 'カエル弟と呼んだ',
  akiya_unlocked: '空き家の鍵を開けた',
  herb_found: '薬草を見つけた',
  pass_shown: '関所で通行証を見せた',
  found_bundles: '瓦礫の包みを見つけた',
  read_note: 'スドウの書き置きを読んだ',
  listed_kaya: 'カヤの包みをのぞいた',
  rescued_kaya: 'カヤを助けた',
  kaya_told: 'カヤから鼓動の話を聞いた',
  told_shrine: 'カヤから祠の話を聞いた',
  reached_shrine: '古い祠に渡った',
  listed_box: '古い箱をのぞいた',
  found_blueprint: '設計図を見つけた',
  blueprint_packed: '設計図をまとめた',
  blueprint_in_bag: '設計図をかばんにしまった',
  rescued_make: 'メイクを助けた',
  rescued_yam: 'ヤムを助けた',
  rescued_zip: 'ジップを助けた',
  ch5_clear: '第5章クリア',
  named_blueprint: '紙の束に「設計図」と名札をつけた',
  read_tag: '添え書きを読んだ',
  reported_kaya: 'カヤに知らせた',
  read_roll: '点呼板を読んだ',
  saw_ps: 'はじめて ps した',
  wrote_nohup: 'ノーハップに声をかけた',
  nohup_appeared: 'ノーハップを表に呼んだ',
  gave_medicine: 'ノーハップに薬を渡した',
  minashigo_appeared: 'ミナシゴを表に呼んだ',
  talked_minashigo: 'ミナシゴと話した',
  minashigo_hidden: 'ミナシゴを裏に隠した',
  beast_appeared: '影の獣が現れた',
  hid_together: '隠れ場に隠れた',
  kill_returned: 'kill が手帳に戻った',
  beast_killed: '影の獣を止めた',
  fg_0231: 'ノーハップが表にいる',
  fg_0455: 'ミナシゴが表にいる',
  killed_0999: '影の獣（0999）を止めた',
  ch6_clear: '第6章クリア',
  met_kron: 'クロンに会った',
  saw_date: 'はじめて date した',
  date_twice: 'もう一度 date した',
  asked_schedule: '予定表を読むよう頼まれた',
  read_cron: '予定表の読み方を教わった',
  backed_up: '予定表の写し（予定表.bak）をとった',
  cron_writable: '予定表に書く鍵を開けた',
  tried_echo: 'はじめて echo した',
  wrote_cron: '予定表に書いた',
  bell_fixed: '鐘を直した（時が動きだした）',
  cron_bell: '予定表の鐘の行が正しい',
  cron_bell_written: '予定表に鐘の行がある',
  read_door1: '扉1の札を読んだ',
  cron_door1: '予定表の扉1の行が正しい',
  cron_door1_written: '予定表に扉1の行がある',
  door1_open: '扉1が開いた',
  cron_door2: '予定表の扉2の行が正しい',
  cron_door2_written: '予定表に扉2の行がある',
  door2_open: '扉2が開いた',
  cron_door3: '予定表の扉3の行が正しい',
  cron_door3_written: '予定表に扉3の行がある',
  door3_open: '扉3が開いた',
  tower_view: '頂上から見晴らした',
  ch7_clear: '第7章クリア',
};

function cond(c?: string): string {
  if (!c) return 'いつも';
  return c
    .split('|')
    .map((alt) =>
      alt
        .replace(/[()]/g, '')
        .split('&')
        .map((t) => t.trim())
        .map((t) => (t.startsWith('!') ? `「${COND_WORDS[t.slice(1)] ?? t.slice(1)}」でない` : `「${COND_WORDS[t] ?? t}」`))
        .join(' かつ '),
    )
    .join(' ／または ');
}

function block(lines: string[] = []): string {
  const FX: Record<string, string> = {
    stomp: 'ずしーん（足音・画面が揺れる）',
    roar: '獣の叫び声（画面が震える）',
    shake: '画面が揺れる',
    bell: '鐘の音',
    towerbell: '塔の鐘「カーン」',
    tick: 'カチ、コチ（秒針の音）',
    unlock: '扉の錠がはずれる「カチャリ」',
    shadow: '画面が暗く沈み、ザザッと乱れる（記録の影）',
    light: '首飾りがまばゆく光る（影がはらわれる）',
    revive: '「復活の祈り」が流れ、画面が真っ白になる（守り人が動きだす）',
    dawn: '真っ白から戻ると、村に色と音が戻っている',
    chapterEnd: '暗転して、章の終わりへ',
  };
  return lines.map((l) => (/^<(\w+)>$/.test(l) ? `> 💥 ${FX[l.slice(1, -1)] ?? l.slice(1, -1)}` : `> ${l}`)).join('  \n');
}

function trigger(t: any, title: string): string {
  const out = [`**${title}**（${cond(t.if)}${t.once ? '・1回だけ' : ''}）`];
  if (t.lines) out.push(block(t.lines));
  if (t.effect) out.push(`🎬 演出: \`${t.effect}\``);
  if (t.guide) out.push(`🔦 画面を照らして説明:\n\n${t.guide.map((g: { at: string; text: string }) => `1. （${g.at}）${g.text}`).join('\n')}`);
  if (t.after) out.push(block(t.after));
  if (t.demo) out.push(demo(t.demo));
  if (t.timeLimit) {
    const tl = t.timeLimit;
    out.push(
      `⏱ **時間制限 ${tl.seconds} 秒**（残り時間は見せない）: ${tl.path} が${tl.group ? ` 組 ${tl.group}・` : ''}鍵 ${tl.mode ?? '（なんでも）'} になれば成功`,
    );
    for (const w of tl.warnings ?? []) out.push(`${w.at} 秒: ${w.lines.join(' ')}`);
    out.push(trigger(tl.onSuccess, '間に合ったとき'));
    out.push(trigger(tl.onTimeout, '時間切れのとき'));
  }
  if (t.gameOver) out.push('💀 **ゲームオーバー**（やり直しの場所から始め直す）');
  const notes = [
    t.rewindPoint && `やり直しの場所: ここ${t.rewindPoint.cwd ? `（${t.rewindPoint.cwd} から）` : ''}`,
    t.set && `フラグ: ${t.set.map((f: string) => COND_WORDS[f] ?? f).join('、')}`,
    t.learn && `手帳に追加: ${t.learn.join('、')}`,
    t.reveal && `地図に表示: ${t.reveal.join('、')}`,
    t.exists && `あるとき: ${t.exists.join('、')}`,
    t.missing && `ないとき: ${t.missing.join('、')}`,
    t.target && `対象: ${t.target}`,
    t.found && `見つけたもの: ${t.found}`,
    t.wrote && `書いた紙: ${t.wrote}`,
    t.from && `パイプで流しこんだもの: ${t.from}`,
    t.identified && `正体を見破ったとき: ${t.identified}`,
    t.chown && `持ち主を変える: ${t.chown.path} → ${t.chown.owner}`,
  ].filter(Boolean);
  if (notes.length) out.push(`<sub>${notes.join(' ／ ')}</sub>`);
  return out.join('\n\n');
}

/** だれかがコマンドを打ってみせる手本 */
function demo(d: any): string {
  const out = [`⌨ **${d.by} の手本**（入力欄にゆっくり打ってみせる）`];
  for (const s of d.steps) {
    if (s.say) out.push(block(s.say));
    const pause = s.pauseAt ? `（「${s.pauseAt}」で止まって説明${s.tab ? '、Tab で補う' : ''}）` : '';
    out.push(`\`${d.by}$ ${s.type}\`${pause}`);
    const guides = [...(s.hold ?? []), ...(s.guide ?? [])];
    if (guides.length) out.push(guides.map((g: { at: string; text: string }) => `1. 🔦（${g.at}）${g.text}`).join('\n'));
    if (s.after) out.push(block(s.after));
  }
  return out.join('\n\n');
}

function node(n: any, path: string[], out: string[]) {
  const here = [...path, n.name].filter(Boolean);
  const p = '/' + here.join('/');
  const isDir = n.children !== undefined;
  const parts: string[] = [];

  if (n.mark) parts.push(`❗ **物語上ここへ行く必要がある**: ${cond(n.mark)}`);
  if (n.gate) parts.push(trigger({ if: n.gate.if, lines: n.gate.lines }, '通れないとき'));
  if (n.deniedLines) parts.push(trigger({ lines: n.deniedLines }, 'Permission denied のとき'));
  if (n.text) parts.push(['📜 紙に書かれた字（cat で、字のまま出る）:', '', '```', ...n.text, '```'].join('\n'));
  for (const t of n.onEnter ?? []) parts.push(trigger(t, '入ったとき'));
  if (!isDir && n.lines) {
    parts.push(trigger({ lines: n.lines, set: n.set, learn: n.learn }, n.type === 'process' ? 'cat したとき' : '話す・調べる'));
    for (const v of n.variants ?? [])
      parts.push(trigger({ ...v, lines: v.garble ? ['（文字化けして読めない）'] : v.lines }, v.at ? `変化（${v.at} にいるとき）` : '変化'));
  }
  if (n.onKill) parts.push(trigger(n.onKill, 'kill したとき'));
  if (n.onFile) parts.push(trigger(n.onFile, 'file で調べたとき'));
  if (n.onBroken) parts.push(trigger(n.onBroken, 'リンク切れで入れなかったとき'));
  if (n.noUnlink) parts.push(trigger({ lines: n.noUnlink }, 'unlink で抜こうとしたとき（抜けない）'));
  if (n.killBlocked) parts.push(trigger({ if: n.killBlockedIf, lines: n.killBlocked }, 'kill を唱えようとしたとき（唱えない）'));
  for (const t of n.onChmod ?? []) parts.push(trigger(t, `chmod で鍵を変えたとき${t.can ? `（${t.can} があるとき）` : ''}`));
  if (n.onMv) parts.push(trigger({ lines: n.onMv }, 'mv で運ぼうとしたとき'));
  if (n.onList) parts.push(trigger(n.onList, 'tar -tzf で中をのぞいたとき'));
  if (n.onExtract) parts.push(trigger(n.onExtract, 'tar -xzf でほどいたとき'));
  if (n.archive) parts.push(`📦 包みの中身: ${n.archive.map((a: any) => a.name + (a.children ? '/' : '')).join('、')}`);
  if (n.needsLink) parts.push(trigger({ lines: n.needsLink }, '飛び石なしで cd したとき'));
  for (const w of n.onWrite ?? []) parts.push(trigger(w, `write で「${(w.has ?? ['（どんなことばでも）']).join('／')}」と届けたとき`));

  if (parts.length) {
    const title = n.label ? `${n.label}（${p}）` : p;
    const icon = n.link !== undefined ? '🔗' : isDir ? '📁' : n.type === 'process' ? '⚙' : '📄';
    out.push(`### ${icon} ${title}${n.link !== undefined ? ` -> ${n.link}` : ''}`, '', parts.join('\n\n'), '');
  }
  for (const c of n.children ?? []) node(c, here, out);
  // 包みの中身は、ほどくと包みのある場所に出てくる
  for (const c of n.archive ?? []) node(c, [...path, `${n.name} の中`], out);
}

function exportChapter(file: string) {
  const s = parse(readFileSync(`scenario/${file}`, 'utf8'));
  const out: string[] = [
    `# 第${s.chapter.no}章 ${s.chapter.title} 台本`,
    '',
    `> このファイルは \`scenario/${file}\` から自動で書き出したもの。直すときは YAML のほうを直して \`npm run script\` する。`,
    '>',
    '> `{name}` はプレイヤーの名前、`{me}` は主人公の一人称（男の子「ぼく」／女の子「わたし」）。',
    '',
    '## オープニング',
    '',
    block(s.intro),
    '',
    '（はじめて遊ぶ人には、ここで画面の説明が入る）',
    '',
    block(s.guide ?? []),
    '',
    ...(s.opening ? [trigger(s.opening, '章のはじめのイベント'), ''] : []),
    ...(s.self
      ? [
          '## 🙂 主人公自身（cat 自分の名前）',
          '',
          trigger({ lines: s.self.lines }, '話す・調べる'),
          '',
          ...(s.self.variants ?? []).flatMap((v: any) => [trigger(v, '変化'), '']),
        ]
      : []),
    '## 🎯 目的の移り変わり（上ほど優先）',
    '',
    '| 条件 | 表示 |',
    '|---|---|',
    ...s.objectives.map((o: any) => `| ${cond(o.if)} | ${o.text} |`),
    '',
    '## 💡 ヒント（3段階）',
    '',
    ...s.hints.flatMap((h: any) => [`**${cond(h.if)}**`, '', ...h.steps.map((st: string, i: number) => `${i + 1}. ${st}`), '']),
    '## コマンドを打ったあとのイベント',
    '',
    ...(s.events ?? []).map((e: any) => trigger(e, `${e.on} のあと`) + '\n'),
    '## 場所ごとのセリフ',
    '',
  ];
  if (s.root) node(s.root, [], out);
  // 後の章は、前の章の場所に中身を足している
  for (const p of s.places ?? []) {
    const parts = p.path.split('/').filter(Boolean);
    node({ ...p, name: parts.pop() }, parts, out);
  }
  if (s.procs?.length) {
    out.push('## 目に見えずに動いている者たち（ps・fg・bg・kill 番号）', '');
    for (const p of s.procs) {
      const parts: string[] = [`状態: ${p.state}${p.if ? `（${cond(p.if)}）` : ''}`];
      for (const w of p.onWrite ?? []) parts.push(trigger(w, `write で「${(w.has ?? ['（どんなことばでも）']).join('／')}」と届けたとき`));
      if (p.noFg) parts.push(trigger({ lines: p.noFg }, 'fg で呼べないとき'));
      if (p.onFg) parts.push(trigger(p.onFg, 'fg で表に呼んだとき'));
      if (p.onBg) parts.push(trigger(p.onBg, 'bg で裏に戻したとき'));
      if (p.killBlocked) parts.push(trigger({ if: p.killIf ? `!(${p.killIf})` : undefined, lines: p.killBlocked }, 'まだ kill できないとき'));
      if (p.onKill) parts.push(trigger(p.onKill, 'kill したとき'));
      out.push(`### ⚙ ${p.pid} ${p.name}`, '', parts.join('\n\n'), '');
    }
  }
  if (s.date?.length) {
    out.push('## 🕰 date で出る日時（上ほど優先）', '', '| 条件 | 日時 |', '|---|---|');
    for (const d of s.date) out.push(`| ${cond(d.if)} | ${d.text} |`);
    out.push('');
  }
  if (s.cron) {
    out.push('## 📅 予定表を塔に渡したとき（crontab 紙）', '', '| 仕事に含む言葉 | 正しい時刻 | フラグ |', '|---|---|---|');
    for (const j of s.cron.jobs) out.push(`| ${j.key} | ${j.at.map((a: string) => `\`${a}\``).join(' / ')}${j.all ? '（その行がぜんぶ）' : ''} | ${j.flag} |`);
    out.push('', '上から、条件が合った最初の反応:', '');
    for (const t of s.cron.onInstall) out.push(trigger(t, '渡したとき'), '');
    for (const t of s.cron.onError ?? []) out.push(trigger(t, '行の形がおかしくて、渡せなかったとき'), '');
  }
  if (s.services?.length) {
    out.push('## ⚙ systemctl で動かすもの', '');
    for (const sv of s.services) {
      out.push(`### ${sv.name}（${sv.desc}）`, '', `動いている条件: ${cond(sv.activeIf)}`, '');
      for (const t of sv.onStart) out.push(trigger(t, 'sudo systemctl start で動かそうとしたとき'), '');
    }
  }
  if (s.epilogue?.length) out.push('## 🌙 エンディングの最後（真っ暗な中に出すせりふ）', '', block(s.epilogue), '');
  if (s.endingTitles?.length) {
    out.push('## 🎬 結末の名前（エンディングの最後に出す）', '', '| 条件 | 名前 |', '|---|---|');
    for (const e of s.endingTitles) out.push(`| ${cond(e.if)} | ${e.title} |`);
    out.push('');
  }
  if (s.companions?.length) {
    out.push('## 仲間', '');
    for (const c of s.companions) node({ ...c, name: `${c.name}（仲間・どこでも話せる）` }, ['（仲間）'], out);
  }
  mkdirSync('docs/chapters', { recursive: true });
  const dest = `docs/chapters/${file.replace('.yaml', '_script.md')}`;
  writeFileSync(dest, out.join('\n'));
  console.log(`wrote ${dest}`);
}

for (const f of readdirSync('scenario').filter((f) => /^ch\d+\.yaml$/.test(f))) exportChapter(f);
