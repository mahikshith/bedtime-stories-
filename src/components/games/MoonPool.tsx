import { useCallback, useEffect, useRef, useState } from 'react';
import { Mascot } from '../Mascot';
import { CompanionSprite, cheerFor } from '../CompanionSprite';
import { useDeviceTilt } from '../../hooks/useDeviceTilt';
import {
  COLUMNS,
  LEDGE_X,
  NO_LAP,
  SEED_R,
  SLOSH_SECONDS,
  buildPool,
  isPoolComplete,
  stepWater,
  surfaceAt,
  type LapState,
  type Pool,
} from '../../engine/waterPhysics';
import { playChime, playRun, playSquish } from '../../engine/gameAudio';
import { clearLevel, gameLevel } from '../../state/store';
import { currentMode } from '../../engine/dayArc';
import type { ChildProfile } from '../../engine/types';

/**
 * Moon Pool — rock the phone until the water lifts the glow-seeds to the ledge.
 *
 * The second motion game, and a different verb from Stardust Tilt: that one is
 * about *aiming* a tilt, this one is about *timing* it. Holding the phone over
 * clears level 1 and nothing else. Everything above it needs the child to find
 * the pool's own rhythm, which is why the moon overhead swings at exactly that
 * rhythm — the whole lesson is "rock along with the moon", and a five-year-old
 * can copy a swinging thing long before they can be told about resonance.
 *
 * Geometry is written straight to the DOM inside the animation frame rather
 * than through state. A twenty-eight point surface plus its seeds is a lot to
 * reconcile sixty times a second on the cheap Android this has to run on, and
 * none of it is information React needs. React still owns everything discrete:
 * the level, the win, the permission prompt.
 */

/** Depth that maps to the top of the field. The pool is half full at rest. */
const TOP_DEPTH = 1.25;
const yOf = (depth: number) => 100 - (depth / TOP_DEPTH) * 100;

