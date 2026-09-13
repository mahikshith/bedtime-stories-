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

  await page.getByRole('button', { name: /Colour/ }).first().click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/17-colour.png`, fullPage: true });
  // On-screen colouring path
  await page.getByRole('button', { name: /Colour on screen instead/ }).click();
  await page.waitForTimeout(300);
  await page.locator('.colour__art path').nth(1).click({ force: true });
  await page.locator('.colour__art path').nth(6).click({ force: true });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/18-colour-filled.png` });

  await page.getByRole('button', { name: /Today/ }).first().click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /Letters/ }).first().click();
  await page.waitForTimeout(700);
  await page.locator('.letters__card').first().click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/19-letters.png`, fullPage: true });

  // Parent zone: the household section is where a second child is added.
  await page.getByRole('button', { name: /Today/ }).first().click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: /Parents/ }).first().click();
  await page.waitForTimeout(300);
  await page.locator('#parentpin').fill('1234');
  await page.getByRole('button', { name: 'Unlock' }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /Add a child/ }).click();
  await page.waitForTimeout(300);
  await page.locator('#newchild').fill('Kwame');
  await page.getByRole('button', { name: 'New child, ages 3-5' }).click();
  await page.getByRole('button', { name: /Add them/ }).click();
  await page.waitForTimeout(500);
  await page.locator('text=The household').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/20-household.png` });
  const names = await page.locator('.glass', { hasText: 'The household' }).first().innerText();
  console.log('HOUSEHOLD', names.replace(/\n+/g, ' | ').slice(0, 200));

  console.log('ERRORS', errors.length ? errors.join('\n') : 'none');
  await browser.close();
  // Fail the CI job on any page or console error, not just report it.
  if (errors.length) process.exitCode = 1;
})();
