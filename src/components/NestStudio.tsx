import { Mascot } from './Mascot';
import { Tile } from './Tile';
import { HATS, NEST_ITEMS, nextUnlock, type NestItem } from '../content/nest';
import { playChime } from '../engine/gameAudio';
import { playState, wearHat } from '../state/store';

/**
 * Lumi's Nest — the shelf of things a child has kept.
 *
 * Read the tone carefully, because it is the whole design: stars are a count of
 * what has been done, never a balance to spend. Nothing here is ever taken
 * away, nothing expires, and a locked item shows what it is and what it costs
 * rather than being hidden behind a silhouette with a question mark. A goal is
 * fine; a mystery box is not.
 */
export function NestStudio({ onExit }: { onExit: () => void }) {
  const play = playState();
  const stars = play.stars;
  const next = nextUnlock(stars);

  const owned = (item: NestItem) => stars >= item.stars;

  function choose(id: string) {
    const wearing = play.nest.wearing === id ? null : id;
    wearHat(wearing);
    playChime({ step: wearing ? 4 : 1, velocity: 0.6 });
  }

  return (
    <div className="page">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <button className="btn btn--sm btn--ghost" onClick={onExit}>&#8592; Games</button>
        <span className="badge">
          <span aria-hidden="true">&#11088;</span> {stars}
        </span>
      </div>

      <div className="glass stack" style={{ padding: 'var(--sp-3)', gap: 'var(--sp-2)' }}>
        <p className="eyebrow">Lumi&rsquo;s nest</p>
        <h1 className="h1">Everything you have kept.</h1>
        <p className="tiny">
          {next
            ? `${next.stars - stars} more ${next.stars - stars === 1 ? 'star' : 'stars'} and the ${next.name.toLowerCase()} is yours.`
            : 'The whole nest is yours. Every last bit of it.'}
        </p>
      </div>

      <div className="row" style={{ justifyContent: 'center' }}>
        <Mascot size={168} mood="proud" hat={play.nest.wearing} autoHop />
      </div>

      <h2 className="h2">Hats</h2>
      <div className="tiles" aria-label="Hats for Lumi">
        {HATS.map((item, i) => (
          <Tile
            key={item.id}
            index={i}
            emoji={item.emoji}
            title={item.name}
            subtitle={owned(item) ? (play.nest.wearing === item.id ? 'Wearing it' : 'Tap to wear') : undefined}
            meta={owned(item) ? undefined : `⭐ ${item.stars}`}
            dimmed={!owned(item)}
            disabled={!owned(item)}
            onClick={() => choose(item.id)}
          />
        ))}
      </div>

      <h2 className="h2">For the nest</h2>
      <div className="tiles" aria-label="Nest furnishings and sounds">
        {NEST_ITEMS.filter((i) => i.kind !== 'hats').map((item, i) => (
          <Tile
            key={item.id}
            index={i}
            emoji={item.emoji}
            title={item.name}
            subtitle={owned(item) ? 'In the nest' : undefined}
            meta={owned(item) ? undefined : `⭐ ${item.stars}`}
            dimmed={!owned(item)}
            disabled
            onClick={() => undefined}
          />
        ))}
      </div>

      <p className="tiny" style={{ textAlign: 'center' }}>
        Stars only ever go up. Nothing here can be lost or spent.
      </p>
    </div>
  );
}
