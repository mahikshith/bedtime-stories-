import { useEffect } from 'react';
import { useMascotRig } from './mascot/useMascotRig';
import type { Gesture } from './mascot/rig';

export type Mood =
  | 'happy'
  | 'awake'
  | 'soft'
  | 'sleepy'
  | 'excited'
  | 'curious'
  | 'proud'
  | 'encouraging'
  | 'oops';

/** What the body is doing, independent of what the face is feeling. */
export type Action = 'idle' | 'walk' | 'fly' | 'spin';

interface MascotProps {
  size?: number;
  mood?: Mood;
  action?: Action;
  /** Squash-and-stretch hop. */
  hopping?: boolean;
  /** Hop on a timer without an external driver. */
  autoHop?: boolean;
  /** A Nest hat id. Drawn on the head, so it inherits the head's rotation. */
  hat?: string | null;
  /** Idle life. Off gives a still frame for a screenshot or an icon. */
  alive?: boolean;
  title?: string;
}

/**
 * Lumi.
 *
 * Rebuilt from nothing, twice. The first version was a circle with a face on
 * it; the second was the same circle with better gradients, which is why it
 * still looked like a sticker. The thing that makes Duo, or a Clash barbarian,
 * or a Candy Crush character read as solid is not shading quality. It is that
 * they are **assembled out of separate volumes that overlap and cast onto each
 * other**, and that they are **animated with springs rather than keyframes**.
 * A single shaded circle cannot get there by trying harder.
 *
 * So she is now seven overlapping forms — tail, far wing, body, belly, near
 * wing, head, crest — each with its own light-to-core-shadow-to-reflected-light
 * ramp, and each casting a contact shadow onto whatever sits behind it. The
 * head sits *in front of* the body and darkens it where they meet; that single
 * shadow does more for the impression of depth than every gradient combined.
 *
 * Proportions are the caricature every mascot of this kind uses: a head far too
 * big for the body, eyes far too big for the head. It is what survives being
 * shrunk to a 24px tile, and it is what children draw when asked to draw a
 * character.
 *
 * Motion comes from `mascot/rig.ts` — springs, chained so each part arrives
 * after the one it hangs off. Nothing here is a CSS keyframe, because a
 * keyframe cannot overshoot, cannot be interrupted, and cannot lag.
 */

interface Face {
  brow: number;
  browRot: number;
  browAsym: number;
  eyeOpen: number;
  closed: 'happy' | 'sleepy';
  blush: number;
  sparkle: boolean;
}

const FACES: Record<Mood, Face> = {
  happy:       { brow: 0,  browRot: -8,  browAsym: 1,   eyeOpen: 1,    closed: 'happy',  blush: 0.85, sparkle: true },
  excited:     { brow: -7, browRot: -16, browAsym: 1,   eyeOpen: 1.1,  closed: 'happy',  blush: 1,    sparkle: true },
  curious:     { brow: -5, browRot: -14, browAsym: 0.1, eyeOpen: 1,    closed: 'happy',  blush: 0.7,  sparkle: true },
  proud:       { brow: -3, browRot: -5,  browAsym: 1,   eyeOpen: 0.12, closed: 'happy',  blush: 0.95, sparkle: false },
  encouraging: { brow: -6, browRot: -12, browAsym: 1,   eyeOpen: 0.95, closed: 'happy',  blush: 0.9,  sparkle: true },
  oops:        { brow: -5, browRot: 20,  browAsym: 1,   eyeOpen: 1.08, closed: 'happy',  blush: 0.8,  sparkle: false },
  awake:       { brow: -2, browRot: -6,  browAsym: 1,   eyeOpen: 1,    closed: 'happy',  blush: 0.75, sparkle: true },
  soft:        { brow: 2,  browRot: -2,  browAsym: 1,   eyeOpen: 0.5,  closed: 'sleepy', blush: 0.8,  sparkle: false },
  sleepy:      { brow: 6,  browRot: 13,  browAsym: 1,   eyeOpen: 0.05, closed: 'sleepy', blush: 0.75, sparkle: false },
};

/** Which resting gesture a mood implies. */
const MOOD_GESTURE: Partial<Record<Mood, Gesture>> = { sleepy: 'sleep', soft: 'sleep' };

const EYE = { lx: 96, rx: 144, cy: 96, rx_: 25, ry: 26 };

