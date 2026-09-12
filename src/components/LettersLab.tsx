import { useMemo, useRef, useState } from 'react';
import { Mascot } from './Mascot';
import { PHONICS_SETS, type LetterSound } from '../content/phonics';
import { Narrator, isNarrationSupported } from '../engine/narration';
import type { ChildProfile } from '../engine/types';
import { markLetterMet, progressFor, useAppState } from '../state/store';

interface LettersLabProps {
  profile: ChildProfile;
  onExit: () => void;
}

/**
 * Sound first, letter name never.
 *
 * The whole point of a systematic sequence is that the child can read a real
 * word almost immediately, so each set ends on the words it unlocks rather than
 * on a score.
 */
export function LettersLab({ profile, onExit }: LettersLabProps) {
  const state = useAppState();
  const met = new Set(progressFor(state, profile.id).letters);
  const [setIndex, setSetIndex] = useState(0);
  const [active, setActive] = useState<LetterSound | null>(null);
  const narrator = useRef(new Narrator());

  const set = PHONICS_SETS[setIndex];
  const unlockedWords = useMemo(
    () => PHONICS_SETS.slice(0, setIndex + 1).flatMap((s) => s.words),
    [setIndex],
  );

  function say(text: string, letter?: LetterSound) {
    if (letter) {
      setActive(letter);
      markLetterMet(profile.id, letter.letter);
    }
    if (!state.settings.narration || !isNarrationSupported()) return;
    narrator.current.speak(text, {
      persona: state.settings.voicePersona,
      pace: 'slow',
      calm: 0,
    });
  }

  return (
    <div className="page">
      <header className="row row--between">
        <button className="btn btn--sm btn--ghost" onClick={onExit}>&larr; Today</button>
        <span className="badge">Set {set.id} of {PHONICS_SETS.length}</span>
      </header>

      <section className="glass stack" style={{ padding: 'var(--sp-4)' }}>
        <p className="eyebrow">Letters and sounds</p>
        <h1 className="h1">Tap a letter to hear its sound.</h1>
        <p className="tiny">
          These are sounds, not letter names &mdash; &ldquo;sss&rdquo;, not &ldquo;ess&rdquo;.
          That is the order the reading research puts them in, and it is why {profile.name} can
          read a real word by the end of the first set.
        </p>
      </section>

      <div className="letters__grid">
        {set.letters.map((l) => (
          <button
            key={l.letter}
            className={`letters__card${active?.letter === l.letter ? ' letters__card--on' : ''}`}
            onClick={() => say(l.say, l)}
          >
            <span className="letters__glyph">{l.letter}</span>
            <span className="letters__cue">
              <span aria-hidden="true">{l.emoji}</span> {l.cue}
            </span>
            {met.has(l.letter) && <span className="letters__met" aria-label="Met">&#10003;</span>}
          </button>
        ))}
      </div>

      {active && (
        <p className="badge" style={{ alignSelf: 'center' }}>
          <strong>{active.letter}</strong> says &ldquo;{active.sound}&rdquo; &mdash; like {active.cue}
        </p>
      )}

      <Mascot size={112} mood="happy" autoHop={active !== null} />

      <section className="glass stack" style={{ padding: 'var(--sp-4)' }}>
        <p className="eyebrow">Words {profile.name} can read now</p>
        <div className="row">
          {unlockedWords.slice(0, 18).map((word) => (
            <button key={word} className="chip" onClick={() => say(word)}>
              {word}
            </button>
          ))}
        </div>
        {set.sentence && (
          <>
            <hr className="divider" />
            <p className="h3">And a whole sentence:</p>
            <button className="btn btn--primary btn--block" onClick={() => say(set.sentence!)}>
              &ldquo;{set.sentence}&rdquo;
            </button>
          </>
        )}
      </section>

      <div className="row">
        <button
          className="btn grow"
          disabled={setIndex === 0}
          onClick={() => { setSetIndex((i) => i - 1); setActive(null); }}
        >
          {setIndex === 0 ? 'First set' : `\u2190 Set ${set.id - 1}`}
        </button>
        <button
          className="btn btn--primary grow"
          disabled={setIndex === PHONICS_SETS.length - 1}
          onClick={() => { setSetIndex((i) => i + 1); setActive(null); }}
        >
          {setIndex === PHONICS_SETS.length - 1 ? 'Last set' : `Set ${set.id + 1} \u2192`}
        </button>
      </div>
    </div>
  );
}
