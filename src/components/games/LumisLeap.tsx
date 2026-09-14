import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Mascot } from '../Mascot';
import { useVoiceMeter } from '../../hooks/useVoiceMeter';
import { countSyllables, scoreAttempt, targetForWord } from '../../engine/voiceMeter';
import { wordsForAge, type WordCard } from '../../content/games';
import { makeRng, pick } from '../../engine/rng';
import type { ChildProfile } from '../../engine/types';

export type LeapMode = 'leap' | 'syllable';

interface LumisLeapProps {
  profile: ChildProfile;
  /** 'leap' rewards one big voice; 'syllable' wants one hop per beat. */
  mode: LeapMode;
  onExit: () => void;
}

type Phase = 'intro' | 'ready' | 'listening' | 'result' | 'done';

const ROUNDS = 6;

/**
 * Lumi's Leap.
 *
 * Volume drives the jump, the way the genre does — Scream Go Hero reads
 * decibels rather than recognising words, which is why it responds in
 * milliseconds. We do the same, and never record.
 *
 * The syllable mode exists because volume alone teaches the wrong thing: a
 * child can shout "aaah" and clear every platform without ever saying the word.
 * Requiring one burst per syllable makes "but-ter-fly" three real efforts, and
 * syllable segmentation is an actual phonological-awareness skill rather than
 * a party trick.
 *
 * There is no "game over". Missing a platform costs nothing but another go —
 * a four-year-old practising a new word should never be punished for trying.
 */