export function Mascot({
  size = 200,
  mood = 'happy',
  action = 'idle',
  hopping = false,
  autoHop = false,
  hat = null,
  alive = true,
  title = 'Lumi',
}: MascotProps) {
  const f = FACES[mood];
  const resting = MOOD_GESTURE[mood] ?? (action === 'fly' ? 'cheer' : 'idle');
  const { ref, trigger } = useMascotRig({
    energy: alive ? (mood === 'sleepy' ? 0.25 : mood === 'soft' ? 0.55 : 1) : 0,
    gesture: resting,
  });

  // A hop is a one-shot gesture, not a state: firing it again mid-flight
  // restarts it cleanly because the spring keeps whatever velocity it had.
  useEffect(() => {
    if (hopping) trigger('hop');
  }, [hopping, trigger]);

  useEffect(() => {
    if (action === 'spin') trigger('spin');
  }, [action, trigger]);

  useEffect(() => {
    if (!autoHop || mood === 'sleepy') return;
    const id = window.setInterval(() => trigger(mood === 'proud' ? 'cheer' : 'hop'), 3600);
    return () => window.clearInterval(id);
  }, [autoHop, mood, trigger]);

  const shut = f.eyeOpen <= 0.2;

  return (
    <svg
      ref={ref}
      className={`lumi lumi--${action}${mood === 'sleepy' ? ' lumi--asleep' : ''}`}
      width={size}
      height={size}
      viewBox="0 0 240 252"
      role="img"
      aria-label={title}
    >
      <defs>
        {/*
          One ramp per volume, and every one ends BRIGHTER than its core shadow.
          That last band is reflected light, where a surface turns away from the
          key and picks light back up off its surroundings. Leave it out and the
          edge of a form goes dead flat, which is the difference between a
          drawing of a ball and a ball.
        */}
        <radialGradient id="lu-head" cx="34%" cy="26%" r="82%">
          <stop offset="0%" stopColor="#a8fdf0" />
          <stop offset="34%" stopColor="#45e6d1" />
          <stop offset="68%" stopColor="#14bfab" />
          <stop offset="90%" stopColor="#06786c" />
          <stop offset="100%" stopColor="#1cc4b1" />
        </radialGradient>

        <radialGradient id="lu-body" cx="36%" cy="22%" r="86%">
          <stop offset="0%" stopColor="#7cf2e2" />
          <stop offset="40%" stopColor="#25d3bf" />
          <stop offset="74%" stopColor="#0ba392" />
          <stop offset="92%" stopColor="#046156" />
          <stop offset="100%" stopColor="#16b6a3" />
        </radialGradient>

        <radialGradient id="lu-belly" cx="42%" cy="26%" r="78%">
          <stop offset="0%" stopColor="#fffdf2" />
          <stop offset="42%" stopColor="#ffec84" />
          <stop offset="82%" stopColor="#ffc316" />
          <stop offset="100%" stopColor="#e89b00" />
        </radialGradient>

        <linearGradient id="lu-wing" x1="0.3" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="#5fead9" />
          <stop offset="62%" stopColor="#12ac9b" />
          <stop offset="100%" stopColor="#23c6b3" />
        </linearGradient>

        <linearGradient id="lu-wing-far" x1="0.3" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="#1fae9e" />
          <stop offset="100%" stopColor="#0a7166" />
        </linearGradient>

        <linearGradient id="lu-crest" x1="0" y1="1" x2="0.35" y2="0">
          <stop offset="0%" stopColor="#e03c74" />
          <stop offset="55%" stopColor="#ff6d9b" />
          <stop offset="100%" stopColor="#ffb9cf" />
        </linearGradient>

        <linearGradient id="lu-beak" x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stopColor="#ffd08a" />
          <stop offset="38%" stopColor="#ff9c33" />
          <stop offset="100%" stopColor="#ef4f26" />
        </linearGradient>

        <linearGradient id="lu-foot" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffab6b" />
          <stop offset="100%" stopColor="#ef6a34" />
        </linearGradient>

        {/* The shadow the head throws down the body. This is the single most
            load-bearing thing in the whole drawing. */}
        <radialGradient id="lu-cast" cx="50%" cy="0%" r="86%">
          <stop offset="0%" stopColor="#013b35" stopOpacity="0.52" />
          <stop offset="58%" stopColor="#013b35" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#013b35" stopOpacity="0" />
        </radialGradient>

        {/* Where the belly patch sits into the body. */}
        <radialGradient id="lu-seam" cx="50%" cy="50%" r="50%">
          <stop offset="72%" stopColor="#014139" stopOpacity="0" />
          <stop offset="85%" stopColor="#014139" stopOpacity="0.42" />
          <stop offset="100%" stopColor="#014139" stopOpacity="0" />
        </radialGradient>

        <radialGradient id="lu-spec" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.62" />
          <stop offset="62%" stopColor="#ffffff" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>

        <radialGradient id="lu-blush" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ff8ab8" stopOpacity="0.92" />
          <stop offset="58%" stopColor="#ff8ab8" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#ff8ab8" stopOpacity="0" />
        </radialGradient>

        <linearGradient id="lu-sclera" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#cfc4b4" />
          <stop offset="24%" stopColor="#fffdf7" />
          <stop offset="100%" stopColor="#fffdf7" />
        </linearGradient>

        <clipPath id="lu-body-clip">
          <ellipse cx="120" cy="170" rx="54" ry="52" />
        </clipPath>
        <clipPath id="lu-head-clip">
          <ellipse cx="120" cy="94" rx="68" ry="64" />
        </clipPath>
      </defs>

      {/* Ground shadow. It answers the hop rather than travelling with it. */}
      <ellipse className="lumi__cast" cx="120" cy="238" rx="56" ry="9" fill="#001f1c" />

      <g className="lumi__rig">
        {/* ---- behind the body ---- */}
        {/*
          A tail is a solid fan of overlapping feathers, tucked UNDER the body so
          it looks attached. Drawn as separate thin strokes it read as scratch
          marks floating beside her — three lines are a tally, not a tail.
        */}
        <g className="lumi__tail">
          <path d="M150 178 C186 172 208 152 216 126 C222 156 206 186 172 198 Z" fill="#0a7f73" />
          <path d="M150 184 C188 184 214 174 232 152 C230 188 202 208 166 206 Z" fill="#0c9083" />
          <path d="M150 190 C184 196 210 196 232 186 C214 212 180 218 156 210 Z" fill="#0e9e90" />
        </g>

        {/*
          Wings must OVERLAP the body. Floated out beside it they read as two
          detached blobs — which is exactly what they did, because the body only
          reaches x=66 and the wing started at 62.
        */}
        <g className="lumi__wing lumi__wing--far">
          <path
            d="M86 140 C52 142 30 166 34 192 C37 214 56 222 74 214 C86 208 90 176 86 140 Z"
            fill="url(#lu-wing-far)"
          />
        </g>

        {/* ---- body ---- */}
        <g className="lumi__body">
          <ellipse cx="120" cy="170" rx="54" ry="52" fill="url(#lu-body)" />

          <g clipPath="url(#lu-body-clip)">
            {/* The head's cast shadow. Clipped to the body so it lands ON it. */}
            <ellipse cx="120" cy="118" rx="72" ry="44" fill="url(#lu-cast)" />
          </g>

          <ellipse cx="120" cy="180" rx="46" ry="44" fill="url(#lu-seam)" />
          <ellipse cx="120" cy="180" rx="36" ry="35" fill="url(#lu-belly)" />
          <ellipse cx="104" cy="160" rx="16" ry="11" fill="url(#lu-spec)" transform="rotate(-28 104 160)" />
        </g>

        {/* ---- feet, in front of the body ---- */}
        {/* Three toes each, at a size that survives a 24px tile. */}
        <g className="lumi__feet" fill="url(#lu-foot)">
          <rect x="98" y="206" width="10" height="14" rx="5" />
          <rect x="132" y="206" width="10" height="14" rx="5" />
          <path d="M103 218 L86 232 L99 232 Z" />
          <path d="M103 218 L103 234 L108 234 L108 218 Z" />
          <path d="M103 218 L120 232 L107 232 Z" />
          <path d="M137 218 L120 232 L133 232 Z" />
          <path d="M137 218 L137 234 L142 234 L142 218 Z" />
          <path d="M137 218 L154 232 L141 232 Z" />
        </g>

        {/* ---- near wing, overlapping the body edge ---- */}
        <g className="lumi__wing lumi__wing--near">
          {/* Its own contact shadow, offset toward the light's opposite. Without
              one the wing is a decal lying flat on the body. */}
          <path
            d="M154 140 C188 142 210 166 206 192 C203 214 184 222 166 214 C154 208 150 176 154 140 Z"
            fill="#04564d"
            transform="translate(3 4)"
          />
          <path
            d="M154 140 C188 142 210 166 206 192 C203 214 184 222 166 214 C154 208 150 176 154 140 Z"
            fill="url(#lu-wing)"
          />
        </g>

        {/* ---- head, in front of everything ---- */}
        <g className="lumi__head">
          {/*
            Three feathers of different lengths, all swept the same way. Equal
            and symmetrical they read as rabbit ears; raked back they read as a
            crest, and the sweep also gives the follow-through something to show.
          */}
          <g className="lumi__crest">
            <path d="M102 42 C88 26 82 12 90 4 C102 12 108 28 110 44 Z" fill="url(#lu-crest)" />
            <path d="M119 38 C112 16 116 -2 128 -6 C138 8 133 26 127 42 Z" fill="url(#lu-crest)" />
            <path d="M134 44 C140 26 152 14 163 16 C162 32 150 42 141 48 Z" fill="url(#lu-crest)" />
          </g>

          <Hat id={hat} />

          <ellipse cx="120" cy="94" rx="68" ry="64" fill="url(#lu-head)" />
          <g clipPath="url(#lu-head-clip)">
            <ellipse cx="74" cy="52" rx="34" ry="24" fill="url(#lu-spec)" transform="rotate(-24 74 52)" />
          </g>

          {/* The back of the head, shown as she comes round. No face on it —
              that absence IS the effect. */}
          <g className="lumi__back">
            <ellipse cx="120" cy="94" rx="68" ry="64" fill="url(#lu-head)" />
            <ellipse cx="120" cy="104" rx="30" ry="24" fill="#0a8d7f" opacity="0.45" />
          </g>

          {/* Everything that swings round the cylinder of the head. */}
          <g className="lumi__face">
            <g className="lumi__blush">
              <ellipse cx="66" cy="118" rx="18" ry="11" fill="url(#lu-blush)" opacity={f.blush} />
              <ellipse cx="174" cy="118" rx="18" ry="11" fill="url(#lu-blush)" opacity={f.blush} />
            </g>

            {shut ? (
              <g stroke="#0d3a37" strokeWidth="6" fill="none" strokeLinecap="round">
                <path d={lid(EYE.lx, f.closed)} />
                <path d={lid(EYE.rx, f.closed)} />
              </g>
            ) : (
              <g className="lumi__eyes">
                {([['l', EYE.lx], ['r', EYE.rx]] as const).map(([side, cx]) => (
                  <g key={side} className={`lumi__eye lumi__eye--${side}`}>
                    <ellipse
                      cx={cx} cy={EYE.cy}
                      rx={EYE.rx_} ry={EYE.ry * f.eyeOpen}
                      fill="url(#lu-sclera)"
                    />
                    <g className="lumi__pupil">
                      <circle cx={cx} cy={EYE.cy} r="13" fill="#0d3a37" />
                      <circle cx={cx - 5} cy={EYE.cy - 6} r="5.5" fill="#fff" />
                      <circle cx={cx + 5} cy={EYE.cy + 5} r="2.4" fill="#fff" opacity="0.85" />
                    </g>
                  </g>
                ))}
              </g>
            )}

            <g fill="#06857a">
              <g
                className="lumi__brow"
                style={{ transform: `translateY(${f.brow}px) rotate(${f.browRot}deg)` }}
              >
                <rect x={EYE.lx - 19} y={54} width="38" height="9" rx="4.5" />
              </g>
              <g
                className="lumi__brow"
                style={{ transform: `translateY(${f.brow}px) rotate(${-f.browRot * f.browAsym}deg)` }}
              >
                <rect x={EYE.rx - 19} y={54} width="38" height="9" rx="4.5" />
              </g>
            </g>

            <g className="lumi__beak">
              <path d="M100 122 L140 122 L120 148 Z" fill="url(#lu-beak)" />
              {/* The lit top ridge. A beak is a wedge; a flat one is a triangle. */}
              <path d="M100 122 L140 122 L131 129 L109 129 Z" fill="#ffdcae" opacity="0.6" />
              <path className="lumi__beak-lower" d="M104 129 L136 129 L120 152 Z" fill="#b93317" />
            </g>
          </g>
        </g>

        {f.sparkle && (
          <g className="lumi__sparkle" fill="#fff3d4">
            <path d="M206 44 l4 10 10 4 -10 4 -4 10 -4 -10 -10 -4 10 -4 Z" />
            <path d="M28 66 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3 Z" opacity="0.7" />
          </g>
        )}
      </g>

      {mood === 'sleepy' && (
        <g className="lumi__zzz" fill="#ffe0b4" fontWeight="700">
          <text x="196" y="54" fontSize="19">z</text>
          <text x="212" y="34" fontSize="14">z</text>
          <text x="224" y="19" fontSize="10">z</text>
        </g>
      )}
    </svg>
  );
}

