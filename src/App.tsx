import { useCallback, useState } from 'react';
import { Sky } from './components/Sky';
import { Onboarding } from './components/Onboarding';
import { WorldMap } from './components/WorldMap';
import { StoryPlayer } from './components/StoryPlayer';
import { ParentZone } from './components/ParentZone';
import { getCompanion } from './content/companions';
import { LibraryProvider, tellStory } from './engine/providers';
import type { Story, World } from './engine/types';
import {
  activeProfile,
  markHeard,
  recordSettledNight,
  recordStory,
  useAppState,
  type Screen,
} from './state/store';

export default function App() {
  const state = useAppState();
  const [screen, setScreen] = useState<Screen>('map');
  const [story, setStory] = useState<Story | null>(null);
  const [world, setWorld] = useState<World | null>(null);
  const [calm, setCalm] = useState(0);
  const [note, setNote] = useState<string | null>(null);

  const handleCalm = useCallback((next: number) => setCalm(next), []);

  const profile = activeProfile(state);

  async function pick(chosen: World, episode: number, short: boolean) {
    if (!profile) return;
    const request = {
      world: chosen,
      episode,
      profile,
      companion: getCompanion(profile.companionId),
      short,
    };
    // The library is the default path: instant, offline, zero marginal cost.
    const result = await tellStory(request, { useSpark: false, spark: new LibraryProvider() });
    setNote(result.note ?? null);
    setStory(result.story);
    setWorld(chosen);
    setCalm(0);
    setScreen('story');
    recordStory({ id: result.story.id, title: result.story.title, worldId: chosen.id });
  }

  function leaveStory() {
    setScreen('map');
    setCalm(0);
    setStory(null);
  }

  function settled() {
    if (story && world) markHeard(world.id, story.episode);
    recordSettledNight();
    leaveStory();
  }

  if (!state.onboarded || !profile) {
    return (
      <div className="app">
        <Sky calm={0} dimming={false} />
        <Onboarding />
      </div>
    );
  }

  return (
    <div className="app">
      <Sky
        world={screen === 'story' ? world ?? undefined : undefined}
        calm={screen === 'story' ? calm : 0}
        dimming={state.settings.dimming}
      />

      {note && screen === 'story' && (
        <p className="tiny" style={{ textAlign: 'center', paddingTop: 'var(--sp-2)' }}>{note}</p>
      )}

      {screen === 'map' && <WorldMap onPick={pick} onOpenParent={() => setScreen('parent')} />}

      {screen === 'story' && story && world && (
        <StoryPlayer
          story={story}
          world={world}
          onCalmChange={handleCalm}
          onExit={leaveStory}
          onSettled={settled}
        />
      )}

      {screen === 'parent' && <ParentZone onExit={() => setScreen('map')} />}
    </div>
  );
}
