// プレイヤーごとの設定（文字の速さ・文字の音）。セーブとは別に、ブラウザに保存する
export type Speed = 'slow' | 'normal' | 'fast' | 'instant';

export interface Settings {
  speed: Speed;
  /** 文字が出るときの音 */
  sound: boolean;
  /** 鈴の音などの効果音 */
  sfx: boolean;
  /** BGM */
  bgm: boolean;
  /** 0〜1 */
  volume: number;
}

/** 1文字あたりのミリ秒 */
export const CHAR_MS: Record<Speed, number> = { slow: 70, normal: 45, fast: 22, instant: 0 };
/** 行と行のあいだのミリ秒 */
export const LINE_MS: Record<Speed, number> = { slow: 450, normal: 320, fast: 180, instant: 0 };
export const SPEED_LABEL: Record<Speed, string> = { slow: 'おそい', normal: 'ふつう', fast: 'はやい', instant: 'いっしゅん' };

const KEY = 'morihito-settings-v1';
const DEFAULTS: Settings = { speed: 'normal', sound: true, sfx: true, bgm: true, volume: 0.5 };

export const settings: Settings = load();

function load(): Settings {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (s && s.speed in CHAR_MS) return { ...DEFAULTS, ...s };
  } catch {
    /* 既定値で遊ぶ */
  }
  return { ...DEFAULTS };
}

export function saveSettings() {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* 保存できなくても続行 */
  }
}
