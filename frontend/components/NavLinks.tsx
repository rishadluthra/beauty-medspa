"use client";

/**
 * The nav's "Front Desk" / "Analytics" links, highlighting whichever one
 * matches the current route -- the nav previously gave no visual sign of
 * which page you were actually on. Split out from the root layout (a
 * Server Component) into its own small client component specifically
 * because active-route detection needs `usePathname()`, a client-only
 * hook -- this keeps that requirement scoped to just the two links
 * instead of forcing the whole nav (and layout) to become a Client
 * Component.
 *
 * "Front Desk" is active for `/patients` AND `/patients/{id}` /
 * `/appointments/{id}` (its own drill-down pages) -- not just an exact
 * `/patients` match -- since those pages are still part of that section.
 *
 * `variant="menu"` renders each link as a full-width block row instead of
 * inline text -- used inside `MobileNavMenu`'s dropdown, which needs these
 * to read as tappable menu rows, not the desktop nav's plain inline text
 * links. Sharing this one component (instead of a second, independently
 * written link list inside the mobile menu) means the two can't drift
 * apart on which routes count as "active" for which link.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/patients", label: "Front Desk", isActive: (path: string) => path.startsWith("/patients") || path.startsWith("/appointments") },
  { href: "/analytics", label: "Analytics", isActive: (path: string) => path.startsWith("/analytics") },
];

interface Props {
  variant?: "inline" | "menu";
  /** Called after a link is clicked -- `MobileNavMenu` uses this to close itself. */
  onNavigate?: () => void;
}

export function NavLinks({ variant = "inline", onNavigate }: Props) {
  const pathname = usePathname();

  return (
    <>
      {LINKS.map((link) => {
        const active = link.isActive(pathname);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            onClick={onNavigate}
            className={
              variant === "menu"
                ? `block rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                    active ? "bg-brand-gold/10 text-brand-gold-dark" : "text-brand-dark/70 hover:bg-brand-dark/5 hover:text-brand-dark"
                  }`
                // A pill background here read as low-contrast/hard-to-read
                // (gold-tinted text on a gold-tinted bg) -- just the text
                // color change is what actually reads clearly, matching the
                // existing hover treatment on the inactive link. `brand-gold`
                // (not the darker `brand-gold-dark` hover uses) for the active
                // state specifically -- still hard to read as reported;
                // `brand-gold` is the brighter of the two golds in the
                // palette (its luminance sits noticeably further from the
                // nav's own translucent grey-cream background), so it's the
                // one that actually reads clearly against it.
                : `text-sm font-medium transition-colors ${
                    active ? "text-brand-gold" : "text-brand-dark/80 hover:text-brand-gold-dark"
                  }`
            }
          >
            {link.label}
          </Link>
        );
      })}
    </>
  );
}
