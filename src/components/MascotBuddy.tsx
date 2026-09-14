import { useCallback, useEffect, useRef, useState } from 'react';
import { Mascot, type Action, type Mood } from './Mascot';

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
  const [action, setAction] = useState<Action>('idle');
  const [facing, setFacing] = useState(1);
  const [says, setSays] = useState<string | null>(null);
  const hopTimer = useRef<number | undefined>(undefined);
  const bubbleTimer = useRef<number | undefined>(undefined);

  /**
   * Crossing the screen: a short move is a waddle, a long one is a flight.
   *
   * Picking the gait from the distance is what stops it looking like a sprite
   * being slid around — a bird that flies two inches looks wrong, and one that
   * walks half the screen in 800ms looks worse.
   */
  const travel = useCallback((next?: number) => {
    setStop((prev) => {
      const target =
        next ?? (prev + 1 + Math.floor(Math.random() * (STOPS.length - 1))) % STOPS.length;
      const distance = Math.abs(STOPS[target] - STOPS[prev]);
      setFacing(STOPS[target] >= STOPS[prev] ? 1 : -1);
      setAction(distance > 30 ? 'fly' : 'walk');
      return target;
    });
    window.clearTimeout(hopTimer.current);
    hopTimer.current = window.setTimeout(() => setAction('idle'), 900);
  }, []);

  useEffect(() => {
    if (settled) return;
    const reduced =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    const id = window.setInterval(() => travel(), 5200 + Math.random() * 2600);
    return () => window.clearInterval(id);
  }, [settled, travel]);

  useEffect(() => () => {
    window.clearTimeout(hopTimer.current);
    window.clearTimeout(bubbleTimer.current);
  }, []);

  function greet() {
    if (settled) return;
    // A tap is worth a barrel roll.
    setAction('spin');
    window.clearTimeout(hopTimer.current);
    hopTimer.current = window.setTimeout(() => setAction('idle'), 950);
    setSays(LINES[Math.floor(Math.random() * LINES.length)]);
    window.clearTimeout(bubbleTimer.current);
    bubbleTimer.current = window.setTimeout(() => setSays(null), 2800);
  }

  return (
    <button
      type="button"
      className={`buddy${action !== 'idle' ? ' buddy--moving' : ''}`}
      style={{
        // Clamped so Lumi can never hop off the edge of a narrow phone.
        left: `clamp(4px, calc(${settled ? 42 : STOPS[stop]}% ), calc(100% - ${size}px - 4px))`,
      }}
      onClick={greet}
      aria-label="Lumi. Tap to say hello."
    >
      {says && <span className="buddy__bubble">{says}</span>}
      {/* Face the way it is going; a bird moonwalking is uncanny. */}
      <span className="buddy__facing" style={{ transform: `scaleX(${facing})` }}>
        <Mascot
          size={size}
          mood={settled ? 'sleepy' : mood}
          action={settled ? 'idle' : action}
          title="Lumi"
        />
      </span>
    </button>
  );
}
