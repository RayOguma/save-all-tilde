// 仮のドット絵。1文字=1ピクセルで、'.' は透明。sym: true なら左半分だけ書いて左右反転でつなげる。
// 本番の絵ができたら、ここを画像ファイルに差し替える。

interface Sprite {
  px: string[];
  pal?: Record<string, string>;
  sym?: boolean;
}

const BASE: Record<string, string> = {
  k: '#1e1612', // 輪郭
  s: '#f2c79b', // 肌
  S: '#d9a276',
  e: '#1e1612', // 目
  m: '#c0504d', // 口
  w: '#f4f1ea', // 白
  g: '#b9b4ab', // 灰
  h: '#8a4b2a', // 髪
};

const SPRITES: Record<string, Sprite> = {
  // ---- 立ち絵（16×16）----
  chown: {
    sym: true,
    pal: { r: '#7a4a2a', R: '#5c3620' },
    px: [
      '........', '....kkkk', '...kssss', '...kssss', '...kwwss', '...ksess', '...ksssS', '...kwsss',
      '...kwwww', '....kwww', '..krrkww', '..krrrkw', '.krrrrrk', '.krrRrrr', '.krrRrrr', '.kkkkkkk',
    ],
  },
  nano: {
    sym: true,
    pal: { a: '#d9785a' },
    px: [
      '....kkkk', '...kwwww', '...kwwww', '...kkkkk', '..khhhhh', '..khssss', '..khsess', '..khssss',
      '..khsssm', '..khhsss', '...kkkss', '..kaaaww', '.kaaawww', '.kaaawww', '.kaaawww', '.kkkkkkk',
    ],
  },
  pico: {
    sym: true,
    pal: { c: '#e0873a', b: '#4f8fd6' },
    px: [
      '........', '........', '....kkkk', '...kcccc', '..kccccc', '..kkkkkk', '...khsss', '...ksess',
      '...kssss', '...ksssm', '....kkss', '...kbbbb', '..kbbbbb', '..kbbbbb', '..kbbbbb', '..kkkkkk',
    ],
  },
  vim: {
    sym: true,
    pal: { v: '#3f9b4b', V: '#2b6e35' },
    px: [
      '......kk', '.....kgg', '....kkgg', '...kgggg', '..kggsss', '..kgssss', '..kgsess', '..kgssss',
      '...kssmm', '....kkss', '..kvvvvv', '.kvvvVvv', '.kvvVvvv', '.kvVvvvv', '.kvvvvvv', '.kkkkkkk',
    ],
  },
  emacs: {
    sym: true,
    pal: { p: '#7b5cc4', P: '#5a3f9a', o: '#9fd3ff' },
    px: [
      '........', '....kkkk', '...kgggg', '..kggsss', '..kgssss', '..kskkkk', '..kskook', '..kskkkk',
      '...kssgg', '...ksggg', '..kppppp', '.kpppPpp', '.kppPppp', '.kpPpppp', '.kpppppp', '.kkkkkkk',
    ],
  },
  // 主人公（男の子）
  'player-boy': {
    sym: true,
    pal: { h: '#3a2a22', g: '#3f8f7a' },
    px: [
      '........', '....kkkk', '...khhhh', '..khhhhh', '..khhhhh', '..khssss', '..khsess', '...kssss',
      '...ksssm', '....kkss', '...kgggg', '..kggggg', '..kggggg', '..kggggg', '..kggggg', '..kkkkkk',
    ],
  },
  // 主人公の兄。とがった髪と、青いベスト
  bash: {
    sym: true,
    pal: { h: '#4a2e1e', b: '#3f6fb0', B: '#2c5590' },
    px: [
      '...k.k.k', '..khkhkh', '..khhhhh', '.khhhhhh', '.khhssss', '.khhssss', '.khhsess', '..khssss',
      '...ksssm', '....kkss', '..kbbbbw', '.kbbbbbw', '.kbbBbbb', '.kbbBbbb', '.kbbbbbb', '.kkkkkkk',
    ],
  },
  // 主人公（女の子）
  'player-girl': {
    sym: true,
    pal: { h: '#5a3424', r: '#e0605a', g: '#e08a4a' },
    px: [
      '........', '....kkkk', '...khhhh', '..khhhhr', '..khhhhh', '.khhssss', '.khhsess', '.khhssss',
      '.khhsssm', '.khhkkss', '..kkgggg', '..kggggg', '..kggggg', '.kgggggg', '.kgggggg', '.kkkkkkk',
    ],
  },
  groupu: {
    sym: true,
    pal: { g: '#c8c4bc', p: '#8a5aa8', P: '#6a3a88', y: '#e8c34a' },
    px: [
      '.....kkk', '....kggg', '...kgggg', '...kkkkk', '..kggsss', '..kgssss', '..kgsess', '..kgssss',
      '...kssmm', '....kkss', '..kppyyp', '.kpppPpp', '.kppPppp', '.kpPpppp', '.kpppppp', '.kkkkkkk',
    ],
  },
  haru: {
    sym: true,
    pal: { h: '#6a4a2a', b: '#5a8ac8', B: '#3a6aa8' },
    px: [
      '........', '....kkkk', '...khhhh', '..khhhhh', '..khhhhh', '..khssss', '..khsess', '...kssss',
      '...ksssm', '....kkss', '...kbbbb', '..kbbBbb', '..kbBbbb', '..kbbbbb', '..kbbbbb', '..kkkkkk',
    ],
  },
  herbalist: {
    sym: true,
    pal: { c: '#5a8a4a', C: '#3a6a30', o: '#9fd3ff', a: '#e8e0c8' },
    px: [
      '........', '....kkkk', '...kcccc', '..kccccc', '..kkkkkk', '..kgssss', '..kskkkk', '..kskook',
      '..kskkkk', '...kgggg', '..kaaagg', '.kaaaaaa', '.kaaCaaa', '.kaaaaaa', '.kaaaaaa', '.kkkkkkk',
    ],
  },
  mom: {
    sym: true,
    pal: { h: '#5a3424', p: '#d97b9a' },
    px: [
      '....kkkk', '...khhhh', '..khhhhh', '..khhhhh', '..khssss', '..khsess', '..khssss', '..khsssm',
      '..khhsss', '...khkss', '..kppppw', '.kppppww', '.kppppww', '.kppppww', '.kppppww', '.kkkkkkk',
    ],
  },
  cat: {
    sym: true,
    pal: { c: '#6b6b78', p: '#e89aa6', y: '#f2d45c', Y: '#1e1612' },
    px: [
      '........', '..kk....', '..kpkk..', '..kccckk', '..kccccc', '.kcccccc', '.kcyYccc', '.kcyYccc',
      '.kcccccp', '.kcccccc', '..kccccc', '...kkkkk', '..kccccc', '.kcccccc', '.kcccccc', '.kkkkkkk',
    ],
  },

  // ---- 第4章 市場町イチバ ----
  // 商人アプト: 赤い帽子と緑の前かけ
  apt: {
    sym: true,
    pal: { c: '#c0504d', a: '#3f8f5a', A: '#2c6a40', h: '#4a3020' },
    px: [
      '........', '....kkkk', '...kcccc', '..kccccc', '..kkkkkk', '..khssss', '..khsess', '...kssss',
      '...ksssm', '....kkss', '...kaaaw', '..kaaaww', '..kaAaww', '..kaaaww', '..kaaaww', '..kkkkkk',
    ],
  },
  // 書写屋のディディ爺: めがねと白いひげ、紫の上着
  dd: {
    sym: true,
    pal: { r: '#6a4a8a', R: '#4a2f6a', o: '#9fd3ff' },
    px: [
      '........', '....kkkk', '...kgggg', '..kggsss', '..kgssss', '..kskkkk', '..kskook', '..kskkkk',
      '..kswwww', '...kwwww', '..krrkww', '.krrrrkw', '.krrRrrr', '.krrRrrr', '.krrrrrr', '.kkkkkkk',
    ],
  },
  // 看板屋のリネ: 金色のおさげ、絵の具のついた赤い上着
  rine: {
    sym: true,
    pal: { c: '#e8c34a', h: '#e8c34a', b: '#e0605a', p: '#4f8fd6' },
    px: [
      '........', '.kk.....', '.kckkkkk', '.kckcccc', '..kccccc', '..kkkkkk', '...khsss', '...ksess',
      '...kssss', '...ksssm', '....kkss', '...kbbbb', '..kbpbbb', '..kbbbbb', '..kbbbpb', '..kkkkkk',
    ],
  },
  // 旅の楽師ピップ: 羽根つき帽子
  pip: {
    sym: true,
    pal: { f: '#f2d45c', p: '#3a8f8f', o: '#e08a4a', y: '#f2d45c' },
    px: [
      '.....k..', '....kfk.', '....kkkk', '...kpppp', '..kppppp', '..kkkkkk', '...kssss', '...ksess',
      '...kssss', '...ksssm', '....kkss', '...kooyo', '..koooyo', '..koooyo', '..kooooo', '..kkkkkk',
    ],
  },
  // 宿屋の女将: 赤い頭巾と橙の前かけ
  okami: {
    sym: true,
    pal: { R: '#c0504d', h: '#5a3424', o: '#e8a04a' },
    px: [
      '....kkkk', '...kRRRR', '..kRRRRR', '..kkkkkk', '..khssss', '..khsess', '..khssss', '..khsssm',
      '..khhsss', '...khkss', '..kooooo', '.kooowww', '.kooowww', '.kooowww', '.kooowww', '.kkkkkkk',
    ],
  },
  // ---- 第5章 廃墟山道 ----
  // 関所番イプタ: 鉄のかぶとと、青灰色の上着
  iputa: {
    sym: true,
    pal: { g: '#8c8c94', b: '#5a6a80', B: '#3a4a60', h: '#3a2a22' },
    px: [
      '........', '....kkkk', '...kgggg', '..kggggg', '..kkkkkk', '..khssss', '..khsess', '...kssss',
      '...ksssm', '....kkss', '...kbbbb', '..kbbBbb', '..kbBbbb', '..kbbbbb', '..kbbbbb', '..kkkkkk',
    ],
  },
  // 宿場の聞き番カヤ: 長い黒髪と、桃色の頭巾
  kaya: {
    sym: true,
    pal: { h: '#2a1a1a', p: '#e07a9a', r: '#c86a8a', R: '#a04a6a' },
    px: [
      '....kkkk', '...kpppp', '..kppppp', '..khhhhh', '.khhssss', '.khhsess', '.khhssss', '.khhsssm',
      '.khhkkss', '..kkrrrr', '..krrrrr', '..krRrrr', '.krrrrrr', '.krrrrrr', '.krrrrrr', '.kkkkkkk',
    ],
  },
  // 石工メイク: 大きな体、白いはちまき、茶色の前かけ
  meiku: {
    sym: true,
    pal: { h: '#3a2a22', t: '#e8e0c8', v: '#7a6a50', V: '#5a4a34' },
    px: [
      '....kkkk', '...khhhh', '..kttttt', '..khhhhh', '..khssss', '..khsess', '..khssss', '..khsssm',
      '...kksss', '..kvvvvv', '.kvvvVvv', '.kvvVvvv', '.kvvvvvv', '.kvvvvvv', '.kvvvvvv', '.kkkkkkk',
    ],
  },
  // 羊飼いヤム: 麦わら帽子と、緑の服
  yamu: {
    sym: true,
    pal: { y: '#e8c860', g: '#6aa84a', G: '#4a8a30', h: '#5a3a22' },
    px: [
      '........', '...kkkkk', '..kyyyyy', '.kyyyyyy', '..kkkkkk', '...khsss', '...ksess', '...kssss',
      '...ksssm', '....kkss', '...kgggg', '..kggGgg', '..kgGggg', '..kggggg', '..kggggg', '..kkkkkk',
    ],
  },
  // 包みの中の子どもジップ: 小さくて、黄色い帽子
  zippu: {
    sym: true,
    pal: { c: '#f0c050', o: '#e07a4a', O: '#c05a2a', h: '#4a3020' },
    px: [
      '........', '........', '........', '....kkkk', '...kcccc', '..kccccc', '..kkkkkk', '...khsss',
      '...ksess', '...ksssm', '....kkss', '...koooo', '..koooOo', '..kooooo', '..kooooo', '..kkkkkk',
    ],
  },
  // ---- 第6章 坑道アナグラ ----
  // 鍛冶屋ノーハップ（ハルの兄）: すすけた顔、赤い手ぬぐい、革の前かけ
  nohup: {
    sym: true,
    pal: { h: '#3a2418', r: '#c0504d', a: '#8a5a3a', A: '#6a4428', d: '#555048' },
    px: [
      '........', '....kkkk', '...khhhh', '..krrrrr', '..khhhhh', '..khssss', '..khsess', '...kdsss',
      '...ksssm', '....kkss', '..kaaaaa', '.kaaaAaa', '.kaaAaaa', '.kaaaaaa', '.kaaaaaa', '.kkkkkkk',
    ],
  },
  // 坑道の子どもミナシゴ: 小さくて、ぼろぼろの灰色の服
  minashigo: {
    sym: true,
    pal: { h: '#4a3a30', c: '#8a8a90', C: '#6a6a70' },
    px: [
      '........', '........', '........', '....kkkk', '...khhhh', '..khhhhh', '..khssss', '..khsess',
      '...kssss', '...kssmm', '....kkss', '...kcccc', '..kcCccc', '..kccccC', '..kccccc', '..kkkkkk',
    ],
  },
  // 影の獣: 黒い影に、赤い目
  beast: {
    sym: true,
    pal: { b: '#2a1a2e', B: '#1a0e1e', r: '#e04040' },
    px: [
      '........', '.k......', '.kbk....', '.kbbkkkk', '..kbbbbb', '.kbbbbbb', 'kbbrrbbb', 'kbbrrbbb',
      'kbbbbbbb', 'kbBbbbbb', 'kbbBbbbb', '.kbbbbbb', '.kbbBbbb', '..kbbbbb', '.kbk.kbb', '.kk..kkk',
    ],
  },
  // 塔守クロン: 白髪と長い白ひげの老人。紺のローブに、真ちゅうの留め金
  kron: {
    sym: true,
    pal: { b: '#3a4a7a', B: '#2a3660', y: '#d8b048' },
    px: [
      '........', '....kkkk', '...kgggg', '..kgssss', '..kgssss', '..kgsess', '..kgssss', '..kgwwww',
      '..kwwwww', '...kwwww', '..kbbkww', '.kbbbkww', '.kbBbbkw', '.kbbbbby', '.kbbBbbb', '.kkkkkkk',
    ],
  },
  // 書庫の番人シスロ: 黒髪のおだんごと、丸めがね。紫の衣で、本を抱えている
  syslo: {
    sym: true,
    pal: { h: '#2a2030', p: '#6a4a8a', P: '#4a3068', y: '#c8a048' },
    px: [
      '.....kkk', '....khhh', '...kkhhh', '..khhhhh', '..khssss', '..khwewk', '..khssss', '..khsssm',
      '...kkkss', '..kppwww', '.kpppkyy', '.kpppkyy', '.kpPppkk', '.kppPppp', '.kpppppp', '.kkkkkkk',
    ],
  },
  // 記録の影: あふれ出した墨が、目のある影になったもの
  inkshadow: {
    sym: true,
    pal: { b: '#1a1424', B: '#3a2a4a' },
    px: [
      '........', '.....kkk', '...kkbbb', '..kbbbbb', '.kbbbbbb', '.kbbwwbb', '.kbbwkbb', 'kbbbbbbb',
      'kbbbbbbb', 'kbBbbbbb', 'kbbbbBbb', '.kbbbbbb', '.kbkbbkb', '..kbk.kb', '...k..kb', '......kk',
    ],
  },
  // 賢者スドウ: 長い白髪と白ひげの老人。灰色の衣の腰に、金色の鍵束
  sudo: {
    sym: true,
    pal: { d: '#6a6a7a', D: '#4a4a5a', y: '#e8c050' },
    px: [
      '........', '....kkkk', '...kgggg', '..kggggg', '..kgssss', '..kgsess', '..kgssss', '..kgwwww',
      '..kgwwww', '...kwwww', '..kddkww', '.kdddkww', '.kdDddkw', '.kddyddd', '.kdddDdd', '.kkkkkkk',
    ],
  },
  // 片づけ番: 腰の曲がった白髪の老人。手ぬぐいのはちまきと、くたびれた茶色の作業着（ほかの人より背が低い）
  katazuke: {
    sym: true,
    pal: { t: '#d8c8a0', b: '#7a6a50', B: '#5a4a34' },
    px: [
      '........', '........', '....kkkk', '...kgggg', '..kttttt', '..kgssss', '..kgsess', '...kssss',
      '...kssgg', '....kkgg', '...kbbbb', '..kbbbBb', '..kbbBbb', '..kbbbbb', '..kbbbbb', '..kkkkkk',
    ],
  },
  // 呼びこみの男: 赤いはちまきと、橙のはっぴ
  yobikomi: {
    sym: true,
    pal: { h: '#2a1e16', r: '#e0605a', o: '#e8a04a', O: '#c07a2a' },
    px: [
      '........', '....kkkk', '...khhhh', '..krrrrr', '..khhhhh', '..khssss', '..khsess', '...kssss',
      '...ksssm', '....kkss', '...koooo', '..koooOo', '..kooOoo', '..kooooo', '..kooooo', '..kkkkkk',
    ],
  },
  // 買い物客: 青い頭巾と、紫の上着のおばさん
  kaimono: {
    sym: true,
    pal: { h: '#6a4a3a', c: '#4f8fd6', p: '#a86ab0', P: '#86488e' },
    px: [
      '....kkkk', '...kcccc', '..kccccc', '..kkkkkk', '..khssss', '..khsess', '..khssss', '..khsssm',
      '..khhsss', '...khkss', '..kppppp', '.kpppPpp', '.kppPppp', '.kpppppp', '.kpppppp', '.kkkkkkk',
    ],
  },
  // 町の子ども: 小さくて、黄色い服
  kodomo: {
    sym: true,
    pal: { h: '#3a2a22', y: '#f2d45c', Y: '#d9b030' },
    px: [
      '........', '........', '........', '....kkkk', '...khhhh', '..khhhhh', '..khssss', '..khsess',
      '...kssss', '...ksssm', '....kkss', '...kyyyy', '..kyyYyy', '..kyyyyy', '..kyyyyy', '..kkkkkk',
    ],
  },

  // ---- 地図のアイコン（12×12）----
  world: {
    sym: true,
    pal: { b: '#3d7fd1', g: '#4cae5a' },
    px: ['....kk', '..kkbb', '.kbbgg', '.kbggg', 'kbbbgg', 'kbbbbg', 'kbggbb', 'kbgggb', '.kbbgg', '.kbbbb', '..kkbb', '....kk'],
  },
  house: {
    sym: true,
    pal: { r: '#c0504d', w: '#e8d8b0', d: '#8a5a3a' },
    px: ['.....k', '....kr', '...krr', '..krrr', '.krrrr', 'krrrrr', '.kwwww', '.kwwww', '.kwwwd', '.kwwwd', '.kwwwd', '.kkkkk'],
  },
  homes: { sym: true, pal: { r: '#4f7fc0', w: '#e8d8b0', d: '#8a5a3a' }, px: [] },
  bakery: { sym: true, pal: { r: '#e0873a', w: '#f2e2c0', d: '#8a5a3a' }, px: [] },
  village: {
    sym: true,
    pal: { r: '#c0504d', w: '#e8d8b0', d: '#8a5a3a', G: '#4cae5a' },
    px: ['.....k', '....kr', '...krr', '..krrr', '.krrrr', 'krrrrr', '.kwwww', '.kwwww', '.kwwwd', '.kwwwd', 'GGGGGG', 'GGGGGG'],
  },
  kodama: {
    sym: true,
    pal: { w: '#f4f6fa', W: '#c8d0dc', r: '#e07a8a', y: '#e8b84a' },
    px: [
      '.kk.....', '.kwk....', '.kwrk...', '.kwrwk..', '.kwwwwkk', 'kwwwwwww', 'kwwwwwww', 'kwwyywww',
      'kwwykwww', '.kwwwwww', '.kWwwwww', '..kWwwwk', '...kWwww', '....kkWw', '.....kkk', '........',
    ],
  },
  squirrel: {
    pal: { b: '#a0602a', c: '#f0d0a0' },
    px: [
      '................',
      '..kk.......kk...',
      '..kbkkkkkkkbk...',
      '..kbbbbbbbbbk...',
      '...kbbbbbbbk....',
      '..kbekbbbkebk...',
      '..kbbbbbbbbbk...',
      '...kbbbkkbbk....',
      '....kbccccbk....',
      '...kbbccccbbk.kk',
      '..kbbbccccbbbkbk',
      '..kbbbbccbbbbkbk',
      '..kbbbbbbbbbbkbk',
      '...kbbbbbbbbkbbk',
      '....kkkkkkkkkkk.',
      '................',
    ],
  },
  owl: {
    sym: true,
    pal: { o: '#8a6a4a', y: '#f2d45c', Y: '#1e1612', c: '#d8c0a0' },
    px: [
      '........', '...k....', '...kk...', '..kookkk', '..kooooo', '.koyyyoo', '.koyYyoo', '.koyyyoo',
      '.koooook', '.kocccco', '.kocccco', '.koccccc', '..kocccc', '..kooooo', '...kkkkk', '........',
    ],
  },
  bush: {
    sym: true,
    pal: { g: '#3f9b4b', G: '#2b6e35' },
    px: ['......', '...kkk', '..kggg', '.kgGgg', '.kgggg', 'kgggGg', 'kggggg', 'kgGggg', '.kgggg', '..kkkk', '......', '......'],
  },
  log: {
    sym: true,
    pal: { b: '#8a5a3a', B: '#5c3620', G: '#4cae5a' },
    px: ['......', '......', '......', '.kkkkk', 'kbbbbb', 'kbBbbb', 'kbbbbB', 'kbbbbb', '.kkkkk', '......', 'GGGGGG', '......'],
  },
  moss: {
    sym: true,
    pal: { G: '#4cae5a', g: '#2b6e35', t: '#8c8c8c' },
    px: ['......', '......', 'G.....', 'GG..G.', '.GGGGG', '..tGGG', '.ttGGg', 'GGGggg', 'GGgggg', 'gggGGG', '......', '......'],
  },
  stump: {
    sym: true,
    pal: { y: '#d8b070', Y: '#b08a50', b: '#8a5a3a', B: '#5c3620', G: '#4cae5a' },
    px: ['......', '......', '......', '.kkkkk', 'kyyYyy', 'kyYyyy', 'kkkkkk', 'kbbbbb', 'kbBbbb', 'kbbbbb', 'GGGGGG', '......'],
  },
  stream: {
    sym: true,
    pal: { b: '#3d7fd1', w: '#bfe3ff', l: '#8cc8ff' },
    px: ['......', '......', 'llllll', 'bbbbbb', 'bwbbbb', 'bbbbwb', 'bbbbbb', 'bwbbbb', 'bbbbbw', 'llllll', '......', '......'],
  },
  camp: {
    sym: true,
    pal: { r: '#e0503a', y: '#f2c14a', Y: '#fff0a0', b: '#8a5a3a' },
    px: ['......', '.....r', '....ry', '...ryy', '...ryY', '..rryy', '..ryYy', '.kbbbb', 'kbkbkb', '......', '......', '......'],
  },
  fog: {
    sym: true,
    pal: { l: '#c8ccd8' },
    px: ['......', '......', '.lllll', 'llllll', '......', '..llll', 'llllll', '......', '.lllll', 'llllll', '......', '......'],
  },
  gate: {
    sym: true,
    pal: { t: '#8c8c8c', G: '#4cae5a' },
    px: ['......', '.kkkkk', 'kttttt', 'ktGttt', 'ktkkkk', 'ktk...', 'ktk...', 'ktk...', 'kGk...', 'ktk...', 'ktk...', 'kkk...'],
  },
  tsunagi: {
    sym: true,
    pal: { g: '#7a9a5a', G: '#5a7a40', s: '#c8b890', e: '#1e1612', t: '#8a6a3a', T: '#6a4a28' },
    px: [
      '........', '........', '....kkkk', '...kgggg', '..kggggg', '..kgeggg', '..kggggg', '..kgGggk',
      '...kkkkt', '..ktTttt', '.ktTtTtt', '.kttTttT', '.ktTttTt', '..kttttt', '..kskksk', '...kk.kk',
    ],
  },
  frog: {
    sym: true,
    pal: { g: '#6ac43a', G: '#4a9a28', w: '#f4f6fa', y: '#e8e070' },
    px: [
      '........', '........', '..kkk...', '.kwwwk..', '.kwkwkkk', '.kwwwkgg', '..kkkggg', '.kgggggg',
      'kggggggg', 'kgmmmmmm', 'kggggggg', '.kgyyyyy', '.kgyyyyy', 'kggkkkgg', 'kGk...kG', 'kk......',
    ],
  },
  swamp: {
    sym: true,
    pal: { p: '#5a4a6a', P: '#3e3050', g: '#6a8a4a' },
    px: ['......', '......', '....g.', '...gg.', '..g.g.', 'pppppp', 'pPpppp', 'ppppPp', 'Pppppp', 'ppPppp', 'pppppp', '......'],
  },
  reeds: {
    sym: true,
    pal: { g: '#6a8a4a', G: '#4a6a30', b: '#8a6a3a', p: '#5a4a6a' },
    px: ['.b....', '.b..b.', '.g..b.', '.g..g.', 'gg.gg.', '.g..g.', '.gg.g.', '.g.gg.', '.g..g.', 'pppppp', 'pppppp', '......'],
  },
  rock: {
    sym: true,
    pal: { t: '#8c8c8c', T: '#6a6a6a', p: '#5a4a6a' },
    px: ['......', '......', '......', '...kkk', '..kttt', '.ktTtt', '.ktttt', 'kttTtt', 'kttttt', 'pppppp', 'pppppp', '......'],
  },
  shrine: {
    sym: true,
    pal: { r: '#8a3a3a', t: '#8c8c8c', p: '#3e3050', g: '#6a8a4a' },
    px: ['......', '....kk', '...krr', '..krrr', '.krrrr', '...ktt', '...ktk', '...ktk', '..kttt', '.gkttt', 'pppppp', 'pppppp'],
  },
  link: {
    pal: { c: '#6fd3d8', C: '#3a9aa0' },
    px: [
      '............',
      '............',
      '..kkkk......',
      '.kccCck.....',
      'kcC..kc.....',
      'kc..kkkkk...',
      'kc.kccCcck..',
      '.kckk..kCck.',
      '..kk....kck.',
      '........kck.',
      '.......kcck.',
      '........kk..',
    ],
  },
  'tile-swamp': {
    pal: { p: '#4a3a5a', P: '#3a2c48', g: '#5a7a40', l: '#7a6a8a' },
    px: [
      'ppppppppppppppPppppppppppppppppp',
      'pppPppppppppppppppppppgppppppppp',
      'pppppppppllllppppppppgpgppppPppp',
      'ppppppppppppppppppppppgppppppppp',
      'ppgppppppppppppPpppppppppppppppp',
      'pgpgppppPpppppppppppppppllllpppp',
      'ppgppppppppppppppppppppppppppppp',
      'pppppppppppppppppppPpppppppppppp',
      'pppppllllppppppppppppppppppppgpp',
      'ppppppppppppppgpppppppppppppgpgp',
      'pppPpppppppppgpgppppppppppppggpp',
      'ppppppppppppppgppppllllppppppppp',
      'pppppppppPpppppppppppppppppppppp',
      'pppppppppppppppppppppppppPpppppp',
      'ppllllpppppppppppppppppppppppppp',
      'ppppppppppppppppPppppppppppppppp',
    ],
  },
  bed: {
    sym: true,
    pal: { b: '#4f7fc0', d: '#8a5a3a' },
    px: ['......', '......', 'k.....', 'kk....', 'kwwkkk', 'kwwbbb', 'kbbbbb', 'kbbbbb', 'kkkkkk', 'kd....', 'kd....', '......'],
  },
  shelf: {
    sym: true,
    pal: { d: '#8a5a3a', r: '#c0504d', b: '#4f7fc0', y: '#e0a84a', G: '#4cae5a' },
    px: ['kkkkkk', 'kddddd', 'kdrbyG', 'kdrbyG', 'kddddd', 'kdbGry', 'kdbGry', 'kddddd', 'kdyrbb', 'kdyrbb', 'kkkkkk', 'k.....'],
  },
  table: {
    sym: true,
    pal: { d: '#8a5a3a', y: '#e0a84a' },
    px: ['......', '......', '......', '....yy', '..wwyy', 'kkkkkk', 'kddddd', 'kkkkkk', '.kd...', '.kd...', '.kd...', '......'],
  },
  // 第4章: 露店（しまの天幕）
  stall: {
    sym: true,
    pal: { r: '#c0504d', d: '#8a5a3a' },
    px: ['......', '.kkkkk', 'krwrwr', 'krwrwr', 'kkkkkk', '.k....', '.k....', '.kkkkk', '.kdddd', '.kdddd', '.kkkkk', '......'],
  },
  crate: {
    sym: true,
    pal: { d: '#b07a40' },
    px: ['......', '......', '.kkkkk', '.kdddd', '.kdkdd', '.kddkd', '.kdddk', '.kddkd', '.kdkdd', '.kdddd', '.kkkkk', '......'],
  },
  scroll: {
    sym: true,
    pal: { w: '#f0e6c8' },
    px: ['......', '..kkkk', '.kwwww', '.kkkkk', '..kwww', '..kwkk', '..kwww', '..kwkk', '..kwww', '.kkkkk', '.kwwww', '..kkkk'],
  },
  // きみのかばん（mkdir ~/かばん で作る場所のアイコン）
  bag: {
    sym: true,
    pal: { b: '#a0603a', B: '#e8c34a' },
    px: ['......', '...kkk', '..k...', '..k...', '.kkkkk', 'kbbbbb', 'kbbbbB', 'kbbbbb', 'kbbbbb', 'kbbbbb', 'kkkkkk', '......'],
  },
  stage: {
    sym: true,
    pal: { r: '#c0504d', d: '#b07a40' },
    px: ['......', '......', 'kkkkkk', 'krrrrr', 'kr....', 'kr....', 'kr....', 'kkkkkk', 'kddddd', 'kddddd', 'kkkkkk', '......'],
  },
  // 物語を進めるために行く場所の印（4×12、細長い）
  mark: {
    pal: { R: '#ff4d4d' },
    px: ['.kk.', 'kRRk', 'kRRk', 'kRRk', 'kRRk', 'kRRk', '.kk.', '....', '.kk.', 'kRRk', '.kk.', '....'],
  },
  well: {
    sym: true,
    pal: { r: '#7a4a2a', t: '#8c8c8c', T: '#6a6a6a' },
    px: ['......', '..kkkk', '.krrrr', 'krrrrr', '..k...', '..k...', '..k...', 'kkkkkk', 'kttttt', 'ktTttt', 'kttttt', 'kkkkkk'],
  },
  path: {
    sym: true,
    pal: { w: '#c89a5a', G: '#4cae5a' },
    px: ['......', '.kkkkk', '.kwwww', '.kwwww', '.kkkkk', '....kw', '....kw', '....kw', '....kw', '..GGGG', 'GGGGGG', '......'],
  },
  lock: {
    sym: true,
    pal: { y: '#e8c34a' },
    px: ['......', '...kkk', '..k...', '..k...', '..k...', '.kkkkk', '.kyyyy', '.kyyyk', '.kyyyk', '.kyyyy', '.kkkkk', '......'],
  },
  fence: {
    sym: true,
    pal: { w: '#c89a5a' },
    px: ['......', '.k...k', 'kwk.kw', 'kwk.kw', 'kkkkkk', 'kwwwww', 'kkkkkk', 'kwk.kw', 'kwk.kw', 'kkkkkk', 'kwwwww', 'kkkkkk'],
  },
  hole: {
    sym: true,
    pal: { d: '#0a0806', t: '#6b5a3a' },
    px: ['......', '......', '......', '...kkk', '..kddd', '.kdddd', '.kdddd', '.kdddd', 'kttttt', 'tttttt', 'tttttt', '......'],
  },
  forest: {
    sym: true,
    pal: { g: '#3f9b4b', G: '#2b6e35', b: '#7a4a2a' },
    px: ['....kk', '...kgg', '..kggg', '.kgggG', '.kgGgg', 'kggggg', 'kgGggg', '.kgggg', '..kkkk', '....kb', '....kb', '...kkk'],
  },
  item: {
    sym: true,
    px: ['......', '.kkkkk', '.kwwww', '.kwkkk', '.kwwww', '.kwkkk', '.kwwww', '.kwkkk', '.kwwww', '.kwwww', '.kkkkk', '......'],
  },
  board: {
    sym: true,
    pal: { w: '#c89a5a', p: '#f4f1ea', G: '#4cae5a' },
    px: ['......', 'kkkkkk', 'kwwwww', 'kwppww', 'kwppww', 'kwwwww', 'kkkkkk', '..kw..', '..kw..', '..kw..', 'GGGGGG', '......'],
  },
  // 包み（.tar.gz）: 布の荷を、縄で十字に縛ったもの
  package: {
    sym: true,
    pal: { b: '#c8a070', r: '#7a4a2a' },
    px: ['......', '....kr', '..kkkr', '.kbbbr', 'kbbbbr', 'krrrrr', 'kbbbbr', 'kbbbbr', '.kbbbr', '..kkkk', '......', '......'],
  },
  // 坑道: 木の枠で支えた、暗い入口
  mine: {
    sym: true,
    pal: { w: '#8a5a3a', d: '#1a1410', t: '#6a6460' },
    px: ['......', '......', 'kkkkkk', 'kwwwww', 'kwkkkk', 'kwkddd', 'kwkddd', 'kwkddd', 'kwkddd', 'tttttt', 'tttttt', '......'],
  },
  // 隠れ場（mkdir 隠れ場 で作る場所）: 岩かげの小さな囲い
  hideout: {
    sym: true,
    pal: { t: '#8c8780', T: '#a39e96', d: '#3a3430' },
    px: ['......', '......', '....kk', '..kktt', '.kttTt', 'ktttdd', 'kttddd', 'kttddd', 'kttddd', 'kkkkkk', '......', '......'],
  },
  // 廃墟山道: 崩れた石垣
  ruins: {
    sym: true,
    pal: { t: '#8c8780', T: '#a39e96', p: '#7a6a5a' },
    px: ['......', '......', '......', '.kk...', '.ktk..', '.ktk.k', '.kttkt', '.ktttt', 'kttttt', 'kttTtt', 'pppppp', '......'],
  },
  stone: {
    sym: true,
    pal: { t: '#8c8c8c', G: '#4cae5a' },
    px: ['......', '...kkk', '..kttt', '.kttkk', '.kttkt', '.ktttt', '.kttkk', '.ktttt', '.ktttt', 'kkkkkk', 'GGGGGG', '......'],
  },
  proc: {
    sym: true,
    pal: { l: '#fff1c2', Y: '#ffd24a' },
    px: ['......', '....ll', '..llYY', '.lYYww', '.lYwww', 'lYwwww', 'lYwwww', '.lYwww', '.lYYww', '..llYY', '....ll', '......'],
  },
  'proc-stopped': { sym: true, pal: { l: '#55555e', Y: '#77777f', w: '#99999f' }, px: [] },
  up: {
    sym: true,
    pal: { a: '#9fb4d0' },
    px: ['......', '.....k', '....ka', '...kaa', '..kaaa', '.kaaaa', 'kkkkaa', '....ka', '....ka', '....ka', '....kk', '......'],
  },
  // 物見の塔: 赤い屋根の、石の塔。窓に明かり
  tower: {
    sym: true,
    pal: { r: '#8a3a3a', t: '#a39e96', y: '#f2c46d', G: '#4cae5a' },
    px: ['.....k', '....kr', '...krr', '..krrr', '..kkkk', '...ktt', '...kty', '...ktt', '...ktt', '..kttt', '..kttt', 'GGGGGG'],
  },
  // 塔の扉: 木の両開きの扉と、真ちゅうの取っ手
  door: {
    sym: true,
    pal: { w: '#8a5a3a', W: '#6a4428', y: '#f2c46d' },
    px: ['......', '..kkkk', '.kwwww', 'kwwwwW', 'kwwwwW', 'kwwwwW', 'kwwwyW', 'kwwwwW', 'kwwwwW', 'kwwwwW', 'kkkkkk', '......'],
  },
  // 大時計: 9時を指した文字盤と、振り子
  clock: {
    pal: { y: '#d8b048' },
    px: [
      '....kkkk....',
      '..kkwwwwkk..',
      '.kwwwwkwwwk.',
      '.kwwwwkwwwk.',
      'kwwwwwkwwwwk',
      'kwkkkkkwwwwk',
      'kwwwwwwwwwwk',
      '.kwwwwwwwwk.',
      '.kwwwwwwwwk.',
      '..kkwwwwkk..',
      '....kkkk....',
      '.....yy.....',
    ],
  },
  // 開いた帳面（きみの記録）
  book: {
    sym: true,
    pal: { r: '#8a3a3a' },
    px: ['......', '......', '.kk...', 'kwwkk.', 'kwwwwk', 'kwkkwk', 'kwwwwk', 'kwkkwk', 'kwwwwk', 'kkkkkk', 'rrrrrr', '......'],
  },
  // 鍵（試練の鍵、鍵束）
  key: {
    pal: { y: '#e8c050' },
    px: [
      '............',
      '..kkk.......',
      '.kyyyk......',
      'kyk.kyk.....',
      'kyk.kyk.....',
      '.kyyyk......',
      '..kyk.......',
      '..kyk.......',
      '..kyykk.....',
      '..kyk.......',
      '..kyykk.....',
      '...kk.......',
    ],
  },
  // 賢者の庵: わらぶき屋根の、小さな家
  hermitage: {
    sym: true,
    pal: { t: '#c8a860', w: '#e8dcc0', d: '#6a4428', G: '#f4f6fa' },
    px: ['......', '.....k', '....kt', '...ktt', '..kttt', '.ktttt', 'kkkkkk', '.kwwww', '.kwwkd', '.kwwkd', '.kkkkk', 'GGGGGG'],
  },
  // ---- ターミナルの枠のタイル（大きさは自由。くり返し敷きつめる）----
  'tile-market': {
    pal: { r: '#d85a4a', R: '#b8463a', w: '#f6ead2', D: '#7a2a1e' },
    px: [
      'DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD',
      'rrrRwwwwrrrRwwwwrrrRwwwwrrrRwwww',
      'rrrRwwwwrrrRwwwwrrrRwwwwrrrRwwww',
      'rrrRwwwwrrrRwwwwrrrRwwwwrrrRwwww',
      'rrrRwwwwrrrRwwwwrrrRwwwwrrrRwwww',
      'rrrRwwwwrrrRwwwwrrrRwwwwrrrRwwww',
      'rrrRwwwwrrrRwwwwrrrRwwwwrrrRwwww',
      'rrrRwwwwrrrRwwwwrrrRwwwwrrrRwwww',
      'rrrRwwwwrrrRwwwwrrrRwwwwrrrRwwww',
      'rrrRwwwwrrrRwwwwrrrRwwwwrrrRwwww',
      '.rr..ww..rr..ww..rr..ww..rr..ww.',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
    ],
  },
  // 坑道アナグラ: 暗い岩の壁と、木の支柱、ランプの明かり
  'tile-mine': {
    pal: { s: '#2a2420', S: '#221c18', w: '#6a4428', W: '#4a2c18', l: '#f2c46d' },
    px: [
      'sssswWsssssssSssssssswWssssssSss',
      'sssswWssssssssssssssswWsssssssss',
      'SssswWsssssSsssssSssswWssslsssss',
      'sssswWssssssssssssssswWsssssssSs',
      'wwwwwWwwwwwwwwwwwwwwwwWwwwwwwwww',
      'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
      'sssswWssssSsssssssssswWsssssssss',
      'ssSswWsssssssslssssssWWssSssssss',
      'sssswWssssssssssssssswWsssssssss',
      'sssswWsssssSsssssssssWWssssssSss',
      'ssssWWssssssssssSssssswWssssssss',
      'SssswWssssssssssssssswWsssssssss',
      'sssswWsssssssSsssssssWWsssssslss',
      'sssswWssssssssssssssswWsssSsssss',
      'ssssWWssslsssssssssssWWsssssssss',
      'sssswWsssssssssssSssswWsssssssss',
    ],
  },
  // 記憶の書庫: 色とりどりの背表紙が並ぶ、本棚
  'tile-library': {
    pal: {
      W: '#6a4428', w: '#4a2c18', d: '#2a1c14', r: '#b84a3a', R: '#7a2a2a', b: '#3a5a9a', g: '#4a7a4a', y: '#c8a048', p: '#6a4a8a',
    },
    px: [
      'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
      'ddkbkbddddddddkRdddddddkpkggddkp',
      'ddkbkbddddddddkRddkrdddkpkggddkp',
      'kgkbkbkbbkrrkykRkrkrkyykpkggkykp',
      'kgkbkbkbbkrrkykRkrkrkyykpkggkykp',
      'kgkbkbkbbkrrkykRkrkrkyykpkggkykp',
      'kgkbkbkbbkrrkykRkrkrkyykpkggkykp',
      'wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww',
      'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
      'kbkpkbbdddkbbdddddkbddddddkRRddk',
      'kbkpkbbdddkbbdddkRkbkrrdddkRRkbk',
      'kbkpkbbkrrkbbkyykRkbkrrkggkRRkbk',
      'kbkpkbbkrrkbbkyykRkbkrrkggkRRkbk',
      'kbkpkbbkrrkbbkyykRkbkrrkggkRRkbk',
      'kbkpkbbkrrkbbkyykRkbkrrkggkRRkbk',
      'wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww',
    ],
  },
  // 賢者の庵の中: 木の桟と、障子の紙
  'tile-shoji': {
    pal: { b: '#8a6a48', w: '#f0e8d4', W: '#f8f2e4' },
    px: [
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      'bWWWWWWWbWWWWWWWbWWWWWWWbWWWWWWW',
      'bwwwwwwwbwwwwwwwbwwwwwwwbwwwwwww',
      'bwwwwwwwbwwwwwwwbwwwwwwwbwwwwwww',
      'bwwwwwwwbwwwwwwwbwwwwwwwbwwwwwww',
      'bwwwwwwwbwwwwwwwbwwwwwwwbwwwwwww',
      'bwwwwwwwbwwwwwwwbwwwwwwwbwwwwwww',
      'bwwwwwwwbwwwwwwwbwwwwwwwbwwwwwww',
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      'bWWWWWWWbWWWWWWWbWWWWWWWbWWWWWWW',
      'bwwwwwwwbwwwwwwwbwwwwwwwbwwwwwww',
      'bwwwwwwwbwwwwwwwbwwwwwwwbwwwwwww',
      'bwwwwwwwbwwwwwwwbwwwwwwwbwwwwwww',
      'bwwwwwwwbwwwwwwwbwwwwwwwbwwwwwww',
      'bwwwwwwwbwwwwwwwbwwwwwwwbwwwwwww',
      'bwwwwwwwbwwwwwwwbwwwwwwwbwwwwwww',
    ],
  },
  // 物見の塔: 灰色の石のれんがと、真ちゅうの歯車
  'tile-tower': {
    pal: { s: '#5a5660', S: '#46424c', t: '#6e6a74', y: '#c8a048', Y: '#8a6a28' },
    px: [
      'SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS',
      'sssssssSsssssssSsssssssSsssstssS',
      'sstssssSsssssssSsssssssSsssssssS',
      'sssssssSsssssssSsssssssSsssssssS',
      'SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS',
      'sssSsssssssSsssssssSsssssssSssss',
      'sssSsssssssStssssssSsssssssSssss',
      'sssSsssssssSsssssssSsssssssSssss',
      'SSSSSSSSSSSSSSSSSSSSSySySSSSSSSS',
      'sssssssSsssssssSssssyyyyyssssssS',
      'sssssssSsssssstSsssyyYYYyysssssS',
      'sssssssSsssssssSssssyYkYyssssssS',
      'SSSSSSSSSSSSSSSSSSSyyYYYyySSSSSS',
      'sssSstsssssSsssssssSyyyyystSssss',
      'sssSsssssssSsssssssSsysysssSssss',
      'sssSsssssssSsssssssSsssssssSssss',
    ],
  },
  // 廃墟山道: 灰色の山肌に、崩れた石垣のかけら
  'tile-ruins': {
    pal: { s: '#6e6a64', S: '#5a5650', t: '#8c8780', T: '#a39e96', c: '#4a4640' },
    px: [
      'ssssssssssssssssssssssssssssssss',
      'sttttTttsssssSsssssttttTtttsssss',
      'sttttttcssssssssssstttttttcsssss',
      'scccccccsssSssssssscccccccssssss',
      'sssssssssttTtttsssssssssssssttTt',
      'sssSssssstttttcssssSsssssssstttt',
      'ssssssssscccccsssssssssssssscccc',
      'ssssssssssssssssssssssSsssssssss',
      'ttTttssssssssSsssttTttttsssssssS',
      'tttttcssssssssssstttttttcsssssss',
      'cccccsssssSsssssscccccccssssssss',
      'ssssssssssssssssssssssssssttTtts',
      'sssssttTttttssssssSssssssttttcss',
      'Ssssstttttttcssssssssssssscccsss',
      'ssssscccccccssssssssssssssssssss',
      'ssssssssssssssssSsssssssssssssss',
    ],
  },
  'tile-wood': {
    pal: { a: '#8a5a3a', b: '#734a2e', c: '#4a2c18', d: '#a06a44' },
    px: [
      'dddddddddddddddddddddddddddddddd',
      'aaaaaabaaaaaaaaaaaaaaaaaaaaaaaac',
      'aaaaaaaaaaabbaaaaaaaabbbaaaaaaac',
      'abbaaaaaaaaaaaaaaaaaaaaaaaaaaaac',
      'aaaaaaaaabaaaaaaaaabaaaaaaabbaac',
      'aaaaabbaaaaaaaabaaaaaaaaaaaaaaac',
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaac',
      'cccccccccccccccccccccccccccccccc',
      'dddddddddddddddddddddddddddddddd',
      'aaaaaaaaaaaaaaacaaaaaaaaaabaaaaa',
      'aaabbbaaaaaaaaacaaaaabaaaaaaaaaa',
      'aaaaaaaaaaaabaacaaaaaaaaaaaaaaaa',
      'aaaaaaaaaaaaaaacaaabbaaaaaaaabba',
      'abaaaaaaabbaaaacaaaaaaaaaaaaaaaa',
      'aaaaaaaaaaaaaaacaaaaaaaaabaaaaaa',
      'cccccccccccccccccccccccccccccccc',
    ],
  },
  'tile-cloud': {
    pal: { w: '#ffffff', l: '#dcefff' },
    px: [
      '................................................',
      '..........llll..................................',
      '........llwwwwll................................',
      '.......lwwwwwwwwl.......................ll......',
      '.....llwwwwwwwwwwll...................llwwll....',
      '....lwwwwwwwwwwwwwwl.................lwwwwwwl...',
      '....llllllllllllllll.................llllllll...',
      '................................................',
      '................................................',
      '................................................',
      '..........................lll...................',
      '........................llwwwll.................',
      '.......................lwwwwwwwl................',
      '.......................lllllllll................',
      '................................................',
      '................................................',
    ],
  },
  'tile-dusk': {
    pal: { d: '#2a1622', r: '#6e1f2e', p: '#3d2440', e: '#b0303f' },
    px: [
      '................................................',
      '..........dddd.......................e..........',
      '........ddppppdd................................',
      '.......dppppppppd.......................dd......',
      '.....ddppppppppppdd...................ddppdd....',
      '....dppppppppppppppd.................dppppppd...',
      '....rrrrrrrrrrrrrrrr.................rrrrrrrr...',
      '.............e..................................',
      '................................................',
      '...e............................................',
      '..........................ddd...............e...',
      '........................ddpppdd.................',
      '.......................dpppppppd................',
      '.......................rrrrrrrrr................',
      '................................................',
      '..................e.............................',
    ],
  },
  'tile-leaves': {
    pal: { g: '#3f9b4b', G: '#2b6e35', l: '#5cbf5c', b: '#1d4a26' },
    px: [
      'GGgggGGbbGGgglgG',
      'GgglggGGbGgggggG',
      'bGggggGGGGgllggb',
      'bbGgGGgglGGgggGb',
      'GGGbGGgggggGGGbb',
      'gggGbbGgglggGbGG',
      'glggGbGGgggGbbGg',
      'ggggGGGbGGGGbGgg',
      'GgGGGgGbbGggGGgg',
      'GGggglGGbGglgGGG',
      'bGgggggGGGgggGbb',
      'bbGGgGGGgGGGgGGb',
      'GbbGGgggggGbbGGG',
      'GGbGgglgggGbGGgg',
      'gGGGggggGGGGGglg',
      'ggGbGGGGbbGgggGg',
    ],
  },
  unknown: {
    pal: { q: '#8f84b8' },
    px: [
      '............', '....qqqq....', '...qq..qq...', '.......qq...', '......qq....', '.....qq.....',
      '.....qq.....', '............', '.....qq.....', '.....qq.....', '............', '............',
    ],
  },
};

