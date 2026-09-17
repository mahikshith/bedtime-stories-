import { useEffect, useState } from 'react';
import { useMascotLife } from './mascot/useMascotLife';

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
  /** Body motion. The face still carries the mood on top of it. */
  action?: Action;
  /** Squash-and-stretch hop. Ignored under prefers-reduced-motion via CSS. */
  hopping?: boolean;
  /** Hop on a timer without an external driver. */
  autoHop?: boolean;
  /** A Nest hat id. Drawn over the crest, so a hat covers it rather than clashing. */
  hat?: string | null;
  /**
   * Idle life: breathing, weight shifts, glances, blinks. On by default,
   * because a mascot that only moves when spoken to is a puppet. Turn it off
   * for a still frame — a screenshot, a print, an icon.
   */
  alive?: boolean;
  title?: string;
}

/**
 * Lumi — the lantern-bird.
 *
 * Rebuilt as a bird because the previous round blob had no silhouette and no
 * face to speak of. What makes a mascot legible at 24px and lovable at 200px is
 * the same thing: a distinctive outline plus a face that can actually feel
 * something.
 *
 * **Eyebrows do almost all of the emotional work.** A face without them reads
 * blank no matter how big the eyes are; two rotated bars above the eyes carry
 * happy, worried, curious and proud between them. Everything else — eye
 * openness, pupil direction, beak opening, wing lift, head tilt — is a
 * modifier on that.
 *
 * **She is drawn flat and shaded round.** The trick that makes a vector
 * character read as a solid object is not a gradient from light to dark: it is
 * the full sequence a lit form actually has — highlight, midtone, *core
 * shadow*, and then a band of reflected light at the very edge where the
 * surface turns away and picks light back up off its surroundings. Leave the
 * reflected light out and the silhouette goes dead flat at the rim, which is
 * what separates a sticker from an illustration. On top of that sit contact
 * occlusion where forms meet, one specular, a rim light, and a shadow on the
 * ground that squashes when she lands.
 *
 * **And she turns.** `--turn` slides every feature by a different amount —
 * the beak furthest, the eyes next, the crest least — and narrows whichever
 * eye is going away. Parallax between parts at different depths is the whole
 * of why a rotating flat drawing reads as a head rather than as a slide.
 *
 * Drawn inline so it ships offline, scales without artefacts, needs no image
 * pipeline, and can react to the sleep gradient.
 *
 * **Colour is deliberately fixed, not themed.** A mascot that changes colour
 * with the palette is a shape, not a character — Duo is the same green
 * everywhere. Lumi stays turquoise on every theme.
 *
 * The hues come from the research rather than taste: children's preference
 * correlates positively with saturation across every hue family, they favour
 * bright over deep (darker shades read as negative to them), and warm hues
 * slightly dominate. So: a vividly saturated turquoise body carrying the warm
 * colours where they count — a sunny-yellow lantern belly and a coral beak and
 * feet. Complementary teal-against-coral is the highest-chroma pairing
 * available, which is why it stays legible on all six palettes.
 */

interface Face {
  /** Vertical brow offset. Negative is raised. */
  browY: number;
  /** Brow rotation in degrees. Positive tilts the INNER end up (worried). */
  browRot: number;
  /** Asymmetry factor for the right brow — 1 mirrors, <1 cocks one brow. */
  browAsym: number;
  /** 1 is wide open; below 0.2 the eye is drawn as a closed arc. */
  eyeOpen: number;
  /** Closed-eye shape: a contented upward arc or a sleeping downward one. */
  closed: 'happy' | 'sleepy';
  pupilX: number;
  pupilY: number;
  /** 0 shut, 1 wide. */
  beak: number;
  /** Wing lift in degrees. Negative is up. */
  wing: number;
  /** One wing raised in a wave. */
  wave: boolean;
  blush: number;
  /** Whole-head tilt. */
  tilt: number;
  sparkle: boolean;
  zzz: boolean;
}

