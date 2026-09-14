import { useMemo } from 'react';
import type { World } from '../engine/types';
import { buildSpecks, worldGradient } from '../engine/backdrop';
import { hashString } from '../engine/rng';

interface SkyProps {
  world?: World;
  /** 0 = story opening, 1 = deepest wind-down. Drives the amber veil. */
  calm?: number;
  dimming?: boolean;
}

/*
 * Outside a story the sky is built from the active palette's own surfaces, so a
 * light theme gets a light sky. Hardcoding a night gradient here made every
 * bright palette look like a dark one with the wrong text colour.
 */
const THEMED_SKY =
  'radial-gradient(125% 92% at 50% 6%, var(--ink-600) 0%, var(--ink-800) 48%, var(--ink-900) 100%)';

/**
 * The ambient layer: a world gradient, a deterministic speck field, and the
 * warm veil that deepens as the story settles. Processed backdrop only —
 * real archive photography gets its own moment in the Real Window card.
 */
export function Sky({ world, calm = 0, dimming = true }: SkyProps) {
  const seed = hashString(world?.id ?? 'home');
  const specks = useMemo(() => buildSpecks(seed, 46), [seed]);

  const background = world ? worldGradient(world, calm) : THEMED_SKY;

  return (
    <>
      <div className="app__sky" style={{ background }} aria-hidden="true" />
      <svg className="app__specks" aria-hidden="true" preserveAspectRatio="none">
        {specks.map((s, i) => (
          <circle
            key={i}
            className="speck"
            cx={`${s.x}%`}
            cy={`${s.y}%`}
            r={s.r}
            fill="var(--speck, #fff6e2)"
            opacity={s.o * (1 - calm * 0.55)}
            style={{ animationDelay: `${s.delay}s` }}
          />
        ))}
      </svg>
      <div
        className="app__veil"
        aria-hidden="true"
        style={{ opacity: dimming ? calm * 0.62 : 0 }}
      />
    </>
  );
}
