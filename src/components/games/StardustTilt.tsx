import { useCallback, useEffect, useRef, useState } from 'react';
import { Mascot } from '../Mascot';
import { useDeviceTilt } from '../../hooks/useDeviceTilt';
import { MARBLE_R, buildField, isComplete, step, type Field } from '../../engine/tiltPhysics';
import { playChime, playRun, playThud } from '../../engine/gameAudio';
import { clearLevel, gameLevel } from '../../state/store';

/**
 * Stardust Tilt — roll a sleep-pearl home by tipping the phone.
 *
 * The first motion game, and the pattern the rest should follow:
 *
 *  - **Tilt is never required.** The prompt is a button, because iOS only
 *    grants motion from inside a user gesture. Refuse it, or play on a device
 *    with no sensor, and dragging a finger steers instead. Same physics, same
 *    levels, nothing withheld.
 *  - **Readings are drained inside our own frame**, never through state. The
 *    orientation event fires faster than React can usefully re-render.
 *  - **No fail state.** A sleeper nudges the pearl onward rather than back.
 */
export function StardustTilt({ onExit }: { onExit: () => void }) {
  const level = gameLevel('stardust-tilt');
  const tilt = useDeviceTilt();

  const [field, setField] = useState<Field>(() => buildField(level));
  const [won, setWon] = useState(false);
  const [asked, setAsked] = useState(false);

  const live = useRef<Field>(field);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const frame = useRef(0);
  const last = useRef(0);
  const wonRef = useRef(false);

  const restart = useCallback((next: number) => {
    const fresh = buildField(next);
    live.current = fresh;
    wonRef.current = false;
    setField(fresh);
    setWon(false);
  }, []);

  useEffect(() => {
    live.current = field;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const tick = (now: number) => {
      const dt = last.current ? (now - last.current) / 1000 : 1 / 60;
      last.current = now;

      if (!wonRef.current) {
        // Touch drag stands in for gravity: the pearl leans toward the finger.
        let ax = 0;
        let ay = 0;
        if (drag.current) {
          ax = (drag.current.x - live.current.marble.x) * 2.4;
          ay = (drag.current.y - live.current.marble.y) * 2.4;
          ax = Math.max(-1, Math.min(1, ax));
          ay = Math.max(-1, Math.min(1, ay));
        } else if (tilt.available) {
          const t = tilt.read();
          ax = t.x;
          ay = t.y;
        }

        const result = step(live.current, { tiltX: ax, tiltY: ay, dt });
        live.current = result.field;

        for (const hit of result.hits) {
          if (hit.kind === 'bell') playChime({ step: 4, velocity: 0.8 });
          else if (hit.kind === 'sleeper') playChime({ step: 1, velocity: 0.5, calm: true });
          else playThud({ velocity: Math.min(0.5, hit.speed) });
        }

        if (isComplete(result.field, result.landed)) {
          wonRef.current = true;
          playRun(4, { step: 2 });
          clearLevel('stardust-tilt', level, 1 + result.field.obstacles.length);
          setWon(true);
        }
        setField(result.field);
      }
      frame.current = requestAnimationFrame(tick);
    };

    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [tilt, level]);

  const pointer = (e: React.PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    drag.current = {
      x: (e.clientX - box.left) / box.width,
      y: (e.clientY - box.top) / box.height,
    };
  };

  const pct = (v: number) => `${v * 100}%`;

  return (
    <div className="page">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <button className="btn btn--sm btn--ghost" onClick={onExit}>&#8592; Games</button>
        <span className="badge">Level {level} of 5</span>
      </div>

      <div className="glass stack" style={{ padding: 'var(--sp-3)', gap: 'var(--sp-2)' }}>
        <p className="eyebrow">Stardust Tilt</p>
        <h1 className="h1">
          {won ? 'The pearl is home.' : 'Roll the sleepy pearl back to the nest.'}
        </h1>
        {!tilt.available && !won && (
          <p className="tiny">
            {tilt.permission === 'prompt'
              ? 'Tip the phone to roll it — or just drag it with your finger.'
              : 'Drag the pearl with your finger.'}
          </p>
        )}
      </div>

      <svg
        className="tiltfield"
        viewBox="0 0 100 100"
        role="img"
        aria-label={won ? 'The pearl reached the nest' : 'Tilt field with a rolling pearl'}
        onPointerDown={pointer}
        onPointerMove={(e) => { if (drag.current) pointer(e); }}
        onPointerUp={() => { drag.current = null; }}
        onPointerLeave={() => { drag.current = null; }}
      >
        <circle
          cx={pct(field.goal.x)} cy={pct(field.goal.y)} r={pct(field.goal.r)}
          className="tiltfield__nest"
        />
        {field.obstacles.map((o, i) => (
          <circle
            key={i}
            cx={pct(o.x)} cy={pct(o.y)} r={pct(o.r)}
            className={o.kind === 'bell' ? `tiltfield__bell${o.rung ? ' is-rung' : ''}` : 'tiltfield__sleeper'}
          />
        ))}
        <circle
          cx={pct(field.marble.x)} cy={pct(field.marble.y)} r={pct(MARBLE_R)}
          className={`tiltfield__pearl${won ? ' juice-pop' : ''}`}
        />
      </svg>

      <div className="row" style={{ justifyContent: 'center' }}>
        <Mascot size={110} mood={won ? 'proud' : 'curious'} autoHop={won} />
      </div>

      {tilt.permission === 'prompt' && !asked && (
        <button
          className="btn btn--primary btn--block"
          onClick={() => { setAsked(true); void tilt.request(); }}
        >
          Use tilt to roll it
        </button>
      )}

      {won && (
        <button
          className="btn btn--primary btn--block"
          onClick={() => restart(gameLevel('stardust-tilt'))}
        >
          {level >= 5 ? 'Roll it again' : 'Next level'}
        </button>
      )}
    </div>
  );
}
