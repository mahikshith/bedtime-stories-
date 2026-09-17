/**
 * Screenshots for docs/PROJECT-BRIEF.md.
 *
 * Kept separate from the smoke scripts: those prove the app works, this one
 * produces the figures a reviewer looks at, so it shoots at scale 1 (small
 * files, committable) and walks the screens in reading order rather than the
 * order that exercises the most code.
 */
const { chromium } = require('playwright');
const { launchOptions } = require('./lib/browser.cjs');

const OUT = process.env.SHOT_DIR || 'docs/brief-images';
require('fs').mkdirSync(OUT, { recursive: true });
const shot = (page, name, opts = {}) => page.screenshot({ path: `${OUT}/${name}.png`, ...opts });

(async () => {
  const browser = await chromium.launch(launchOptions());
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); });

  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await shot(page, '01-welcome');

  await page.getByRole('button', { name: 'Begin' }).click();
  await page.waitForTimeout(300);
  await shot(page, '02-parental-gate');
  const h = await page.locator('h2.h1').first().innerText();
  const m = h.match(/(\d+)\s*×\s*(\d+)/);
  await page.locator('#gate').fill(String(Number(m[1]) * Number(m[2])));
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForTimeout(300);
  await shot(page, '03-trial-and-prices', { fullPage: true });

  await page.getByRole('button', { name: /Buy Family/ }).click();
  await page.waitForTimeout(300);
  await page.locator('#childname').fill('Ada');
  await page.getByRole('button', { name: '6 to 8' }).click();
  await shot(page, '04-child-setup', { fullPage: true });
  await page.getByRole('button', { name: /That.s them/ }).click();
  await page.waitForTimeout(250);
  await page.locator('#pin').fill('1234');
  await page.getByRole('button', { name: /take me to the map/ }).click();
  await page.waitForTimeout(800);
  await shot(page, '05-today', { fullPage: true });

  // Stories
  await page.getByRole('button', { name: /Stories/ }).first().click();
  await page.waitForTimeout(600);
  await shot(page, '06-world-shelf', { fullPage: true });
  await page.locator('.tile, .shelf .tile').first().click();
  await page.waitForTimeout(900);
  await shot(page, '07-story-opening');
  for (let i = 0; i < 5; i++) {
    const next = page.getByRole('button', { name: /Next|Turn the page/ }).first();
    if (!(await next.count())) break;
    await next.click();
    await page.waitForTimeout(350);
  }
  await shot(page, '08-story-winding-down');

  // Rhymes
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: /Rhymes/ }).first().click();
  await page.waitForTimeout(600);
  await shot(page, '09-rhyme-shelves', { fullPage: true });
  await page.locator('.shelf .tile, .tiles .tile').first().click();
  await page.waitForTimeout(700);
  await shot(page, '10-rhyme-player');

  // Games
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: /Games/ }).first().click();
  await page.waitForTimeout(600);
  await shot(page, '11-arcade', { fullPage: true });
  await page.locator('.shelf .tile').first().click();
  await page.waitForTimeout(900);
  await shot(page, '12-game');

  // The motion game, and its drag fallback
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: /Games/ }).first().click();
  await page.waitForTimeout(600);
  const tilt = page.getByText('Stardust Tilt').first();
  if (await tilt.count()) {
    await tilt.click();
    await page.waitForTimeout(1000);
    await shot(page, '12b-stardust-tilt');
  }

  // Create + Learn
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: /Colour/ }).first().click();
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: /Colour on screen instead/ }).click();
  await page.waitForTimeout(300);
  for (const i of [1, 3, 6, 8]) {
    const p = page.locator('.colour__art path').nth(i);
    if (await p.count()) await p.click({ force: true });
  }
  await page.waitForTimeout(300);
  await shot(page, '13-colour-studio', { fullPage: true });

  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: /Letters/ }).first().click();
  await page.waitForTimeout(700);
  await page.locator('.letters__card').first().click();
  await page.waitForTimeout(400);
  await shot(page, '14-letters-lab', { fullPage: true });

  // Parent zone, then a light palette applied to the whole app
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: /Parents/ }).first().click();
  await page.waitForTimeout(300);
  await page.locator('#parentpin').fill('1234');
  await page.getByRole('button', { name: 'Unlock' }).click();
  await page.waitForTimeout(600);
  await shot(page, '15-parent-zone', { fullPage: true });

  await page.getByRole('button', { name: /Ocean palette/ }).click();
  await page.waitForTimeout(500);
  await shot(page, '16-parent-zone-ocean', { fullPage: true });
  await page.getByRole('button', { name: 'Done' }).click();
  await page.waitForTimeout(700);
  await shot(page, '17-today-ocean', { fullPage: true });
  await page.getByRole('button', { name: /Stories/ }).first().click();
  await page.waitForTimeout(600);
  await page.locator('.tile').first().click();
  await page.waitForTimeout(900);
  await shot(page, '18-story-keeps-its-dark-room');

  console.log('ERRORS', errors.length ? errors.join('\n') : 'none');
  await browser.close();
  if (errors.length) process.exitCode = 1;
})();
