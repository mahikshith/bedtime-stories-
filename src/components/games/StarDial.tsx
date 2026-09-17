import { useCallback, useEffect, useRef, useState } from 'react';
import { Mascot } from '../Mascot';
import { CompanionSprite, cheerFor } from '../CompanionSprite';
import { useDeviceTilt } from '../../hooks/useDeviceTilt';
import { arc, buildDial, dialComplete, stepDial, type Dial } from '../../engine/spinPhysics';
import { playChime, playPop, playRun } from '../../engine/gameAudio';
import { clearLevel, gameLevel } from '../../state/store';
import { currentMode } from '../../engine/dayArc';
import type { ChildProfile } from '../../engine/types';

/**
 * Star Dial — turn the phone like a wheel to bring a constellation under the
 * marker, and hold it there.
 *
 * The fourth motion verb and the last sensor: `alpha`, which way the phone is
 * pointing, as opposed to which way it is leaning (Stardust Tilt, Moon Pool) or
 * how hard it is being moved (Firefly Air). Holding a phone flat and rotating
 * it is a completely different gesture from tipping it, and it is the one that
 * works sitting down with the phone on a table.
 *
 * **The hold is the game.** Without it this would be "sweep until something
 * lights up", which a child wins by flailing — and flailing is exactly what a
 * rotation game must not teach. Aiming and then keeping still is the skill.
 *
 * Turning is never required: dragging around the dial rotates it identically.
 */
export function StarDial({ profile, onExit }: { profile: ChildProfile; onExit: () => void }) {
  const [level, setLevel] = useState(() => gameLevel('star-dial'));
  const tilt = useDeviceTilt();

  const [dial, setDial] = useState<Dial>(() => buildDial(level));
  const [won, setWon] = useState(false);
  const [asked, setAsked] = useState(false);

  const live = useRef<Dial>(dial);
  const frame = useRef(0);
  const last = useRef(0);
  const wonRef = useRef(false);
  /** Previous sensor heading, so the absolute reading becomes a delta. */
  const heading = useRef<number | null>(null);
  const dragFrom = useRef<number | null>(null);
  /**
   * Turns swept by the finger since the last frame, waiting to be consumed.
   *
   * The pointer handler does NOT step the dial itself. Stepping in both the
   * handler and the frame loop applies the drag once and then applies the
   * momentum it implied a second time, so the dial ends up somewhere neither
   * the finger nor the physics asked for.
   */
  const pending = useRef(0);

  const ring = useRef<SVGGElement>(null);
  const fill = useRef<SVGCircleElement>(null);

  const restart = useCallback(() => {
    const next = gameLevel('star-dial');
    setLevel(next);
    const fresh = buildDial(next);
    live.current = fresh;
    heading.current = null;
    pending.current = 0;
    wonRef.current = false;
    setDial(fresh);
    setWon(false);
  }, []);

  useEffect(() => {
    /** Circumference of the r=40 progress ring, for the dash offset. */
    const RING = 2 * Math.PI * 40;

    const tick = (now: number) => {
      const dt = last.current ? (now - last.current) / 1000 : 1 / 60;
      last.current = now;

      if (!wonRef.current) {
        let delta = 0;
        if (pending.current !== 0) {
          delta = pending.current;
          pending.current = 0;
        } else if (tilt.available) {
          const spin = tilt.read().spin;
          // Shortest way round, never a plain subtraction: the reading wraps,
          // and a plain one reports a whole turn every time it crosses north.
          if (heading.current !== null) delta = arc(heading.current, spin);
          heading.current = spin;
        }

        const r = stepDial(live.current, { delta, dt });
        live.current = r.dial;

        for (const event of r.events) {
          if (event.kind === 'found') playChime({ step: 2 + event.index, velocity: 0.8 });
          else if (event.kind === 'enter') playPop({ velocity: 0.3 });
        }

        ring.current?.setAttribute('transform', `rotate(${(r.dial.angle * 360).toFixed(2)} 50 50)`);
        fill.current?.setAttribute(
          'stroke-dashoffset',
          (RING * (1 - r.progress)).toFixed(2),
        );
        setDial(r.dial);

        if (dialComplete(r.dial)) {
          wonRef.current = true;
          playRun(4, { step: 2 });
          clearLevel('star-dial', level, r.dial.stars.length);
          setWon(true);
        }
      }
      frame.current = requestAnimationFrame(tick);
    };

    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [tilt, level]);

  /** A drag around the dial's centre turns it by the angle swept. */
  const grab = (e: React.PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const at = Math.atan2(
      e.clientY - (box.top + box.height / 2),
      e.clientX - (box.left + box.width / 2),
    ) / (2 * Math.PI);
    if (dragFrom.current !== null) pending.current += arc(dragFrom.current, at);
    dragFrom.current = at;
  };

  const target = dial.stars[dial.target];

  return (
    <div className="page">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <button className="btn btn--sm btn--ghost" onClick={onExit}>&#8592; Games</button>
        <span className="badge">Level {level} of 5</span>
      </div>

      <div className="glass stack" style={{ padding: 'var(--sp-3)', gap: 'var(--sp-2)' }}>
        <p className="eyebrow">Star Dial</p>
        <h1 className="h1">
          {won ? 'The whole sky, named.' : `Find ${target ? target.name : 'the next one'}.`}
        </h1>
        {!won && (
          <p className="tiny">
            Hold the phone flat and turn it like a wheel &mdash; or drag the sky round. Stop on
            the star and <strong>keep still</strong> until the ring closes.
          </p>
        )}
      </div>

      <svg
        className="stardial"
        viewBox="0 0 100 100"
        role="img"
        aria-label={won ? 'Every constellation found' : `Turn the dial to find ${target?.name}`}
        onPointerDown={grab}
        onPointerMove={(e) => { if (dragFrom.current !== null) grab(e); }}
        onPointerUp={() => { dragFrom.current = null; }}
        onPointerLeave={() => { dragFrom.current = null; }}
      >
        {/* The marker is fixed at the top and the sky turns under it, the way
            every physical dial in the world works. */}
        <path className="stardial__marker" d="M50 4 L55 14 L45 14 Z" />

        <circle className="stardial__track" cx="50" cy="50" r="40" />
        <circle
          ref={fill}
          className="stardial__fill"
          cx="50" cy="50" r="40"
          strokeDasharray={2 * Math.PI * 40}
          strokeDashoffset={2 * Math.PI * 40}
          transform="rotate(-90 50 50)"
        />

        <g ref={ring}>
          {dial.stars.map((star, i) => {
            const a = star.at * 2 * Math.PI - Math.PI / 2;
            return (
              <g
                key={i}
                className={`stardial__star${star.found ? ' is-found' : ''}${i === dial.target ? ' is-target' : ''}`}
              >
                <circle cx={50 + Math.cos(a) * 40} cy={50 + Math.sin(a) * 40} r={star.found ? 5 : 3.4} />
              </g>
            );
          })}
        </g>

        <text className="stardial__count" x="50" y="54" textAnchor="middle">
          {dial.stars.filter((s) => s.found).length}/{dial.stars.length}
        </text>
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
          Turn the phone to turn the sky
        </button>
      )}

      {won && (
        <button className="btn btn--primary btn--block" onClick={restart}>
          {level >= 5 ? 'Another sky' : 'Next level'}
        </button>
      )}
    </div>
  );
}
