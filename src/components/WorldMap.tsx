import { useState } from 'react';
import { MascotBuddy } from './MascotBuddy';
import { WORLDS } from '../content/worlds';
import { getCompanion } from '../content/companions';
import type { World } from '../engine/types';
import { nextEpisodeFor, useAppState, activeProfile, updateSettings } from '../state/store';

interface WorldMapProps {
  onPick: (world: World, episode: number, short: boolean) => void;
  onOpenParent: () => void;
}

export function WorldMap({ onPick, onOpenParent }: WorldMapProps) {
  const state = useAppState();
  const profile = activeProfile(state);
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!profile) return null;
  const companion = getCompanion(profile.companionId);

  const totalHeard = Object.values(state.progress).reduce((n, list) => n + list.length, 0);
  const lastWorldId = state.history[0]?.worldId;
  const tonight = WORLDS.find((w) => w.id === lastWorldId) ?? WORLDS[0];
  const tonightEpisode = nextEpisodeFor(state, tonight.id, tonight.episodeCount);

  return (
    <div className="page">
      <header className="row row--between">
        <div className="row map__greeting" style={{ gap: 'var(--sp-2)', flexWrap: 'nowrap', minWidth: 0 }}>
          <div style={{ minWidth: 0 }}>
            <p className="eyebrow" style={{ margin: 0 }}>Good evening</p>
            <h1 className="h2">{profile.name} &amp; {companion.name}</h1>
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

      <section className="map" aria-label="Worlds">
        {WORLDS.map((world, i) => {
          const heard = state.progress[world.id] ?? [];
          const next = nextEpisodeFor(state, world.id, world.episodeCount);
          const isOpen = expanded === world.id;
          return (
            <div key={world.id}>
              {i > 0 && <div className="map__link" aria-hidden="true" />}
              <button
                className={`map__node${i % 2 === 1 ? ' map__node--offset' : ''}`}
                onClick={() => setExpanded(isOpen ? null : world.id)}
                aria-expanded={isOpen}
              >
                <span
                  className="map__orb"
                  aria-hidden="true"
                  style={{
                    background: `radial-gradient(circle at 32% 28%, ${world.palette[2]}, ${world.palette[1]} 62%, ${world.palette[0]})`,
                  }}
                >
                  {world.emoji}
                </span>
                <span className="grow">
                  <span className="h2" style={{ display: 'block' }}>{world.name}</span>
                  <span className="tiny">{world.blurb}</span>
                  <span className="pips" aria-hidden="true">
                    {Array.from({ length: world.episodeCount }, (_, e) => (
                      <span key={e} className={`pip${heard.includes(e) ? ' pip--done' : ''}`} />
                    ))}
                  </span>
                  <span className="sr-only">
                    {heard.length} of {world.episodeCount} episodes heard
                  </span>
                </span>
              </button>

              {isOpen && (
                <div className="glass glass--flat stack" style={{ padding: 'var(--sp-3)', marginTop: 'var(--sp-2)' }}>
                  <button
                    className="btn btn--primary btn--block"
                    onClick={() => onPick(world, next, state.settings.twoMinute)}
                  >
                    Next up &mdash; episode {next + 1}
                  </button>
                  <div className="row">
                    {Array.from({ length: world.episodeCount }, (_, e) => (
                      <button
                        key={e}
                        className="chip"
                        aria-pressed={heard.includes(e)}
                        onClick={() => onPick(world, e, state.settings.twoMinute)}
                      >
                        {e + 1}
                      </button>
                    ))}
                  </div>
                  <p className="tiny">
                    Any episode, any night, in any order. Nothing is locked and nothing expires.
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