export function MoonPool({ profile, onExit }: { profile: ChildProfile; onExit: () => void }) {
  /*
   * Held in state, not read from the store on every render. `clearLevel` bumps
   * the stored level the instant a round is won, so a screen that derives the
   * level from the store re-renders the WON board labelled with the next level
   * — and any board built from it changes underneath the child while they are
   * still being congratulated for the last one.
   */
  const [level, setLevel] = useState(() => gameLevel('moon-pool'));
  const tilt = useDeviceTilt();

  const [pool, setPool] = useState<Pool>(() => buildPool(level));
  const [won, setWon] = useState(false);
  const [asked, setAsked] = useState(false);

  const live = useRef<Pool>(pool);
  const lap = useRef<LapState>(NO_LAP);
  const drag = useRef<number | null>(null);
  const frame = useRef(0);
  const last = useRef(0);
  const wonRef = useRef(false);

  const surface = useRef<SVGPathElement>(null);
  const seeds = useRef<(SVGCircleElement | null)[]>([]);

  const restart = useCallback(() => {
    const next = gameLevel('moon-pool');
    setLevel(next);
    const fresh = buildPool(next);
    live.current = fresh;
    lap.current = NO_LAP;
    wonRef.current = false;
    setPool(fresh);
    setWon(false);
  }, []);

  useEffect(() => {
    const paint = (p: Pool) => {
      const { h } = p.water;
      // Both edges are sampled from the end columns so the water meets the
      // walls instead of stopping a half-column short of them.
      let d = `M 0 100 L 0 ${yOf(h[0]).toFixed(2)}`;
      for (let i = 0; i < COLUMNS; i += 1) {
        d += ` L ${(((i + 0.5) / COLUMNS) * 100).toFixed(2)} ${yOf(h[i]).toFixed(2)}`;
      }
      d += ` L 100 ${yOf(h[COLUMNS - 1]).toFixed(2)} L 100 100 Z`;
      surface.current?.setAttribute('d', d);

      p.seeds.forEach((seed, i) => {
        const node = seeds.current[i];
        if (!node) return;
        if (seed.home) {
          node.setAttribute('cx', String(90 + i * 4));
          node.setAttribute('cy', String(yOf(p.ledge) - SEED_R * 100));
        } else {
          node.setAttribute('cx', (seed.x * 100).toFixed(2));
          node.setAttribute('cy', yOf(surfaceAt(p.water, seed.x)).toFixed(2));
        }
      });
    };

    const tick = (now: number) => {
      const dt = last.current ? (now - last.current) / 1000 : 1 / 60;
      last.current = now;

      if (!wonRef.current) {
        // A finger swept across the pool stands in for the phone being rocked,
        // so the rhythm a child has to find is the same either way.
        let tiltX = 0;
        if (drag.current !== null) tiltX = (drag.current - 0.5) * 2;
        else if (tilt.available) tiltX = tilt.read().x;

        const r = stepWater(live.current, { tiltX, dt }, lap.current);
        live.current = r.pool;
        lap.current = r.lap;

        for (const event of r.events) {
          if (event.kind === 'lap') {
            playSquish({ velocity: 0.18 + event.strength * 0.3, calm: true });
          } else {
            playChime({ step: 2 + event.index * 2, velocity: 0.7 });
          }
        }

        paint(r.pool);

        if (isPoolComplete(r.pool)) {
          wonRef.current = true;
          playRun(4, { step: 2 });
          clearLevel('moon-pool', level, r.pool.seeds.length + 1);
          setWon(true);
        }
      }
      frame.current = requestAnimationFrame(tick);
    };

    paint(live.current);
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [tilt, level]);

  const track = (e: React.PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    drag.current = Math.max(0, Math.min(1, (e.clientX - box.left) / box.width));
  };

  const ledgeY = yOf(pool.ledge);

  return (
    <div className="page">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <button className="btn btn--sm btn--ghost" onClick={onExit}>&#8592; Games</button>
        <span className="badge">Level {level} of 5</span>
      </div>

      <div className="glass stack" style={{ padding: 'var(--sp-3)', gap: 'var(--sp-2)' }}>
        <p className="eyebrow">Moon Pool</p>
        <h1 className="h1">
          {won ? 'All of them are safe on the ledge.' : 'Rock the water up to the mossy ledge.'}
        </h1>
        {!won && (
          <p className="tiny">
            {level === 1
              ? 'Tip it over and wait — the seed floats that way on its own.'
              : 'Sway along with the moon. Rocking in time makes a much bigger wave than rocking hard.'}
          </p>
        )}
      </div>

      <svg
        className="moonpool"
        viewBox="0 0 100 100"
        role="img"
        aria-label={won ? 'Every glow-seed is on the ledge' : 'A pool of glowing water with floating seeds'}
        onPointerDown={track}
        onPointerMove={(e) => { if (drag.current !== null) track(e); }}
        onPointerUp={() => { drag.current = null; }}
        onPointerLeave={() => { drag.current = null; }}
      >
        {/*
          The moon swings at the pool's resonant period. It is the only tuition
          in the game: match it and the water answers, fight it and it does not.
        */}
        <g className="moonpool__moon" style={{ animationDuration: `${SLOSH_SECONDS.toFixed(2)}s` }}>
          <circle cx="50" cy="11" r="6" />
        </g>

        <path ref={surface} className="moonpool__water" d="" />

        <line className="moonpool__guide" x1="52" y1={ledgeY} x2={LEDGE_X * 100} y2={ledgeY} />
        {/*
          A shelf, not a column. Drawn full height it hid the water behind it and
          read as a glass tube bolted to the side of the pool; as a slab the wave
          can be seen climbing past it, which is the thing the child is doing.
        */}
        <rect
          className="moonpool__ledge"
          x={LEDGE_X * 100} y={ledgeY} width={100 - LEDGE_X * 100} height="3.4" rx="1.2"
        />

        {pool.seeds.map((_, i) => (
          <circle
            key={i}
            ref={(node) => { seeds.current[i] = node; }}
            className="moonpool__seed"
            r={SEED_R * 100}
            cx="0"
            cy="0"
          />
        ))}
      </svg>

      <div className="row" style={{ justifyContent: 'center', gap: 'var(--sp-3)' }}>
        <CompanionSprite
          companionId={profile.companionId}
          mood={won ? 'cheering' : currentMode() === 'winddown' ? 'sleeping' : 'watching'}
          cheer={won ? 1 : 0}
          says={won ? cheerFor(profile.companionId, level) : null}
        />
        <Mascot size={110} mood={won ? 'proud' : 'curious'} autoHop={won} />
      </div>

      {tilt.permission === 'prompt' && !asked && !won && (
        <button
          className="btn btn--primary btn--block"
          onClick={() => { setAsked(true); void tilt.request(); }}
        >
          Rock the pool by tipping the phone
        </button>
      )}

      {won && (
        <button className="btn btn--primary btn--block" onClick={restart}>
          {level >= 5 ? 'Fill it again' : 'Next level'}
        </button>
      )}
    </div>
  );
}
