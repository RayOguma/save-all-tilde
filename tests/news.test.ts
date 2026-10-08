import { describe, expect, it } from 'vitest';
import { NEWS, parseNews } from '../src/news';

describe('お知らせ（news.yaml）', () => {
  it('どのお知らせにも日付と見出しがあり、新しいものが上', () => {
    expect(NEWS.length).toBeGreaterThan(0);
    for (const [i, n] of NEWS.entries()) {
      expect(n.title).not.toBe('');
      if (i > 0) expect(n.date <= NEWS[i - 1].date).toBe(true);
    }
  });

  it('日付の形がおかしいと、読みこむときに分かる', () => {
    expect(() => parseNews('- date: 10/8\n  title: x')).toThrow();
    expect(parseNews('- date: "2026-10-08"\n  title: x\n  body: ひとこと')).toEqual([{ date: '2026-10-08', title: 'x', body: ['ひとこと'] }]);
  });
});
