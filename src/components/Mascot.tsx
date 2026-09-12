import { useEffect, useState } from 'react';

export type Mood = 'happy' | 'awake' | 'soft' | 'sleepy';

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

interface MascotProps {
  size?: number;
  /** Lumi's face follows the sleep gradient: by the last page the eyes are closed. */
  mood?: Mood;
  /** Squash-and-stretch hop. Ignored under prefers-reduced-motion via CSS. */
  hopping?: boolean;
  /** Hop on a timer without an external driver. */
  autoHop?: boolean;
  title?: string;
}

/**
 * Lumi — the lantern-sprite.
 *
 * Drawn from the principles that make a mascot readable rather than from any
 * existing character: one big rounded silhouette, a head that is most of the
 * body, eyes at roughly 40% of the face, a single strong colour, and one
 * signature feature that survives being shrunk to a 24px icon — here, the two
 * curved antennae with glowing lantern bulbs.
 *
 * Inline SVG so it ships offline, scales without artefacts, and can react to
 * the story's calm value.
 */
export function Mascot({
  size = 200,
  mood = 'happy',
  hopping = false,
  autoHop = false,
  title = 'Lumi',
}: MascotProps) {
  const autoHopping = useAutoHop(autoHop && mood !== 'sleepy');
  const isHopping = hopping || autoHopping;
  const lidScale = mood === 'happy' || mood === 'awake' ? 1 : mood === 'soft' ? 0.42 : 0.04;
  const asleep = mood === 'sleepy';

  const mouth = {
    happy: 'M84 150 Q100 168 116 150 Q100 158 84 150 Z',
    awake: 'M86 151 Q100 163 114 151',
    soft: 'M88 152 Q100 160 112 152',
    sleepy: 'M91 153 Q100 159 109 153',
  }[mood];

  return (
    <svg
      className={`lumi${isHopping ? ' lumi--hop' : ''}${asleep ? ' lumi--asleep' : ''}`}
      width={size}
      height={size}
      viewBox="0 0 200 210"
      role="img"
      aria-label={title}
    >
      <defs>
        <radialGradient id="lumi-halo" cx="50%" cy="58%" r="52%">
          <stop offset="0%" stopColor="#ffe3ae" stopOpacity="0.85" />
          <stop offset="55%" stopColor="#ffb45e" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#ffb45e" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="lumi-skin" x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#fff4dc" />
          <stop offset="48%" stopColor="#ffd79b" />
          <stop offset="100%" stopColor="#f0a35c" />
        </linearGradient>
        <radialGradient id="lumi-belly" cx="50%" cy="38%" r="62%">
          <stop offset="0%" stopColor="#fffdf6" />
          <stop offset="70%" stopColor="#ffe9bd" />
          <stop offset="100%" stopColor="#ffcf8f" />
        </radialGradient>
        <radialGradient id="lumi-bulb" cx="38%" cy="32%" r="70%">
          <stop offset="0%" stopColor="#fffdf2" />
          <stop offset="60%" stopColor="#ffd98a" />
          <stop offset="100%" stopColor="#ffab4d" />
        </radialGradient>
      </defs>

      <circle className="lumi__halo" cx="100" cy="122" r="88" fill="url(#lumi-halo)" />

      <g className="lumi__rig">
        {/* feet — drawn first so the body overlaps them */}
        <ellipse className="lumi__foot lumi__foot--l" cx="76" cy="186" rx="18" ry="11" fill="#e08f4a" />
        <ellipse className="lumi__foot lumi__foot--r" cx="124" cy="186" rx="18" ry="11" fill="#e08f4a" />

        {/* antennae — the silhouette signature */}
        <g className="lumi__antenna lumi__antenna--l">
          <path d="M81 62 C70 38 54 26 42 21" stroke="#e8a45f" strokeWidth="7" fill="none" strokeLinecap="round" />
          <circle cx="39" cy="19" r="14" fill="url(#lumi-bulb)" />
          <circle cx="35" cy="15" r="4.5" fill="#fffdf4" opacity="0.9" />
        </g>
        <g className="lumi__antenna lumi__antenna--r">
          <path d="M119 62 C130 38 146 26 158 21" stroke="#e8a45f" strokeWidth="7" fill="none" strokeLinecap="round" />
          <circle cx="161" cy="19" r="14" fill="url(#lumi-bulb)" />
          <circle cx="157" cy="15" r="4.5" fill="#fffdf4" opacity="0.9" />
        </g>

        {/* arms */}
        <ellipse className="lumi__arm lumi__arm--l" cx="46" cy="141" rx="13" ry="21" fill="#e89751" />
        <ellipse className="lumi__arm lumi__arm--r" cx="154" cy="141" rx="13" ry="21" fill="#e89751" />

        {/* body — one big rounded mass, head and body as a single silhouette */}
        <g className="lumi__body">
          <path
            d="M100 46 C142 46 166 80 166 118 C166 158 138 182 100 182 C62 182 34 158 34 118 C34 80 58 46 100 46 Z"
            fill="url(#lumi-skin)"
          />

          {/* lantern belly */}
          <ellipse className="lumi__glow" cx="100" cy="152" rx="30" ry="23" fill="url(#lumi-belly)" />

          {/* eyes */}
          <g
            className={`lumi__eyes${lidScale === 1 ? ' lumi__eyes--blink' : ''}`}
            style={lidScale === 1 ? undefined : { transform: `scaleY(${lidScale})` }}
          >
            <ellipse cx="76" cy="112" rx="19" ry="21" fill="#fffdf6" />
            <ellipse cx="124" cy="112" rx="19" ry="21" fill="#fffdf6" />
            <circle cx="79" cy="115" r="11" fill="#3a2410" />
            <circle cx="127" cy="115" r="11" fill="#3a2410" />
            <circle cx="83" cy="110" r="4.4" fill="#ffffff" />
            <circle cx="131" cy="110" r="4.4" fill="#ffffff" />
            <circle cx="75" cy="120" r="2.2" fill="#ffffff" opacity="0.75" />
            <circle cx="123" cy="120" r="2.2" fill="#ffffff" opacity="0.75" />
          </g>

          {/* closed lids, shown only when the eyes are shut */}
          {lidScale < 0.2 && (
            <>
              <path d="M62 112 Q76 122 90 112" stroke="#3a2410" strokeWidth="4.5" fill="none" strokeLinecap="round" />
              <path d="M110 112 Q124 122 138 112" stroke="#3a2410" strokeWidth="4.5" fill="none" strokeLinecap="round" />
            </>
          )}

          {/* blush */}
          <ellipse cx="53" cy="140" rx="11" ry="7" fill="#ff9aae" opacity="0.5" />
          <ellipse cx="147" cy="140" rx="11" ry="7" fill="#ff9aae" opacity="0.5" />

          {/* mouth */}
          <path
            d={mouth}
            stroke="#3a2410"
            strokeWidth="4"
            fill={mood === 'happy' ? '#3a2410' : 'none'}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </g>

      {asleep && (
        <g className="lumi__zzz" fill="#ffe0b4" fontFamily="inherit" fontWeight="700">
          <text x="156" y="76" fontSize="17">z</text>
          <text x="170" y="58" fontSize="13">z</text>
          <text x="181" y="44" fontSize="10">z</text>
        </g>
      )}
    </svg>
  );
}
