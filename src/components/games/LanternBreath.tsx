import { useCallback, useEffect, useRef, useState } from 'react';
import { playChime } from '../../engine/gameAudio';
import { Mascot } from '../Mascot';
import { useVoiceMeter } from '../../hooks/useVoiceMeter';
import { detectBreath } from '../../engine/voiceMeter';
import { BREATH_LEVEL, pressSamples } from '../../engine/pressMeter';
import { recordSettledNight, useAppState } from '../../state/store';
import type { ChildProfile } from '../../engine/types';

const LANTERNS = 5;
/** Seconds to breathe in before each blow. Long, and deliberately unhurried. */
const IN_BREATH = 4;

type Phase = 'intro' | 'breathe-in' | 'blow' | 'blown' | 'done';

/**
 * Lantern Breath — the wind-down game.
 *
 * Every calming app for children is passive: sleep stories, meditations, white
 * noise. Every interactive children's game is arousing. Nothing sits in the
 * middle, and that gap is this game.
 *
 * Blowing out candles is a standard technique for calming children, and a
 * randomised trial of bubble-blower breathing in children aged 7-10 found it
 * significantly reduced anxiety and pain. The breathing a child uses to blow
 * out a flame is the same breathing used to calm down — long out-breath, longer
 * than the in-breath, which is what actually shifts the nervous system.
 *
 * So the game is the intervention rather than a wrapper around it. The child
 * breathes in while the lantern brightens, blows out while it dims, and the
 * room darkens one lantern at a time until there is nothing left to look at.
 * It ends by counting a settled night and getting out of the way.
 */
