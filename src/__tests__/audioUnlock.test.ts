import { afterEach, describe, expect, it, vi } from 'vitest';
import { armAudioUnlock, primeAudio, resetAudioUnlock, sharedContext, unlockContext } from '../engine/audioUnlock';

/**
 * jsdom has no Web Audio, which is the same shape as a browser that has had it
 * disabled. Nothing here may throw in that case — the app has to render and the
 * games have to fall back, not crash on import.
 */
afterEach(() => {
  resetAudioUnlock();
  delete (window as unknown as { AudioContext?: unknown }).AudioContext;
  vi.restoreAllMocks();
});

function fakeContext(state: AudioContextState = 'suspended') {
  const ctx = {
    state,
    resume: vi.fn(async () => { ctx.state = 'running'; }),
    createBuffer: vi.fn(() => ({})),
    createBufferSource: vi.fn(() => ({ buffer: null, connect: vi.fn(), start: vi.fn() })),
    destination: {},
    addEventListener: vi.fn(),
  };
  return ctx;
}

function installFakeAudio(ctx: ReturnType<typeof fakeContext>) {
  (window as unknown as { AudioContext: unknown }).AudioContext = vi.fn(() => ctx);
}

describe('without Web Audio', () => {
  it('prime and arm are no-ops rather than throws', () => {
    expect(() => primeAudio()).not.toThrow();
    expect(() => armAudioUnlock()).not.toThrow();
    expect(sharedContext()).toBeUndefined();
  });
});

describe('unlockContext', () => {
  it('resumes a suspended context and nudges the hardware', async () => {
    const ctx = fakeContext('suspended');
    await unlockContext(ctx as unknown as AudioContext);
    expect(ctx.resume).toHaveBeenCalled();
    // Older iOS only counts the hardware as unlocked once something has been
    // routed to the destination, so resuming alone is not enough.
    expect(ctx.createBufferSource).toHaveBeenCalled();
  });

  it('does not resume a context that is already running', async () => {
    const ctx = fakeContext('running');
    await unlockContext(ctx as unknown as AudioContext);
    expect(ctx.resume).not.toHaveBeenCalled();
  });

  it('survives a context that refuses to resume', async () => {
    const ctx = fakeContext('suspended');
    ctx.resume = vi.fn(async () => { throw new Error('no gesture yet'); });
    await expect(unlockContext(ctx as unknown as AudioContext)).resolves.toBeUndefined();
  });
});

describe('gesture arming', () => {
  it('unlocks on the first gesture and then stops listening', async () => {
    const ctx = fakeContext('suspended');
    installFakeAudio(ctx);
    armAudioUnlock();

    window.dispatchEvent(new Event('pointerdown'));
    await vi.waitFor(() => expect(ctx.resume).toHaveBeenCalledTimes(1));

    // Disarmed: a second touch must not queue more resumes.
    window.dispatchEvent(new Event('pointerdown'));
    await Promise.resolve();
    expect(ctx.resume).toHaveBeenCalledTimes(1);
  });

  it('arming twice does not double-subscribe', async () => {
    const ctx = fakeContext('suspended');
    installFakeAudio(ctx);
    const add = vi.spyOn(window, 'addEventListener');
    armAudioUnlock();
    const afterFirst = add.mock.calls.length;
    armAudioUnlock();
    expect(add.mock.calls.length).toBe(afterFirst);
  });

  it('re-arms when the tab becomes visible again', async () => {
    // WKWebView suspends the context on background, so a child who leaves a
    // game and comes back needs the next touch to count as a fresh unlock.
    // The sequence that matters is prime -> gesture (which disarms) -> return.
    const ctx = fakeContext('suspended');
    installFakeAudio(ctx);
    primeAudio();

    window.dispatchEvent(new Event('pointerdown'));
    await vi.waitFor(() => expect(ctx.resume).toHaveBeenCalledTimes(1));

    // Disarmed now: coming back from the background must listen again.
    ctx.state = 'suspended';
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('pointerdown'));
    await vi.waitFor(() => expect(ctx.resume).toHaveBeenCalledTimes(2));
  });
});
