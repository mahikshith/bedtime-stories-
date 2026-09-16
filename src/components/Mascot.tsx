import { useEffect, useState } from 'react';

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
  title = 'Lumi',
}: MascotProps) {
  const autoHopping = useAutoHop(autoHop && mood !== 'sleepy');
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
      width={size}
      height={size}
      viewBox="-6 0 252 244"
      role="img"
      aria-label={title}
    >
      <defs>
        <radialGradient id="lumi-halo" cx="50%" cy="54%" r="52%">
          <stop offset="0%" stopColor="#8ff7e8" stopOpacity="0.85" />
          <stop offset="55%" stopColor="#16d8c4" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#16d8c4" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="lumi-body" x1="0.25" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#6ff3e2" />
          <stop offset="44%" stopColor="#1fd6c1" />
          <stop offset="100%" stopColor="#0aa694" />
        </linearGradient>
        <radialGradient id="lumi-belly" cx="50%" cy="34%" r="66%">
          <stop offset="0%" stopColor="#fffbe8" />
          <stop offset="62%" stopColor="#ffe45c" />
          <stop offset="100%" stopColor="#ffc60a" />
        </radialGradient>
        <linearGradient id="lumi-crest" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#ff5f8f" />
          <stop offset="100%" stopColor="#ffa1bf" />
        </linearGradient>
        <linearGradient id="lumi-beak" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffa24a" />
          <stop offset="100%" stopColor="#ff5f3d" />
        </linearGradient>
      </defs>

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
          <ellipse cx="34" cy="150" rx="23" ry="36" fill="#13bfae" transform="rotate(-14 34 150)" />
        </g>
        <g className="lumi__wing lumi__wing--r" style={{ transform: `rotate(${-f.wing}deg)` }}>
          <ellipse cx="206" cy="150" rx="23" ry="36" fill="#13bfae" transform="rotate(14 206 150)" />
        </g>

        {/* head and body are one silhouette, which is what makes it readable small */}
        <g className="lumi__head" style={{ transform: `rotate(${f.tilt}deg)` }}>
          {/* crest — the signature that survives being shrunk to an icon */}
          <g className="lumi__crest">
            <path d="M104 50 C88 30 88 14 97 4 C109 13 112 32 110 50 Z" fill="url(#lumi-crest)" />
            <path d="M120 46 C112 22 119 4 130 0 C139 13 133 32 127 46 Z" fill="url(#lumi-crest)" />
            <path d="M136 52 C139 31 150 17 160 16 C161 31 152 44 143 54 Z" fill="url(#lumi-crest)" />
          </g>

          <path
            d="M120 38 C170 38 202 80 202 130 C202 182 168 212 120 212 C72 212 38 182 38 130 C38 80 70 38 120 38 Z"
            fill="url(#lumi-body)"
          />
          <ellipse cx="120" cy="156" rx="46" ry="46" fill="url(#lumi-belly)" />

          {/* blush */}
          <ellipse cx="58" cy="146" rx="15" ry="9" fill="#ff5f8f" opacity={f.blush} />
          <ellipse cx="182" cy="146" rx="15" ry="9" fill="#ff5f8f" opacity={f.blush} />

          {/* eyes */}
          {shut ? (
            <g stroke="#123c3a" strokeWidth="6" fill="none" strokeLinecap="round">
              <path d={lid(EYE.lx)} />
              <path d={lid(EYE.rx)} />
            </g>
          ) : (
            <g className="lumi__eyes">
              {[EYE.lx, EYE.rx].map((cx) => (
                <g key={cx}>
                  <ellipse cx={cx} cy={EYE.cy} rx={EYE.rx_} ry={EYE.ry * f.eyeOpen} fill="#fffdf7" />
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
