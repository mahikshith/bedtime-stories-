import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The native shells are the one part of this app CI cannot run.
 *
 * `npx cap sync` rewrites parts of both platforms, and the microphone
 * permission is a hand-applied edit that a regeneration can drop. Losing it
 * does not fail a build, a test or the browser smoke — it fails silently on a
 * handset, where `getUserMedia` is refused and every voice game shows its
 * no-microphone fallback while the code looks perfect. So the permission gets
 * the same treatment as the privacy policy: pinned, and failed on if it moves.
 */
const MANIFEST = 'android/app/src/main/AndroidManifest.xml';
const PLIST = 'ios/App/App/Info.plist';

describe('android shell', () => {
  it('exists and is committed', () => {
    expect(existsSync(MANIFEST)).toBe(true);
  });

  it('asks for RECORD_AUDIO', () => {
    expect(readFileSync(MANIFEST, 'utf8')).toMatch(
      /<uses-permission android:name="android\.permission\.RECORD_AUDIO"\s*\/>/,
    );
  });

  it('marks the microphone optional so no-mic devices still see the app', () => {
    // Every voice game has a tap fallback, so requiring the feature would hide
    // the app from tablets for no benefit.
    expect(readFileSync(MANIFEST, 'utf8')).toMatch(
      /<uses-feature android:name="android\.hardware\.microphone" android:required="false"\s*\/>/,
    );
  });

  it('never asks for a permission we cannot justify to a reviewer', () => {
    const manifest = readFileSync(MANIFEST, 'utf8');
    const asked = [...manifest.matchAll(/android\.permission\.([A-Z_]+)/g)].map((m) => m[1]).sort();
    // INTERNET is the WebView host's, not ours — nothing in src makes a request.
    expect(asked).toEqual(['INTERNET', 'RECORD_AUDIO']);
  });
});

describe('ios shell', () => {
  it('exists and is committed', () => {
    expect(existsSync(PLIST)).toBe(true);
  });

  it('carries a microphone usage description', () => {
    // Apple rejects a missing or vague purpose string outright.
    expect(readFileSync(PLIST, 'utf8')).toContain('<key>NSMicrophoneUsageDescription</key>');
  });

  it('says what is measured and what is not, in words a parent can check', () => {
    const plist = readFileSync(PLIST, 'utf8');
    const match = plist.match(/<key>NSMicrophoneUsageDescription<\/key>\s*<string>([^<]+)<\/string>/);
    expect(match).not.toBeNull();
    const reason = match![1];
    expect(reason.length).toBeGreaterThan(40);
    expect(reason).toMatch(/loud/i);
    expect(reason).toMatch(/record/i);
  });

  it('claims no background mode', () => {
    // A bedtime app is a natural place to ask for background audio. Apple reads
    // that as a reason to look harder, and we have no feature that needs it.
    expect(readFileSync(PLIST, 'utf8')).not.toContain('UIBackgroundModes');
  });
});
