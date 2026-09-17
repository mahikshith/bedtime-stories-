/**
 * Renders the mascot sheets and screenshots them.
 *
 * The mood table, the turn sequence and the four body actions on one page. A
 * mascot is the one thing in this app that cannot be checked by assertion — the
 * only way to know whether a crest is drawn through a hat, or a cap is clipped
 * by the viewBox, is to look at it, and both of those shipped once.
 */
const { chromium } = require('playwright');
const { launchOptions, outDir } = require('./lib/browser.cjs');
const OUT = outDir();
require('fs').mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch(launchOptions());
  const page = await browser.newPage({ viewport: { width: 1000, height: 1500 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); });

  const url = process.env.MOODS_URL || 'http://127.0.0.1:4173/moods.html';
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/mascot-sheet.png`, fullPage: true });

  const rigs = await page.locator('.lumi__rig').count();
  const turned = await page.locator('.lumi').first().evaluate(
    (el) => getComputedStyle(el).getPropertyValue('--turn').trim(),
  );
  console.log('MASCOTS', rigs, 'TURN_VAR', JSON.stringify(turned));
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'NO PAGE ERRORS');
  await browser.close();
  if (errors.length) process.exit(1);
})();
