import { MODES, PILLARS, currentMode, isEncouraged, type Pillar } from '../engine/dayArc';
import { MascotBuddy } from './MascotBuddy';
import { getCompanion } from '../content/companions';
import { RHYMES } from '../content/rhymes';
import { SCENES } from '../content/colouring';
import { ALL_LETTERS } from '../content/phonics';
import { GAMES } from '../content/games';
import { WORLDS } from '../content/worlds';
import {
  activeProfile,
  progressFor,
  setActiveProfile,
  useAppState,
} from '../state/store';

interface TodayProps {
  onOpenPillar: (pillar: Pillar) => void;
  onOpenParent: () => void;
  /** Override for the parent-zone preview and for tests. */
  now?: Date;
}

/**
 * The day arc.
 *
 * One app that knows what time it is: it offers different things in the morning
 * than at bedtime, and says so. Nothing is ever locked — a locked app at 7pm
 * starts an argument — but wind-down stops *offering* the lively pillars.
 */
export function Today({ onOpenPillar, onOpenParent, now }: TodayProps) {
  const state = useAppState();
  const profile = activeProfile(state);
  const mode = MODES[currentMode(now)];

  if (!profile) return null;
  const companion = getCompanion(profile.companionId);
  const mine = progressFor(state, profile.id);
  const storiesHeard = Object.values(mine.stories).reduce((n, l) => n + l.length, 0);

  // Progress is shown as "3 of 22", never as a streak or a score. It tells a
  // parent what is left to explore; it is not there to pull anyone back in.
  const done: Record<Pillar, number> = {
    rhymes: mine.rhymes.length,
    stories: storiesHeard,
    learn: mine.letters.length,
    create: mine.printed.length,
    games: mine.games.length,
  };
  const total: Record<Pillar, number> = {
    rhymes: RHYMES.length,
    stories: WORLDS.reduce((n, w) => n + w.episodeCount, 0),
    learn: ALL_LETTERS.length,
    create: SCENES.length,
    games: GAMES.filter((g) => g.status === 'playable').length,
  };

  return (
    <div className="page">
      <header className="row row--between">
        <div className="map__greeting" style={{ minWidth: 0 }}>
          <p className="eyebrow" style={{ margin: 0 }}>
            {mode.greeting} &middot; {mode.label}
          </p>
          <h1 className="h2">{profile.name} &amp; {companion.name}</h1>
        </div>
        <button className="btn btn--sm btn--ghost" onClick={onOpenParent}>
          <span aria-hidden="true">&#9881;&#65039;</span> Parents
        </button>
      </header>

      {state.profiles.length > 1 && (
        <div className="row" role="group" aria-label="Choose a child">
          {state.profiles.map((p) => (
            <button
              key={p.id}
              className="chip"
              aria-pressed={p.id === profile.id}
              onClick={() => setActiveProfile(p.id)}
            >
              <span aria-hidden="true">{getCompanion(p.companionId).emoji}</span> {p.name}
            </button>
          ))}
        </div>
      )}

      <section className="glass stack" style={{ padding: 'var(--sp-4)' }}>
        <p className="eyebrow">Right now</p>
        <h2 className="h1">{mode.intent}</h2>
        {mode.id === 'winddown' && (
          <p className="tiny">
            It is getting late, so Lumi is only suggesting the quiet things. Everything else is
            still here if you want it.
          </p>
        )}
      </section>

      <div className="buddy-stage">
        <MascotBuddy size={128} mood="happy" settled={mode.id === 'winddown'} />
      </div>

      <section className="stack" aria-label="What we can do">
        {mode.order.map((id) => {
          const pillar = PILLARS[id];
          const encouraged = isEncouraged(mode.id, id);
          return (
            <button
              key={id}
              className="map__node"
              style={{ opacity: encouraged ? 1 : 0.46 }}
              onClick={() => onOpenPillar(id)}
            >
              <span className="map__orb" aria-hidden="true">{pillar.emoji}</span>
              <span className="grow">
                <span className="h2" style={{ display: 'block' }}>{pillar.label}</span>
                <span className="tiny">{pillar.blurb}</span>
                {done[id] > 0 && (
                  <span className="tiny" style={{ display: 'block', marginTop: 4 }}>
                    {done[id]} of {total[id]}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </section>

      <p className="tiny" style={{ textAlign: 'center' }}>
        {storiesHeard === 0
          ? 'Everything here works with no signal at all.'
          : `${profile.name} has heard ${storiesHeard} ${storiesHeard === 1 ? 'story' : 'stories'} and ${mine.rhymes.length} ${mine.rhymes.length === 1 ? 'rhyme' : 'rhymes'}. No streaks — missing a day costs nothing.`}
      </p>
    </div>
  );
}
