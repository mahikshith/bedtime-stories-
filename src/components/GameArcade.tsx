import { GAMES, gamesForBand, isGameEncouraged, type Game } from '../content/games';
import { MascotBuddy } from './MascotBuddy';
import { Tile } from './Tile';
import { currentMode } from '../engine/dayArc';
import type { ChildProfile } from '../engine/types';

interface GameArcadeProps {
  profile: ChildProfile;
  onPick: (game: Game) => void;
  onExit: () => void;
}

/**
 * The games section.
 *
 * Games are listed by how well they fit the child's age, but nothing is hidden:
 * a four-year-old with an older sibling may well want the harder one, and a
 * parent should not have to fight the app about it.
 */
export function GameArcade({ profile, onPick, onExit }: GameArcadeProps) {
  const fitted = gamesForBand(profile.ageBand);
  const rest = GAMES.filter((g) => !fitted.includes(g));
  const winddown = currentMode() === 'winddown';

  return (
    <div className="page">
      <header className="row row--between">
        <button className="btn btn--sm btn--ghost" onClick={onExit}>&larr; Today</button>
        <span className="badge">Ages {profile.ageBand}</span>
      </header>

      <section className="glass stack" style={{ padding: 'var(--sp-4)' }}>
        <p className="eyebrow">Games</p>
        <h1 className="h1">Say it, hear it, catch it.</h1>
        <p className="tiny">
          The voice games measure how loud {profile.name} is and nothing else. No recording is
          made, no words are sent anywhere, and nothing is stored.
        </p>
      </section>

      {winddown && (
        <section className="glass glass--flat stack" style={{ padding: 'var(--sp-3)' }}>
          <p className="h3">It&rsquo;s getting late</p>
          <p className="tiny">
            The shouting games are still here if you want them, but they wake everybody up.
            <strong> Lantern Breath</strong> is the one built for now &mdash; five slow breaths and
            the screen goes dark.
          </p>
        </section>
      )}

      <div className="buddy-stage">
        <MascotBuddy size={120} mood="happy" settled={winddown} />
      </div>

      <section>
        <div className="shelf__head">
          <p className="h3">Just right for {profile.name}</p>
          <span className="shelf__count">{fitted.length} &rarr;</span>
        </div>
        <div className="shelf" aria-label={`Games for ages ${profile.ageBand}`}>
          {fitted.map((game, i) => (
            <GameTile
              key={game.id}
              game={game}
              index={i}
              onPick={onPick}
              dimmed={!isGameEncouraged(winddown, game)}
            />
          ))}
        </div>
      </section>

      {rest.length > 0 && (
        <section>
          <div className="shelf__head">
            <p className="h3">For other ages</p>
            <span className="shelf__count">{rest.length} &rarr;</span>
          </div>
          <div className="shelf" aria-label="Games for other ages">
            {rest.map((game, i) => (
              <GameTile key={game.id} game={game} index={i} onPick={onPick} dimmed />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function GameTile({
  game, index, onPick, dimmed,
}: { game: Game; index: number; onPick: (g: Game) => void; dimmed?: boolean }) {
  const planned = game.status === 'planned';
  return (
    <Tile
      index={index}
      emoji={game.emoji}
      title={game.title}
      subtitle={game.blurb}
      meta={`Ages ${game.minAge}\u2013${game.maxAge}${planned ? ' \u00b7 soon' : ''}`}
      dimmed={dimmed}
      disabled={planned}
      badge={game.input === 'voice' ? <span aria-label="Uses the microphone">🎤</span> : undefined}
      onClick={() => onPick(game)}
    />
  );
}
