const { chromium } = require('playwright');
const OUT = '/tmp/claude-0/-home-user-bedtime-stories-/07bd3299-9573-56a2-9e37-91ebfc711a8a/scratchpad/shots';
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); });

  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/01-welcome.png` });

  await page.getByRole('button', { name: 'Begin' }).click();
  await page.waitForTimeout(300);
  // Parent gate: read the multiplication off the heading and answer it.
  const heading = await page.locator('h2.h1').first().innerText();
  const m = heading.match(/(\d+)\s*×\s*(\d+)/);
  await page.screenshot({ path: `${OUT}/02-gate.png` });
  await page.locator('#gate').fill(String(Number(m[1]) * Number(m[2])));
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/03-paywall.png` });

  await page.getByRole('button', { name: /Buy once/ }).click();
  await page.waitForTimeout(400);
  await page.locator('#childname').fill('Ada');
  await page.getByRole('button', { name: '6 to 8' }).click();
  await page.getByRole('button', { name: 'she / her' }).click();
  await page.screenshot({ path: `${OUT}/04-child.png`, fullPage: true });
  await page.getByRole('button', { name: /That.s them/ }).click();
  await page.waitForTimeout(300);
  await page.locator('#pin').fill('1234');
  await page.getByRole('button', { name: /take me to the map/ }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/05-map.png` });
  await page.screenshot({ path: `${OUT}/05-map-full.png`, fullPage: true });

  await page.getByRole('button', { name: /Episode 1/ }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/06-story-p1.png` });
  const text1 = await page.locator('.story__text').innerText();

  for (let i = 0; i < 10; i++) {
    const turn = page.getByRole('button', { name: 'Turn the page' });
    if (await turn.count() === 0) break;
    await turn.click();
    await page.waitForTimeout(320);
  }
  await page.screenshot({ path: `${OUT}/07-story-late.png` });
  const textLate = await page.locator('.story__text').innerText();

  await page.getByRole('button', { name: 'Goodnight' }).click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/08-realwindow.png`, fullPage: true });

  await page.getByRole('button', { name: /asleep/ }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /Parents/ }).click();
  await page.waitForTimeout(300);
  await page.locator('#parentpin').fill('1234');
  await page.getByRole('button', { name: 'Unlock' }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/09-parent.png`, fullPage: true });
  await page.locator('text=Who is reading?').scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/10-voice.png` });

  console.log('--- PAGE 1 ---\n' + text1);
  console.log('--- LATE PAGE ---\n' + textLate);
  console.log('--- ERRORS ---\n' + (errors.length ? errors.join('\n') : 'none'));
  await browser.close();
})();
