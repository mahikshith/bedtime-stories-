import type { SpeakOptions } from './narration';

/**
 * Pluggable speech back end.
 *
 * D11 says on-device only: no cloud TTS in the daily loop, ever. Today that is
 * the platform synthesiser, which is on-device, free and ships zero bytes.
 *
 * The open question (TODO §2) is whether to ALSO offer a bundled neural voice
 * for brand consistency. That decision should not require touching every
 * caller, so speech goes through this interface. A Piper/Kokoro engine becomes
 * a new implementation and a registration call, nothing else.
 *
 * Any implementation added here MUST run locally. An engine that makes a
 * network call per utterance reintroduces exactly the per-night recurring cost
 * that the one-time price cannot carry — hence `local` is not optional.
 */
export interface TtsEngine {
  readonly id: string;
  /** Shown in the parent zone when more than one engine is available. */
  readonly label: string;
  /** Must be true. Present so a cloud engine cannot be added by accident. */
  readonly local: true;
  /** Approximate bytes shipped or downloaded, for the parent-zone disclosure. */
  readonly bytes: number;
  /** False until a downloadable voice has actually been fetched. */
  isAvailable(): boolean;
  speak(text: string, options: SpeakOptions): void;
  stop(): void;
}

const engines = new Map<string, TtsEngine>();

export function registerEngine(engine: TtsEngine): void {
  if (!engine.local) {
    throw new Error(
      `TTS engine "${engine.id}" is not local. Cloud speech is barred from the daily loop (D11).`,
    );
  }
  engines.set(engine.id, engine);
}

export function listEngines(): TtsEngine[] {
  return [...engines.values()];
}

export function availableEngines(): TtsEngine[] {
  return listEngines().filter((e) => e.isAvailable());
}

/**
 * The engine to speak with: the requested one if it is ready, otherwise the
 * first available. A voice that has not finished downloading must never leave
 * a child in silence.
 */
export function resolveEngine(preferredId?: string): TtsEngine | undefined {
  const preferred = preferredId ? engines.get(preferredId) : undefined;
  if (preferred?.isAvailable()) return preferred;
  return availableEngines()[0];
}

/** Test seam. */
export function __clearEngines(): void {
  engines.clear();
}
