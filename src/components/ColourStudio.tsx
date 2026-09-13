import { useMemo, useState } from 'react';
import { CRAYONS, SCENES, sceneForWorld, type Scene } from '../content/colouring';
import { getCompanion } from '../content/companions';
import { getWorld } from '../content/worlds';
import type { ChildProfile } from '../engine/types';
import { markPrinted, progressFor, useAppState } from '../state/store';

interface ColourStudioProps {
  profile: ChildProfile;
  onExit: () => void;
}

/**
 * Print-first colouring.
 *
 * The primary button takes the child OFF the screen, which reads as
 * self-sabotage and is in fact the point: crayon-on-paper builds the pincer
 * grasp that tapping a screen does not, and printed pages hold attention far
 * longer. Screen colouring stays for the car and the waiting room.
 */
export function ColourStudio({ profile, onExit }: ColourStudioProps) {
  const state = useAppState();
  const companion = getCompanion(profile.companionId);

  // Default to a scene from the world of the last story heard, so the page is
  // "colour last night's story" rather than a generic picture.
  const lastWorldId = state.history.find((h) => h.profileId === profile.id)?.worldId;
  const [scene, setScene] = useState<Scene>(() => sceneForWorld(lastWorldId));
  const [crayon, setCrayon] = useState<string>(CRAYONS[0].value);
  const [fills, setFills] = useState<Record<string, string>>({});
  // Each entry is the fill map as it was BEFORE a stroke, so undo is a pop.
  const [history, setHistory] = useState<Record<string, string>[]>([]);
  const [onScreen, setOnScreen] = useState(false);

  const printed = progressFor(state, profile.id).printed;

  const worldName = useMemo(
    () => (lastWorldId ? getWorld(lastWorldId).name : null),
    [lastWorldId],
  );

  function paint(regionId: string) {
    if (!onScreen) return;
    // Colouring the same region the same colour twice is not a step to undo.
    if (fills[regionId] === crayon) return;
    setHistory((h) => [...h.slice(-24), fills]);
    setFills((prev) => ({ ...prev, [regionId]: crayon }));
  }

  function undo() {
    setHistory((h) => {
      if (h.length === 0) return h;
      setFills(h[h.length - 1]);
      return h.slice(0, -1);
    });
  }

  function reset() {
    if (Object.keys(fills).length === 0) return;
    setHistory((h) => [...h.slice(-24), fills]);
    setFills({});
  }

  function print() {
    markPrinted(profile.id, scene.id);
    window.print();
  }

  function openScene(next: Scene) {
    setScene(next);
    setFills({});
    setHistory([]);
  }

  return (
    <div className="page">
      <header className="row row--between no-print">
        <button className="btn btn--sm btn--ghost" onClick={onExit}>&larr; Today</button>
        <span className="badge">{scene.emoji} {scene.title}</span>
      </header>

      <section className="glass stack no-print" style={{ padding: 'var(--sp-4)' }}>
        <p className="eyebrow">Colour</p>
        <h1 className="h1">
          {worldName ? `A page from ${worldName}` : 'A page to colour'}
        </h1>
        <p className="tiny">
          Made for {profile.name} and {companion.name}. This page is meant to be printed &mdash;
          holding a crayon builds the hand strength that tapping a screen doesn&rsquo;t.
        </p>
      </section>

      {/* The page itself. Everything else is hidden when printing. */}
      <div className="colour__sheet" id="colour-sheet">
        <svg viewBox="0 0 400 470" className="colour__art" role="img" aria-label={scene.title}>
          <rect x="0" y="0" width="400" height="470" fill="#ffffff" />
          {scene.regions.map((region) => (
            <path
              key={region.id}
              d={region.d}
              fill={fills[region.id] ?? '#ffffff'}
              stroke="#1c1c1c"
              strokeWidth="3.5"
              strokeLinejoin="round"
              onClick={() => paint(region.id)}
              style={{ cursor: onScreen ? 'pointer' : 'default' }}
            />
          ))}
          <text
            x="200"
            y="462"
            textAnchor="middle"
            fontSize="30"
            fontFamily="ui-rounded, system-ui, sans-serif"
            fontWeight="800"
            fill="none"
            stroke="#1c1c1c"
            strokeWidth="2"
          >
            {profile.name.toLocaleUpperCase()}
          </text>
        </svg>
      </div>

      <button className="btn btn--primary btn--block no-print" onClick={print}>
        &#128424;&#65039; Print this page
      </button>

      <div className="row no-print">
        <button
          className="chip grow"
          aria-pressed={onScreen}
          onClick={() => setOnScreen((v) => !v)}
        >
          {onScreen ? 'Colouring on screen' : 'Colour on screen instead'}
        </button>
        {history.length > 0 && (
          <button className="chip" onClick={undo}>&#8630; Undo</button>
        )}
        {Object.keys(fills).length > 0 && (
          <button className="chip" onClick={reset}>Start again</button>
        )}
      </div>

      {onScreen && (
        <div className="row no-print" role="group" aria-label="Crayons">
          {CRAYONS.map((c) => (
            <button
              key={c.id}
              className="colour__crayon"
              aria-label={c.label}
              aria-pressed={crayon === c.value}
              style={{ background: c.value }}
              onClick={() => setCrayon(c.value)}
            />
          ))}
        </div>
      )}

      {printed.length > 0 && (
        <section className="glass stack no-print" style={{ padding: 'var(--sp-3)' }}>
          <p className="h3">Printed before</p>
          <div className="row">
            {printed.map((entry) => {
              const previous = SCENES.find((s) => s.id === entry.sceneId);
              if (!previous) return null;
              return (
                <button key={entry.sceneId} className="chip" onClick={() => openScene(previous)}>
                  <span aria-hidden="true">{previous.emoji}</span> {previous.title}
                </button>
              );
            })}
          </div>
          <p className="tiny">Tap one to open it again and run off another copy.</p>
        </section>
      )}

      <section className="glass stack no-print" style={{ padding: 'var(--sp-3)' }}>
        <p className="h3">Another picture</p>
        <div className="row">
          {SCENES.map((s) => (
            <button
              key={s.id}
              className="chip"
              aria-pressed={s.id === scene.id}
              onClick={() => openScene(s)}
            >
              <span aria-hidden="true">{s.emoji}</span> {s.title}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
