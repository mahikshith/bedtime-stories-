import type { ReactNode } from 'react';

interface TileProps {
  emoji: string;
  title: string;
  subtitle?: string;
  /** Small line under the subtitle — progress, age range, a status. */
  meta?: string;
  /** Tints the orb, so a world or pillar keeps its own colour. */
  tint?: string;
  /** Stagger index; entrance is delayed by index so a grid cascades in. */
  index?: number;
  dimmed?: boolean;
  disabled?: boolean;
  badge?: ReactNode;
  onClick: () => void;
}

/**
 * One activity in a grid.
 *
 * Built as a nested enclosure — an outer shell with its own hairline and a
 * larger radius, holding an inner core with a concentric smaller radius. It
 * reads as a physical object rather than a rectangle, which is the right
 * register for children, and it gives the glass an edge to catch light on.
 *
 * Two of these fit across a 390px phone, which is the point: a child scanning
 * a grid of pictures beats a child scrolling a list of rows.
 */
export function Tile({
  emoji, title, subtitle, meta, tint, index = 0, dimmed, disabled, badge, onClick,
}: TileProps) {
  return (
    <button
      type="button"
      className="tile"
      style={{ ['--i' as string]: index, opacity: dimmed || disabled ? 0.48 : 1 }}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="tile__inner">
        {badge && <span className="tile__badge">{badge}</span>}
        <span
          className="tile__orb"
          aria-hidden="true"
          style={tint ? { background: tint } : undefined}
        >
          {emoji}
        </span>
        <span className="tile__title">{title}</span>
        {subtitle && <span className="tile__sub">{subtitle}</span>}
        {meta && <span className="tile__meta">{meta}</span>}
      </span>
    </button>
  );
}
