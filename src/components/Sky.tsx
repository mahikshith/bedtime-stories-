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

const DEFAULT_PALETTE: World['palette'] = ['#070a16', '#1e2749', '#b9a6ff'];

/**
 * The ambient layer: a world gradient, a deterministic speck field, and the
 * warm veil that deepens as the story settles. Processed backdrop only —
 * real archive photography gets its own moment in the Real Window card.
 */
export function Sky({ world, calm = 0, dimming = true }: SkyProps) {
  const seed = hashString(world?.id ?? 'home');
  const specks = useMemo(() => buildSpecks(seed, 46), [seed]);

  const background = world
    ? worldGradient(world, calm)
    : `radial-gradient(120% 90% at 50% 8%, ${DEFAULT_PALETTE[2]}22 0%, ${DEFAULT_PALETTE[1]}44 34%, ${DEFAULT_PALETTE[0]} 66%, ${DEFAULT_PALETTE[0]} 100%)`;

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
            fill="#fff6e2"
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