const FACES: Record<Mood, Face> = {
  happy:       { browY: 0,  browRot: -8,  browAsym: 1,   eyeOpen: 1,    closed: 'happy',  pupilX: 0, pupilY: 0,  beak: 0.18, wing: 0,   wave: false, blush: 0.55, tilt: 0,  sparkle: true,  zzz: false },
  excited:     { browY: -9, browRot: -16, browAsym: 1,   eyeOpen: 1.12, closed: 'happy',  pupilX: 0, pupilY: -2, beak: 0.75, wing: -24, wave: false, blush: 0.72, tilt: 0,  sparkle: true,  zzz: false },
  curious:     { browY: -5, browRot: -14, browAsym: 0.1, eyeOpen: 1,    closed: 'happy',  pupilX: 6, pupilY: 0,  beak: 0.1,  wing: 0,   wave: false, blush: 0.4,  tilt: -7, sparkle: true,  zzz: false },
  proud:       { browY: -3, browRot: -5,  browAsym: 1,   eyeOpen: 0.14, closed: 'happy',  pupilX: 0, pupilY: 0,  beak: 0.34, wing: -12, wave: false, blush: 0.62, tilt: 0,  sparkle: false, zzz: false },
  encouraging: { browY: -7, browRot: -12, browAsym: 1,   eyeOpen: 0.96, closed: 'happy',  pupilX: 0, pupilY: -1, beak: 0.46, wing: -8,  wave: true,  blush: 0.6,  tilt: -3, sparkle: true,  zzz: false },
  oops:        { browY: -6, browRot: 20,  browAsym: 1,   eyeOpen: 1.1,  closed: 'happy',  pupilX: 0, pupilY: 2,  beak: 0.22, wing: 9,   wave: false, blush: 0.5,  tilt: 4,  sparkle: false, zzz: false },
  // Legacy moods kept so every existing call site still reads correctly.
  awake:       { browY: -2, browRot: -6,  browAsym: 1,   eyeOpen: 1,    closed: 'happy',  pupilX: 0, pupilY: 0,  beak: 0.12, wing: 0,   wave: false, blush: 0.45, tilt: 0,  sparkle: true,  zzz: false },
  soft:        { browY: 2,  browRot: -2,  browAsym: 1,   eyeOpen: 0.5,  closed: 'sleepy', pupilX: 0, pupilY: 1,  beak: 0.08, wing: 3,   wave: false, blush: 0.5,  tilt: 0,  sparkle: false, zzz: false },
  sleepy:      { browY: 7,  browRot: 13,  browAsym: 1,   eyeOpen: 0.05, closed: 'sleepy', pupilX: 0, pupilY: 3,  beak: 0,    wing: 7,   wave: false, blush: 0.45, tilt: 3,  sparkle: false, zzz: true  },
};

/** Periodic self-triggered hop, for Lumi outside the hopping buddy layer. */
function useAutoHop(enabled: boolean): boolean {
  const [hopping, setHopping] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let stop: number | undefined;
    const id = window.setInterval(() => {
      setHopping(true);
      stop = window.setTimeout(() => setHopping(false), 850);
    }, 4200);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(stop);
    };
  }, [enabled]);
  return hopping;
}

