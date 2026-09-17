/*
 * Shell walk — onboarding → Today → Stories → Rhymes → Games → Nest at 390x844.
 *
 * `walkthrough.cjs` proves the app *works*; this one exists to prove the shell
 * *looks* right, so it stops on every screen the redesign touches and captures
 * it. Screenshots are the point: the last several layout bugs here were
 * invisible to the unit tests and obvious the moment somebody looked.
 *
 * Usage: node scripts/shell-walk.cjs   (needs a preview server on PORT, 4174)
 */
const { chromium } = require('playwright');
const { launchOptions, outDir } = require('./lib/browser.cjs');

const PORT = process.env.PORT || 4174;
const OUT = `${outDir()}/shell`;
require('fs').mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch(launchOptions());
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); });

  const shot = async (name, full = false) => {
    await page.waitForTimeout(700); // let entrance staggers finish before capture
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
  };

  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle' });
  await shot('01-welcome');

  await page.getByRole('button', { name: 'Begin' }).click();
  await page.waitForTimeout(300);
  const heading = await page.locator('h2.h1').first().innerText();
  const m = heading.match(/(\d+)\s*×\s*(\d+)/);
  await page.locator('#gate').fill(String(Number(m[1]) * Number(m[2])));
  await shot('02-gate');
  await page.getByRole('button', { name: 'Continue' }).click();
  await shot('03-paywall', true);

  await page.getByRole('button', { name: /Start .* free nights/ }).click();
  await page.waitForTimeout(400);
  await page.locator('#childname').fill('Ada');
  await page.getByRole('button', { name: '6 to 8' }).click();
  await page.getByRole('button', { name: 'she / her' }).click();
  await shot('04-profile', true);
  await page.getByRole('button', { name: /That.s them/ }).click();
  await page.waitForTimeout(300);
  await page.locator('#pin').fill('1234');
  await page.getByRole('button', { name: /take me to the map/ }).click();

  await shot('05-today');
  await shot('05-today-full', true);

  // --- Stories / World map ---
  await page.getByRole('button', { name: /Stories/ }).first().click();
  await shot('06-worldmap');
  await shot('06-worldmap-full', true);
  // Open a world so the expanded panel is captured too.
  await page.locator('.shelf .tile').first().click();
  await shot('07-world-open', true);
  await page.getByRole('button', { name: /^Today$/ }).first().click().catch(() => {});
  await page.getByRole('button', { name: /Today/ }).first().click().catch(() => {});
  await page.waitForTimeout(400);

  // --- Rhymes ---
  await page.getByRole('button', { name: /Rhymes/ }).first().click();
  await shot('08-rhymes');
  await shot('08-rhymes-full', true);
  await page.getByRole('button', { name: /Today/ }).first().click();
  await page.waitForTimeout(400);

  // --- Games ---
  await page.getByRole('button', { name: /Games/ }).first().click();
  await shot('09-games');
  await shot('09-games-full', true);

  // --- Nest ---
  await page.getByRole('button', { name: /Nest/ }).first().click();
  await shot('10-nest');
  await shot('10-nest-full', true);

  // Layout assertions a screenshot can't make for itself.
  await page.getByRole('button', { name: /Games/ }).first().click().catch(() => {});
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /Today/ }).first().click().catch(() => {});
  await page.waitForTimeout(600);
  const cols = await page.evaluate(() => {
    const grid = document.querySelector('.tiles');
    if (!grid) return null;
    return getComputedStyle(grid).gridTemplateColumns.split(' ').length;
  });
  const smallTargets = await page.evaluate(() => {
    const bad = [];
    document.querySelectorAll('button, [role="button"], .tile, .chip').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      if (r.height < 44) bad.push(`${el.className || el.tagName} ${Math.round(r.width)}x${Math.round(r.height)}`);
    });
    return bad;
  });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );

  console.log('TILE_COLUMNS', cols);
  console.log('HORIZONTAL_OVERFLOW_PX', overflow);
  console.log('SUB_44PX_TARGETS', smallTargets.length ? smallTargets.join(' | ') : 'none');
  console.log('ERRORS', errors.length ? errors.join('\n') : 'none');
  console.log('SHOTS', OUT);
  await browser.close();
  if (errors.length) process.exit(1);
})().catch((e) => { console.error(e); process.exit(1); });