/** Closed eyes are a curve, not a flat line — a line reads as unconscious. */
function lid(cx: number, closed: 'happy' | 'sleepy'): string {
  return closed === 'happy'
    ? `M${cx - 21} ${EYE.cy + 4} Q${cx} ${EYE.cy - 17} ${cx + 21} ${EYE.cy + 4}`
    : `M${cx - 21} ${EYE.cy - 2} Q${cx} ${EYE.cy + 15} ${cx + 21} ${EYE.cy - 2}`;
}

/** Hats that sit on top of the head, as opposed to on the forehead. */
const CREST_COVERING = new Set(['acorn-cap', 'nightcap', 'star-crown', 'petal-wreath']);

export function hidesCrest(hat: string | null): boolean {
  return hat !== null && CREST_COVERING.has(hat);
}

/**
 * Nest hats.
 *
 * Drawn inside `.lumi__head`, so a hat inherits the head's rotation and the
 * revolve for free and never has to be told about either. Flat shapes rather
 * than gradients: a hat has to read at 110px in a shelf tile, where a soft
 * gradient turns to mud.
 */
function Hat({ id }: { id: string | null }) {
  if (!id) return null;

  if (id === 'acorn-cap') {
    return (
      <g aria-hidden="true">
        <path d="M58 44 C58 4 182 4 182 44 Z" fill="#a4652f" />
        <ellipse cx="120" cy="44" rx="64" ry="9" fill="#8b5426" />
        <rect x="113" y="0" width="14" height="18" rx="7" fill="#6d4120" />
      </g>
    );
  }

  if (id === 'nightcap') {
    return (
      <g aria-hidden="true">
        <path d="M58 46 C62 10 118 2 158 8 C182 11 198 10 206 9 C190 24 152 35 122 41 C102 45 74 44 58 46 Z" fill="#5b6bd6" />
        <path d="M58 46 C62 18 108 8 140 10 C118 20 92 34 78 46 Z" fill="#6b7ae4" />
        <circle cx="207" cy="10" r="13" fill="#fdf6ec" />
        <ellipse cx="120" cy="46" rx="66" ry="11" fill="#fdf6ec" />
      </g>
    );
  }

  if (id === 'star-crown') {
    return (
      <g aria-hidden="true" fill="#ffcf8f">
        <path d="M60 46 L72 10 L96 34 L120 2 L144 34 L168 10 L180 46 Z" />
        <circle cx="120" cy="2" r="7" fill="#fff3d6" />
      </g>
    );
  }

  if (id === 'goggles') {
    return (
      <g aria-hidden="true">
        <rect x="44" y="30" width="152" height="13" rx="6" fill="#6d4120" />
        <circle cx="84" cy="30" r="25" fill="#3b2a1a" />
        <circle cx="156" cy="30" r="25" fill="#3b2a1a" />
        <circle cx="84" cy="30" r="17" fill="#9ff0d4" opacity="0.85" />
        <circle cx="156" cy="30" r="17" fill="#9ff0d4" opacity="0.85" />
      </g>
    );
  }

  if (id === 'petal-wreath') {
    const petals = [60, 84, 108, 132, 156, 180];
    return (
      <g aria-hidden="true">
        <path d="M56 42 C70 16 170 16 184 42" stroke="#2f8f5b" strokeWidth="9" fill="none" strokeLinecap="round" />
        {petals.map((x, i) => (
          <circle key={x} cx={x} cy={i % 2 ? 24 : 30} r="13" fill={i % 2 ? '#ff8fb1' : '#ffd6e3'} />
        ))}
      </g>
    );
  }

  return null;
}
