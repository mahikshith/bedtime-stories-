import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Mascot } from './Mascot';
import { Narrator, isNarrationSupported, rateFor } from '../engine/narration';
import {
  buildRhymeQuestion,
  clozeFor,
  estimateTimings,
  personalizeRhyme,
  tokenize,
  totalDuration,
  wordsRhyme,
  buildRhymeIndex,
} from '../engine/rhyme';
import { RHYMES } from '../content/rhymes';
import { getCompanion } from '../content/companions';
import type { ChildProfile, Rhyme } from '../engine/types';
import { markRhymeRecited, useAppState } from '../state/store';
import { getWorld } from '../content/worlds';

interface RhymePlayerProps {
  rhyme: Rhyme;
  profile: ChildProfile;
  onExit: () => void;
}

const RHYME_INDEX = buildRhymeIndex(RHYMES);

export function RhymePlayer({ rhyme: raw, profile, onExit }: RhymePlayerProps) {
  const state = useAppState();
  const companion = getCompanion(profile.companionId);

  const rhyme = useMemo(
    () =>
      personalizeRhyme(raw, {
        child: profile.name,
        pronouns: profile.pronouns,
        companion: companion.name,
        companionSpecies: companion.species,
        trait: companion.trait,
        world: raw.worldId ? getWorld(raw.worldId).name : 'the Sleepy Worlds',
        place: '', place2: '', guide: '', wonder: '', wonder2: '',
        obstacle: '', gentle: '', sound: '', sound2: '', treasure: '', interest: '',
      }),
    [raw, profile, companion],
  );

  const [lineIndex, setLineIndex] = useState(0);
  const [wordIndex, setWordIndex] = useState(-1);
  const [awaitingCloze, setAwaitingCloze] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [done, setDone] = useState(false);

  const narrator = useRef(new Narrator());
  const timers = useRef<number[]>([]);

  const line = rhyme.lines[lineIndex];
  const cloze = clozeFor(line);
  const isLast = lineIndex === rhyme.lines.length - 1;

  const clearTimers = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }, []);

  const stop = useCallback(() => {
    clearTimers();
    narrator.current.stop();
    setPlaying(false);
    setWordIndex(-1);
  }, [clearTimers]);

  useEffect(() => {
    const n = narrator.current;
    return () => {
      n.stop();
      timers.current.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  /**
   * Speaks one line and walks the highlight across it.
   *
   * The highlight is driven by syllable-weighted timings rather than speech
   * boundary events, because boundary events are unreliable across Android
   * browsers and a highlight that stalls is worse than one that drifts.
   */
  const speakLine = useCallback(
    (text: string, voice: 'grownup' | 'companion', onDone?: () => void) => {
      clearTimers();
      const persona = voice === 'companion' ? 'kid' : state.settings.voicePersona;
      const settings = { persona, pace: state.settings.voicePace } as const;
      const rate = rateFor(settings, 0);
      const timings = estimateTimings(text, rate);

      timings.forEach((at, i) => {
        timers.current.push(window.setTimeout(() => setWordIndex(i), at));
      });
      timers.current.push(
        window.setTimeout(() => {
          setWordIndex(-1);
          onDone?.();
        }, totalDuration(text, rate) + 120),
      );

      if (state.settings.narration && isNarrationSupported()) {
        narrator.current.speak(text, { ...settings, calm: 0 });
      }
    },
    [clearTimers, state.settings],
  );

  const advance = useCallback(() => {
    if (isLast) {
      markRhymeRecited(profile.id, rhyme.id);
      setDone(true);
      setPlaying(false);
      return;
    }
    setLineIndex((i) => i + 1);
    setRevealed(false);
    setAwaitingCloze(false);
  }, [isLast, profile.id, rhyme.id]);

  // Play the current line: speak the run-up, then wait for the child on a cloze.
  useEffect(() => {
    if (!playing || done) return;
    const voice = line.voice === 'companion' ? 'companion' : 'grownup';
    const spoken = cloze ? cloze.prefix : line.text;
    speakLine(spoken, voice, () => {
      if (cloze && !revealed) {
        setAwaitingCloze(true);
        return;
      }
      window.setTimeout(advance, 420);
    });
    return clearTimers;
    // Re-runs when the line changes or the child fills in the blank.
  }, [playing, lineIndex, revealed, done]); // eslint-disable-line react-hooks/exhaustive-deps

  function reveal() {
    if (!cloze) return;
    setAwaitingCloze(false);
    setRevealed(true);
    const voice = line.voice === 'companion' ? 'companion' : 'grownup';
    speakLine(cloze.answer, voice, () => window.setTimeout(advance, 380));
  }

  function start() {
    setDone(false);
    setLineIndex(0);
    setRevealed(false);
    setAwaitingCloze(false);
    setPlaying(true);
  }

  if (done) {
    return <RhymeGame rhyme={rhyme} onAgain={start} onExit={onExit} />;
  }

  const displayText = cloze && !revealed ? cloze.prefix : line.text;
  const tokens = tokenize(displayText);

  return (
    <div className="page">
      <header className="row row--between">
        <button className="btn btn--sm btn--ghost" onClick={() => { stop(); onExit(); }}>
          &larr; Rhymes
        </button>
        <span className="badge">{rhyme.emoji} {rhyme.title}</span>
      </header>

      <div className="story__progress" aria-hidden="true">
        {rhyme.lines.map((_, i) => (
          <span key={i} className={`story__tick${i <= lineIndex ? ' story__tick--on' : ''}`} />
        ))}
      </div>

      <section
        className="glass rhyme__verse"
        style={{ padding: 'var(--sp-4)', minHeight: '34vh' }}
      >
        {rhyme.lines.map((l, i) => {
          const isCurrent = i === lineIndex;
          if (i > lineIndex) return null;
          const c = clozeFor(l);
          const shown = isCurrent ? displayText : l.text;
          return (
            <p
              key={i}
              className="rhyme__line"
              style={{ opacity: isCurrent ? 1 : 0.34 }}
            >
              {l.voice === 'companion' && (
                <span className="rhyme__who">{companion.name}</span>
              )}
              {isCurrent
                ? tokens.map((t, w) => {
                    // The answer is appended to the line the moment it is
                    // revealed, so the last token is a fresh mount and its
                    // entrance runs once. Everything before it is already on
                    // screen and must not move.
                    const justRevealed = Boolean(c) && revealed && w === tokens.length - 1;
                    return (
                      <span
                        key={w}
                        className={
                          `rhyme__word${w === wordIndex ? ' rhyme__word--on' : ''}` +
                          (justRevealed ? ' rhyme__word--reveal' : '')
                        }
                      >
                        {t.text}{' '}
                      </span>
                    );
                  })
                : <span>{shown} </span>}
              {isCurrent && c && !revealed && (
                <button className="rhyme__blank" onClick={reveal} aria-label="Reveal the word">
                  {awaitingCloze ? 'your turn!' : ' ? '}
                </button>
              )}
            </p>
          );
        })}
      </section>

      {line.action && (
        <p className="badge" style={{ alignSelf: 'flex-start' }}>
          <span aria-hidden="true">{'\u{1F44F}'}</span> {line.action}
        </p>
      )}

      <Mascot size={116} mood={awaitingCloze ? 'happy' : 'awake'} autoHop={awaitingCloze} />

      <div className="row" style={{ gap: 'var(--sp-2)' }}>
        {!playing ? (
          <button className="btn btn--primary grow" onClick={start}>
            {lineIndex === 0 ? '▶️ Say it with me' : '▶️ Keep going'}
          </button>
        ) : (
          <button className="btn grow" onClick={stop}>⏸️ Pause</button>
        )}
        {awaitingCloze && (
          <button className="btn btn--primary grow" onClick={reveal}>
            Show me
          </button>
        )}
      </div>

      <p className="tiny" style={{ textAlign: 'center' }}>
        {rhyme.kind === 'traditional' ? rhyme.provenance : 'An original Lumi rhyme.'}
      </p>
    </div>
  );
}

/** Rhyme matching — the corpus turned into phonological-awareness practice. */
function RhymeGame({ rhyme, onAgain, onExit }: { rhyme: Rhyme; onAgain: () => void; onExit: () => void }) {
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const [picked, setPicked] = useState<string | null>(null);
  const question = useMemo(() => buildRhymeQuestion(rhyme, RHYMES, seed), [rhyme, seed]);

  if (!question) {
    return (
      <div className="page stack">
        <h1 className="h1">Lovely rhyming!</h1>
        <button className="btn btn--primary btn--block" onClick={onExit}>Back to the rhymes</button>
      </div>
    );
  }

  const correct = picked !== null && wordsRhyme(picked, question.target, RHYME_INDEX);

  return (
    <div className="page stack">
      <Mascot size={140} mood={correct ? 'happy' : 'awake'} autoHop={correct} />
      <section className="glass stack" style={{ padding: 'var(--sp-4)', textAlign: 'center' }}>
        <p className="eyebrow">Rhyme time</p>
        <h1 className="h1">Which one rhymes with <em>{question.target}</em>?</h1>
        <div className="row" style={{ justifyContent: 'center' }}>
          {question.options.map((option) => (
            <button
              key={option}
              className="chip"
              aria-pressed={picked === option}
              onClick={() => setPicked(option)}
            >
              {option}
            </button>
          ))}
        </div>
        {picked && (
          <p className="muted">
            {correct
              ? `Yes! ${question.target} and ${picked} rhyme.`
              : `Not quite — ${picked} does not rhyme with ${question.target}. Try another.`}
          </p>
        )}
      </section>

      <button
        className="btn btn--primary btn--block"
        onClick={() => { setPicked(null); setSeed(Math.floor(Math.random() * 1e9)); }}
      >
        Another one
      </button>
      <button className="btn btn--ghost btn--block" onClick={onAgain}>Say the rhyme again</button>
      <button className="btn btn--ghost btn--block" onClick={onExit}>Back to the rhymes</button>
    </div>
  );
}
