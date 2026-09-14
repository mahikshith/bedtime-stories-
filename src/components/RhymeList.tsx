import { RHYMES } from '../content/rhymes';
import { MascotBuddy } from './MascotBuddy';
import { Tile } from './Tile';
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

      {/* Grouped into rows that mean something, rather than one long wall. */}
      {[
        { key: 'original', label: 'Lumi originals', list: ordered.filter((r) => r.kind === 'original') },
        { key: 'traditional', label: 'The old favourites', list: ordered.filter((r) => r.kind === 'traditional') },
      ].map((group) => (
        <section key={group.key}>
          <div className="shelf__head">
            <p className="h3">{group.label}</p>
            <span className="shelf__count">{group.list.length} &rarr;</span>
          </div>
          <div className="shelf" role="list" aria-label={group.label}>
            {group.list.map((rhyme, i) => (
              <Tile
                key={rhyme.id}
                index={i}
                emoji={rhyme.emoji}
                title={rhyme.title}
                subtitle={rhyme.devices.slice(0, 2).join(', ')}
                badge={recited.has(rhyme.id) ? <span aria-label="Recited">&#10003;</span> : undefined}
                onClick={() => onPick(rhyme)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
