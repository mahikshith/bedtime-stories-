import type { World } from './types';

/**
 * World backdrops.
 *
 * Design note (see docs/RESEARCH.md §3a): real NASA/NOAA astrophotography does
 * NOT composite with children's-book illustration — photoreal nebulae behind a
 * cartoon fox reads as a ransom note. So real imagery is used two ways:
 *
 *  1. Heavily processed, low-opacity, colour-graded to the world palette, as
 *     atmosphere only. Rendered procedurally here so the app ships offline.
 *  2. Unretouched and credited, in its own moment: the Real Window card shown
 *     after the story. Fantasy first, then one true thing.
 */

export interface PublicDomainSource {
  /** Archive the imagery is drawn from. All public domain. */
  archive: World['realWindow']['source'];
  /** Endpoint used when online imagery is enabled. */
  endpoint: string;
  /** Attribution required by the archive's usage guidelines. */
  attribution: string;
}

/**
 * NASA imagery is public domain, but three conditions apply and are encoded here:
 * credit NASA, never imply endorsement, and never use the insignia, logotype or seal.
 */
export const PUBLIC_DOMAIN_SOURCES: Record<string, PublicDomainSource> = {
  NASA: {
    archive: 'NASA',
    endpoint: 'https://images-api.nasa.gov/search',
    attribution: 'Courtesy of NASA. NASA does not endorse this app.',
  },
  NOAA: {
    archive: 'NOAA',
    endpoint: 'https://www.noaa.gov/digital-media',
    attribution: 'Courtesy of NOAA.',
  },
  USGS: {
    archive: 'USGS',
    endpoint: 'https://www.usgs.gov/products/multimedia-gallery',
    attribution: 'Courtesy of the U.S. Geological Survey.',
  },
  'Smithsonian Open Access': {
    archive: 'Smithsonian Open Access',
    endpoint: 'https://api.si.edu/openaccess/api/v1.0/search',
    attribution: 'Courtesy of Smithsonian Open Access (CC0).',
  },
  'Library of Congress': {
    archive: 'Library of Congress',
    endpoint: 'https://www.loc.gov/photos/',
    attribution: 'Courtesy of the Library of Congress.',
  },
};

/** Deterministic star/particle field for a world, seeded so it never re-shuffles. */
export interface Speck {
  x: number;
  y: number;
  r: number;
  o: number;
  delay: number;
}

export function buildSpecks(seed: number, count: number): Speck[] {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return Array.from({ length: count }, () => ({
    x: Number((next() * 100).toFixed(2)),
    y: Number((next() * 100).toFixed(2)),
    r: Number((0.6 + next() * 1.6).toFixed(2)),
    o: Number((0.18 + next() * 0.55).toFixed(2)),
    delay: Number((next() * 6).toFixed(2)),
  }));
}

/** The world gradient, warmed as the story winds down. */
export function worldGradient(world: World, calm = 0): string {
  const [deep, mid, glow] = world.palette;
  const spread = 62 - calm * 18;
  return `radial-gradient(120% 90% at 50% 8%, ${glow}22 0%, ${mid}44 ${spread * 0.5}%, ${deep} ${spread}%, ${deep} 100%)`;
}