export function LanternBreath({ profile, onExit }: { profile: ChildProfile; onExit: () => void }) {
  const meter = useVoiceMeter();
  const state = useAppState();
  const [phase, setPhase] = useState<Phase>('intro');
  const [lit, setLit] = useState(LANTERNS);
  const [countdown, setCountdown] = useState(IN_BREATH);
  const [nudge, setNudge] = useState<string | null>(null);
  const timers = useRef<number[]>([]);
  /*
   * Touch mode: no microphone, so the child holds the screen for as long as
   * they breathe out. The press is converted to the level stream a breath would
   * have produced and scored by exactly the same `detectBreath`, so the rule
   * that a breath must be long AND gentle still decides it — a stab is still
   * too short, and there is still no way to win by shouting.
   */
  const [touch, setTouch] = useState(false);
  /*
   * Mirrored in a ref because `startBlow` is read through a callback that was
   * created before the switch. Calling `breatheIn()` in the same tick as
   * `setTouch(true)` runs the version of `startBlow` that still believes there
   * is a microphone, so it schedules the listening timer, drains an empty meter
   * four seconds later and reports that it did not feel a breath — while the
   * child is still holding the screen.
   */
  const touchRef = useRef(false);
  const pressedAt = useRef(0);

  const clear = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }, []);

  useEffect(() => clear, [clear]);

  /** Shared by both inputs, so the outcome cannot drift between them. */
  const judge = useCallback((breath: ReturnType<typeof detectBreath>) => {
    if (breath.isBreath) {
      setLit((n) => {
        const left = Math.max(0, n - 1);
        // Descending, so the room audibly settles rather than celebrates.
        playChime({ step: left, velocity: 0.5, calm: true });
        return left;
      });
    } else {
      // Never a failure, only a hint. A shout is the wrong shape, not a loss.
      setNudge(
        breath.frames === 0
          ? 'Lumi did not feel a breath. Try a long, soft one.'
          : 'A bit longer and softer — like blowing a dandelion.',
      );
    }
    setPhase('blown');
  }, []);

  const startBlow = useCallback(() => {
    setPhase('blow');
    setNudge(null);
    if (touchRef.current) return; // The child's press ends this turn, not a timer.
    meter.drain();
    timers.current.push(window.setTimeout(() => judge(detectBreath(meter.drain())), 4200));
  }, [meter, touch, judge]);

  const breatheIn = useCallback(() => {
    setPhase('breathe-in');
    setCountdown(IN_BREATH);
    for (let i = 1; i <= IN_BREATH; i++) {
      timers.current.push(window.setTimeout(() => setCountdown(IN_BREATH - i), i * 1000));
    }
    timers.current.push(window.setTimeout(startBlow, IN_BREATH * 1000));
  }, [startBlow]);

  // Move on once a lantern is out, or finish when the room is dark.
  useEffect(() => {
    if (phase !== 'blown') return;
    const t = window.setTimeout(() => {
      if (lit <= 0) {
        recordSettledNight(profile.id);
        setPhase('done');
      } else {
        breatheIn();
      }
    }, 2200);
    return () => window.clearTimeout(t);
  }, [phase, lit, breatheIn, profile.id]);

  async function begin() {
    await meter.start();
    breatheIn();
  }

  const dark = 1 - lit / LANTERNS;

  if (phase === 'intro') {
    return (
      <div className="page stack">
        <header className="row row--between">
          <button className="btn btn--sm btn--ghost" onClick={onExit}>&larr; Games</button>
        </header>
        <Mascot size={160} mood="soft" />
        <section className="glass stack" style={{ padding: 'var(--sp-4)', textAlign: 'center' }}>
          <p className="eyebrow">Lantern Breath</p>
          <h1 className="h1">Blow out the lanterns, one at a time.</h1>
          <p className="muted">
            Breathe in while the lantern glows. Then blow, slowly and softly, like blowing a
            dandelion. Not a shout &mdash; a long quiet breath.
          </p>
          <p className="tiny">
            Five lanterns, about two minutes. Lumi measures how steady the sound is and nothing
            else. No recording is made and nothing leaves this device.
          </p>
          <button className="btn btn--primary btn--block" onClick={begin}>Begin</button>
        </section>
      </div>
    );
  }

  /*
   * No microphone is not the end of the game.
   *
   * This screen used to be a wall — "Lumi can't hear right now" and a button
   * back to the menu — which meant a refused permission, a device without a
   * microphone, or an embedded page where `getUserMedia` is blocked outright
   * all made the app's one calming game unplayable. The breathing is the point;
   * the microphone was only ever how we noticed it.
   */
  if (!touch && (meter.state === 'denied' || meter.state === 'unsupported' || meter.state === 'unavailable')) {
    return (
      <div className="page stack">
        <Mascot size={148} mood="soft" />
        <section className="glass stack" style={{ padding: 'var(--sp-4)' }}>
          <h1 className="h1">Lumi can&rsquo;t hear right now.</h1>
          <p className="muted">
            That&rsquo;s alright &mdash; you can hold the screen instead. Breathe out for as long
            as you can while you hold it, and let go when you run out.
          </p>
          <button
            className="btn btn--primary btn--block"
            onClick={() => { touchRef.current = true; setTouch(true); breatheIn(); }}
          >
            Hold the screen instead
          </button>
          <button className="btn btn--ghost btn--block" onClick={onExit}>Back to games</button>
        </section>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className="page stack" style={{ justifyContent: 'center' }}>
        <Mascot size={172} mood="sleepy" />
        <section className="glass stack" style={{ padding: 'var(--sp-4)', textAlign: 'center' }}>
          <h1 className="h1">All out.</h1>
          <p className="muted">Goodnight, {profile.name}.</p>
          <p className="tiny">There is deliberately nothing else on this screen.</p>
        </section>
        <button className="btn btn--ghost btn--block" onClick={onExit}>Close</button>
      </div>
    );
  }

  return (
    <div className="page stack breath" style={{ ['--dark' as string]: dark }}>
      <header className="row row--between">
        <button className="btn btn--sm btn--ghost" onClick={onExit}>&larr; Games</button>
        <span className="badge">{lit} left</span>
      </header>

      <div className="breath__lanterns" aria-hidden="true">
        {Array.from({ length: LANTERNS }, (_, i) => (
          <span
            key={i}
            className={`breath__lantern${i < lit ? ' breath__lantern--lit' : ''}${
              i === lit - 1 && phase === 'breathe-in' ? ' breath__lantern--swelling' : ''
            }`}
          >
            🏮
          </span>
        ))}
      </div>

      <section className="glass stack" style={{ padding: 'var(--sp-4)', textAlign: 'center' }}>
        {phase === 'breathe-in' && (
          <>
            <p className="eyebrow">Breathe in</p>
            <h1 className="h1 breath__count">{countdown || 'now blow'}</h1>
          </>
        )}
        {phase === 'blow' && !touch && (
          <>
            <p className="eyebrow">Blow</p>
            <h1 className="h1">Long and soft&hellip;</h1>
            <div className="breath__bar" aria-hidden="true">
              <div className="breath__bar-fill" style={{ width: `${Math.round(meter.level * 100)}%` }} />
            </div>
          </>
        )}
        {phase === 'blow' && touch && (
          <>
            <p className="eyebrow">Blow</p>
            <h1 className="h1">Hold, and breathe out&hellip;</h1>
            {/*
              Press and release rather than tap. The held duration is turned
              into the level stream a breath would have made and scored by the
              same detector, so holding briefly still does not count — the rule
              that a breath has to be sustained is not relaxed for touch.
            */}
            <button
              className="btn btn--primary btn--block breath__hold"
              onPointerDown={() => { pressedAt.current = performance.now(); }}
              onPointerUp={() => {
                if (!pressedAt.current) return;
                const held = (performance.now() - pressedAt.current) / 1000;
                pressedAt.current = 0;
                judge(detectBreath(pressSamples(held, BREATH_LEVEL)));
              }}
              onPointerLeave={() => {
                if (!pressedAt.current) return;
                const held = (performance.now() - pressedAt.current) / 1000;
                pressedAt.current = 0;
                judge(detectBreath(pressSamples(held, BREATH_LEVEL)));
              }}
            >
              Hold me while you breathe out
            </button>
          </>
        )}
        {phase === 'blown' && (
          <>
            <h1 className="h1">{nudge ? 'Nearly' : 'One out.'}</h1>
            <p className="muted">{nudge ?? 'Lovely. Let\u2019s do the next one.'}</p>
          </>
        )}
        {state.settings.dimming && <p className="tiny">The room gets darker each time.</p>}
      </section>
    </div>
  );
}
