import { useEffect, useMemo, useRef, useState } from 'react';
import { Mascot } from './Mascot';
import { Narrator, isNarrationSupported } from '../engine/narration';
import type { Story, World } from '../engine/types';
import { useAppState } from '../state/store';

interface StoryPlayerProps {
  story: Story;
  world: World;
  onCalmChange: (calm: number) => void;
  onExit: () => void;
  onSettled: () => void;
}

/** Renders *emphasis* without shipping a markdown parser to a bedtime app. */
function Emphasised({ text }: { text: string }) {
  const parts = text.split(/(\*[^*]+\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('*') && part.endsWith('*') && part.length > 2 ? (
          <em key={i}>{part.slice(1, -1)}</em>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

export function StoryPlayer({ story, world, onCalmChange, onExit, onSettled }: StoryPlayerProps) {
  const state = useAppState();
  const [index, setIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const [narrating, setNarrating] = useState(state.settings.narration);
  const narrator = useRef<Narrator>(new Narrator());

  const page = story.pages[index];
  const isLast = index === story.pages.length - 1;
  const calm = finished ? 1 : page.calm;

  useEffect(() => {
    onCalmChange(calm);
  }, [calm, onCalmChange]);

  // Narration follows the sleep gradient: the voice slows as the story settles.
  useEffect(() => {
    const n = narrator.current;
    if (!narrating || finished) {
      n.stop();
      return;
    }
    n.speak(page.text, {
      calm: page.calm,
      persona: state.settings.voicePersona,
      pace: state.settings.voicePace,
    });
    return () => n.stop();
  }, [index, narrating, finished, page.text, page.calm, state.settings.voicePersona, state.settings.voicePace]);

  useEffect(() => {
    const n = narrator.current;
    return () => n.stop();
  }, []);

  const mood = useMemo(() => {
    if (calm > 0.7) return 'sleepy' as const;
    if (calm > 0.3) return 'soft' as const;
    return 'awake' as const;
  }, [calm]);

  function advance() {
    if (isLast) {
      setFinished(true);
      return;
    }
    setIndex((i) => i + 1);
  }

  if (finished) {
    return (
      <div className="story">
        <Mascot size={172} mood="sleepy" />

        <section className="realwindow stack" aria-labelledby="realwindow-title">
          <p className="eyebrow">The Real Window &mdash; one true thing</p>
          <h2 className="h2" id="realwindow-title">{story.realWindow.title}</h2>
          <p className="muted">{story.realWindow.fact}</p>
          <p className="tiny">{story.realWindow.credit} Public domain.</p>
        </section>

        <div className="stack">
          <button className="btn btn--primary btn--block" onClick={onSettled}>
            They&rsquo;re asleep &mdash; goodnight
          </button>
          <button className="btn btn--ghost btn--block" onClick={onExit}>
            Back to the map
          </button>
          <p className="tiny" style={{ textAlign: 'center' }}>
            There is deliberately no &ldquo;next episode&rdquo; button here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="story">
      <header className="story__header">
        <button className="btn btn--sm btn--ghost" onClick={onExit}>&larr;<span className="sr-only"> Back to map</span></button>
        <span className="badge">
          {world.emoji} {world.name} &middot; {story.episode + 1}
        </span>
        {isNarrationSupported() ? (
          <button
            className="btn btn--sm btn--ghost"
            aria-pressed={narrating}
            onClick={() => setNarrating((v) => !v)}
          >
            {narrating ? '🔈 Reading' : '🔇 Silent'}
          </button>
        ) : (
          <span className="badge">Silent</span>
        )}
      </header>

      <div className="story__progress" aria-hidden="true">
        {story.pages.map((_, i) => (
          <span key={i} className={`story__tick${i <= index ? ' story__tick--on' : ''}`} />
        ))}
      </div>

      <div className="story__page grow" key={index}>
        <h1 className="h2" style={{ opacity: index === 0 ? 1 : 0.4, marginBottom: 'var(--sp-3)' }}>
          {story.title}
        </h1>
        <p className="story__text" style={{ opacity: 1 - calm * 0.18 }}>
          <Emphasised text={page.text} />
        </p>
      </div>

      <Mascot size={124} mood={mood} hopping={false} autoHop={calm < 0.3} />

      <button className="btn btn--primary btn--block" onClick={advance}>
        {isLast ? 'Goodnight' : 'Turn the page'}
      </button>

      <p className="tiny" style={{ textAlign: 'center' }}>
        {story.origin === 'spark' ? 'Made just now, just for you.' : 'From the library · works offline'}
        {' · '}
        {story.wordCount} words
      </p>
    </div>
  );
}
