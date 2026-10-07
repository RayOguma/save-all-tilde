import { describe, expect, it } from 'vitest';
import commandsYaml from '../scenario/commands.yaml?raw';
import yaml from '../scenario/ch0.yaml?raw';
import ch1Yaml from '../scenario/ch1.yaml?raw';
import ch2Yaml from '../scenario/ch2.yaml?raw';
import ch3Yaml from '../scenario/ch3.yaml?raw';
import ch4Yaml from '../scenario/ch4.yaml?raw';
import ch5Yaml from '../scenario/ch5.yaml?raw';
import ch6Yaml from '../scenario/ch6.yaml?raw';
import ch7Yaml from '../scenario/ch7.yaml?raw';
import ch8Yaml from '../scenario/ch8.yaml?raw';
import ch9Yaml from '../scenario/ch9.yaml?raw';
import { loadScenario } from '../src/scenario';
import { playerRows, type Face, type Pose } from '../src/ui/scenes';
import { hasSprite, spritePalette, spriteRows } from '../src/ui/sprites';
import type { VNode } from '../src/vfs';

describe('ドット絵', () => {
  const scn = loadScenario([yaml, ch1Yaml, ch2Yaml, ch3Yaml, ch4Yaml, ch5Yaml, ch6Yaml, ch7Yaml, ch8Yaml, ch9Yaml], commandsYaml);
  const icons = new Set<string>(['unknown', 'up', 'proc-stopped', 'mark', 'player-boy', 'player-girl', 'tile-wood', 'tile-cloud', 'tile-dusk', 'tile-leaves', 'tile-swamp', 'tile-market', 'tile-ruins', 'tile-mine', 'tile-tower', 'tile-library', 'tile-shoji', 'package', 'book', 'sudo', 'hideout', 'link', 'bag', 'stage']);
  const walk = (n: VNode) => {
    if (n.icon) icons.add(n.icon);
    if (n.type === 'dir') n.children.forEach(walk);
  };
  walk(scn.root);
  for (const c of Object.values(scn.characters)) icons.add(c.sprite);

  it.each([...icons])('%s は正しい形をしている', (id) => {
    expect(hasSprite(id)).toBe(true);
    const rows = spriteRows(id);
    expect(rows.length).toBeGreaterThan(0);
    expect(new Set(rows.map((r) => r.length)).size).toBe(1); // 全行が同じ幅
    if (id !== 'mark' && !id.startsWith('tile-')) expect(rows.length).toBe(rows[0].length); // 「!」と枠のタイル以外は正方形
    const pal = spritePalette(id);
    for (const ch of rows.join('')) if (ch !== '.') expect(pal[ch], `${id}: 色 ${ch}`).toBeDefined();
  });

  // 章の幕の主人公（表情とポーズの組み合わせ）
  const faces: Face[] = ['smile', 'determined', 'joy', 'tired', 'relieved'];
  const poses: Pose[] = ['stand', 'back', 'fist', 'wipe', 'wave', 'banzai'];
  for (const gender of ['boy', 'girl'] as const)
    for (const face of faces)
      for (const pose of poses)
        it(`幕の主人公 ${gender} ${face} ${pose} は 16×24`, () => {
          const { rows, pal } = playerRows(gender, face, pose);
          expect(rows.length).toBe(24);
          expect(new Set(rows.map((r) => r.length))).toEqual(new Set([16]));
          for (const ch of rows.join('')) if (ch !== '.') expect(pal[ch], `色 ${ch}`).toBeDefined();
        });
});
