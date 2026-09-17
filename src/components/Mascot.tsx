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
  skin?: 'cocoa' | 'plum' | 'slate';
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

const EYE = { lx: 101, rx: 139, cy: 98, rx_: 9, ry: 10 };

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
   * Every Mascot emits its own <defs>, and `url(#head)` resolves against the
   * WHOLE document — so the browser hands every mascot on the page the first
   * one's gradients. Four colour variants rendered side by side all came out
   * the colour of whichever mounted first, and nothing errored. `useId` returns
   * a value containing colons, legal in an id but awkward in a url(), so it is
   * reduced to word characters.
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
          Soft occlusion, done the way a renderer does it: a blurred dark copy of
          a form, laid under the form in front of it. Gradients alone cannot make
          the seam where two volumes meet, because the darkness has to follow the
          shape of the thing casting it, not the thing receiving it.
        */}
        <filter id={g('soft')} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
        <filter id={g('softer')} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="12" />
        </filter>

        {/*
          Matte, not glossy. The reference look is moulded plastic under a big
          soft light: one broad highlight, a long shallow falloff, and a lift
          again at the very edge where the surface turns away and catches its
          surroundings. A tight bright specular is what makes vector art read as
          glass, and it was doing exactly that here.
        */}
        <radialGradient id={g('head')} cx="36%" cy="22%" r="86%">
          <stop offset="0%" stopColor="var(--fur-lit)" />
          <stop offset="38%" stopColor="var(--fur-hi)" />
          <stop offset="72%" stopColor="var(--fur-mid)" />
          <stop offset="93%" stopColor="var(--fur-core)" />
          <stop offset="100%" stopColor="var(--fur-bounce)" />
        </radialGradient>

        <radialGradient id={g('body')} cx="38%" cy="18%" r="90%">
          <stop offset="0%" stopColor="var(--fur-hi)" />
          <stop offset="44%" stopColor="var(--fur-mid)" />
          <stop offset="82%" stopColor="var(--fur-core)" />
          <stop offset="96%" stopColor="var(--fur-deep)" />
          <stop offset="100%" stopColor="var(--fur-bounce)" />
        </radialGradient>

        <radialGradient id={g('cream')} cx="40%" cy="24%" r="84%">
          <stop offset="0%" stopColor="var(--cream-lit)" />
          <stop offset="50%" stopColor="var(--cream-mid)" />
          <stop offset="88%" stopColor="var(--cream-deep)" />
          <stop offset="100%" stopColor="var(--cream-edge)" />
        </radialGradient>

        <radialGradient id={g('limb')} cx="34%" cy="20%" r="88%">
          <stop offset="0%" stopColor="var(--fur-hi)" />
          <stop offset="58%" stopColor="var(--fur-mid)" />
          <stop offset="92%" stopColor="var(--fur-deep)" />
          <stop offset="100%" stopColor="var(--fur-bounce)" />
        </radialGradient>

        {/* The far limb is the same form, lit less: it is behind her. */}
        <radialGradient id={g('far-limb')} cx="34%" cy="20%" r="88%">
          <stop offset="0%" stopColor="var(--fur-mid)" />
          <stop offset="58%" stopColor="var(--fur-core)" />
          <stop offset="100%" stopColor="var(--fur-deep)" />
        </radialGradient>

        <radialGradient id={g('spec')} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.26" />
          <stop offset="70%" stopColor="#ffffff" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>

        <clipPath id={g('head-clip')}>
          <ellipse cx="120" cy="98" rx="63" ry="59" />
        </clipPath>
        <clipPath id={g('body-clip')}>
          <ellipse cx="120" cy="180" rx="47" ry="45" />
        </clipPath>
      </defs>

      {/* The shadow on the ground. Soft and close, the way a big overhead light
          makes one — a hard shadow would put her in a different room. */}
      <ellipse
        className="lumi__cast"
        cx="120" cy="238" rx="50" ry="8"
        fill="var(--shade)"
        filter={`url(#${g('soft')})`}
      />

      <g className="lumi__rig">
        <g className="lumi__tail">
          <circle cx="176" cy="204" r="18" fill="var(--fur-core)" />
        </g>

        {/* ---- far limb ---- */}
        {/*
          Arms hang from the shoulder and angle outward, with a cream cuff at the
          end. Drawn straight down as flat bars they read as stumps stuck to the
          sides — and the far one had no gradient at all, so it had no form to
          recede with.
        */}
        <g className="lumi__arm lumi__arm--far">
          <g transform="rotate(14 78 164)">
            <rect x="62" y="158" width="29" height="50" rx="14.5" fill={url('far-limb')} />
            <ellipse cx="76.5" cy="203" rx="15" ry="13" fill="var(--cream-deep)" />
          </g>
        </g>

        {/* ---- body ---- */}
        <g className="lumi__body">
          <ellipse cx="120" cy="180" rx="47" ry="45" fill={url('body')} />
          <g clipPath={`url(#${g('body-clip')})`}>
            {/* The head, blurred, laid on the body. This is the seam. */}
            <ellipse
              cx="120" cy="120" rx="63" ry="52"
              fill="var(--shade)" opacity="0.55"
              filter={`url(#${g('softer')})`}
            />
          </g>
          <ellipse cx="120" cy="188" rx="31" ry="30" fill={url('cream')} />
          <ellipse cx="106" cy="166" rx="15" ry="10" fill={url('spec')} transform="rotate(-26 106 166)" />
        </g>

        {/* ---- feet ---- */}
        <g className="lumi__feet">
          <ellipse cx="99" cy="222" rx="20" ry="12" fill="var(--cream-deep)" />
          <ellipse cx="141" cy="222" rx="20" ry="12" fill="var(--cream-deep)" />
          <ellipse cx="99" cy="220" rx="19" ry="11" fill={url('cream')} />
          <ellipse cx="141" cy="220" rx="19" ry="11" fill={url('cream')} />
        </g>

        {/* ---- near limb ---- */}
        <g className="lumi__arm lumi__arm--near">
          <g transform="rotate(-14 162 164)">
            {/* Its own contact shadow, so the arm sits in front of the body
                rather than being painted onto it. */}
            <rect x="151" y="160" width="31" height="52" rx="15.5" fill="var(--shade)" opacity="0.55"
              filter={`url(#${g('soft')})`} />
            <rect x="149" y="158" width="29" height="50" rx="14.5" fill={url('limb')} />
            <ellipse cx="163.5" cy="203" rx="15" ry="13" fill="var(--cream-deep)" />
            <ellipse cx="163.5" cy="202" rx="14" ry="12" fill={url('cream')} />
          </g>
        </g>

        {/* ---- head ---- */}
        <g className="lumi__head">
          <g className="lumi__ears">
            <g>
              <circle cx="72" cy="52" r="27" fill="var(--fur-core)" />
              <circle cx="72" cy="50" r="25" fill={url('head')} />
              <circle cx="73" cy="52" r="14" fill="var(--cream-deep)" />
              <circle cx="73" cy="51" r="13" fill={url('cream')} />
            </g>
            <g>
              <circle cx="168" cy="52" r="27" fill="var(--fur-core)" />
              <circle cx="168" cy="50" r="25" fill={url('head')} />
              <circle cx="167" cy="52" r="14" fill="var(--cream-deep)" />
              <circle cx="167" cy="51" r="13" fill={url('cream')} />
            </g>
          </g>

          <Hat id={hat} />

          <ellipse cx="120" cy="98" rx="63" ry="59" fill={url('head')} />
          <g clipPath={`url(#${g('head-clip')})`}>
            <ellipse cx="80" cy="60" rx="34" ry="24" fill={url('spec')} transform="rotate(-22 80 60)" />
          </g>

          <g className="lumi__back">
            <ellipse cx="120" cy="98" rx="63" ry="59" fill={url('head')} />
            <ellipse cx="120" cy="108" rx="26" ry="20" fill="var(--fur-core)" opacity="0.4" />
          </g>

          <g className="lumi__face">
            {/* The muzzle. A big soft cream mask across the lower face, with its
                own occlusion where it sits into the head. */}
            <g className="lumi__muzzle">
              <ellipse cx="120" cy="124" rx="40" ry="30" fill="var(--shade)" opacity="0.4"
                filter={`url(#${g('soft')})`} />
              <ellipse cx="120" cy="122" rx="39" ry="29" fill={url('cream')} />
            </g>

            {/*
              Two thick dark bars and two small solid eyes. No whites, no
              highlights in the sclera, no blush, no sparkles. Those are the
              cartoon tells, and every one of them was in the previous version.
              The whole read comes from the form; the features only have to stay
              out of its way.
            */}
            {shut ? (
              <g stroke="var(--line)" strokeWidth="6" fill="none" strokeLinecap="round">
                <path d={lid(EYE.lx, f.closed)} />
                <path d={lid(EYE.rx, f.closed)} />
              </g>
            ) : (
              <g className="lumi__eyes" fill="var(--line)">
                {([['l', EYE.lx], ['r', EYE.rx]] as const).map(([side, cx]) => (
                  <g key={side} className={`lumi__eye lumi__eye--${side}`}>
                    <g className="lumi__pupil">
                      <ellipse cx={cx} cy={EYE.cy} rx="8.5" ry={9.5 * f.eyeOpen} />
                      <circle cx={cx - 3} cy={EYE.cy - 3.5} r="2.6" fill="#fff" opacity="0.65" />
                    </g>
                  </g>
                ))}
              </g>
            )}

            <g fill="var(--line)">
              <g
                className="lumi__brow"
                style={{ transform: `translateY(${f.brow}px) rotate(${f.browRot * 0.5}deg)` }}
              >
                <rect x={EYE.lx - 17} y={72} width="34" height="11" rx="5.5" />
              </g>
              <g
                className="lumi__brow"
                style={{ transform: `translateY(${f.brow}px) rotate(${-f.browRot * f.browAsym * 0.5}deg)` }}
              >
                <rect x={EYE.rx - 17} y={72} width="34" height="11" rx="5.5" />
              </g>
            </g>

            <g className="lumi__snout">
              <ellipse cx="120" cy="114" rx="10" ry="7.5" fill="var(--nose)" />
              <ellipse cx="117" cy="112" rx="3.5" ry="2.4" fill="#fff" opacity="0.3" />
              <path
                className="lumi__mouth"
                d="M120 122 Q113 133 106 126 M120 122 Q127 133 134 126"
                stroke="var(--line)"
                strokeWidth="4.5"
                strokeLinecap="round"
                fill="none"
              />
            </g>
          </g>
        </g>
      </g>

      {mood === 'sleepy' && (
        <g className="lumi__zzz" fill="var(--cream-lit)" fontWeight="700">
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
