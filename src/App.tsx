import { useCallback, useEffect, useState } from 'react';
import { Sky } from './components/Sky';
import { useTheme } from './hooks/useTheme';
import { Onboarding } from './components/Onboarding';
import { Today } from './components/Today';
import { WorldMap } from './components/WorldMap';
import { StoryPlayer } from './components/StoryPlayer';
import { RhymeList } from './components/RhymeList';
import { RhymePlayer } from './components/RhymePlayer';
import { ColourStudio } from './components/ColourStudio';
import { GameArcade } from './components/GameArcade';
import { LanternBreath } from './components/games/LanternBreath';
import { LumisLeap } from './components/games/LumisLeap';
import { RhymeRace } from './components/games/RhymeRace';
import { WakeTheAnimal } from './components/games/WakeTheAnimal';
import { LettersLab } from './components/LettersLab';
import { ParentZone } from './components/ParentZone';
import { Paywall } from './components/Paywall';
import { PrivacyPolicy } from './components/PrivacyPolicy';
import { getCompanion } from './content/companions';
import { LibraryProvider, tellStory } from './engine/providers';
import { MODES, currentMode, type Pillar } from './engine/dayArc';
import type { Rhyme, Story, World } from './engine/types';
import type { Game } from './content/games';
import {
  activeProfile,
  countSession,
  markGamePlayed,
  markHeard,
  needsPurchase,
  recordSettledNight,
  recordStory,
  useAppState,
} from './state/store';

type Screen =
  | 'today'
  | 'worlds'
  | 'story'
  | 'rhymes'
  | 'rhyme'
  | 'colour'
  | 'letters'
  | 'games'
  | 'game'
  | 'parent'
  | 'privacy';

/** Routes a catalogue entry to its implementation. */
function PlayGame({
  game, profile, onExit,
}: { game: Game; profile: ReturnType<typeof activeProfile> & object; onExit: () => void }) {
  if (game.id === 'lantern-breath') return <LanternBreath profile={profile} onExit={onExit} />;
  if (game.id === 'rhyme-race') return <RhymeRace onExit={onExit} />;
  if (game.id === 'wake-the-animal') return <WakeTheAnimal onExit={onExit} />;
  return (
    <LumisLeap
      profile={profile}
      mode={game.id === 'syllable-hop' ? 'syllable' : 'leap'}
      onExit={onExit}
    />
  );
}

export default function App() {
  const state = useAppState();
  const [screen, setScreen] = useState<Screen>('today');
  const [story, setStory] = useState<Story | null>(null);
  const [world, setWorld] = useState<World | null>(null);
  const [rhyme, setRhyme] = useState<Rhyme | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [storyCalm, setStoryCalm] = useState(0);
  const [note, setNote] = useState<string | null>(null);

  const handleCalm = useCallback((next: number) => setStoryCalm(next), []);
  const profile = activeProfile(state);

  useTheme(state.settings.theme);

  // One bedtime counts as one trial night, however many times the app is opened.
  useEffect(() => {
    if (state.onboarded) countSession();
  }, [state.onboarded]);

  async function pickStory(chosen: World, episode: number, short: boolean) {
    if (!profile) return;
    const result = await tellStory(
      { world: chosen, episode, profile, companion: getCompanion(profile.companionId), short },
      { useSpark: false, spark: new LibraryProvider() },
    );
    setNote(result.note ?? null);
    setStory(result.story);
    setWorld(chosen);
    setStoryCalm(0);
    setScreen('story');
    recordStory({
      id: result.story.id,
      title: result.story.title,
      worldId: chosen.id,
      profileId: profile.id,
    });
  }

  function leaveStory() {
    setScreen('worlds');
    setStoryCalm(0);
    setStory(null);
  }

  function settled() {
    if (!profile) return;
    if (story && world) markHeard(profile.id, world.id, story.episode);
    recordSettledNight(profile.id);
    setScreen('today');
    setStoryCalm(0);
    setStory(null);
  }

  function openPillar(pillar: Pillar) {
    if (pillar === 'stories') return setScreen('worlds');
    if (pillar === 'rhymes') return setScreen('rhymes');
    if (pillar === 'create') return setScreen('colour');
    if (pillar === 'games') return setScreen('games');
    setScreen('letters');
  }

  if (!state.onboarded || !profile) {
    return (
      <div className="app">
        <Sky calm={0} dimming={false} />
        <Onboarding />
      </div>
    );
  }

  // Outside a story, the ambient calm comes from the time of day rather than
  // from the page — the app dims itself as the evening arrives.
  const ambientCalm = MODES[currentMode()].calm;
  const calm = screen === 'story' ? storyCalm : ambientCalm;

  if (needsPurchase(state)) {
    return (
      <div className="app">
        <Sky calm={0} dimming={false} />
        <Paywall variant="expired" />
      </div>
    );
  }

  return (
    <div className="app">
      <Sky
        world={screen === 'story' ? world ?? undefined : undefined}
        calm={calm}
        dimming={state.settings.dimming}
      />

      {note && screen === 'story' && (
        <p className="tiny" style={{ textAlign: 'center', paddingTop: 'var(--sp-2)' }}>{note}</p>
      )}

      {screen === 'today' && (
        <Today onOpenPillar={openPillar} onOpenParent={() => setScreen('parent')} />
      )}

      {screen === 'worlds' && (
        <WorldMap onPick={pickStory} onOpenParent={() => setScreen('parent')} onExit={() => setScreen('today')} />
      )}

      {screen === 'story' && story && world && (
        <StoryPlayer
          story={story}
          world={world}
          onCalmChange={handleCalm}
          onExit={leaveStory}
          onSettled={settled}
        />
      )}

      {screen === 'rhymes' && (
        <RhymeList
          profile={profile}
          onPick={(r) => { setRhyme(r); setScreen('rhyme'); }}
          onExit={() => setScreen('today')}
        />
      )}

      {screen === 'rhyme' && rhyme && (
        <RhymePlayer rhyme={rhyme} profile={profile} onExit={() => setScreen('rhymes')} />
      )}

      {screen === 'colour' && (
        <ColourStudio profile={profile} onExit={() => setScreen('today')} />
      )}

      {screen === 'letters' && (
        <LettersLab profile={profile} onExit={() => setScreen('today')} />
      )}

      {screen === 'games' && (
        <GameArcade
          profile={profile}
          onPick={(picked) => {
            setGame(picked);
            markGamePlayed(profile.id, picked.id);
            setScreen('game');
          }}
          onExit={() => setScreen('today')}
        />
      )}

      {screen === 'game' && game && (
        <PlayGame game={game} profile={profile} onExit={() => setScreen('games')} />
      )}

      {screen === 'parent' && (
        <ParentZone
          onExit={() => setScreen('today')}
          onOpenPrivacy={() => setScreen('privacy')}
        />
      )}

      {screen === 'privacy' && <PrivacyPolicy onExit={() => setScreen('parent')} />}
    </div>
  );
}
