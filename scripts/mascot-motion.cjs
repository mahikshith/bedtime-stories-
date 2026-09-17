/*
 * Frame strips of Lumi's gestures.
 *
 * A still frame cannot tell you whether a hop has anticipation or whether a
 * revolve goes all the way round — both of those shipped broken once and looked
 * fine in a screenshot. This fires each gesture from the dev stage and captures
 * the frames that follow, so the motion can actually be inspected.
 *
 * Usage: MOODS_URL=http://127.0.0.1:5199/scripts/moods.html OUT=<dir> \
 *        node scripts/mascot-motion.cjs   (needs `npm run dev`)
 */
const { chromium } = require('playwright');
const { launchOptions } = require('./lib/browser.cjs');
const fs = require('fs');
(async () => {
  const OUT = process.env.OUT;
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch(launchOptions());
  const p = await b.newPage({ viewport: { width: 420, height: 380 }, deviceScaleFactor: 2 });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.goto(process.env.MOODS_URL, { waitUntil: 'networkidle' });
  await p.waitForTimeout(600);
  const stage = p.locator('#stage');

  for (const [name, button, frames, gap] of [['hop', '#do-hop', 10, 70], ['spin', '#do-spin', 10, 90]]) {
    await p.locator(button).click();
    for (let i = 0; i < frames; i += 1) {
      await stage.screenshot({ path: `${OUT}/${name}-${String(i).padStart(2, '0')}.png` });
      await p.waitForTimeout(gap);
    }
    await p.waitForTimeout(900);
  }
  await b.close();
  console.log('strips written');
})();
