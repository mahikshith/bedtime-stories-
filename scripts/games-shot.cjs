const { chromium } = require('playwright');
const { launchOptions, outDir } = require('./lib/browser.cjs');
const OUT = outDir();

require('fs').mkdirSync(OUT, { recursive: true });

(async () => {
  // Fake device + auto-grant, so the voice games can be driven without a mic.
  const browser = await chromium.launch(
    launchOptions({
      args: [
        '--use-fake-device-for-media-capture',
        '--use-fake-ui-for-media-stream',
        '--autoplay-policy=no-user-gesture-required',
      ],
    }),
  );
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    permissions: ['microphone'],
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
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/21-arcade.png`, fullPage: true });

  // Voice game: intro -> mic -> calibrate -> a listening turn.
  await page.getByRole('button', { name: /Lumi.s Leap/ }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/22-leap-intro.png` });
  await page.getByRole('button', { name: /Let.s play/ }).click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/23-leap-stage.png` });
  const readyText = await page.locator('.leap__word').first().innerText().catch(() => 'NONE');
  const meterExists = await page.locator('.leap__meter').count();

  const ready = page.getByRole('button', { name: /I.m ready/ });
  if (await ready.count()) {
    await ready.click({ force: true });
    await page.waitForTimeout(3200);
    await page.screenshot({ path: `${OUT}/24-leap-result.png` });
  }
  const resultShown = await page.locator('text=/Lumi made it|Not quite|Lumi heard/').count();

  await page.getByRole('button', { name: /Games/ }).first().click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /Rhyme Race/ }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/25-rhyme-race.png` });

  console.log('WORD_CARD', readyText);
  console.log('METER_PRESENT', meterExists);
  console.log('RESULT_SHOWN', resultShown);
  console.log('ERRORS', errors.length ? errors.join('\n') : 'none');
  await browser.close();
  if (errors.length) process.exitCode = 1;
})();
