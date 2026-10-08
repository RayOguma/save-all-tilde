// タイトル画面のお知らせ（中身は news.yaml）
import { parse } from 'yaml';
import raw from '../news.yaml?raw';

export interface NewsItem {
  /** "2026-10-08" */
  date: string;
  title: string;
  /** 段落ごと。`ls` のようにバッククォートで囲むと、コマンドの枠で出る */
  body: string[];
}

/** お知らせを読む。新しいものが上（書いた順のまま） */
export function parseNews(text: string): NewsItem[] {
  const list: unknown = parse(text) ?? [];
  if (!Array.isArray(list)) throw new Error('news.yaml は、お知らせの並び（- date: …）で書く');
  return list.map((n, i) => {
    const date = String(n?.date ?? '');
    const title = String(n?.title ?? '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !title) throw new Error(`news.yaml の ${i + 1} つ目: date（YYYY-MM-DD）と title がいる`);
    const body = n.body == null ? [] : Array.isArray(n.body) ? n.body.map(String) : [String(n.body)];
    return { date, title, body };
  });
}

export const NEWS: NewsItem[] = parseNews(raw);
