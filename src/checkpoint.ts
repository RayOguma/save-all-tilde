// 章のチェックポイント。「章を選ぶ」で、章の最初から遊べるようにする。
import type { Scenario } from './scenario';
import { newState, type Gender, type GameState } from './state';
import { PLAYER, splitPath } from './vfs';

/** 今のセーブを、章の最初の状態として写しておく（チェックポイントの中にチェックポイントは入れない） */
export function snapshot(st: GameState, chapterNo: number): GameState {
  const { checkpoints: _c, ...rest } = st;
  const copy: GameState = JSON.parse(JSON.stringify(rest));
  // この章の導入は、まだ見ていないことにする（選んだときに、導入から始まるように）
  copy.introSeen = (copy.introSeen ?? []).filter((n) => n !== chapterNo);
  return copy;
}

/**
 * 前の章までをクリアした状態を、シナリオの clear から組み立てる。
 * まだ着いていない章を試すとき（開発用）や、テストの準備に使う
 */
export function stateAtChapter(scn: Scenario, no: number, who: { name: string; gender: Gender }): GameState {
  const ch = scn.chapters.find((c) => c.no === no);
  if (!ch) throw new Error(`第${no}章はない`);
  const start = ch.startAt ? splitPath(ch.startAt) : scn.start;
  const st = newState(who.name, who.gender, start, scn.startCommands);
  st.onboarded = no > 0;
  const before = scn.chapters.filter((c) => c.no < no);
  st.introSeen = before.map((c) => c.no);
  for (const c of before) {
    const g = c.clear ?? {};
    for (const f of g.flags ?? []) st.flags[f] = true;
    for (const l of g.learned ?? []) if (!st.learned.includes(l)) st.learned.push(l);
    for (const x of g.groups ?? []) {
      st.groups ??= [PLAYER];
      if (!st.groups.includes(x)) st.groups.push(x);
    }
    for (const [path, p] of Object.entries(g.perms ?? {})) (st.perms ??= {})[path] = { ...st.perms?.[path], ...p };
    for (const d of g.discovered ?? []) if (!st.discovered.includes(d)) st.discovered.push(d);
    for (const o of g.ops ?? []) (st.ops ??= []).push(o);
    for (const [path, t] of Object.entries(g.texts ?? {})) (st.texts ??= {})[path] = [...t];
    st.history.push(...(g.history ?? []));
  }
  return st;
}

/**
 * 選んだ章の最初から遊ぶためのセーブ。着いたことがあればそのときの状態、なければ組み立てる。
 * fresh（?dev のテストプレイ）なら、遊んだ記録は使わず、いつも組み立てる（しくみを変えたあとも、今の決まりで試せるように）
 */
export function startAtChapter(scn: Scenario, no: number, saved: GameState | null, fresh = false): GameState {
  const built = () => stateAtChapter(scn, no, { name: saved?.name ?? 'ユウ', gender: saved?.gender ?? 'boy' });
  const base = fresh ? built() : (saved?.checkpoints?.[no] ?? built());
  const st: GameState = JSON.parse(JSON.stringify(base));
  st.checkpoints = saved?.checkpoints ?? {};
  st.introSeen = (st.introSeen ?? []).filter((n) => n !== no);
  return st;
}
