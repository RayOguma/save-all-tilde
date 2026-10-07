// 表示用テキストの加工。端末に依存しないので単体テストできる。

export type Seg = { t: string; c?: string };
export type Line = string | Seg[];

/** シナリオの1行を種類ごとに分けたもの。会話は立ち絵つきのかたまりで表示される */
export type Msg =
  | { kind: 'talk'; speaker: string; text: string; garbled?: boolean }
  | { kind: 'narr' | 'sys' | 'chapter' | 'plain'; text: string }
  /** 演出（`<stomp>` のように書く）。せりふの途中で、足音や画面の揺れを入れる。text は演出の名前 */
  | { kind: 'fx'; text: string };

const NOISE = '縺繧譁蟄怜喧繝ｹ・□▒░';

/** 文字化け。同じ行はいつも同じ化け方をするよう、行の内容から乱数の種を作る */
export function garble(s: string): string {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return [...s]
    .map((ch) => {
      h = (h * 1103515245 + 12345) & 0x7fffffff;
      return ch !== ' ' && h % 100 < 55 ? NOISE[h % NOISE.length] : ch;
    })
    .join('');
}

/**
 * 打った文字をそろえる。全角英数字は半角に（NFKC）。日本語入力のまま打つと / が「・」、. が「。」になるので、戻す
 * （シナリオの名前には「・」「。」を使わない）
 */
export function normalizeInput(s: string): string {
  return s.normalize('NFKC').replace(/・/g, '/').replace(/。/g, '.');
}

export function fill(s: string, vars: Record<string, string>): string {
  return s.replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m);
}

/** 行の書式: 「名前: せりふ」「（ナレーション）」「[システム]」「― 見出し ―」「<演出>」 */
export function parseMsg(s: string): Msg {
  const fx = s.match(/^<(\w+)>$/);
  if (fx) return { kind: 'fx', text: fx[1] };
  if (s.startsWith('（')) return { kind: 'narr', text: s };
  if (s.startsWith('[')) return { kind: 'sys', text: s };
  if (s.startsWith('―')) return { kind: 'chapter', text: s };
  const m = s.match(/^([^\s:：「」（）]{1,12})[:：]\s?(.*)$/);
  if (m) return { kind: 'talk', speaker: m[1], text: m[2] };
  return { kind: 'plain', text: s };
}

/** `…` で囲んだところはコマンド。表示するときに枠で囲んで目立たせる */
export function splitCode(text: string): { t: string; code: boolean }[] {
  return text
    .split('`')
    .map((t, i) => ({ t, code: i % 2 === 1 }))
    .filter((p) => p.t);
}

/** コマンドを枠で囲んだ表示用の部品にする（cls はふつうの文字の色） */
export function codeSegs(text: string, cls?: string): Seg[] {
  return splitCode(text).map((p) => ({ t: p.t, c: p.code ? [cls, 'cmd'].filter(Boolean).join(' ') : cls }));
}

/** 画面に見えるとおりの文字（コマンドを囲む ` は表示されない） */
export function msgText(m: Msg): string {
  if (m.kind === 'fx') return '';
  const text = m.text.replaceAll('`', '');
  return m.kind === 'talk' ? `${m.speaker}: ${text}` : text;
}

/** 表示幅（全角=2）。ls -l の桁そろえ用 */
export function width(s: string): number {
  let w = 0;
  for (const ch of s) w += /[\u0000-ÿ｡-ﾟ]/.test(ch) ? 1 : 2;
  return w;
}

export function padEnd(s: string, w: number): string {
  return s + ' '.repeat(Math.max(0, w - width(s)));
}

/** 打ち間違い候補を出すための編集距離 */
export function distance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}
