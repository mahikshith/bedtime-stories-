import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PRIVACY_CONTACT, PRIVACY_POLICY, PRIVACY_TITLE, PRIVACY_UPDATED } from '../content/privacy';

function sourceFiles(dir = 'src'): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      return entry === '__tests__' ? [] : sourceFiles(path);
    }
    return /\.tsx?$/.test(path) ? [path] : [];
  });
}

/**
 * Strips comments before scanning.
 *
 * The voice meter documents at length why it never touches `MediaRecorder` or
 * `SpeechRecognition`; a scan that reads prose would flag the explanation as
 * the offence.
 */
function code(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const SOURCES = sourceFiles();
const ALL_SOURCE = SOURCES.map(code).join('\n');
const PACKAGE = JSON.parse(readFileSync('package.json', 'utf8'));

describe('the policy document', () => {
  it('has content in every section', () => {
    expect(PRIVACY_POLICY.length).toBeGreaterThanOrEqual(6);
    for (const section of PRIVACY_POLICY) {
      expect(section.heading.length, section.heading).toBeGreaterThan(3);
      expect(section.body.length, section.heading).toBeGreaterThan(0);
      section.body.forEach((p) => expect(p.length).toBeGreaterThan(20));
    }
  });

  it('survived extraction with its punctuation intact', () => {
    // A latin-1/UTF-8 round trip once mangled every curly quote in here.
    const text = [PRIVACY_TITLE, ...PRIVACY_POLICY.flatMap((s) => [s.heading, ...s.body])].join(' ');
    expect(text).not.toMatch(/Ã|â€|Â/);
  });

  it('covers the microphone, because the app uses one', () => {
    const text = PRIVACY_POLICY.flatMap((s) => s.body).join(' ').toLowerCase();
    expect(text).toContain('microphone');
    expect(text).toContain('no recording is made');
  });

  it('states a contact and a date', () => {
    expect(PRIVACY_CONTACT).toMatch(/@/);
    expect(PRIVACY_UPDATED.length).toBeGreaterThan(6);
  });
});

/**
 * These tests exist so the policy cannot quietly become untrue.
 *
 * A Data safety form or Privacy Nutrition Label that contradicts the app's
 * actual behaviour is not a warning on either store — it is a removal. Each
 * assertion below pins one sentence of the policy to the code that makes it so.
 */
describe('the policy matches the code', () => {
  it('"nothing is sent anywhere" — no network calls in the app', () => {
    const offenders = SOURCES.filter((f) =>
      /\bfetch\s*\(|XMLHttpRequest|navigator\.sendBeacon|new WebSocket/.test(code(f)),
    );
    expect(offenders).toEqual([]);
  });

  it('"no recording is made" — no recorder is ever constructed', () => {
    expect(ALL_SOURCE).not.toMatch(/\bMediaRecorder\b/);
  });

  it('never uses cloud speech recognition', () => {
    // On Android this ships the child's audio to Google. D17.
    expect(ALL_SOURCE).not.toMatch(/SpeechRecognition|webkitSpeechRecognition/);
  });

  it('"no analytics, no adverts, no tracking" — none are installed', () => {
    const banned = /analytics|firebase|segment|amplitude|mixpanel|sentry|admob|gtag|posthog/i;
    const deps = Object.keys({
      ...(PACKAGE.dependencies ?? {}),
      ...(PACKAGE.devDependencies ?? {}),
    });
    expect(deps.filter((d) => banned.test(d))).toEqual([]);
  });

  it('"no accounts" — ships only react at runtime', () => {
    // Apple's Kids Category bars third-party SDKs from receiving any device or
    // personal information. The cheapest way to comply is to have none.
    expect(Object.keys(PACKAGE.dependencies ?? {}).sort()).toEqual(['react', 'react-dom']);
  });

  it('"stored only on this device" — persistence is localStorage alone', () => {
    const storage = SOURCES.filter((f) => /localStorage|sessionStorage|indexedDB/.test(code(f)));
    // One owner, so there is one place to audit.
    expect(storage).toEqual(['src/state/store.ts']);
  });
});