const EYE = { lx: 94, rx: 146, cy: 112, rx_: 26, ry: 27 };

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
  const autoHopping = useAutoHop(autoHop && mood !== 'sleepy');
  /*
   * `proud` and `oops` are held poses — the body is making a point, and a head
   * wandering off mid-point undercuts it. Sleepy barely moves but never stops
   * breathing.
   */
  const rig = useMascotLife(alive, {
    energy: mood === 'sleepy' ? 0.22 : mood === 'soft' ? 0.5 : 1,
    frozen: mood === 'proud' || mood === 'oops',
  });
  const isHopping = hopping || autoHopping;
  const f = FACES[mood];
  const shut = f.eyeOpen <= 0.2;

  /** Closed eyes are a curve, not a flat line — a line reads as unconscious. */
  const lid = (cx: number) =>
    f.closed === 'happy'
      ? `M${cx - 22} ${EYE.cy + 4} Q${cx} ${EYE.cy - 18} ${cx + 22} ${EYE.cy + 4}`
      : `M${cx - 22} ${EYE.cy - 2} Q${cx} ${EYE.cy + 16} ${cx + 22} ${EYE.cy - 2}`;

  const gape = f.beak * 16;

  return (
    <svg
      className={[
        'lumi',
        `lumi--${action}`,
        isHopping ? 'lumi--hop' : '',
        mood === 'sleepy' ? 'lumi--asleep' : '',
      ].filter(Boolean).join(' ')}
      ref={rig}
      width={size}
      height={size}
      viewBox="-6 0 252 252"
      role="img"
      aria-label={title}
    >
      <defs>
        <radialGradient id="lumi-halo" cx="50%" cy="54%" r="52%">
          <stop offset="0%" stopColor="#8ff7e8" stopOpacity="0.85" />
          <stop offset="55%" stopColor="#16d8c4" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#16d8c4" stopOpacity="0" />
        </radialGradient>

        {/*
          The lit form, in the order a lit form actually goes. The last stop is
          BRIGHTER than the one before it: that is the reflected light where the
          surface turns away and catches its surroundings, and without it the
          bottom edge of the silhouette reads as a cut-out.
        */}
        <linearGradient id="lumi-body" x1="0.16" y1="0" x2="0.84" y2="1">
          <stop offset="0%" stopColor="#9dfcef" />
          <stop offset="24%" stopColor="#3ae3ce" />
          <stop offset="54%" stopColor="#12c2ae" />
          <stop offset="80%" stopColor="#077e71" />
          <stop offset="93%" stopColor="#12b6a4" />
          <stop offset="100%" stopColor="#35dcc8" />
        </linearGradient>

        {/* Contact occlusion: the shadow a form casts onto itself at its edges. */}
        <radialGradient id="lumi-occ" cx="44%" cy="28%" r="80%">
          <stop offset="58%" stopColor="#00322f" stopOpacity="0" />
          <stop offset="100%" stopColor="#00322f" stopOpacity="0.42" />
        </radialGradient>

        {/* One specular, soft and off-centre. Two would read as wet plastic. */}
        <radialGradient id="lumi-spec" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.5" />
          <stop offset="70%" stopColor="#ffffff" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>

        {/*
          Clips the rim to the silhouette. A stroke straddles its path, so half
          of a 5px rim sits INSIDE the body — which does not read as a lit edge,
          it reads as a scratch curving across her. Clipped, only the inner half
          survives and it hugs the outline the way a rim light does.
        */}
        <radialGradient id="lumi-belly" cx="46%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#fffdf0" />
          <stop offset="40%" stopColor="#ffec7d" />
          <stop offset="78%" stopColor="#ffc60a" />
          <stop offset="100%" stopColor="#f0a800" />
        </radialGradient>

        {/* The seam where the belly sits into the body. */}
        <radialGradient id="lumi-belly-occ" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#014f49" stopOpacity="0" />
          <stop offset="76%" stopColor="#014f49" stopOpacity="0" />
          <stop offset="86%" stopColor="#014f49" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#014f49" stopOpacity="0" />
        </radialGradient>

        {/*
          A cheek has no edge. Drawn as a flat ellipse at partial alpha it reads
          as a sticker, and a semi-transparent pink sitting over dark teal mixes
          to grey — so this carries its own falloff and stays bright in the
          middle rather than leaning on opacity to soften it.
        */}
        <radialGradient id="lumi-blush" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ff8fbb" stopOpacity="0.95" />
          <stop offset="55%" stopColor="#ff8fbb" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#ff8fbb" stopOpacity="0" />
        </radialGradient>

        <linearGradient id="lumi-crest" x1="0" y1="1" x2="0.3" y2="0">
          <stop offset="0%" stopColor="#e8447a" />
          <stop offset="55%" stopColor="#ff6f9c" />
          <stop offset="100%" stopColor="#ffb3cb" />
        </linearGradient>

        <linearGradient id="lumi-beak" x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#ffc078" />
          <stop offset="35%" stopColor="#ff9a3c" />
          <stop offset="100%" stopColor="#f0522c" />
        </linearGradient>

        <linearGradient id="lumi-wing" x1="0.2" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="#5ae8d6" />
          <stop offset="65%" stopColor="#15b6a4" />
          <stop offset="100%" stopColor="#2bd0bd" />
        </linearGradient>

        {/* Eyelid occlusion: a real eyeball is darkest where the lid overhangs. */}
        <linearGradient id="lumi-sclera" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d9cfc0" />
          <stop offset="26%" stopColor="#fffdf7" />
          <stop offset="100%" stopColor="#fffdf7" />
        </linearGradient>
      </defs>

      {/*
        The shadow on the ground. Nothing else in the drawing says how far from
        the floor she is, so this is what makes a hop read as leaving it — it
        widens and fades as she rises rather than travelling with her.
      */}
      <ellipse className="lumi__cast" cx="120" cy="238" rx="58" ry="9" fill="#00201f" opacity="0.4" />

      <circle className="lumi__halo" cx="120" cy="128" r="104" fill="url(#lumi-halo)" />

      <g className="lumi__rig">
        {/* legs and feet, behind the body */}
        {/*
          Three toes each, so they read as bird feet rather than one bar, and
          each leg is its own group pivoting at the hip so it can swing.
        */}
        <g className="lumi__legs" stroke="#ff7a4d" strokeWidth="7" strokeLinecap="round" fill="none">
          <g className="lumi__leg lumi__leg--l">
            <path d="M103 198 L103 214" stroke="#f2603a" />
            <path d="M103 213 L90 229" />
            <path d="M103 213 L103 232" />
            <path d="M103 213 L116 229" />
          </g>
          <g className="lumi__leg lumi__leg--r">
            <path d="M137 198 L137 214" stroke="#f2603a" />
            <path d="M137 213 L124 229" />
            <path d="M137 213 L137 232" />
            <path d="M137 213 L150 229" />
          </g>
        </g>

        {/* wings, behind the body so they read as attached */}
        <g
          className={`lumi__wing lumi__wing--l${f.wave ? ' lumi__wing--wave' : ''}`}
          style={{ transform: `rotate(${f.wing}deg)` }}
        >
          {/*
            A wing has to show a lobe OUTSIDE the body or it reads as an ear
            stuck on the side of the head. The dark inner edge is what separates
            it from the body behind it, which is doing the same job a cast
            shadow would.
          */}
          <ellipse cx="30" cy="152" rx="26" ry="40" fill="#05675e" transform="rotate(-16 30 152)" />
          <ellipse cx="28" cy="150" rx="24" ry="38" fill="url(#lumi-wing)" transform="rotate(-16 28 150)" />
        </g>
        <g className="lumi__wing lumi__wing--r" style={{ transform: `rotate(${-f.wing}deg)` }}>
          <ellipse cx="210" cy="152" rx="26" ry="40" fill="#05675e" transform="rotate(16 210 152)" />
          <ellipse cx="212" cy="150" rx="24" ry="38" fill="url(#lumi-wing)" transform="rotate(16 212 150)" />
        </g>

        {/* head and body are one silhouette, which is what makes it readable small */}
        <g className="lumi__head" style={{ transform: `rotate(${f.tilt}deg)` }}>
          {/*
            The crest is the signature that survives being shrunk to an icon, so
            it only ever gives way to a hat that actually sits where it sits.
            Goggles ride the forehead and leave it alone.
          */}
          {!hidesCrest(hat) && (
            <g className="lumi__crest">
              <path d="M104 50 C88 30 88 14 97 4 C109 13 112 32 110 50 Z" fill="url(#lumi-crest)" />
              <path d="M120 46 C112 22 119 4 130 0 C139 13 133 32 127 46 Z" fill="url(#lumi-crest)" />
              <path d="M136 52 C139 31 150 17 160 16 C161 31 152 44 143 54 Z" fill="url(#lumi-crest)" />
            </g>
          )}

          <Hat id={hat} />

          <path d="M120 38 C170 38 202 80 202 130 C202 182 168 212 120 212 C72 212 38 182 38 130 C38 80 70 38 120 38 Z" fill="url(#lumi-body)" />
          {/*
            Three passes over the same silhouette. Separate paths rather than
            one clever fill, because each answers a different question: where
            the form turns away from the light, where it catches light back off
            its surroundings, and where the key light actually lands.
          */}
          <path d="M120 38 C170 38 202 80 202 130 C202 182 168 212 120 212 C72 212 38 182 38 130 C38 80 70 38 120 38 Z" fill="url(#lumi-occ)" />
          {/*
            No stroked rim light. On a body this close to a circle a stroke
            traces the whole outline, and the eye reads a complete bright ring
            as a glass bubble drawn around her rather than as light catching an
            edge. The reflected light lives in the body gradient instead, as the
            two stops after the core shadow that climb back up in value.
          */}
          <ellipse
            className="lumi__spec"
            cx="80" cy="76" rx="34" ry="24" fill="url(#lumi-spec)"
            transform="rotate(-26 80 76)"
          />

          <g className="lumi__belly">
            <ellipse cx="120" cy="170" rx="54" ry="52" fill="url(#lumi-belly-occ)" />
            <ellipse cx="120" cy="170" rx="42" ry="41" fill="url(#lumi-belly)" />
          </g>

          {/* blush */}
          {/*
            Beside the beak: below the eyes, outside the belly, inside the
            silhouette. There is very little room here and each of the three
            neighbours takes it differently — tucked under the eyes the cheeks
            disappear behind them, out at the rim they sit on the body's own
            core shadow and turn mauve, and a warm pink over a dark teal is a
            bruise rather than a cheek.
          */}
          <g className="lumi__blush">
            <ellipse cx="74" cy="150" rx="17" ry="11" fill="url(#lumi-blush)" opacity={f.blush} />
            <ellipse cx="166" cy="150" rx="17" ry="11" fill="url(#lumi-blush)" opacity={f.blush} />
          </g>

          {/* eyes */}
          {shut ? (
            <g stroke="#123c3a" strokeWidth="6" fill="none" strokeLinecap="round">
              <path d={lid(EYE.lx)} />
              <path d={lid(EYE.rx)} />
            </g>
          ) : (
            <g className="lumi__eyes">
              {([['l', EYE.lx], ['r', EYE.rx]] as const).map(([side, cx]) => (
                /*
                 * Each eye narrows on its own as the head turns away from it,
                 * which is the single strongest cue that this is a head and not
                 * a picture of one sliding sideways.
                 */
                <g key={side} className={`lumi__eye lumi__eye--${side}`}>
                  <ellipse
                    cx={cx} cy={EYE.cy}
                    rx={EYE.rx_} ry={EYE.ry * f.eyeOpen}
                    fill="url(#lumi-sclera)"
                  />
                  <circle cx={cx + f.pupilX} cy={EYE.cy + f.pupilY} r="13" fill="#123c3a" />
                  <circle cx={cx + f.pupilX - 5} cy={EYE.cy + f.pupilY - 6} r="5.5" fill="#fff" />
                  <circle cx={cx + f.pupilX + 5} cy={EYE.cy + f.pupilY + 5} r="2.4" fill="#fff" opacity="0.8" />
                </g>
              ))}
            </g>
          )}

          {/*
            Eyebrows. Positive browRot lifts the INNER end, which is the shape
            the face reads as worried; negative lifts the outer end for cheerful.
          */}
          <g fill="#06857a">
            {/*
              Geometry is static and the mood is carried entirely by a CSS
              transform, so the brows can be transitioned between moods.
              Previously y and the rotate origin both moved with browY inside an
              SVG transform attribute — the same mix of attribute geometry and
              CSS origin that once displaced the wings, and impossible to
              interpolate cleanly. transform-box: fill-box puts the origin at
              each rect's own centre, which is where the old rotate() pivoted.
            */}
            <g
              className="lumi__brow"
              style={{ transform: `translateY(${f.browY}px) rotate(${f.browRot}deg)` }}
            >
              <rect x={EYE.lx - 19} y={72} width="38" height="9" rx="4.5" />
            </g>
            <g
              className="lumi__brow"
              style={{ transform: `translateY(${f.browY}px) rotate(${-f.browRot * f.browAsym}deg)` }}
            >
              <rect x={EYE.rx - 19} y={72} width="38" height="9" rx="4.5" />
            </g>
          </g>

          {/* beak — opens downward so the head shape is never broken */}
          <g className="lumi__beak">
            <path d={`M100 138 L140 138 L120 ${156 - gape / 2} Z`} fill="url(#lumi-beak)" />
            {/* The lit top ridge. A beak is a wedge; a flat one is a triangle. */}
            <path d="M100 138 L140 138 L132 143 L108 143 Z" fill="#ffd9a8" opacity="0.55" />
            {gape > 2 && (
              <path
                d={`M104 ${142 + gape / 2} L136 ${142 + gape / 2} L120 ${160 + gape} Z`}
                fill="#c8341c"
              />
            )}
          </g>
        </g>

        {f.sparkle && (
          <g className="lumi__sparkle" fill="#fff3d4">
            <path d="M206 62 l4 10 10 4 -10 4 -4 10 -4 -10 -10 -4 10 -4 Z" />
            <path d="M32 84 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3 Z" opacity="0.7" />
          </g>
        )}
      </g>

      {f.zzz && (
        <g className="lumi__zzz" fill="#ffe0b4" fontWeight="700">
          <text x="196" y="72" fontSize="19">z</text>
          <text x="212" y="52" fontSize="14">z</text>
          <text x="224" y="37" fontSize="10">z</text>
        </g>
      )}
    </svg>
  );
}

