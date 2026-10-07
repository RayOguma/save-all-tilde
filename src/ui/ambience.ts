// 崩壊したあとの場所の空気。シナリオの staticIf の場所（body.glitchy）にいる間、ときどき画面が乱れて「ザザッ」と鳴る。
// BGM が止まった静けさの中で、世界が壊れていることを感じさせる
import { playSound, sfx } from './sound';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 次に乱れるまでの間（ミリ秒）。たまに、が大事なので間をあける */
const nextGap = () => 18000 + Math.random() * 30000;

/** 全画面の幕（タイトル・章の見出し・案内）が出ているときは、乱さない */
function covered(): boolean {
  return ['title', 'chapter-card', 'tour'].some((id) => !document.getElementById(id)?.hidden);
}

/** 一度だけ乱す。長さはまちまち */
export async function staticBurst() {
  const ms = 220 + Math.random() * 480;
  document.body.classList.add('fx-static');
  sfx('static', ms / 1000);
  await sleep(ms);
  document.body.classList.remove('fx-static');
}

/** 鳴りやまない鐘（シナリオの bellIf の場所。body.belling）。入ってすぐに一度、それから1分おきに鳴る */
const BELL_EVERY = 60_000;

function startBells() {
  let next = 0;
  setInterval(() => {
    const on = document.body.classList.contains('belling') && !covered() && document.visibilityState === 'visible';
    if (!on) {
      next = 0;
      return;
    }
    const now = Date.now();
    if (!next) next = now + 3000;
    if (now < next) return;
    playSound('towerbell');
    next = now + BELL_EVERY;
  }, 500);
}

export function startAmbience() {
  startBells();
  const tick = async () => {
    if (document.body.classList.contains('glitchy') && !covered() && document.visibilityState === 'visible') {
      await staticBurst();
      // ときどき、続けてもう一度
      if (Math.random() < 0.3) {
        await sleep(300 + Math.random() * 500);
        await staticBurst();
      }
    }
    setTimeout(tick, nextGap());
  };
  setTimeout(tick, nextGap());
}
