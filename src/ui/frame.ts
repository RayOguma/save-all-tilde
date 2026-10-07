// ターミナルの枠。今いる場所の theme（scenario の theme）に合わせて、ドット絵のタイルを敷きつめる。
// 新しい場所を作ったら、ここに枠を足す（タイルの絵は sprites.ts の tile-*）。
import { spriteImg, spriteRows, spriteURL } from './sprites';

interface FrameTheme {
  /** 上に重ねるタイル（ドット絵の id）。3倍に拡大してくり返す */
  tiles: string[];
  /** タイルの下の地の色（CSS の色かグラデーション） */
  base: string;
  /** 場所の名前の札 */
  plate: { bg: string; fg: string; edge: string };
}

const SCALE = 3;

export const THEMES: Record<string, FrameTheme> = {
  plain: { tiles: [], base: '#15181f', plate: { bg: '#1b1f28', fg: '#dfe4ea', edge: '#2a303c' } },
  // 家の中: 木の板の壁
  wood: { tiles: ['tile-wood'], base: '#6b4428', plate: { bg: '#e8c890', fg: '#3a2210', edge: '#4a2c18' } },
  // 村（ふだん）: 青空と雲
  sky: {
    tiles: ['tile-cloud'],
    base: 'linear-gradient(180deg, #3f8fe0 0%, #7fc0ff 55%, #bfe3ff 100%)',
    plate: { bg: '#fff6d8', fg: '#2a4a6a', edge: '#2a5a8a' },
  },
  // 村（モリビトが止まったあと）: どす黒い空
  dusk: {
    tiles: ['tile-dusk'],
    base: 'linear-gradient(180deg, #07040a 0%, #1e0a14 55%, #3a0f1a 100%)',
    plate: { bg: '#2a1420', fg: '#e8a0a8', edge: '#6e1f2e' },
  },
  // もつれ沼: 紫がかった、にごった水
  swamp: { tiles: ['tile-swamp'], base: '#4a3a5a', plate: { bg: '#d8d0e0', fg: '#3a2c48', edge: '#3a2c48' } },
  // 市場町イチバ: しまの天幕と、夕焼け色の地
  market: {
    tiles: ['tile-market'],
    base: 'linear-gradient(180deg, #f2b85a 0%, #e08a4a 100%)',
    plate: { bg: '#fff3d6', fg: '#7a2a1e', edge: '#a8402e' },
  },
  // 廃墟山道: 灰色の山肌と、崩れた石垣
  ruins: {
    tiles: ['tile-ruins'],
    base: 'linear-gradient(180deg, #4a4a52 0%, #6a6660 100%)',
    plate: { bg: '#e0dcd4', fg: '#3a3632', edge: '#4a4640' },
  },
  // 坑道アナグラ: 暗い岩の壁と、木の支柱
  mine: {
    tiles: ['tile-mine'],
    base: 'linear-gradient(180deg, #1a1612 0%, #2a2420 100%)',
    plate: { bg: '#3a2c20', fg: '#f2c46d', edge: '#6a4428' },
  },
  // 物見の塔: 石のれんがと、真ちゅうの歯車。夕暮れの紫
  tower: {
    tiles: ['tile-tower'],
    base: 'linear-gradient(180deg, #2e2a3a 0%, #4a4458 100%)',
    plate: { bg: '#f0e2b8', fg: '#3a2c48', edge: '#8a6a28' },
  },
  // 記憶の書庫: 本棚と、ろうそくの明かりの茶色
  library: {
    tiles: ['tile-library'],
    base: 'linear-gradient(180deg, #2a1c14 0%, #4a3020 100%)',
    plate: { bg: '#f4e8cc', fg: '#4a2c18', edge: '#8a5a3a' },
  },
  // 賢者の庵（雲の上）: 金色の空と、白い雲
  cloudtop: {
    tiles: ['tile-cloud'],
    base: 'linear-gradient(180deg, #f6c26a 0%, #fde6b0 55%, #fff6e4 100%)',
    plate: { bg: '#fffaf0', fg: '#7a5420', edge: '#c89a4a' },
  },
  // 賢者の庵の中: 木の桟と障子
  hermitage: {
    tiles: ['tile-shoji'],
    base: '#8a6a48',
    plate: { bg: '#f8f2e4', fg: '#4a3420', edge: '#6a4c30' },
  },
  // 迷いの森
  forest: { tiles: ['tile-leaves'], base: '#2b6e35', plate: { bg: '#d8e8b0', fg: '#1d4a26', edge: '#1d4a26' } },
};

export class Frame {
  private current = '';

  constructor(
    private readonly frame: HTMLElement,
    private readonly plate: HTMLElement,
  ) {}

  apply(themeName: string, label: string, icon: string) {
    const t = THEMES[themeName] ?? THEMES.plain;
    this.plate.replaceChildren(spriteImg(icon.replace(/^char:/, ''), 'icon'), Object.assign(document.createElement('span'), { textContent: label }));
    if (themeName === this.current) return;

    const layers = t.tiles.map((id) => `url(${spriteURL(id)})`);
    const sizes = t.tiles.map((id) => {
      const rows = spriteRows(id);
      return `${rows[0].length * SCALE}px ${rows.length * SCALE}px`;
    });
    const isGradient = t.base.includes('gradient');
    this.frame.style.backgroundImage = [...layers, ...(isGradient ? [t.base] : [])].join(', ') || 'none';
    this.frame.style.backgroundSize = [...sizes, ...(isGradient ? ['100% 100%'] : [])].join(', ');
    this.frame.style.backgroundColor = isGradient ? '' : t.base;
    this.frame.style.setProperty('--plate-bg', t.plate.bg);
    this.frame.style.setProperty('--plate-fg', t.plate.fg);
    this.frame.style.setProperty('--plate-edge', t.plate.edge);
    this.frame.dataset.theme = themeName;

    // 場所が変わったら、枠を一瞬光らせて切り替わりを伝える（最初の表示は除く）
    if (this.current) {
      this.frame.classList.remove('frame-change');
      void this.frame.offsetWidth;
      this.frame.classList.add('frame-change');
    }
    this.current = themeName;
  }
}
