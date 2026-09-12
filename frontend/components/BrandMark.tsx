/**
 * A small logo mark for the nav, sitting to the left of the "Beauty Med
 * Spa" wordmark -- matching decodahealth.com's own nav treatment (a
 * minimal geometric icon beside a text wordmark), not a literal copy of
 * their mark or color (that's someone else's actual brand identity; this
 * app has its own gold/cream/sage palette already established everywhere
 * else, so the mark is drawn from that instead of Decoda's blue).
 *
 * A simple four-petal bloom -- four identical ellipses rotated around a
 * shared center, plus a small dark center -- read as an abstract,
 * spa/wellness-appropriate mark using clean geometric shapes and generous
 * negative space, in keeping with the calm, minimal style the spec's
 * design reference calls for.
 *
 * `app/icon.svg` (the browser tab favicon) draws this exact same shape --
 * a plain static SVG file can't import/render this component directly, so
 * its geometry/colors are copied there instead. Keep the two in sync if
 * this mark ever changes.
 */
export function BrandMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <g fill="#c5a37e">
        <ellipse cx="16" cy="8" rx="3.2" ry="6.5" />
        <ellipse cx="16" cy="8" rx="3.2" ry="6.5" transform="rotate(90 16 16)" />
        <ellipse cx="16" cy="8" rx="3.2" ry="6.5" transform="rotate(180 16 16)" />
        <ellipse cx="16" cy="8" rx="3.2" ry="6.5" transform="rotate(270 16 16)" />
      </g>
      <circle cx="16" cy="16" r="3" fill="#1b211b" />
    </svg>
  );
}
