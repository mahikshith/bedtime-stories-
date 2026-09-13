const { chromium } = require('playwright');
const { launchOptions, outDir } = require('./lib/browser.cjs');
const OUT = outDir();

require('fs').mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch(launchOptions());
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); });

  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/01-welcome.png` });

  await page.getByRole('button', { name: 'Begin' }).click();
  await page.waitForTimeout(300);
  const heading = await page.locator('h2.h1').first().innerText();
  const m = heading.match(/(\d+)\s*×\s*(\d+)/);
  await page.locator('#gate').fill(String(Number(m[1]) * Number(m[2])));
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/03-paywall.png`, fullPage: true });

  await page.getByRole('button', { name: /Buy Family/ }).click();
  await page.waitForTimeout(400);
  await page.locator('#childname').fill('Ada');
  await page.getByRole('button', { name: '6 to 8' }).click();
  await page.getByRole('button', { name: 'she / her' }).click();
  await page.getByRole('button', { name: /That.s them/ }).click();
  await page.waitForTimeout(300);
  await page.locator('#pin').fill('1234');
  await page.getByRole('button', { name: /take me to the map/ }).click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/11-today.png`, fullPage: true });

  // --- Rhymes ---
  await page.getByRole('button', { name: /Rhymes/ }).first().click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/12-rhymelist.png` });

  await page.getByRole('button', { name: /Lumi.s Lanterns/ }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/13-rhyme-start.png` });

  await page.getByRole('button', { name: /Say it with me/ }).click();
  // Wait for the first dropped word to be offered rather than guessing at timing.
  await page.locator('.rhyme__blank').first().waitFor({ state: 'visible', timeout: 20000 });
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}/14-rhyme-cloze.png` });
  const clozeVisible = await page.locator('.rhyme__blank').count();

  // Work through the rhyme, answering each dropped word.
  for (let i = 0; i < 40; i++) {
    const blank = page.locator('.rhyme__blank');
    // force: the blank pulses forever by design, so Playwright never sees it settle.
    if (await blank.count()) { await blank.first().click({ force: true }); await page.waitForTimeout(700); continue; }
    if (await page.locator('h1.h1', { hasText: 'Which one rhymes' }).count()) break;
    await page.waitForTimeout(600);
  }
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/15-rhyme-game.png`, fullPage: true });

  const gameHeading = await page.locator('h1.h1').first().innerText().catch(() => '');

  // --- Stories still work ---
  await page.getByRole('button', { name: /Back to the rhymes/ }).click().catch(() => {});
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: /Today/ }).first().click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /Stories/ }).first().click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/16-worlds.png` });

  console.log('CLOZE_SHOWN', clozeVisible);
  console.log('GAME_HEADING', gameHeading);
  console.log('ERRORS', errors.length ? errors.join('\n') : 'none');
  await browser.close();
  // Fail the CI job on any page or console error, not just report it.
  if (errors.length) process.exitCode = 1;
})();
