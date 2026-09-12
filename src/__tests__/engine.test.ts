import { describe, expect, it } from 'vitest';
import { WORLDS, getWorld } from '../content/worlds';
import { ARCS } from '../content/arcs';
import { COMPANIONS, getCompanion } from '../content/companions';
import { composeLibraryStory, seedFor } from '../engine/generator';
import { checkStoryText, longestSentenceWords, sanitizeName } from '../engine/safety';
import { fixCapitalization, stripArticle, substitute, titleCase } from '../engine/personalize';
import { makeRng, pickDistinct } from '../engine/rng';
import type { ChildProfile, StoryRequest } from '../engine/types';

function profile(over: Partial<ChildProfile> = {}): ChildProfile {
  return {
    id: 'p1',
    name: 'Ada',
    ageBand: '6-8',
    pronouns: 'she',
    companionId: 'fox',
    interests: ['space', 'building'],
    createdAt: 0,
    ...over,
  };
}

function request(over: Partial<StoryRequest> = {}): StoryRequest {
  const p = over.profile ?? profile();
  return {
    world: getWorld('starfall'),
    episode: 0,
    profile: p,
    companion: getCompanion(p.companionId),
    ...over,
  };
}

describe('content library', () => {
  it('ships 18 worlds with complete lexicons', () => {
    expect(WORLDS).toHaveLength(18);
    for (const w of WORLDS) {
      expect(w.lexicon.places.length).toBeGreaterThanOrEqual(4);
      expect(w.lexicon.wonders.length).toBeGreaterThanOrEqual(4);
      expect(w.lexicon.sounds.length).toBeGreaterThanOrEqual(4);
      expect(w.signatures.wonder.length).toBeGreaterThan(0);
      expect(w.signatures.settle.length).toBeGreaterThan(0);
      expect(w.realWindow.credit).toMatch(/courtesy of/i);
    }
  });

  it('gives every world a unique id and palette', () => {
    expect(new Set(WORLDS.map((w) => w.id)).size).toBe(18);
    for (const w of WORLDS) {
      expect(w.palette).toHaveLength(3);
      w.palette.forEach((c) => expect(c).toMatch(/^#[0-9a-f]{6}$/i));
    }
  });

  it('draws Real Window facts only from public-domain archives', () => {
    const allowed = new Set(['NASA', 'NOAA', 'USGS', 'Smithsonian Open Access', 'Library of Congress']);
    for (const w of WORLDS) expect(allowed.has(w.realWindow.source)).toBe(true);
  });

  it('defines every stage on every arc', () => {
    const stages = ['call', 'threshold', 'wonder', 'wobble', 'helper', 'resolve', 'settle'] as const;
    for (const arc of ARCS) {
      for (const s of stages) {
        expect(arc.stages[s].length).toBeGreaterThan(0);
        arc.stages[s].forEach((slot) => expect(slot.length).toBeGreaterThan(1));
      }
    }
  });
});

describe('personalization', () => {
  it('substitutes names and pronouns without leaving tokens', () => {
    const out = substitute('{child} took {their} coat. {they} went out.', {
      child: 'Ada', pronouns: 'she', companion: 'Sorrel', companionSpecies: 'fox',
      trait: 't', world: 'W', place: 'p', place2: 'p2', guide: 'g', wonder: 'w',
      wonder2: 'w2', obstacle: 'o', gentle: 'gt', sound: 's', sound2: 's2',
      treasure: 'tr', interest: 'space',
    });
    expect(out).toBe('Ada took her coat. She went out.');
    expect(out).not.toMatch(/\{/);
  });

  it('uses plural pronouns for they/them', () => {
    const out = substitute('{they} found {their} way. {them}.', {
      child: 'Sam', pronouns: 'they', companion: 'c', companionSpecies: 's', trait: 't',
      world: 'W', place: 'p', place2: 'p2', guide: 'g', wonder: 'w', wonder2: 'w2',
      obstacle: 'o', gentle: 'gt', sound: 's', sound2: 's2', treasure: 'tr', interest: 'i',
    });
    expect(out).toBe('They found their way. Them.');
  });

  it('capitalizes after sentence boundaries', () => {
    expect(fixCapitalization('hello there. how are you? fine! ok')).toBe(
      'Hello there. How are you? Fine! Ok',
    );
  });

  it('builds readable titles', () => {
    expect(titleCase(stripArticle('a slow river of stars'))).toBe('Slow River of Stars');
    expect(titleCase('the observation ring')).toBe('The Observation Ring');
    expect(titleCase('the observation ring', false)).toBe('the Observation Ring');
  });
});

describe('safety', () => {
  it('rejects blocked concepts', () => {
    expect(checkStoryText('the monster under the bed').ok).toBe(false);
    expect(checkStoryText('a soldier with a gun').ok).toBe(false);
    expect(checkStoryText('enter your password here').ok).toBe(false);
  });

  it('rejects unsubstituted tokens reaching a child', () => {
    expect(checkStoryText('Hello {child}, good night.').ok).toBe(false);
  });

  it('accepts ordinary gentle prose', () => {
    expect(checkStoryText('The lantern glowed and the fox curled up warm.').ok).toBe(true);
  });

  it('sanitizes parent-entered names', () => {
    expect(sanitizeName('  ada   lovelace ').name).toBe('Ada Lovelace');
    expect(sanitizeName('Ad4m!!').name).toBe('Adm');
    expect(sanitizeName('').ok).toBe(false);
    expect(sanitizeName('shit').ok).toBe(false);
    expect(sanitizeName('a'.repeat(50)).name.length).toBe(20);
    expect(sanitizeName("Siobhán O'Hara-Lee").name).toBe("Siobhán O'Hara-Lee");
  });
});

describe('rng', () => {
  it('is deterministic for a seed', () => {
    const a = Array.from({ length: 5 }, makeRng(42));
    const b = Array.from({ length: 5 }, makeRng(42));
    expect(a).toEqual(b);
  });

  it('picks distinct items when the pool allows', () => {
    const got = pickDistinct(makeRng(7), ['a', 'b', 'c', 'd'], 3);
    expect(new Set(got).size).toBe(3);
  });
});

describe('story generation', () => {
  it('produces a seven-page story that passes safety', () => {
    const story = composeLibraryStory(request());
    expect(story.pages).toHaveLength(7);
    expect(checkStoryText(story.pages.map((p) => p.text).join(' ')).ok).toBe(true);
    expect(story.wordCount).toBeGreaterThan(180);
    expect(story.title.length).toBeLessThanOrEqual(46);
  });

  it('is deterministic — the same child gets the same bedtime story back', () => {
    const a = composeLibraryStory(request());
    const b = composeLibraryStory(request());
    expect(a.pages.map((p) => p.text)).toEqual(b.pages.map((p) => p.text));
    expect(a.title).toBe(b.title);
  });

  it('produces different stories for different episodes', () => {
    const a = composeLibraryStory(request({ episode: 0 }));
    const b = composeLibraryStory(request({ episode: 1 }));
    expect(a.pages[0].text).not.toBe(b.pages[0].text);
  });

  it('personalizes to the child without the name leaving the device', () => {
    const story = composeLibraryStory(request({ profile: profile({ name: 'Kwame', pronouns: 'he' }) }));
    const full = story.pages.map((p) => p.text).join(' ');
    expect(full).toContain('Kwame');
    expect(full).not.toContain('Ada');
  });

  it('applies the sleep gradient — calm rises monotonically to 1', () => {
    const story = composeLibraryStory(request());
    const calms = story.pages.map((p) => p.calm);
    for (let i = 1; i < calms.length; i++) expect(calms[i]).toBeGreaterThan(calms[i - 1]);
    expect(calms[calms.length - 1]).toBe(1);
  });

  it('shortens sentences for the 3-5 band', () => {
    const young = composeLibraryStory(request({ profile: profile({ ageBand: '3-5' }) }));
    const older = composeLibraryStory(request({ profile: profile({ ageBand: '9-11' }) }));
    const youngLongest = longestSentenceWords(young.pages.map((p) => p.text).join(' '));
    const olderLongest = longestSentenceWords(older.pages.map((p) => p.text).join(' '));
    expect(youngLongest).toBeLessThanOrEqual(16);
    expect(youngLongest).toBeLessThan(olderLongest);
    expect(young.wordCount).toBeLessThan(older.wordCount);
  });

  it('supports two-minute mode', () => {
    const short = composeLibraryStory(request({ short: true }));
    expect(short.pages).toHaveLength(4);
    expect(short.pages[short.pages.length - 1].stage).toBe('settle');
  });

  it('generates safe, token-free stories across every world, episode and companion', () => {
    for (const world of WORLDS) {
      for (let episode = 0; episode < world.episodeCount; episode++) {
        const companion = COMPANIONS[episode % COMPANIONS.length];
        const story = composeLibraryStory(
          request({
            world,
            episode,
            profile: profile({ companionId: companion.id, ageBand: '6-8' }),
            companion,
          }),
        );
        const text = story.pages.map((p) => p.text).join(' ');
        expect(checkStoryText(text).ok, `${world.id} ep${episode}: ${text.slice(0, 120)}`).toBe(true);
        expect(text).not.toMatch(/\{|\}/);
        expect(text).not.toMatch(/\s{2,}/);
        expect(story.title).not.toMatch(/\{|\}/);
      }
    }
  });

  it('never renders a trait clause after a copula', () => {
    // Traits are appositives ("who always knew the way back"), so "X was who..."
    // is ungrammatical. This guards every arc variant, not just the one that broke.
    for (const world of WORLDS.slice(0, 4)) {
      for (let episode = 0; episode < 6; episode++) {
        for (const companion of COMPANIONS) {
          const story = composeLibraryStory(
            request({ world, episode, profile: profile({ companionId: companion.id }), companion }),
          );
          const text = story.pages.map((p) => p.text).join(' ');
          expect(text, `${world.id} ep${episode} ${companion.id}`).not.toMatch(
            /\b(was|is|were|are)\s+(who|whose|which)\b/i,
          );
        }
      }
    }
  });

  it('builds grammatical titles across every world and episode', () => {
    for (const world of WORLDS) {
      for (let episode = 0; episode < world.episodeCount; episode++) {
        const title = composeLibraryStory(request({ world, episode })).title;
        // "The Night Ada Found Folded Star Chart" — the article was wrongly stripped.
        expect(title, title).toMatch(/^(?!.*\bFound (?!a |an |the )[A-Z])/);
        // "Ada and Sorrel at The Greenhouse Module" — an article capitalised mid-title.
        expect(title, title).not.toMatch(/\s(The|A|An)\s/);
        expect(title, title).not.toMatch(/\s{2,}/);
        expect(title.trim()).toBe(title);
        expect(title.length).toBeGreaterThan(4);
      }
    }
  });

  it('seeds stably from the request', () => {
    expect(seedFor(request())).toBe(seedFor(request()));
    expect(seedFor(request({ episode: 1 }))).not.toBe(seedFor(request({ episode: 2 })));
  });
});
