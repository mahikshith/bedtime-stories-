import { useEffect, useState } from 'react';
import { playChime } from '../../engine/gameAudio';
import { Mascot } from '../Mascot';
import { useVoiceMeter } from '../../hooks/useVoiceMeter';

const SLEEPERS = ['🦔', '🐻', '🦉', '🐿️', '🦥', '🐸'];

/**
 * Wake the Animal — for the youngest band.
 *
 * Pure cause and effect: any sound at all wakes the animal. There is no target,
 * no score and no way to fail, because for a two-year-old the discovery that
 * "my voice does something" IS the whole lesson.
 *
 * Marked `together` in the catalogue: at this age the app is a prop for a
 * grown-up and a child playing, not something to hand over.
 */
export function WakeTheAnimal({ onExit }: { onExit: () => void }) {
  const meter = useVoiceMeter();
  const [index, setIndex] = useState(0);
  const [awake, setAwake] = useState(false);
  const [woken, setWoken] = useState(0);
  /** Tapping stands in for noise when there is no microphone. */
  const [touch, setTouch] = useState(false);
  const [poked, setPoked] = useState(false);

  const loud = touch ? poked : meter.level > 0.3;

  useEffect(() => {
    if (loud && !awake) {
      setAwake(true);
      setWoken((n) => {
        // Climbs with each animal, so a run of them is a little tune. Gated on
        // the awake transition, not on `loud`, or a held shout retriggers it
        // every frame.
        playChime({ step: n + 1, velocity: 0.75 });
        return n + 1;
      });
    }
    if (!loud && awake) {
      const t = window.setTimeout(() => {
        setAwake(false);
        setIndex((i) => (i + 1) % SLEEPERS.length);
      }, 1600);
      return () => window.clearTimeout(t);
    }
  }, [loud, awake]);

  if (!touch && meter.state === 'idle') {
    return (
      <div className="page stack">
        <header className="row row--between">
          <button className="btn btn--sm btn--ghost" onClick={onExit}>&larr; Games</button>
        </header>
        <Mascot size={172} mood="happy" autoHop />
        <section className="glass stack" style={{ padding: 'var(--sp-4)', textAlign: 'center' }}>
          <p className="eyebrow">Wake the Animal</p>
          <h1 className="h1">Make a noise. Any noise.</h1>
          <p className="muted">
            Somebody is asleep. A shout, a squeak, a raspberry &mdash; all of it works.
          </p>
          <p className="tiny">
            Best played on a grown-up&rsquo;s lap. Lumi measures loudness only: no recording is
            made and nothing leaves this device.
          </p>
          <button className="btn btn--primary btn--block" onClick={() => void meter.start()}>
            Start
          </button>
        </section>
      </div>
    );
  }

  /*
   * Without a microphone the game becomes a tapping game, and loses nothing
   * worth keeping: the point is that a two-year-old does something and an
   * animal reacts, not which sense they used to do it.
   */
  if (!touch && (meter.state === 'denied' || meter.state === 'unsupported' || meter.state === 'unavailable')) {
    return (
      <div className="page stack">
        <Mascot size={148} mood="soft" />
        <section className="glass stack" style={{ padding: 'var(--sp-4)' }}>
          <h1 className="h1">Lumi can&rsquo;t hear right now.</h1>
          <p className="muted">
            That&rsquo;s alright &mdash; you can wake them with a tap instead.
          </p>
          <button className="btn btn--primary btn--block" onClick={() => setTouch(true)}>
            Wake them by tapping
          </button>
          <button className="btn btn--ghost btn--block" onClick={onExit}>Pick another game</button>
        </section>
      </div>
    );
  }

  return (
    <div className="page stack">
      <header className="row row--between">
        <button className="btn btn--sm btn--ghost" onClick={onExit}>&larr; Games</button>
        <span className="badge">{woken} woken up</span>
      </header>

      <div className="wake" aria-live="polite">
        {touch ? (
          /* The animal itself is the button. A two-year-old aims at the thing
             they want to poke, not at a control underneath it. */
          <button
            type="button"
            className={`wake__animal wake__animal--tappable${awake ? ' wake__animal--awake' : ''}`}
            aria-label={awake ? 'They are awake' : 'Tap to wake them'}
            onPointerDown={() => {
              setPoked(true);
              window.setTimeout(() => setPoked(false), 400);
            }}
          >
            <span aria-hidden="true">{SLEEPERS[index]}</span>
          </button>
        ) : (
          <div className={`wake__animal${awake ? ' wake__animal--awake' : ''}`}>
            <span aria-hidden="true">{SLEEPERS[index]}</span>
          </div>
        )}
        <p className="h1" style={{ textAlign: 'center' }}>
          {awake
            ? 'You woke them up!'
            : touch
              ? 'Shhh\u2026 tap to wake them.'
              : meter.state === 'live'
                ? 'Shhh\u2026 they\u2019re asleep.'
                : 'Listening\u2026'}
        </p>
        {!touch && (
          <div className="leap__meter leap__meter--wide" aria-hidden="true">
            <div className="leap__fill" style={{ height: `${Math.round(meter.level * 100)}%` }} />
          </div>
        )}
      </div>
    </div>
  );
}
