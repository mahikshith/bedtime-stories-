import { useCallback, useEffect, useRef, useState } from 'react';
import { Mascot, type Mood } from './Mascot';

/** Calm, bedtime-appropriate. Nothing here is trying to excite anybody. */
const LINES = [
  'Pick a world. Any world.',
  'I like the quiet ones best.',
  'My lanterns are already warm.',
  'We can go somewhere slow tonight.',
  'Shall we?',
  'I saved you a good one.',
];

const STOPS = [6, 32, 58, 82];

interface MascotBuddyProps {
  /** When true Lumi stops hopping and settles — used through the story wind-down. */
  settled?: boolean;
  size?: number;
  mood?: Mood;
}

/**
 * The hopping buddy layer.
 *
 * Deliberately constrained to a band along the bottom so it never covers the
 * story text or the primary action, and it stops moving entirely once the
 * story starts winding down. A mascot bouncing around the screen at 8:45pm is
 * an arousal cue, which is the one thing this app must not add at bedtime.
 */
export function MascotBuddy({ settled = false, size = 128, mood = 'happy' }: MascotBuddyProps) {
  const [stop, setStop] = useState(0);
  const [hopping, setHopping] = useState(false);
  const [says, setSays] = useState<string | null>(null);
  const hopTimer = useRef<number | undefined>(undefined);
  const bubbleTimer = useRef<number | undefined>(undefined);

  const hop = useCallback((next?: number) => {
    setStop((prev) => next ?? (prev + 1 + Math.floor(Math.random() * (STOPS.length - 1))) % STOPS.length);
    setHopping(true);
    window.clearTimeout(hopTimer.current);
    hopTimer.current = window.setTimeout(() => setHopping(false), 850);
  }, []);

  useEffect(() => {
    if (settled) return;
    const reduced =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    const id = window.setInterval(() => hop(), 5200 + Math.random() * 2600);
    return () => window.clearInterval(id);
  }, [settled, hop]);

  useEffect(() => () => {
    window.clearTimeout(hopTimer.current);
    window.clearTimeout(bubbleTimer.current);
  }, []);

  function greet() {
    if (settled) return;
    hop();
    setSays(LINES[Math.floor(Math.random() * LINES.length)]);
    window.clearTimeout(bubbleTimer.current);
    bubbleTimer.current = window.setTimeout(() => setSays(null), 2800);
  }

  return (
    <button
      type="button"
      className={`buddy${hopping ? ' buddy--hopping' : ''}`}
      style={{
        // Clamped so Lumi can never hop off the edge of a narrow phone.
        left: `clamp(4px, calc(${settled ? 42 : STOPS[stop]}% ), calc(100% - ${size}px - 4px))`,
      }}
      onClick={greet}
      aria-label="Lumi. Tap to say hello."
    >
      {says && <span className="buddy__bubble">{says}</span>}
      <Mascot size={size} mood={settled ? 'sleepy' : mood} hopping={hopping} title="Lumi" />
    </button>
  );
}
