import { useCallback, useEffect, useRef, useState } from 'react';
import { Mascot } from '../Mascot';
import { CompanionSprite, cheerFor } from '../CompanionSprite';
import { useDeviceShake } from '../../hooks/useDeviceShake';
import {
  FLYER_R,
  buildSky,
  driftRings,
  skyComplete,
  stepAir,
  type Sky,
} from '../../engine/airPhysics';
import { playChime, playPop, playRun, playThud } from '../../engine/gameAudio';
import { clearLevel, gameLevel } from '../../state/store';
import { currentMode } from '../../engine/dayArc';
import type { ChildProfile } from '../../engine/types';

/**
 * Firefly Air — fan a seed of light up through the rings by waving the phone.
 *
 * The third motion verb. Stardust Tilt is aiming, Moon Pool is timing, this is
 * *effort*: the phone is a fan, and the child has to keep putting energy in or
 * the seed comes down. It is the only loud-bodied game in the set, which is
 * exactly why it is a daytime one.
 *
 * Waving is never required. A finger swiped across the field makes the same
 * air — speed becomes power, direction becomes the fan — so a refused
 * permission, a sensorless tablet, or a parent who would rather nobody threw
 * the phone around costs nothing at all.
 */
export function FireflyAir({ profile, onExit }: { profile: ChildProfile; onExit: () => void }) {
  /*
   * Held in state, not read from the store on every render. `clearLevel` bumps
   * the stored level the instant a round is won, so a screen that derives the
   * level from the store re-renders the WON board labelled with the next level
   * — and any board built from it changes underneath the child while they are
   * still being congratulated for the last one.
   */
  const [level, setLevel] = useState(() => gameLevel('firefly-air'));
  const shake = useDeviceShake();

  const [sky, setSky] = useState<Sky>(() => buildSky(level));
  const [won, setWon] = useState(false);
  const [asked, setAsked] = useState(false);

  const live = useRef<Sky>(sky);
  const frame = useRef(0);
  const last = useRef(0);
  const wonRef = useRef(false);
  /** Touch fallback: a swipe's speed is the wave, decaying like real air. */
  const swipe = useRef({ power: 0, dir: 0, at: 0, x: 0 });

  const flyer = useRef<SVGGElement>(null);
  const gusts = useRef<SVGGElement>(null);
  /** Smoothed so the streaks breathe rather than strobe on every reading. */
  const smoothed = useRef(0);
  const ringNodes = useRef<(SVGCircleElement | null)[]>([]);

  const restart = useCallback(() => {
    const next = gameLevel('firefly-air');
    setLevel(next);
    const fresh = buildSky(next);
    live.current = fresh;
    wonRef.current = false;
    setSky(fresh);
    setWon(false);
  }, []);

  useEffect(() => {
    const paint = (s: Sky, power = 0, dir = 0) => {
      /*
       * The air itself. Without it the child is waving at a dot and getting an
       * effect they cannot connect to the cause — these streaks lean the way
       * the wave is going and brighten with how hard it is, which is the only
       * thing on screen that says "it is the AIR you are moving".
       */
      gusts.current?.setAttribute('opacity', (power * 0.55).toFixed(3));
      gusts.current?.setAttribute('transform', `translate(${(dir * 9).toFixed(2)} 0)`);

      flyer.current?.setAttribute(
        'transform',
        `translate(${(s.flyer.x * 100).toFixed(2)} ${(s.flyer.y * 100).toFixed(2)})`,
      );
      s.rings.forEach((ring, i) => {
        const node = ringNodes.current[i];
        if (!node) return;
        node.setAttribute('cx', (ring.x * 100).toFixed(2));
        node.classList.toggle('is-passed', ring.passed);
      });
    };

    const tick = (now: number) => {
      const dt = last.current ? (now - last.current) / 1000 : 1 / 60;
      last.current = now;

      if (!wonRef.current) {
        let power = 0;
        let dir = 0;
        // A swipe that has stopped arriving is a hand that has stopped moving.
        swipe.current.power *= Math.exp(-3.2 * dt);
        if (swipe.current.power > 0.02) {
          power = swipe.current.power;
          dir = swipe.current.dir;
        } else if (shake.available) {
          const s = shake.read(dt);
          power = s.power;
          dir = s.dir;
        }

        const r = stepAir(live.current, { power, dir, dt });
        live.current = driftRings(r.sky, dt);
        smoothed.current += (power - smoothed.current) * Math.min(1, 6 * dt);

        for (const event of r.events) {
          if (event.kind === 'ring') playChime({ step: 2 + event.index * 2, velocity: 0.75 });
          else if (event.kind === 'land') playThud({ velocity: Math.min(0.45, event.speed) });
          else playPop({ velocity: 0.3 });
        }

        paint(live.current, smoothed.current, dir);

        if (skyComplete(live.current)) {
          wonRef.current = true;
          playRun(4, { step: 3 });
          clearLevel('firefly-air', level, live.current.rings.length + 1);
          setWon(true);
        }
      }
      frame.current = requestAnimationFrame(tick);
    };

    paint(live.current);
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [shake, level]);

  const fan = (e: React.PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - box.left) / box.width;
    const now = performance.now();
    const dt = swipe.current.at ? Math.max(8, now - swipe.current.at) : 16;
    const speed = Math.abs(x - swipe.current.x) / (dt / 1000);
    swipe.current = {
      // 2.2 field-widths a second is a brisk swipe; that reads as full power.
      power: Math.max(swipe.current.power, Math.min(1, speed / 2.2)),
      dir: Math.sign(x - swipe.current.x) || swipe.current.dir,
      at: now,
      x,
    };
  };

  return (
    <div className="page">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <button className="btn btn--sm btn--ghost" onClick={onExit}>&#8592; Games</button>
        <span className="badge">Level {level} of 5</span>
      </div>

      <div className="glass stack" style={{ padding: 'var(--sp-3)', gap: 'var(--sp-2)' }}>
        <p className="eyebrow">Firefly Air</p>
        <h1 className="h1">
          {won ? 'Through every single ring.' : 'Fan the little light up through the rings.'}
        </h1>
        {!won && (
          <p className="tiny">
            Wave the phone like a fan &mdash; or sweep a finger across the sky. The air keeps
            moving after you stop, so aim a little early.
          </p>
        )}
      </div>

      <svg
        className="airfield"
        viewBox="0 0 100 100"
        role="img"
        aria-label={won ? 'The firefly passed every ring' : 'A firefly drifting below a set of rings'}
        onPointerDown={fan}
        onPointerMove={(e) => { if (e.buttons || e.pointerType === 'touch') fan(e); }}
        onPointerUp={() => { swipe.current.at = 0; }}
        onPointerLeave={() => { swipe.current.at = 0; }}
      >
        <g ref={gusts} className="airfield__gusts" opacity="0">
          {[18, 34, 52, 68, 84].map((y, i) => (
            <line key={y} x1={8 + (i % 2) * 10} y1={y} x2={78 + (i % 2) * 14} y2={y} />
          ))}
        </g>

        <path className="airfield__ground" d="M 0 100 L 0 95 Q 25 91 50 94 T 100 95 L 100 100 Z" />

        {sky.rings.map((ring, i) => (
          <circle
            key={i}
            ref={(node) => { ringNodes.current[i] = node; }}
            className="airfield__ring"
            cx={ring.x * 100}
            cy={ring.y * 100}
            r={ring.r * 100}
          />
        ))}
        <g ref={flyer} className="airfield__flyer">
          <circle r={FLYER_R * 100} />
        </g>
      </svg>

      <div className="row" style={{ justifyContent: 'center', gap: 'var(--sp-3)' }}>
        <CompanionSprite
          companionId={profile.companionId}
          mood={won ? 'cheering' : currentMode() === 'winddown' ? 'sleeping' : 'watching'}
          cheer={won ? 1 : 0}
          says={won ? cheerFor(profile.companionId, level) : null}
        />
        <Mascot size={110} mood={won ? 'proud' : 'excited'} autoHop={won} />
      </div>

      {shake.permission === 'prompt' && !asked && !won && (
        <button
          className="btn btn--primary btn--block"
          onClick={() => { setAsked(true); void shake.request(); }}
        >
          Use the phone as a fan
        </button>
      )}

      {won && (
        <button className="btn btn--primary btn--block" onClick={restart}>
          {level >= 5 ? 'Fly it again' : 'Next level'}
        </button>
      )}
    </div>
  );
}
