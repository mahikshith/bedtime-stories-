const { chromium } = require('playwright');
const { launchOptions, outDir } = require('./lib/browser.cjs');
const OUT = outDir();
require('fs').mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch(launchOptions({
    args: ['--use-fake-device-for-media-capture', '--use-fake-ui-for-media-stream',
           '--autoplay-policy=no-user-gesture-required'],
  }));
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, permissions: ['microphone'],
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); });

  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Begin' }).click();
  await page.waitForTimeout(300);
  const h = await page.locator('h2.h1').first().innerText();
  const m = h.match(/(\d+)\s*×\s*(\d+)/);
  await page.locator('#gate').fill(String(Number(m[1]) * Number(m[2])));
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /Buy Family/ }).click();
  await page.waitForTimeout(300);
  await page.locator('#childname').fill('Ada');
  await page.getByRole('button', { name: '6 to 8' }).click();
  await page.getByRole('button', { name: /That.s them/ }).click();
  await page.waitForTimeout(250);
  await page.locator('#pin').fill('1234');
  await page.getByRole('button', { name: /take me to the map/ }).click();
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: /Games/ }).first().click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/a-arcade.png`, fullPage: true });

  // ---- Moon Pool: rock the finger at the pool's own rhythm ----
  await page.getByRole('button', { name: /Moon Pool/ }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/b-moonpool.png`, fullPage: true });

  const pool = page.locator('svg.moonpool');
  const pb = await pool.boundingBox();
  await page.mouse.move(pb.x + pb.width / 2, pb.y + pb.height / 2);
  await page.mouse.down();
  // ~0.8Hz: a full left-right-left cycle every 1.25s.
  for (let cycle = 0; cycle < 22; cycle += 1) {
    for (const frac of [0.08, 0.5, 0.92, 0.5]) {
      await page.mouse.move(pb.x + pb.width * frac, pb.y + pb.height / 2);
      await page.waitForTimeout(78);
    }
  }
  await page.mouse.up();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/c-moonpool-rocked.png`, fullPage: true });
  const poolWon = await page.getByRole('button', { name: /Next level|Fill it again/ }).count();
  console.log('MOONPOOL_WON', poolWon > 0);
  const waterD = await page.locator('.moonpool__water').getAttribute('d');
  console.log('WATER_PATH_POINTS', (waterD || '').split('L').length - 1);

  await page.getByRole('button', { name: /Games/ }).first().click();
  await page.waitForTimeout(400);

  // ---- Firefly Air: sweep a finger fast across the sky ----
  await page.getByRole('button', { name: /Firefly Air/ }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/d-firefly.png`, fullPage: true });
  const air = page.locator('svg.airfield');
  const ab = await air.boundingBox();
  await page.mouse.move(ab.x + ab.width / 2, ab.y + ab.height * 0.8);
  await page.mouse.down();
  for (let i = 0; i < 90; i += 1) {
    const frac = 0.3 + 0.4 * Math.sin(i * 0.9);
    await page.mouse.move(ab.x + ab.width * frac, ab.y + ab.height * 0.7);
    await page.waitForTimeout(22);
  }
  await page.mouse.up();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/e-firefly-flying.png`, fullPage: true });
  const flyT = await page.locator('.airfield__flyer').getAttribute('transform');
  console.log('FLYER_TRANSFORM', flyT);
  const passed = await page.locator('.airfield__ring.is-passed').count();
  console.log('RINGS_PASSED', passed);

  await page.getByRole('button', { name: /Games/ }).first().click();
  await page.waitForTimeout(400);

  // ---- Echo Cave: use the tap-drum fallback, no mic needed ----
  await page.getByRole('button', { name: /Echo Cave/ }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/f-echo-intro.png`, fullPage: true });
  await page.getByRole('button', { name: /Start listening|Play the rhythm/ }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/g-echo-calling.png`, fullPage: true });
  const drum = page.getByRole('button', { name: /Tap here to echo/ });
  await drum.waitFor({ timeout: 8000 });
  await page.screenshot({ path: `${OUT}/h-echo-listening.png`, fullPage: true });
  // Level 1 is [0, 0.6].
  await drum.click();
  await page.waitForTimeout(600);
  await drum.click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/i-echo-result.png`, fullPage: true });
  const heading = await page.locator('h1.h1').first().innerText();
  console.log('ECHO_RESULT', JSON.stringify(heading));
  console.log('COMPANION_VISIBLE', await page.locator('.companion__body').count());

  await page.getByRole('button', { name: /Games/ }).first().click();
  await page.waitForTimeout(400);

  // ---- Star Dial: drag the sky round, then hold still ----
  await page.getByRole('button', { name: /Star Dial/ }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/j-stardial.png`, fullPage: true });
  const dialBox = await page.locator('svg.stardial').boundingBox();
  const cx = dialBox.x + dialBox.width / 2;
  const cy = dialBox.y + dialBox.height / 2;
  const R = dialBox.width * 0.38;
  /*
   * Level 1 has three stars at 0, 1/3 and 2/3, and wants the one at 1/3. To put
   * it under the fixed marker the dial has to turn BACK a third of a turn, not
   * forward: turning forward parks the star at 2/3 there instead, which is a
   * star, just not the one asked for.
   */
  await page.mouse.move(cx, cy - R);
  await page.mouse.down();
  for (let i = 1; i <= 24; i += 1) {
    const a = -Math.PI / 2 - (i / 24) * (2 * Math.PI / 3);
    await page.mouse.move(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  // Long enough for the dial to stop coasting AND then be held still.
  await page.waitForTimeout(2600);
  await page.screenshot({ path: `${OUT}/k-stardial-held.png`, fullPage: true });
  const found = await page.locator('.stardial__star.is-found').count();
  console.log('STARS_FOUND', found);

  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'NO PAGE ERRORS');
  await browser.close();
  if (errors.length) process.exit(1);
})();
