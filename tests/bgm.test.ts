import { describe, expect, it } from 'vitest';
import commandsYaml from '../scenario/commands.yaml?raw';
import ch0Yaml from '../scenario/ch0.yaml?raw';
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
import { bgmOf, nodeAt, type VNode } from '../src/vfs';

/** public/bgm/ にある曲（ファイル名から .mp3 を除いたもの） */
const files = new Set(
  Object.keys(import.meta.glob('../public/bgm/*.mp3')).map((p) => p.replace(/^.*\//, '').replace(/\.mp3$/, '')),
);

const scn = loadScenario([ch0Yaml, ch1Yaml, ch2Yaml, ch3Yaml, ch4Yaml, ch5Yaml, ch6Yaml, ch7Yaml, ch8Yaml, ch9Yaml], commandsYaml);

describe('BGM', () => {
  it('シナリオに書いた曲は、public/bgm/ にある', () => {
    const names = new Set<string>();
    const walk = (n: VNode) => {
      if (typeof n.bgm === 'string') names.add(n.bgm);
      else for (const t of n.bgm ?? []) names.add(t.name);
      if (n.type === 'dir') n.children.forEach(walk);
    };
    walk(scn.root);
    names.delete('none');
    expect(names.size).toBeGreaterThan(0);
    for (const name of names) expect(files.has(name), name).toBe(true);
  });

  it('ステージごとの曲。中の場所は受け継ぐ。崩壊したチルダ村とムラガレは無音', () => {
    const at = (p: string, flags = {}) => bgmOf(nodeAt(scn.root, p)!, flags);
    expect(at('/home/チルダ村/きみの家/自分の部屋')).toBe('水平線を見据えて');
    expect(at('/home/チルダ村/パン屋', { morihito_killed: true })).toBeNull();
    expect(at('/usr/大きな切り株')).toBe('水上のダンス');
    expect(at('/lib/渡り道B')).toBe('アラブの砂漠');
    expect(at('/home/ムラガレ')).toBeNull();
    expect(at('/tmp/アプトの露店')).toBe('よろずや道中');
  });
});
