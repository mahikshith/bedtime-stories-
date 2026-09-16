import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BRIGHT_SCALE,
  CALM_SCALE,
  isMuted,
  play,
  playChime,
  playPop,
  setMuted,
  stopGameAudio,
  voiceCount,
} from '../engine/gameAudio';

/**
 * jsdom has no Web Audio, so a fake context stands in. The point of these tests
 * is not the sound — it is that nothing throws where Web Audio is missing, that
 * the voice cap holds under the kind of mashing a four-year-old does, and that
 * mute is honoured before any node is built.
 */
const started: string[] = [];

function node(kind: string) {
  const handlers: Record<string, () => void> = {};
  return {
    kind,
    type: '',
    frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), value: 0 },
    Q: { value: 0 },
    gain: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    buffer: null as unknown,
    connect: vi.fn(),
    start: vi.fn(() => started.push(kind)),
    stop: vi.fn(),
    addEventListener: vi.fn((name: string, fn: () => void) => { handlers[name] = fn; }),
    fire: (name: string) => handlers[name]?.(),
  };
}

function installAudio(state: AudioContextState = 'running') {
  const made: ReturnType<typeof node>[] = [];
  const make = (kind: string) => { const n = node(kind); made.push(n); return n; };
  const ctx = {
    state,
    currentTime: 0,
    sampleRate: 44100,
    destination: {},
    // A real resume() settles on a later task, so the state must NOT flip
    // during the synchronous call — otherwise the double hides the very bug
    // these tests exist to catch.
    resume: vi.fn(() => Promise.resolve().then(() => { ctx.state = 'running'; })),
    close: vi.fn(async () => undefined),
    createOscillator: () => make('osc'),
    createGain: () => make('gain'),
    createBiquadFilter: () => make('filter'),
    createBufferSource: () => make('source'),
    createBuffer: (_c: number, frames: number) => ({ getChannelData: () => new Float32Array(frames) }),
  };
  (window as unknown as { AudioContext: unknown }).AudioContext = vi.fn(() => ctx);
  return { ctx, made };
}

beforeEach(() => { started.length = 0; setMuted(false); });

afterEach(() => {
  stopGameAudio();
  setMuted(false);
  delete (window as unknown as { AudioContext?: unknown }).AudioContext;
  vi.restoreAllMocks();
});

describe('without Web Audio', () => {
  it('every voice is a no-op rather than a throw', () => {
    // A browser with audio disabled must still render the game.
    expect(() => { playChime(); playPop(); play('squish'); play('thud'); }).not.toThrow();
  });
});

describe('scales', () => {
  it('are pentatonic, so any two notes played at once are consonant', () => {
    // This is the reason feedback can fire on every touch without ever
    // sounding wrong. Semitone gaps of 1 would break it.
    for (const scale of [BRIGHT_SCALE, CALM_SCALE]) {
      const semitones = scale.map((f) => Math.round(12 * Math.log2(f / scale[0])));
      const gaps = semitones.slice(1).map((s, i) => s - semitones[i]);
      expect(gaps.every((g) => g >= 2)).toBe(true);
    }
  });

  it('puts the calm scale below the bright one', () => {
    expect(CALM_SCALE[0]).toBeLessThan(BRIGHT_SCALE[0]);
  });
});

describe('playback', () => {
  it('builds and starts a voice', () => {
    installAudio();
    playChime({ step: 2 });
    expect(started).toContain('osc');
  });

  it('wraps out-of-range steps instead of reading past the scale', () => {
    installAudio();
    expect(() => playChime({ step: 999 })).not.toThrow();
    expect(started.length).toBeGreaterThan(0);
  });

  it('caps simultaneous voices so mashing cannot clip into distortion', () => {
    installAudio();
    for (let i = 0; i < 200; i++) playChime({ step: i });
    expect(voiceCount()).toBeLessThanOrEqual(12);
  });

  it('frees a voice when its source ends', () => {
    const { made } = installAudio();
    playChime();
    const before = voiceCount();
    made.find((n) => n.kind === 'osc')?.fire('ended');
    expect(voiceCount()).toBe(before - 1);
  });

  it('builds nothing at all when muted', () => {
    installAudio();
    setMuted(true);
    playChime();
    playPop();
    expect(started).toEqual([]);
    expect(isMuted()).toBe(true);
  });
});

describe('suspended contexts', () => {
  it('asks for an unlock and plays nothing until it is running', () => {
    // iOS hands back a suspended context outside a gesture. Playing into one
    // produces silence with no error, which is the worst possible failure.
    const { ctx } = installAudio('suspended');
    playChime();
    expect(ctx.resume).toHaveBeenCalled();
    expect(started).toEqual([]);
  });
});
