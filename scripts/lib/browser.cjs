const fs = require('fs');

/**
 * Resolve a Chromium to drive.
 *
 * Sandboxes pre-install a browser at a fixed path and set PLAYWRIGHT_BROWSERS_PATH;
 * CI runners install their own via `playwright install`. Hard-coding either one
 * breaks the other, so prefer an explicit override, then a pre-installed browser,
 * then let Playwright resolve whatever it downloaded.
 */
function launchOptions(extra = {}) {
  const explicit = process.env.PLAYWRIGHT_EXECUTABLE_PATH;
  if (explicit && fs.existsSync(explicit)) return { executablePath: explicit, ...extra };

  const preinstalled = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  if (fs.existsSync(preinstalled)) return { executablePath: preinstalled, ...extra };

  return extra;
}

/** Screenshot destination: the scratchpad locally, an artifact directory in CI. */
function outDir() {
  return (
    process.env.SHOT_DIR ||
    '/tmp/claude-0/-home-user-bedtime-stories-/07bd3299-9573-56a2-9e37-91ebfc711a8a/scratchpad/shots'
  );
}

module.exports = { launchOptions, outDir };
