/**
 * Every voice game, with no microphone at all.
 *
 * This is the condition a great many real users are in — permission refused, no
 * device, or an embedded page where `getUserMedia` is blocked outright — and
 * until now each of those games answered it with a dead end. The walk fails if
 * any game cannot be played to a scoring turn without a microphone.
 */
const { chromium } = require('playwright');
const { launchOptions, outDir } = require('./lib/browser.cjs');
const OUT = `${outDir()}/nomic`;
require('fs').mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch(launchOptions());
  // No fake device and no permission: getUserMedia rejects, exactly as it does
  // inside a sandboxed iframe.
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); });

  await page.addInitScript(() => {
    // Belt and braces: make the mic unavailable the way an iframe does.
    Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true });
  });

  await page.goto(`http://127.0.0.1:${process.env.PORT || 4173}/`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Begin' }).click();
  await page.waitForTimeout(250);
  const h = await page.locator('h2.h1').first().innerText();
  const m = h.match(/(\d+)\s*×\s*(\d+)/);
  await page.locator('#gate').fill(String(Number(m[1]) * Number(m[2])));
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForTimeout(250);
  await page.getByRole('button', { name: /Buy Family/ }).click();
  await page.waitForTimeout(250);
  await page.locator('#childname').fill('Ada');
  await page.getByRole('button', { name: '6 to 8' }).click();
  await page.getByRole('button', { name: /That.s them/ }).click();
  await page.waitForTimeout(200);
  await page.locator('#pin').fill('1234');
  await page.getByRole('button', { name: /take me to the map/ }).click();
  await page.waitForTimeout(600);

  /*
   * Reload between games rather than navigating back. Each game ends on its own
   * terms — Lantern Breath finishes on "Close", not on a route back to the
   * arcade — and profile state lives in localStorage, so a reload lands on
   * Today with everything intact.
   */
  const openGame = async (name) => {
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: /Games/ }).first().click();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name }).first().click();
    await page.waitForTimeout(500);
  };

  const results = {};

  // ---- Lantern Breath: hold to breathe out ----
  await openGame(/Lantern Breath/);
  await page.getByRole('button', { name: /Begin/ }).click();
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: /Hold the screen instead/ }).click();
  await page.waitForTimeout(4600);
  const hold = page.getByRole('button', { name: /Hold me while you breathe out/ });
  await hold.waitFor({ timeout: 8000 });
  await page.screenshot({ path: `${OUT}/breath-hold.png`, fullPage: true });
  const box = await hold.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(3200);
  await page.mouse.up();
  await page.waitForTimeout(800);
  results.breath = (await page.locator('h1.h1').first().innerText()).trim();
  results.breathHint = (await page.locator('section p.muted').first().innerText().catch(() => '')).trim();
  results.lanternsLeft = (await page.locator('.badge').first().innerText().catch(() => '?')).trim();
  await page.screenshot({ path: `${OUT}/breath-result.png`, fullPage: true });

  // ---- Wake the Animal: tap the animal ----
  await openGame(/Wake the Animal/);
  // It opens on its intro; the microphone only fails once it is asked for.
  await page.getByRole('button', { name: /^Start$/ }).click();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: /Wake them by tapping/ }).click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: /Tap to wake them/ }).click();
  await page.waitForTimeout(500);
  results.wake = (await page.locator('.wake p.h1').first().innerText()).trim();
  await page.screenshot({ path: `${OUT}/wake.png`, fullPage: true });

  // ---- Lumi's Leap: hold to leap ----
  await openGame(/Lumi's Leap/);
  await page.getByRole('button', { name: /Let.s play|Start/ }).first().click();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: /Hold to leap instead/ }).click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /I.m ready/ }).click();
  await page.waitForTimeout(300);
  const leapHold = page.getByRole('button', { name: /Hold to make Lumi leap/ });
  await leapHold.waitFor({ timeout: 6000 });
  const lb = await leapHold.boundingBox();
  await page.mouse.move(lb.x + lb.width / 2, lb.y + lb.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(1400);
  await page.mouse.up();
  await page.waitForTimeout(700);
  results.leap = (await page.locator('section p.h2').first().innerText()).trim();
  await page.screenshot({ path: `${OUT}/leap.png`, fullPage: true });

  console.log('RESULTS', JSON.stringify(results, null, 2));
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'NO PAGE ERRORS');
  await browser.close();
  if (errors.length) process.exit(1);
})();
