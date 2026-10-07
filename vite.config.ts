import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import { parse } from 'yaml';

/**
 * 公開するビルドでは、シナリオ（scenario/*.yaml）のコメントを取り除く。
 * コメントには作り手向けのメモ（続編の伏線など）があるので、遊ぶ人のブラウザには届けない。
 * YAML を読んで JSON に書き直す（JSON は YAML としてそのまま読めるので、ゲーム側はそのまま）
 */
function stripYamlComments(): Plugin {
  return {
    name: 'strip-yaml-comments',
    apply: 'build',
    enforce: 'pre',
    load(id) {
      const m = id.match(/^(.*\.yaml)\?raw$/);
      if (!m) return null;
      const json = JSON.stringify(parse(readFileSync(m[1], 'utf-8')));
      return `export default ${JSON.stringify(json)};`;
    },
  };
}

// base: './' で GitHub Pages などのサブパスにそのまま置ける
export default defineConfig({
  base: './',
  plugins: [stripYamlComments()],
});
