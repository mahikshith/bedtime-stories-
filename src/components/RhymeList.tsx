import { RHYMES } from '../content/rhymes';
import { MascotBuddy } from './MascotBuddy';
import type { ChildProfile, Rhyme } from '../engine/types';
import { progressFor, useAppState } from '../state/store';

interface RhymeListProps {
  profile: ChildProfile;
  onPick: (rhyme: Rhyme) => void;
  onExit: () => void;
}

export function RhymeList({ profile, onPick, onExit }: RhymeListProps) {
  const state = useAppState();
  const recited = new Set(progressFor(state, profile.id).rhymes);

  // Age-appropriate first, but nothing is hidden — a four-year-old may well
  // want the long one, and a parent should not have to fight the app for it.
  const forAge = RHYMES.filter((r) => r.ageBands.includes(profile.ageBand));
  const rest = RHYMES.filter((r) => !r.ageBands.includes(profile.ageBand));
  const ordered = [...forAge, ...rest];

  return (
    <div className="page">
      <header className="row row--between">
        <button className="btn btn--sm btn--ghost" onClick={onExit}>&larr; Today</button>
        <span className="badge">{RHYMES.length} rhymes</span>
      </header>

      <section className="glass stack" style={{ padding: 'var(--sp-4)' }}>
        <p className="eyebrow">Rhymes</p>
        <h1 className="h1">Say them, clap them, fill in the last word.</h1>
        <p className="tiny">
          Knowing rhymes is one of the strongest predictors of how easily a child learns to read.
          Every one here leaves a word out for {profile.name} to supply.
        </p>
      </section>

      <div className="buddy-stage">
        <MascotBuddy size={120} mood="happy" />
      </div>

      <section className="stack">
        {ordered.map((rhyme) => (
          <button key={rhyme.id} className="map__node" onClick={() => onPick(rhyme)}>
            <span className="map__orb" aria-hidden="true">{rhyme.emoji}</span>
            <span className="grow">
              <span className="h2" style={{ display: 'block' }}>{rhyme.title}</span>
              <span className="tiny">
                {rhyme.kind === 'original' ? 'A Lumi original' : 'Traditional'}
                {' · '}
                {rhyme.devices.slice(0, 3).join(', ')}
              </span>
            </span>
            {recited.has(rhyme.id) && <span className="badge" aria-label="Recited">&#10003;</span>}
          </button>
        ))}
      </section>
    </div>
  );
}