// 色だけ違うアイコンは、形を借りる
SPRITES.homes.px = SPRITES.house.px;
SPRITES.bakery.px = SPRITES.house.px;
SPRITES['proc-stopped'].px = SPRITES.proc.px;

export function spriteRows(id: string): string[] {
  const s = SPRITES[id] ?? SPRITES.unknown;
  return s.sym ? s.px.map((r) => r + [...r].reverse().join('')) : s.px;
}

export function spritePalette(id: string): Record<string, string> {
  return { ...BASE, ...(SPRITES[id] ?? SPRITES.unknown).pal };
}

export function hasSprite(id: string): boolean {
  return id in SPRITES;
}

const cache = new Map<string, string>();

/** ドット絵を PNG の data URL にする。表示側で image-rendering: pixelated で拡大する */
export function spriteURL(id: string): string {
  const hit = cache.get(id);
  if (hit) return hit;
  const rows = spriteRows(id);
  const pal = spritePalette(id);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(...rows.map((r) => r.length));
  canvas.height = rows.length;
  const ctx = canvas.getContext('2d')!;
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      ctx.fillStyle = pal[ch] ?? '#ff00ff';
      ctx.fillRect(x, y, 1, 1);
    }),
  );
  const url = canvas.toDataURL();
  cache.set(id, url);
  return url;
}

export function spriteImg(id: string, cls: string): HTMLImageElement {
  const img = document.createElement('img');
  img.src = spriteURL(id);
  img.className = cls;
  img.alt = '';
  img.draggable = false;
  return img;
}
