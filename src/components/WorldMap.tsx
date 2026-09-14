import { useState } from 'react';
import { MascotBuddy } from './MascotBuddy';
import { Tile } from './Tile';
import { WORLDS } from '../content/worlds';
import type { World } from '../engine/types';
import {
  activeProfile,
  nextEpisodeFor,
  progressFor,
  updateSettings,
  useAppState,
} from '../state/store';

interface WorldMapProps {
  onPick: (world: World, episode: number, short: boolean) => void;
  onOpenParent: () => void;
  onExit: () => void;
}

export function WorldMap({ onPick, onOpenParent, onExit }: WorldMapProps) {
  const state = useAppState();
  const profile = activeProfile(state);
  const [expanded, setExpanded] = useState<string | null>(null);
  const open = expanded ? WORLDS.find((w) => w.id === expanded) ?? null : null;

  if (!profile) return null;

  const mine = progressFor(state, profile.id);
  const totalHeard = Object.values(mine.stories).reduce((n, list) => n + list.length, 0);
  const lastWorldId = state.history[0]?.worldId;
  const tonight = WORLDS.find((w) => w.id === lastWorldId) ?? WORLDS[0];
  const tonightEpisode = nextEpisodeFor(state, profile.id, tonight.id, tonight.episodeCount);

  return (
    <div className="page">
      <header className="row row--between">
        <button className="btn btn--sm btn--ghost" onClick={onExit}>&larr; Today</button>
        <div className="row map__greeting" style={{ gap: 'var(--sp-2)', flexWrap: 'nowrap', minWidth: 0 }}>
          <div style={{ minWidth: 0 }}>
            <h1 className="h2">Stories</h1>
          </div>
        </div>
        <button className="btn btn--sm btn--ghost" onClick={onOpenParent}>
          <span aria-hidden="true">&#9881;&#65039;</span> Parents
        </button>
      </header>

      <section className="glass stack" style={{ padding: 'var(--sp-4)' }}>
        <p className="eyebrow">Tonight</p>
        <h2 className="h1">{tonight.name}</h2>
        <p className="muted">{tonight.blurb}</p>
        <div className="row">
          <button
            className="btn btn--primary grow"
            onClick={() => onPick(tonight, tonightEpisode, state.settings.twoMinute)}
          >
            {tonight.emoji} Episode {tonightEpisode + 1}
          </button>
          <button
            className="btn btn--sm"
            aria-pressed={state.settings.twoMinute}
            onClick={() => updateSettings({ twoMinute: !state.settings.twoMinute })}
          >
            {state.settings.twoMinute ? '⏱️ Two minutes' : '⏱️ Full story'}
          </button>
        </div>
        <p className="tiny">
          {totalHeard === 0
            ? 'No stories heard yet. Every world works offline.'
            : `${totalHeard} ${totalHeard === 1 ? 'story' : 'stories'} heard so far. No streaks here — missing a night costs nothing.`}
        </p>
      </section>

      <div className="buddy-stage">
        <MascotBuddy size={128} mood="happy" />
      </div>

      {/*
        A side-by-side shelf rather than a vertical path. Eighteen worlds as a
        scrolling column looked charming and meant a tired parent scrolled past
        fifteen of them every night; one swipeable row is glanceable, and the
        tile peeking past the edge is what says there is more.
      */}
      <div className="shelf__head">
        <p className="h3">All eighteen worlds</p>
        <span className="shelf__count">swipe &rarr;</span>
      </div>
      <section className="shelf" aria-label="Worlds">
        {WORLDS.map((world, i) => {
          const heard = mine.stories[world.id] ?? [];
          return (
            <Tile
              key={world.id}
              index={i}
              emoji={world.emoji}
              title={world.name}
              subtitle={world.blurb}
              meta={`${heard.length} of ${world.episodeCount} heard`}
              tint={`radial-gradient(circle at 32% 28%, ${world.palette[2]}, ${world.palette[1]} 62%, ${world.palette[0]})`}
              onClick={() => setExpanded(expanded === world.id ? null : world.id)}
            />
          );
        })}
      </section>

      {open && (
        <section className="glass stack" style={{ padding: 'var(--sp-4)' }}>
          <p className="eyebrow">{open.emoji} {open.name}</p>
          <button
            className="btn btn--primary btn--block"
            onClick={() =>
              onPick(open, nextEpisodeFor(state, profile.id, open.id, open.episodeCount), state.settings.twoMinute)
            }
          >
            Next up &mdash; episode{' '}
            {nextEpisodeFor(state, profile.id, open.id, open.episodeCount) + 1}
          </button>
          <div className="row">
            {Array.from({ length: open.episodeCount }, (_, e) => (
              <button
                key={e}
                className="chip"
                aria-pressed={(mine.stories[open.id] ?? []).includes(e)}
                onClick={() => onPick(open, e, state.settings.twoMinute)}
              >
                {e + 1}
              </button>
            ))}
          </div>
          <p className="tiny">
            Any episode, any night, in any order. Nothing is locked and nothing expires.
          </p>
          <button className="btn btn--ghost btn--block" onClick={() => setExpanded(null)}>
            Close
          </button>
        </section>
      )}
    </div>
  );
}
