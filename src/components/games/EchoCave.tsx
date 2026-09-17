import { useCallback, useEffect, useRef, useState } from 'react';
import { Mascot } from '../Mascot';
import { CompanionSprite, cheerFor } from '../CompanionSprite';
import { useVoiceMeter } from '../../hooks/useVoiceMeter';
import {
  NO_ONSET,
  callSeconds,
  feedLevel,
  patternFor,
  scoreEcho,
  type OnsetState,
} from '../../engine/rhythmEcho';
import { playChime, playPop, playRun } from '../../engine/gameAudio';
import { clearLevel, gameLevel } from '../../state/store';
import type { ChildProfile } from '../../engine/types';

type Phase = 'intro' | 'calling' | 'listening' | 'right' | 'again';

/**
 * Echo Cave — the cave taps a rhythm, and you tap it back.
 *
 * The voice game for a child who will not perform. Lumi's Leap wants a word
 * said clearly and Lantern Breath wants a long breath; both ask a child to be
 * *heard*. This one only wants the timing, so a clap works, a tap on the glass
 * works, and a shy four-year-old can play it without saying anything at all.
 *
 * There is no wrong answer, only a cave that is happy to go again. An echo that
 * misses replays the same pattern; the level never drops and nothing is lost.
 */
export function EchoCave({ profile, onExit }: { profile: ChildProfile; onExit: () => void }) {
  const meter = useVoiceMeter();
  /*
   * Frozen for the round. Deriving it from the store meant `clearLevel` swapped
   * the pattern for the next level's the moment the child got one right, so the
   * dots under "the cave heard you exactly" were a rhythm they had never heard.
   */
  const [level, setLevel] = useState(() => gameLevel('echo-cave'));
  const pattern = patternFor(level);

  const [phase, setPhase] = useState<Phase>('intro');
  const [beat, setBeat] = useState(-1);
  const [taps, setTaps] = useState<number[]>([]);

  const onset = useRef<OnsetState>(NO_ONSET);
  const heard = useRef<number[]>([]);
  const frame = useRef(0);
  const timers = useRef<number[]>([]);
  const started = useRef(0);

  const clearTimers = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }, []);

  useEffect(() => () => { clearTimers(); cancelAnimationFrame(frame.current); }, [clearTimers]);

  /** Judges what was heard. Split out so both paths land in the same place. */
  const judge = useCallback(() => {
    cancelAnimationFrame(frame.current);
    const result = scoreEcho(pattern, heard.current);
    setTaps(heard.current);
    if (result.ok) {
      playRun(pattern.length, { step: 2 });
      clearLevel('echo-cave', level, pattern.length);
      setPhase('right');
    } else {
      setPhase('again');
    }
  }, [pattern, level]);

  const listen = useCallback(() => {
    onset.current = NO_ONSET;
    heard.current = [];
    started.current = performance.now();
    setTaps([]);
    setPhase('listening');

    const poll = () => {
      // The meter's own stream, drained rather than sampled: a rhythm judged on
      // whatever React last rendered is a rhythm judged a frame or two late.
      for (const sample of meter.drain()) {
        const t = (performance.now() - started.current) / 1000;
        const r = feedLevel(onset.current, sample, t);
        onset.current = r.state;
        if (r.onset !== null) {
          heard.current = [...heard.current, r.onset];
          setTaps(heard.current);
          playPop({ velocity: 0.45 });
          if (heard.current.length >= pattern.length) {
            // One beat of grace before judging, so an extra clap still counts
            // against the child as an extra rather than being missed entirely.
            timers.current.push(window.setTimeout(judge, 700));
            return;
          }
        }
      }
      frame.current = requestAnimationFrame(poll);
    };

    meter.drain();
    frame.current = requestAnimationFrame(poll);
    // A child who says nothing is not failing; the cave just calls again.
    timers.current.push(window.setTimeout(judge, (callSeconds(pattern) + 4) * 1000));
  }, [meter, pattern, judge]);

  const call = useCallback(() => {
    clearTimers();
    setLevel(gameLevel('echo-cave'));
    setPhase('calling');
    setBeat(-1);
    pattern.forEach((at, i) => {
      timers.current.push(
        window.setTimeout(() => {
          setBeat(i);
          playChime({ step: i, velocity: 0.7, calm: true });
        }, at * 1000),
      );
    });
    timers.current.push(window.setTimeout(() => { setBeat(-1); listen(); }, callSeconds(pattern) * 1000));
  }, [pattern, listen, clearTimers]);

  const begin = useCallback(async () => {
    await meter.start();
    call();
  }, [meter, call]);

  const live = meter.state === 'live';
  const blocked = meter.state === 'denied' || meter.state === 'unsupported' || meter.state === 'unavailable';

  return (
    <div className="page">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <button className="btn btn--sm btn--ghost" onClick={onExit}>&#8592; Games</button>
        <span className="badge">Level {level} of 5</span>
      </div>

      <div className="glass stack" style={{ padding: 'var(--sp-3)', gap: 'var(--sp-2)' }}>
        <p className="eyebrow">Echo Cave</p>
        <h1 className="h1">
          {phase === 'calling' && 'Listen…'}
          {phase === 'listening' && 'Now you.'}
          {phase === 'right' && 'The cave heard you exactly.'}
          {phase === 'again' && 'Close. The cave will do it again.'}
          {phase === 'intro' && 'The cave taps. You tap it back.'}
        </h1>
        <p className="tiny">
          Clap it, say it, or tap the glass &mdash; the cave only listens for <em>when</em>, never
          for what. Nothing is recorded and nothing leaves this phone.
        </p>
      </div>

      <div className="echocave" aria-hidden="true">
        {pattern.map((_, i) => (
          <span
            key={i}
            className={[
              'echocave__beat',
              beat === i ? 'is-calling' : '',
              taps.length > i ? 'is-echoed' : '',
            ].join(' ')}
          />
        ))}
      </div>

      <div className="row" style={{ justifyContent: 'center', gap: 'var(--sp-3)' }}>
        <CompanionSprite
          companionId={profile.companionId}
          mood={phase === 'right' ? 'cheering' : 'watching'}
          cheer={phase === 'right' ? 1 : 0}
          says={phase === 'right' ? cheerFor(profile.companionId, level) : null}
        />
        <Mascot
          size={120}
          mood={phase === 'right' ? 'proud' : phase === 'listening' ? 'curious' : 'happy'}
          autoHop={phase === 'right'}
        />
      </div>

      {blocked && phase !== 'right' && phase !== 'again' && (
        <p className="tiny">
          The microphone isn&rsquo;t available, so tap to echo instead &mdash; the cave
          can&rsquo;t tell the difference.
        </p>
      )}

      {phase === 'listening' && (
        <button
          className="btn btn--block btn--ghost echocave__drum"
          onClick={() => {
            const t = (performance.now() - started.current) / 1000;
            heard.current = [...heard.current, t];
            setTaps(heard.current);
            playPop({ velocity: 0.45 });
            if (heard.current.length >= pattern.length) {
              timers.current.push(window.setTimeout(judge, 700));
            }
          }}
        >
          Tap here to echo
        </button>
      )}

      {phase === 'intro' && (
        <button className="btn btn--primary btn--block" onClick={() => void begin()}>
          {live ? 'Play the rhythm' : 'Start listening'}
        </button>
      )}

      {(phase === 'right' || phase === 'again') && (
        <button className="btn btn--primary btn--block" onClick={call}>
          {phase === 'right' ? (level >= 5 ? 'Again' : 'Next rhythm') : 'Hear it again'}
        </button>
      )}
    </div>
  );
}
