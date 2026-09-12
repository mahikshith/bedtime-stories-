/**
 * Colouring scenes.
 *
 * Print-first by design. Occupational therapists are blunt that tapping a shape
 * to flood-fill it bypasses the pincer grasp that holding a crayon builds, and
 * printed pages hold attention far longer. So the primary action here is Print;
 * on-screen colouring is the travel and waiting-room fallback.
 * See docs/RESEARCH-PLATFORM.md §6.
 *
 * Line art only: every region is a closed path with a heavy stroke and no fill,
 * so it prints cleanly in black and white on any printer.
 */

export interface Region {
  id: string;
  /** SVG path data. Closed, so an on-screen fill does not leak. */
  d: string;
  /** Suggested crayon, used for the "colour it for me" hint. */
  hint: string;
}

export interface Scene {
  id: string;
  title: string;
  /** Worlds this scene suits. */
  worldIds: string[];
  emoji: string;
  regions: Region[];
}

export const SCENES: Scene[] = [
  {
    id: 'rocket',
    title: 'The Little Rocket',
    worldIds: ['starfall', 'cloudloom', 'paperkingdom'],
    emoji: '🚀',
    regions: [
      { id: 'sky', d: 'M20 20 H380 V440 H20 Z', hint: '#2b3a8f' },
      { id: 'body', d: 'M200 90 C238 130 250 190 248 250 L152 250 C150 190 162 130 200 90 Z', hint: '#ffd9a0' },
      { id: 'window', d: 'M200 155 m-26 0 a26 26 0 1 0 52 0 a26 26 0 1 0 -52 0 Z', hint: '#7fd9e8' },
      { id: 'fin-left', d: 'M152 250 L112 316 L152 306 Z', hint: '#f2a65a' },
      { id: 'fin-right', d: 'M248 250 L288 316 L248 306 Z', hint: '#f2a65a' },
      { id: 'flame', d: 'M172 252 C186 300 190 330 200 356 C210 330 214 300 228 252 Z', hint: '#ffcf8f' },
      { id: 'moon', d: 'M318 92 m-34 0 a34 34 0 1 0 68 0 a34 34 0 1 0 -68 0 Z', hint: '#ffe0b4' },
      { id: 'star-a', d: 'M80 80 L88 104 L112 112 L88 120 L80 144 L72 120 L48 112 L72 104 Z', hint: '#ffe0b4' },
      { id: 'star-b', d: 'M330 330 L336 348 L354 354 L336 360 L330 378 L324 360 L306 354 L324 348 Z', hint: '#ffe0b4' },
      { id: 'ground', d: 'M20 380 C110 348 290 348 380 380 L380 440 L20 440 Z', hint: '#9ff0d4' },
    ],
  },
  {
    id: 'tree',
    title: 'The Lantern Tree',
    worldIds: ['mossgrove', 'amberwood', 'pebblebrook', 'bumblewick'],
    emoji: '🌳',
    regions: [
      { id: 'sky', d: 'M20 20 H380 V440 H20 Z', hint: '#2f6b43' },
      { id: 'canopy', d: 'M200 60 C286 60 330 130 316 190 C356 214 336 282 274 282 L126 282 C64 282 44 214 84 190 C70 130 114 60 200 60 Z', hint: '#a8e6a0' },
      { id: 'trunk', d: 'M178 282 L178 380 L222 380 L222 282 Z', hint: '#8a6a4a' },
      { id: 'root-left', d: 'M178 380 C160 390 140 394 120 396 L120 410 L178 410 Z', hint: '#8a6a4a' },
      { id: 'root-right', d: 'M222 380 C240 390 260 394 280 396 L280 410 L222 410 Z', hint: '#8a6a4a' },
      { id: 'door', d: 'M186 322 C186 306 214 306 214 322 L214 380 L186 380 Z', hint: '#ffcf8f' },
      { id: 'lantern-a', d: 'M120 200 m-16 0 a16 18 0 1 0 32 0 a16 18 0 1 0 -32 0 Z', hint: '#ffe0b4' },
      { id: 'lantern-b', d: 'M282 214 m-16 0 a16 18 0 1 0 32 0 a16 18 0 1 0 -32 0 Z', hint: '#ffe0b4' },
      { id: 'lantern-c', d: 'M200 140 m-16 0 a16 18 0 1 0 32 0 a16 18 0 1 0 -32 0 Z', hint: '#ffe0b4' },
      { id: 'ground', d: 'M20 408 C110 392 290 392 380 408 L380 440 L20 440 Z', hint: '#2f6b43' },
    ],
  },
  {
    id: 'whale',
    title: 'The Quiet Whale',
    worldIds: ['lanterndeep', 'singingreef', 'tidepool', 'lastlighthouse'],
    emoji: '🐋',
    regions: [
      { id: 'water', d: 'M20 20 H380 V440 H20 Z', hint: '#0e4f6e' },
      { id: 'body', d: 'M96 220 C120 160 250 150 302 196 C330 220 330 254 302 278 C250 322 120 314 96 254 Z', hint: '#7fd9e8' },
      { id: 'tail', d: 'M96 220 L46 180 C34 216 34 262 46 296 L96 254 Z', hint: '#7fd9e8' },
      { id: 'fin', d: 'M196 278 C212 306 236 314 254 306 C238 292 222 282 196 278 Z', hint: '#0e4f6e' },
      { id: 'belly', d: 'M120 252 C170 300 250 304 300 276 C250 296 170 294 120 252 Z', hint: '#cdeef0' },
      { id: 'eye', d: 'M276 212 m-9 0 a9 9 0 1 0 18 0 a9 9 0 1 0 -18 0 Z', hint: '#03121f' },
      { id: 'spout', d: 'M286 190 C280 150 300 118 316 100 C320 128 314 166 300 190 Z', hint: '#cdeef0' },
      { id: 'bubble-a', d: 'M110 120 m-14 0 a14 14 0 1 0 28 0 a14 14 0 1 0 -28 0 Z', hint: '#cdeef0' },
      { id: 'bubble-b', d: 'M150 78 m-9 0 a9 9 0 1 0 18 0 a9 9 0 1 0 -18 0 Z', hint: '#cdeef0' },
      { id: 'seabed', d: 'M20 388 C90 360 150 402 220 380 C290 358 340 396 380 384 L380 440 L20 440 Z', hint: '#9ff0d4' },
    ],
  },
  {
    id: 'castle',
    title: "The Quiet Dragon's Keep",
    worldIds: ['quietdragon', 'nightmarket', 'rooftopowls', 'longtrain', 'snowbell', 'dustpaw', 'kindlymachine'],
    emoji: '🏰',
    regions: [
      { id: 'sky', d: 'M20 20 H380 V440 H20 Z', hint: '#5b3a7e' },
      { id: 'keep', d: 'M140 180 H260 V380 H140 Z', hint: '#e8b4f0' },
      { id: 'tower-left', d: 'M84 220 H140 V380 H84 Z', hint: '#e8b4f0' },
      { id: 'tower-right', d: 'M260 220 H316 V380 H260 Z', hint: '#e8b4f0' },
      { id: 'roof-mid', d: 'M132 180 L200 108 L268 180 Z', hint: '#f2a65a' },
      { id: 'roof-left', d: 'M76 220 L112 168 L148 220 Z', hint: '#f2a65a' },
      { id: 'roof-right', d: 'M252 220 L288 168 L324 220 Z', hint: '#f2a65a' },
      { id: 'door', d: 'M178 300 C178 274 222 274 222 300 L222 380 L178 380 Z', hint: '#8a6a4a' },
      { id: 'window-a', d: 'M158 216 C158 202 178 202 178 216 L178 244 L158 244 Z', hint: '#ffcf8f' },
      { id: 'window-b', d: 'M222 216 C222 202 242 202 242 216 L242 244 L222 244 Z', hint: '#ffcf8f' },
      { id: 'moon', d: 'M318 80 m-28 0 a28 28 0 1 0 56 0 a28 28 0 1 0 -56 0 Z', hint: '#ffe0b4' },
      { id: 'ground', d: 'M20 380 H380 V440 H20 Z', hint: '#2f6b43' },
    ],
  },
];

export const CRAYONS = [
  { id: 'red', label: 'Red', value: '#e8564a' },
  { id: 'orange', label: 'Orange', value: '#f2a65a' },
  { id: 'yellow', label: 'Yellow', value: '#ffd75e' },
  { id: 'green', label: 'Green', value: '#5cc98a' },
  { id: 'teal', label: 'Teal', value: '#49b3c4' },
  { id: 'blue', label: 'Blue', value: '#4a6bd8' },
  { id: 'purple', label: 'Purple', value: '#9b6fe0' },
  { id: 'pink', label: 'Pink', value: '#ff9ab5' },
  { id: 'brown', label: 'Brown', value: '#a9743f' },
  { id: 'black', label: 'Black', value: '#33302e' },
] as const;

export function sceneForWorld(worldId: string | undefined): Scene {
  if (!worldId) return SCENES[0];
  return SCENES.find((s) => s.worldIds.includes(worldId)) ?? SCENES[0];
}