/**
 * Nest hats.
 *
 * Drawn in the mascot's own coordinate space and rendered inside `.lumi__head`,
 * so a hat inherits the mood's head tilt for free and never has to be told
 * about it. Each sits around y 0-60 with the head centred on x 120.
 *
 * Deliberately flat shapes rather than gradients: a hat has to read at 110px in
 * a shelf tile, where a soft gradient turns to mud.
 */
/** Hats worn on top of the head, as opposed to on the forehead. */
const CREST_COVERING = new Set(['acorn-cap', 'nightcap', 'star-crown', 'petal-wreath']);

function hidesCrest(hat: string | null): boolean {
  return hat !== null && CREST_COVERING.has(hat);
}

function Hat({ id }: { id: string | null }) {
  if (!id) return null;

  if (id === 'acorn-cap') {
    return (
      <g aria-hidden="true">
        <path d="M60 52 C60 16 180 16 180 52 Z" fill="#a4652f" />
        <ellipse cx="120" cy="52" rx="62" ry="9" fill="#8b5426" />
        <rect x="113" y="4" width="14" height="20" rx="7" fill="#6d4120" />
      </g>
    );
  }

  if (id === 'nightcap') {
    return (
      <g aria-hidden="true">
        {/*
          The whole cap stays inside the mascot viewBox (-6 0 252 244). An
          earlier version put the tail and pom above y=0, where they were
          silently clipped — the cap looked bitten off and nothing errored.
        */}
        <path d="M60 54 C64 16 118 6 158 12 C182 15 198 14 206 13 C190 28 152 39 122 45 C102 49 76 52 60 54 Z" fill="#5b6bd6" />
        <path d="M60 54 C64 24 108 14 140 16 C118 26 92 40 78 54 Z" fill="#6b7ae4" />
        <circle cx="207" cy="14" r="13" fill="#fdf6ec" />
        <ellipse cx="120" cy="54" rx="64" ry="11" fill="#fdf6ec" />
      </g>
    );
  }

  if (id === 'star-crown') {
    return (
      <g aria-hidden="true" fill="#ffcf8f">
        <path d="M62 54 L74 18 L96 42 L120 8 L144 42 L166 18 L178 54 Z" />
        <circle cx="120" cy="6" r="7" fill="#fff3d6" />
        <circle cx="74" cy="16" r="5" fill="#fff3d6" />
        <circle cx="166" cy="16" r="5" fill="#fff3d6" />
      </g>
    );
  }

  if (id === 'goggles') {
    // Pushed up on the forehead, so they never cover the eyes — the eyes are
    // where every mood is read.
    return (
      <g aria-hidden="true">
        <rect x="46" y="34" width="148" height="13" rx="6" fill="#6d4120" />
        <circle cx="84" cy="34" r="25" fill="#3b2a1a" />
        <circle cx="156" cy="34" r="25" fill="#3b2a1a" />
        <circle cx="84" cy="34" r="17" fill="#9ff0d4" opacity="0.85" />
        <circle cx="156" cy="34" r="17" fill="#9ff0d4" opacity="0.85" />
      </g>
    );
  }

  if (id === 'petal-wreath') {
    const petals = [62, 84, 106, 134, 156, 178];
    return (
      <g aria-hidden="true">
        <path d="M58 50 C70 24 170 24 182 50" stroke="#2f8f5b" strokeWidth="9" fill="none" strokeLinecap="round" />
        {petals.map((x, i) => (
          <circle key={x} cx={x} cy={i % 2 ? 30 : 36} r="13" fill={i % 2 ? '#ff8fb1' : '#ffd6e3'} />
        ))}
      </g>
    );
  }

  return null;
}