export function LumisLeap({ profile, mode, onExit }: LumisLeapProps) {
  const meter = useVoiceMeter();
  const [phase, setPhase] = useState<Phase>('intro');
  const [round, setRound] = useState(0);
  const [landed, setLanded] = useState(0);
  const [peak, setPeak] = useState(0);
  const [bursts, setBursts] = useState(0);
  const [success, setSuccess] = useState(false);

  const age = Number(profile.ageBand.split('-')[0]);
  const words = useMemo(() => wordsForAge(age), [age]);
  const rng = useRef(makeRng(Date.now() >>> 0));
  const [card, setCard] = useState<WordCard>(() => words[0]);

  const syllables = countSyllables(card.word);
  const targetLevel = targetForWord(syllables, mode);

  const nextCard = useCallback(() => {
    setCard(pick(rng.current, words));
  }, [words]);

  const listenTimer = useRef<number | undefined>(undefined);

  const evaluate = useCallback(() => {
    const result = scoreAttempt({
      levels: meter.drain(),
      mode,
      syllables,
      target: targetLevel,
    });
    setPeak(result.peak);
    setBursts(result.bursts);
    setSuccess(result.landed);
    if (result.landed) setLanded((n) => n + 1);
    setPhase('result');
  }, [meter, mode, syllables, targetLevel]);

  const listen = useCallback(() => {
    meter.drain();
    setPhase('listening');
    window.clearTimeout(listenTimer.current);
    // A fixed window keeps the turn short and the rhythm brisk for a small child.
    listenTimer.current = window.setTimeout(evaluate, 2600);
  }, [meter, evaluate]);

  useEffect(() => () => window.clearTimeout(listenTimer.current), []);

  function advance() {
    if (round + 1 >= ROUNDS) return setPhase('done');
    setRound((r) => r + 1);
    nextCard();
    setPhase('ready');
  }

  async function begin() {
    await meter.start();
    nextCard();
    setPhase('ready');
  }

  if (phase === 'intro') {
    return (
      <div className="page stack">
        <header className="row row--between">
          <button className="btn btn--sm btn--ghost" onClick={onExit}>&larr; Games</button>
        </header>
        <Mascot size={172} mood="happy" autoHop />
        <section className="glass stack" style={{ padding: 'var(--sp-4)', textAlign: 'center' }}>
          <p className="eyebrow">{mode === 'syllable' ? 'Syllable Hop' : "Lumi's Leap"}</p>
          <h1 className="h1">
            {mode === 'syllable'
              ? 'One hop for every beat in the word.'
              : 'Say the word to make Lumi hop.'}
          </h1>
          <p className="muted">
            {mode === 'syllable'
              ? 'But-ter-fly is three hops. Clap it out first if you like.'
              : 'A bigger voice makes a bigger hop. Nobody can lose.'}
          </p>
          <p className="tiny">
            Lumi listens to how loud you are and nothing else. No recording is made, nothing is
            saved, and nothing leaves this device.
          </p>
          <button className="btn btn--primary btn--block" onClick={begin}>
            Let&rsquo;s play
          </button>
        </section>
      </div>
    );
  }

  if (meter.state === 'unsupported' || meter.state === 'denied' || meter.state === 'unavailable') {
    return (
      <div className="page stack">
        <Mascot size={148} mood="soft" />
        <section className="glass stack" style={{ padding: 'var(--sp-4)' }}>
          <h1 className="h1">Lumi can&rsquo;t hear right now.</h1>
          <p className="muted">
            {meter.state === 'denied'
              ? 'The microphone is switched off for this app. A grown-up can turn it back on in the browser or phone settings.'
              : meter.state === 'unavailable'
                ? 'Something else may be using the microphone. Closing other apps usually fixes it.'
                : 'This device has no microphone available.'}
          </p>
          <p className="tiny">
            The voice games need it to measure how loud you are. Every other part of the app works
            without it.
          </p>
          <button className="btn btn--primary btn--block" onClick={onExit}>Pick another game</button>
        </section>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className="page stack">
        <Mascot size={172} mood="happy" autoHop />
        <section className="glass stack" style={{ padding: 'var(--sp-4)', textAlign: 'center' }}>
          <p className="eyebrow">Well said</p>
          <h1 className="h1">{landed} of {ROUNDS} hops landed.</h1>
          <p className="muted">
            {landed === ROUNDS
              ? 'Every single one. That is a very good voice.'
              : 'Lumi had a lovely time either way.'}
          </p>
        </section>
        <button
          className="btn btn--primary btn--block"
          onClick={() => { setRound(0); setLanded(0); nextCard(); setPhase('ready'); }}
        >
          Play again
        </button>
        <button className="btn btn--ghost btn--block" onClick={onExit}>Back to games</button>
      </div>
    );
  }

  const listening = phase === 'listening';
  const barLevel = Math.round(meter.level * 100);

  return (
    <div className="page stack">
      <header className="row row--between">
        <button className="btn btn--sm btn--ghost" onClick={onExit}>&larr; Games</button>
        <span className="badge">Hop {round + 1} of {ROUNDS}</span>
      </header>

      {/* The stage: Lumi on a platform, a gap, then the next platform. */}
      <div className="leap">
        <div className="leap__meter" aria-hidden="true">
          <div className="leap__target" style={{ bottom: `${targetLevel * 100}%` }} />
          <div className="leap__fill" style={{ height: `${barLevel}%` }} />
        </div>

        <div className="leap__stage">
          <div
            className={`leap__hero${phase === 'result' && success ? ' leap__hero--landed' : ''}`}
            style={{ transform: `translateY(${-Math.min(140, meter.level * 190)}px)` }}
          >
            <Mascot size={92} mood={listening ? 'happy' : 'awake'} />
          </div>
          <div className="leap__platform leap__platform--from" />
          <div className="leap__platform leap__platform--to" />
        </div>
      </div>

      <section className="glass stack" style={{ padding: 'var(--sp-4)', textAlign: 'center' }}>
        <p className="eyebrow">
          {meter.state === 'calibrating' ? 'Listening to the room…' : 'Say this word'}
        </p>
        <p className="leap__word">
          <span aria-hidden="true">{card.emoji}</span> {card.word}
        </p>
        {mode === 'syllable' && (
          <p className="muted">
            {Array.from({ length: syllables }, (_, i) => (
              <span key={i} className={`leap__beat${i < bursts ? ' leap__beat--on' : ''}`} />
            ))}
            {' '}{syllables} {syllables === 1 ? 'beat' : 'beats'}
          </p>
        )}

        {phase === 'ready' && (
          <button
            className="btn btn--primary btn--block"
            disabled={meter.state !== 'live'}
            onClick={listen}
          >
            {meter.state === 'live' ? "I'm ready" : 'One moment…'}
          </button>
        )}

        {listening && <p className="h2">Go on then — say it!</p>}

        {phase === 'result' && (
          <>
            <p className="h2">
              {success
                ? 'Lumi made it!'
                : mode === 'syllable'
                  ? `Lumi heard ${bursts} of ${syllables}. Try the beats again?`
                  : 'Not quite far enough. A bigger voice this time?'}
            </p>
            <p className="tiny">Loudest: {Math.round(peak * 100)}%</p>
            <button className="btn btn--primary btn--block" onClick={advance}>
              {round + 1 >= ROUNDS ? 'Finish' : 'Next word'}
            </button>
            {!success && (
              <button className="btn btn--ghost btn--block" onClick={listen}>
                Try this word again
              </button>
            )}
          </>
        )}
      </section>
    </div>
  );
}
