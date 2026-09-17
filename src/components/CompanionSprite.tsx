import { useEffect, useRef, useState } from 'react';
import { getCompanion } from '../content/companions';

/**
 * The child's companion, on screen and awake.
 *
 * Companions already run through the stories, the rhymes and the colouring —
 * they are the app's continuity mechanic — but until now they existed only as a
 * name inside a sentence. A child who picked Sorrel the fox never *saw* Sorrel.
 *
 * So this is the same character, watching the games. It reacts to what the game
 * reports rather than to a timer, which is the whole difference between a
 * character and a decoration: it hops when something good happens, and it is
 * asleep during wind-down because the app is winding down too.
 */

export type CompanionMood = 'watching' | 'cheering' | 'sleeping';

interface CompanionSpriteProps {
  companionId: string;
  size?: number;
  mood?: CompanionMood;
  /**
   * Increment this to make the companion react. A counter rather than a
   * boolean, because two wins in a row must play twice and a boolean that is
   * already true cannot.
   */
  cheer?: number;
  /** Shown once beside it, if there is something worth saying. */
  says?: string | null;
}

export function CompanionSprite({
  companionId,
  size = 52,
  mood = 'watching',
  cheer = 0,
  says = null,
}: CompanionSpriteProps) {
  const companion = getCompanion(companionId);
  const [popping, setPopping] = useState(false);
  const seen = useRef(cheer);

  useEffect(() => {
    if (cheer === seen.current) return;
    seen.current = cheer;
    setPopping(true);
    // Matches --dur-mid plus the tail of the wobble; re-arming mid-pop would
    // restart the transform from its current scale and look like a stutter.
    const t = window.setTimeout(() => setPopping(false), 420);
    return () => window.clearTimeout(t);
  }, [cheer]);

  return (
    <div className="companion" data-mood={mood}>
      <span
        className={`companion__body${popping ? ' juice-pop' : ''}`}
        style={{ fontSize: size }}
        role="img"
        aria-label={`${companion.name} the ${companion.species}`}
      >
        {companion.emoji}
      </span>
      {says && <span className="companion__says">{says}</span>}
    </div>
  );
}

/** What the companion says when a level is cleared. Never the same twice running. */
export function cheerFor(companionId: string, streakIndex: number): string {
  const companion = getCompanion(companionId);
  const lines = [
    `${companion.name} saw that.`,
    `${companion.name} is very impressed.`,
    `That was the good one, says ${companion.name}.`,
    `${companion.name} would like to see it again.`,
  ];
  return lines[Math.abs(streakIndex) % lines.length];
}
