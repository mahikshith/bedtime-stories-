import { readFileSync, writeFileSync } from 'node:fs';

/**
 * Emits the hosted privacy page from the same JSON the app renders.
 *
 * Both stores want a public URL as well as the in-app screen. Generating it at
 * build time means the two can never disagree, which matters because a policy
 * that contradicts the app's actual behaviour is the kind of thing that gets an
 * app pulled rather than merely rejected.
 */
const policy = JSON.parse(readFileSync(new URL('../src/content/privacy.json', import.meta.url)));

const escape = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const body = policy.sections
  .map(
    (s) =>
      `    <section>\n      <h2>${escape(s.heading)}</h2>\n` +
      s.body.map((p) => `      <p>${escape(p)}</p>`).join('\n') +
      `\n    </section>`,
  )
  .join('\n');

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escape(policy.title)}</title>
    <meta name="description" content="Lumi collects nothing about your child. Here is the long version." />
    <style>
      :root { color-scheme: light dark; }
      body {
        margin: 0 auto; padding: 32px 20px 64px; max-width: 42rem;
        font: 16px/1.65 system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      }
      h1 { font-size: 1.7rem; line-height: 1.2; margin: 0 0 4px; }
      h2 { font-size: 1.1rem; margin: 32px 0 8px; }
      p { margin: 0 0 12px; }
      .updated { opacity: 0.65; font-size: 0.9rem; margin-bottom: 24px; }
    </style>
  </head>
  <body>
    <h1>${escape(policy.title)}</h1>
    <p class="updated">Last updated ${escape(policy.updated)}</p>
${body}
  </body>
</html>
`;

const out = new URL('../dist/privacy.html', import.meta.url);
writeFileSync(out, html);
console.log(`privacy.html written (${policy.sections.length} sections)`);
