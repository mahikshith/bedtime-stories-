import { useCallback, useMemo, useState } from 'react';
import { Mascot } from '../Mascot';
import { playChime, playRun, playThud } from '../../engine/gameAudio';
import { clearLevel, gameLevel } from '../../state/store';
import { RHYMES } from '../../content/rhymes';
import { buildRhymeIndex, buildRhymeQuestion, wordsRhyme } from '../../engine/rhyme';
import { Narrator, isNarrationSupported } from '../../engine/narration';
import { useAppState } from '../../state/store';

const INDEX = buildRhymeIndex(RHYMES);
const ROUNDS = 8;

/**
 * Rhyme Race — the rhyme corpus turned into a game.
 *
 * Reuses the same declared rhyme groups the rhyme player uses, so the answers
 * are correct by construction rather than by a spelling heuristic. Touch input,
 * quiet, so it is the voice-free option when a child cannot shout.
 */
export function RhymeRace({ onExit }: { onExit: () => void }) {
  const state = useAppState();
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const narrator = useMemo(() => new Narrator(), []);

  const question = useMemo(() => {
    const rhyme = RHYMES[seed % RHYMES.length];
    return buildRhymeQuestion(rhyme, RHYMES, seed);
  }, [seed]);

  const say = useCallback(
    (text: string) => {
      if (!state.settings.narration || !isNarrationSupported()) return;
      narrator.speak(text, {
        persona: state.settings.voicePersona,
        pace: 'slow',
        calm: 0,
      });
    },
    [narrator, state.settings],
  );

  if (!question) {
    return (
      <div className="page stack">
        <button className="btn btn--primary btn--block" onClick={onExit}>Back to games</button>
      </div>
    );
  }

  const correct = picked !== null && wordsRhyme(picked, question.target, INDEX);

  function choose(option: string) {
    if (picked) return;
    setPicked(option);
    const right = wordsRhyme(option, question!.target, INDEX);
    if (right) {
      setScore((s) => s + 1);
      // Each correct answer climbs the scale, so a run of them is an ascending
      // phrase rather than the same ping five times.
      playChime({ step: score + 1, velocity: 0.8 });
    } else {
      // A wrong answer is a soft, low sound, never a buzzer: there is no fail
      // state here and the audio must not invent one.
      playThud({ velocity: 0.35 });
    }
  }

  function next() {
    setPicked(null);
    if (round + 1 >= ROUNDS) {
      setRound(ROUNDS);
      playRun(Math.max(2, score), { step: 2, velocity: 0.7 });
      clearLevel('rhyme-race', gameLevel('rhyme-race'), score);
      return;
    }
    setRound((r) => r + 1);
    setSeed(Math.floor(Math.random() * 1e9));
  }

  if (round >= ROUNDS) {
    return (
      <div className="page stack">
        <Mascot size={172} mood="happy" autoHop />
        <section className="glass stack" style={{ padding: 'var(--sp-4)', textAlign: 'center' }}>
          <p className="eyebrow">Rhyme Race</p>
          <h1 className="h1">{score} of {ROUNDS} caught.</h1>
          <p className="muted">Rhyming is one of the best things you can practise.</p>
        </section>
        <button
          className="btn btn--primary btn--block"
          onClick={() => { setRound(0); setScore(0); setPicked(null); setSeed(Math.floor(Math.random() * 1e9)); }}
        >
          Play again
        </button>
        <button className="btn btn--ghost btn--block" onClick={onExit}>Back to games</button>
      </div>
    );
  }

  return (
    <div className="page stack">
      <header className="row row--between">
        <button className="btn btn--sm btn--ghost" onClick={onExit}>&larr; Games</button>
        <span className="badge">{round + 1} of {ROUNDS}</span>
      </header>

      <div className="story__progress" aria-hidden="true">
        {Array.from({ length: ROUNDS }, (_, i) => (
          <span key={i} className={`story__tick${i <= round ? ' story__tick--on' : ''}`} />
        ))}
      </div>

      <Mascot size={128} mood={picked ? (correct ? 'happy' : 'soft') : 'awake'} autoHop={correct} />

      <section className="glass stack" style={{ padding: 'var(--sp-4)', textAlign: 'center' }}>
        <p className="eyebrow">Which one rhymes with</p>
        <button className="leap__word" onClick={() => say(question.target)}>
          {question.target}
        </button>
        <p className="tiny">Tap the word to hear it again.</p>

        <div className="row" style={{ justifyContent: 'center' }}>
          {question.options.map((option) => {
            const isAnswer = wordsRhyme(option, question.target, INDEX);
            const show = picked !== null;
            return (
              <button
                key={option}
                className="chip"
                aria-pressed={picked === option}
                style={
                  show && isAnswer
                    ? { outline: '3px solid var(--mint-400)' }
                    : show && picked === option
                      ? { opacity: 0.5 }
                      : undefined
                }
                onClick={() => { choose(option); say(option); }}
              >
                {option}
              </button>
            );
          })}
        </div>

        {picked && (
          <>
            <p className="h2">
              {correct
                ? `Yes! ${question.target} and ${picked} rhyme.`
                : `${question.answer} was the one that rhymes.`}
            </p>
            <button className="btn btn--primary btn--block" onClick={next}>
              {round + 1 >= ROUNDS ? 'Finish' : 'Next'}
            </button>
          </>
        )}
      </section>
    </div>
  );
}
