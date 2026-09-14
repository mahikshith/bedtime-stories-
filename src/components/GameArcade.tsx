import { GAMES, gamesForBand, type Game } from '../content/games';
import { MascotBuddy } from './MascotBuddy';
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
            The shouting games are still here if you want them, but they wake everybody up. A story
            might land better right now.
          </p>
        </section>
      )}

      <div className="buddy-stage">
        <MascotBuddy size={120} mood="happy" settled={winddown} />
      </div>

      <section className="stack" aria-label={`Games for ages ${profile.ageBand}`}>
        {fitted.map((game) => (
          <GameRow key={game.id} game={game} onPick={onPick} />
        ))}
      </section>

      {rest.length > 0 && (
        <section className="stack">
          <p className="h3">For other ages</p>
          {rest.map((game) => (
            <GameRow key={game.id} game={game} onPick={onPick} dimmed />
          ))}
        </section>
      )}
    </div>
  );
}

function GameRow({
  game, onPick, dimmed,
}: { game: Game; onPick: (g: Game) => void; dimmed?: boolean }) {
  const planned = game.status === 'planned';
  return (
    <button
      className="map__node"
      style={{ opacity: dimmed || planned ? 0.5 : 1 }}
      disabled={planned}
      onClick={() => onPick(game)}
    >
      <span className="map__orb" aria-hidden="true">{game.emoji}</span>
      <span className="grow">
        <span className="h2" style={{ display: 'block' }}>{game.title}</span>
        <span className="tiny">{game.blurb}</span>
        <span className="tiny" style={{ display: 'block', marginTop: 4 }}>
          Ages {game.minAge}&ndash;{game.maxAge}
          {' · '}{game.skills.slice(0, 2).join(', ')}
          {game.together && ' · with a grown-up'}
          {planned && ' · coming soon'}
        </span>
      </span>
      {game.input === 'voice' && <span className="badge" aria-label="Uses the microphone">🎤</span>}
    </button>
  );
}
