/**
 * Read-aloud.
 *
 * Runs on the platform speech synthesizer: on-device, free, offline, and no
 * characters are billed. A premium cloud voice can be layered on for Wish
 * Sparks later, but the core product must never depend on a per-character
 * cost — that is what makes a one-time price work.
 *
 * Personas are not separate voice models. They are a voice-selection heuristic
 * plus a pitch/rate treatment applied to whatever voices the device actually
 * has, which is the only approach that works offline on every Android handset.
 */

export type VoicePersona = 'parent' | 'storyteller' | 'kid' | 'device';
export type Pace = 'slow' | 'gentle' | 'medium' | 'lively';

export interface PersonaSpec {
  id: VoicePersona;
  label: string;
  hint: string;
  /** Multiplied into the final rate. */
  rateScale: number;
  pitch: number;
  /** Voice names containing these score higher. */
  prefer: string[];
  /** Voice names containing these are pushed down. */
  avoid: string[];
}

export const PERSONAS: PersonaSpec[] = [
  {
    id: 'parent',
    label: 'Like a parent',
    hint: 'Warm, low and unhurried. The default for winding down.',
    rateScale: 0.94,
    pitch: 0.92,
    prefer: ['natural', 'neural', 'enhanced', 'premium', 'samantha', 'daniel', 'karen', 'aaron'],
    avoid: ['compact', 'novelty', 'whisper'],
  },
  {
    id: 'storyteller',
    label: 'Like a storyteller',
    hint: 'Slower and more deliberate, with room around the words.',
    rateScale: 0.86,
    pitch: 1.0,
    prefer: ['narrat', 'natural', 'neural', 'enhanced', 'serena', 'oliver', 'moira'],
    avoid: ['compact', 'novelty'],
  },
  {
    id: 'kid',
    label: 'Like another child',
    hint: 'Higher and brighter. Some children settle better to this.',
    rateScale: 1.02,
    pitch: 1.42,
    prefer: ['junior', 'kid', 'child', 'natural', 'neural'],
    avoid: ['compact', 'novelty', 'whisper'],
  },
  {
    id: 'device',
    label: 'My device voice',
    hint: 'Whatever your phone already uses, untouched.',
    rateScale: 1,
    pitch: 1,
    prefer: [],
    avoid: [],
  },
];

export const PERSONA_BY_ID = new Map(PERSONAS.map((p) => [p.id, p]));

export interface PaceSpec {
  id: Pace;
  label: string;
  rate: number;
}

export const PACES: PaceSpec[] = [
  { id: 'slow', label: 'Very slow', rate: 0.68 },
  { id: 'gentle', label: 'Slow', rate: 0.82 },
  { id: 'medium', label: 'Medium', rate: 0.95 },
  { id: 'lively', label: 'Lively', rate: 1.12 },
];

export const PACE_BY_ID = new Map(PACES.map((p) => [p.id, p]));

/** How much the voice slows across the sleep gradient, at most. */
const CALM_RATE_DROP = 0.18;
const MIN_RATE = 0.5;
const MAX_RATE = 1.6;

export interface VoiceSettings {
  persona: VoicePersona;
  pace: Pace;
}

export const DEFAULT_VOICE: VoiceSettings = { persona: 'parent', pace: 'gentle' };

export function isNarrationSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/** Strips inline emphasis markers so the synthesizer does not read them aloud. */
export function speakableText(text: string): string {
  return text.replace(/\*(.+?)\*/g, '$1').replace(/\s{2,}/g, ' ').trim();
}

export function clampRate(rate: number): number {
  return Number(Math.min(MAX_RATE, Math.max(MIN_RATE, rate)).toFixed(3));
}

/**
 * Final rate = chosen pace, shaped by the persona, then slowed by the sleep
 * gradient. A story that starts "Lively" still ends calmer than it began.
 */
export function rateFor(settings: VoiceSettings, calm: number): number {
  const pace = PACE_BY_ID.get(settings.pace) ?? PACES[1];
  const persona = PERSONA_BY_ID.get(settings.persona) ?? PERSONAS[0];
  const clampedCalm = Math.min(1, Math.max(0, calm));
  return clampRate(pace.rate * persona.rateScale * (1 - CALM_RATE_DROP * clampedCalm));
}

export function pitchFor(settings: VoiceSettings): number {
  const persona = PERSONA_BY_ID.get(settings.persona) ?? PERSONAS[0];
  return Number(Math.min(2, Math.max(0, persona.pitch)).toFixed(2));
}

/**
 * Scores the device's voices against the persona. Offline ("local") voices win
 * ties, because a bedtime story must not need a network connection.
 */
export function scoreVoice(voice: SpeechSynthesisVoice, persona: PersonaSpec): number {
  const name = `${voice.name} ${voice.voiceURI}`.toLowerCase();
  let score = 0;
  if (voice.lang.toLowerCase().startsWith('en')) score += 40;
  if (voice.localService) score += 25;
  if (voice.default) score += 5;
  persona.prefer.forEach((hint, i) => {
    if (name.includes(hint)) score += 30 - i * 2;
  });
  persona.avoid.forEach((hint) => {
    if (name.includes(hint)) score -= 35;
  });
  return score;
}

export function pickVoice(
  voices: SpeechSynthesisVoice[],
  persona: VoicePersona,
): SpeechSynthesisVoice | undefined {
  if (voices.length === 0) return undefined;
  const spec = PERSONA_BY_ID.get(persona) ?? PERSONAS[0];
  return [...voices].sort((a, b) => scoreVoice(b, spec) - scoreVoice(a, spec))[0];
}

export interface SpeakOptions extends VoiceSettings {
  /** 0 = story opening, 1 = deepest wind-down. */
  calm: number;
  onEnd?: () => void;
  onBoundary?: (charIndex: number) => void;
}

export class Narrator {
  private current: SpeechSynthesisUtterance | null = null;

  get supported(): boolean {
    return isNarrationSupported();
  }

  get voices(): SpeechSynthesisVoice[] {
    return this.supported ? window.speechSynthesis.getVoices() : [];
  }

  speak(text: string, options: SpeakOptions): void {
    if (!this.supported) {
      options.onEnd?.();
      return;
    }
    this.stop();
    const utterance = new SpeechSynthesisUtterance(speakableText(text));
    utterance.rate = rateFor(options, options.calm);
    utterance.pitch = pitchFor(options);
    utterance.volume = 1;
    const voice = pickVoice(this.voices, options.persona);
    if (voice) utterance.voice = voice;
    utterance.onend = () => {
      this.current = null;
      options.onEnd?.();
    };
    utterance.onerror = () => {
      this.current = null;
      options.onEnd?.();
    };
    if (options.onBoundary) {
      utterance.onboundary = (e) => options.onBoundary?.(e.charIndex);
    }
    this.current = utterance;
    window.speechSynthesis.speak(utterance);
  }

  stop(): void {
    if (!this.supported) return;
    window.speechSynthesis.cancel();
    this.current = null;
  }

  get speaking(): boolean {
    return this.current !== null;
  }
}
