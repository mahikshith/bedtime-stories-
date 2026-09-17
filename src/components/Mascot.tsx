import { useEffect, useId } from 'react';
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
  /**
   * Colour scheme. Ember is the default; the rest are real alternatives rather
   * than tints, and each sits on the app's indigo differently.
   */
  skin?: 'plum' | 'berry' | 'cocoa';
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
  skin,
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

  /*
   * Gradient ids have to be unique per instance.
   *
   * Every Mascot emits its own <defs>, and `url(#lu-head)` resolves against the
   * WHOLE document — so the browser hands every mascot on the page the first
   * one's gradients. Four colour variants rendered side by side all came out
   * the colour of whichever was mounted first, and nothing errored. `useId`
   * returns a value containing colons, which are legal in an id but awkward
   * in a url(), so it is reduced to word characters.
   */
  const uid = `lu${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const g = (name: string) => `${uid}-${name}`;
  const url = (name: string) => `url(#${g(name)})`;

  return (
    <svg
      ref={ref}
      className={[
        'lumi',
        `lumi--${action}`,
        skin ? `lumi--${skin}` : '',
        mood === 'sleepy' ? 'lumi--asleep' : '',
      ].filter(Boolean).join(' ')}
      width={size}
      height={size}
      viewBox="0 0 240 252"
      role="img"
      aria-label={title}
    >
      <defs>
        {/*
          Every colour comes from a custom property, so the whole creature can be
          recoloured from one place — a stylesheet, a variant class, or a theme —
          without touching a single path. Hard-coding them into the stops is what
          made the last two versions a rewrite to recolour instead of an edit.

          Each ramp still ends BRIGHTER than its core shadow. That last band is
          reflected light, where a surface turns away from the key and picks light
          back up off its surroundings; leave it out and the edge of a form goes
          dead flat.
        */}
        <radialGradient id={g("head")} cx="34%" cy="24%" r="84%">
          <stop offset="0%" stopColor="var(--fur-lit)" />
          <stop offset="34%" stopColor="var(--fur-hi)" />
          <stop offset="68%" stopColor="var(--fur-mid)" />
          <stop offset="90%" stopColor="var(--fur-core)" />
          <stop offset="100%" stopColor="var(--fur-bounce)" />
        </radialGradient>

        <radialGradient id={g("body")} cx="36%" cy="20%" r="88%">
          <stop offset="0%" stopColor="var(--fur-hi)" />
          <stop offset="40%" stopColor="var(--fur-mid)" />
          <stop offset="76%" stopColor="var(--fur-core)" />
          <stop offset="92%" stopColor="var(--fur-deep)" />
          <stop offset="100%" stopColor="var(--fur-bounce)" />
        </radialGradient>

        <radialGradient id={g("belly")} cx="42%" cy="24%" r="80%">
          <stop offset="0%" stopColor="var(--belly-lit)" />
          <stop offset="46%" stopColor="var(--belly-mid)" />
          <stop offset="86%" stopColor="var(--belly-deep)" />
          <stop offset="100%" stopColor="var(--belly-edge)" />
        </radialGradient>

        <radialGradient id={g("inner-ear")} cx="42%" cy="26%" r="76%">
          <stop offset="0%" stopColor="var(--ear-lit)" />
          <stop offset="62%" stopColor="var(--ear-mid)" />
          <stop offset="100%" stopColor="var(--ear-deep)" />
        </radialGradient>

        <linearGradient id={g("arm")} x1="0.3" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="var(--fur-hi)" />
          <stop offset="64%" stopColor="var(--fur-core)" />
          <stop offset="100%" stopColor="var(--fur-bounce)" />
        </linearGradient>

        <linearGradient id={g("arm-far")} x1="0.3" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="var(--fur-core)" />
          <stop offset="100%" stopColor="var(--fur-deep)" />
        </linearGradient>

        {/* The lantern she is named for: the light is INSIDE her. */}
        <radialGradient id={g("lantern")} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--glow-core)" stopOpacity="0.95" />
          <stop offset="42%" stopColor="var(--glow-mid)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="var(--glow-mid)" stopOpacity="0" />
        </radialGradient>

        {/* The shadow the head throws down the body: the single most
            load-bearing thing in the whole drawing. */}
        <radialGradient id={g("cast")} cx="50%" cy="0%" r="88%">
          <stop offset="0%" stopColor="var(--shade)" stopOpacity="0.55" />
          <stop offset="58%" stopColor="var(--shade)" stopOpacity="0.17" />
          <stop offset="100%" stopColor="var(--shade)" stopOpacity="0" />
        </radialGradient>

        <radialGradient id={g("seam")} cx="50%" cy="50%" r="50%">
          <stop offset="72%" stopColor="var(--shade)" stopOpacity="0" />
          <stop offset="85%" stopColor="var(--shade)" stopOpacity="0.4" />
          <stop offset="100%" stopColor="var(--shade)" stopOpacity="0" />
        </radialGradient>

        <radialGradient id={g("spec")} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.6" />
          <stop offset="62%" stopColor="#ffffff" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>

        <radialGradient id={g("blush")} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--blush)" stopOpacity="0.9" />
          <stop offset="58%" stopColor="var(--blush)" stopOpacity="0.46" />
          <stop offset="100%" stopColor="var(--blush)" stopOpacity="0" />
        </radialGradient>

        <linearGradient id={g("sclera")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d6ccbe" />
          <stop offset="24%" stopColor="#fffdf7" />
          <stop offset="100%" stopColor="#fffdf7" />
        </linearGradient>

        <clipPath id={g("body-clip")}>
          <ellipse cx="120" cy="178" rx="52" ry="48" />
        </clipPath>
        <clipPath id={g("head-clip")}>
          <ellipse cx="120" cy="102" rx="66" ry="60" />
        </clipPath>
      </defs>

      <ellipse className="lumi__cast" cx="120" cy="240" rx="54" ry="9" fill="var(--shade)" />

      <g className="lumi__rig">
        {/* ---- behind everything ---- */}
        <g className="lumi__tail">
          <circle cx="182" cy="200" r="20" fill="var(--fur-deep)" />
          <circle cx="180" cy="197" r="17" fill="var(--fur-core)" />
        </g>

        <g className="lumi__arm lumi__arm--far">
          <path d="M84 156 C56 154 42 176 48 198 C53 216 72 222 88 212 Z" fill={url("arm-far")} />
        </g>

        {/* ---- body ---- */}
        <g className="lumi__body">
          <ellipse cx="120" cy="178" rx="52" ry="48" fill={url("body")} />
          <g clipPath={url("body-clip")}>
            <ellipse cx="120" cy="128" rx="70" ry="42" fill={url("cast")} />
          </g>
          <ellipse cx="120" cy="186" rx="42" ry="40" fill={url("seam")} />
          <ellipse cx="120" cy="186" rx="33" ry="32" fill={url("belly")} />
          {/* The lantern mark. She is not carrying the light, she is the light. */}
          <ellipse className="lumi__lantern" cx="120" cy="186" rx="26" ry="25" fill={url("lantern")} />
          <ellipse cx="106" cy="166" rx="13" ry="9" fill={url("spec")} transform="rotate(-28 106 166)" />
        </g>

        {/* ---- feet, in front of the body ---- */}
        <g className="lumi__feet">
          <ellipse cx="98" cy="222" rx="19" ry="12" fill="var(--paw-deep)" />
          <ellipse cx="142" cy="222" rx="19" ry="12" fill="var(--paw-deep)" />
          <ellipse cx="97" cy="220" rx="17" ry="10.5" fill="var(--paw)" />
          <ellipse cx="141" cy="220" rx="17" ry="10.5" fill="var(--paw)" />
        </g>

        {/* ---- near arm, overlapping the body edge ---- */}
        <g className="lumi__arm lumi__arm--near">
          <path
            d="M156 156 C184 154 198 176 192 198 C187 216 168 222 152 212 Z"
            fill="var(--fur-deep)"
            transform="translate(3 4)"
          />
          <path d="M156 156 C184 154 198 176 192 198 C187 216 168 222 152 212 Z" fill={url("arm")} />
        </g>

        {/* ---- head ---- */}
        <g className="lumi__head">
          {/*
            Ears, not a crest. They are the silhouette: the single fastest way
            to say "this is not a bird" at any size, and they are soft enough to
            take the follow-through the rig gives them.
          */}
          <g className="lumi__ears">
            <g transform="rotate(-16 74 56)">
              <ellipse cx="74" cy="52" rx="27" ry="40" fill="var(--fur-core)" />
              <ellipse cx="74" cy="52" rx="26" ry="39" fill={url("head")} />
              <ellipse cx="76" cy="56" rx="14" ry="24" fill={url("inner-ear")} />
            </g>
            <g transform="rotate(16 166 56)">
              <ellipse cx="166" cy="52" rx="27" ry="40" fill="var(--fur-core)" />
              <ellipse cx="166" cy="52" rx="26" ry="39" fill={url("head")} />
              <ellipse cx="164" cy="56" rx="14" ry="24" fill={url("inner-ear")} />
            </g>
          </g>

          <g className="lumi__tuft">
            <path d="M112 50 C106 30 110 16 120 12 C130 18 128 34 124 50 Z" fill="var(--fur-hi)" />
            <path d="M126 52 C130 36 140 26 149 26 C148 40 138 50 130 56 Z" fill="var(--fur-mid)" />
          </g>

          <Hat id={hat} />

          <ellipse cx="120" cy="102" rx="66" ry="60" fill={url("head")} />
          <g clipPath={url("head-clip")}>
            <ellipse cx="78" cy="62" rx="32" ry="22" fill={url("spec")} transform="rotate(-24 78 62)" />
          </g>

          <g className="lumi__back">
            <ellipse cx="120" cy="102" rx="66" ry="60" fill={url("head")} />
            <ellipse cx="120" cy="112" rx="28" ry="22" fill="var(--fur-core)" opacity="0.5" />
          </g>

          <g className="lumi__face">
            <g className="lumi__blush">
              <ellipse cx="68" cy="124" rx="18" ry="11" fill={url("blush")} opacity={f.blush} />
              <ellipse cx="172" cy="124" rx="18" ry="11" fill={url("blush")} opacity={f.blush} />
            </g>

            {/* A muzzle, a nose and a mouth — nothing that could be a beak. */}
            <g className="lumi__muzzle">
              <ellipse cx="120" cy="128" rx="32" ry="24" fill="var(--muzzle)" />
              <ellipse cx="120" cy="124" rx="30" ry="21" fill="var(--muzzle-lit)" />
            </g>

            {shut ? (
              <g stroke="var(--line)" strokeWidth="6" fill="none" strokeLinecap="round">
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
                      fill={url("sclera")}
                    />
                    <g className="lumi__pupil">
                      <circle cx={cx} cy={EYE.cy} r="13" fill="var(--line)" />
                      <circle cx={cx - 5} cy={EYE.cy - 6} r="5.5" fill="#fff" />
                      <circle cx={cx + 5} cy={EYE.cy + 5} r="2.4" fill="#fff" opacity="0.85" />
                    </g>
                  </g>
                ))}
              </g>
            )}

            <g fill="var(--brow)">
              <g
                className="lumi__brow"
                style={{ transform: `translateY(${f.brow}px) rotate(${f.browRot}deg)` }}
              >
                <rect x={EYE.lx - 19} y={60} width="38" height="9" rx="4.5" />
              </g>
              <g
                className="lumi__brow"
                style={{ transform: `translateY(${f.brow}px) rotate(${-f.browRot * f.browAsym}deg)` }}
              >
                <rect x={EYE.rx - 19} y={60} width="38" height="9" rx="4.5" />
              </g>
            </g>

            <g className="lumi__snout">
              <path d="M110 118 Q120 112 130 118 Q120 129 110 118 Z" fill="var(--nose)" />
              <path
                className="lumi__mouth"
                d="M120 127 Q112 137 104 130 M120 127 Q128 137 136 130"
                stroke="var(--line)"
                strokeWidth="4.5"
                strokeLinecap="round"
                fill="none"
              />
            </g>
          </g>
        </g>

        {f.sparkle && (
          <g className="lumi__sparkle" fill="var(--glow-core)">
            <path d="M210 52 l4 10 10 4 -10 4 -4 10 -4 -10 -10 -4 10 -4 Z" />
            <path d="M24 74 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3 Z" opacity="0.7" />
          </g>
        )}
      </g>

      {mood === 'sleepy' && (
        <g className="lumi__zzz" fill="var(--glow-core)" fontWeight="700">
          <text x="198" y="56" fontSize="19">z</text>
          <text x="214" y="36" fontSize="14">z</text>
          <text x="226" y="21" fontSize="10">z</text>
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
