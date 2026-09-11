/**
 * Root layout for the Next.js App Router app.
 *
 * Renders the shared chrome for every page: the top nav (Patients |
 * Analytics) and the `Providers` wrapper (TanStack Query context) around
 * `children`. Per-page content is provided by `app/patients/page.tsx` and
 * `app/analytics/page.tsx`.
 */

import type { Metadata } from "next";
import Link from "next/link";

import { BrandMark } from "@/components/BrandMark";
import { GlobalPatientSearch } from "@/components/GlobalPatientSearch";
import { NavLinks } from "@/components/NavLinks";

import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Beauty Med Spa Dashboard",
};

/** Wraps every route with the shared nav bar and the `Providers` context. */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-brand-dark text-brand-bg">
        <Providers>
          {/*
            Persistent, floating "pill" nav matching decodahealth.com's own
            nav treatment: inset from the page edges (not full-bleed),
            fully rounded, translucent cream with a backdrop blur (frosted
            glass), and `sticky` so it stays visible while scrolling long
            pages instead of scrolling away with the content.

            Sized `max-w-3xl`/`2xl:max-w-5xl` -- roughly three-quarters of
            the main content area's own `max-w-5xl`/`2xl:max-w-7xl` (see
            `<main>` below), a deliberate step up from the earlier
            `max-w-xl`/`2xl:max-w-2xl` now that it holds three distinct
            sections (wordmark, search, nav links) rather than two crowded
            close together.

            Three explicit sections via `justify-between` -- wordmark+logo
            (left, `shrink-0` so it never gets squeezed by the middle
            column), search (middle, `flex-1` so it's the one section that
            actually grows/shrinks with the nav's own width, per request
            that it read as a real search bar rather than a small icon
            button off to the side), Front Desk/Analytics (right,
            `shrink-0`) -- instead of the previous two-group layout that
            bunched search and the nav links together on the right.

            `bg-brand-bg/50` (not the earlier `/80`) is what actually makes
            this read as translucent frosted glass rather than a solid
            cream bar -- at 80% opacity the cream so thoroughly dominated
            the blurred dark page content behind it that the "glass" effect
            was effectively invisible; halving it lets that backdrop
            genuinely show through.
          */}
          <div className="sticky top-3 z-50 flex justify-center px-3 lg:top-4 lg:px-8">
            <nav className="flex w-full max-w-3xl items-center justify-between gap-3 rounded-full border border-brand-gold/10 bg-brand-bg/50 px-4 py-3 text-brand-dark shadow-lg shadow-brand-gold/10 backdrop-blur-xl sm:gap-4 sm:px-6 2xl:max-w-5xl">
              {/*
                Links back to Today's Appointments -- the front desk's
                actual home base -- like a wordmark conventionally does.
                The wordmark text itself hides below `sm` (leaving just the
                logo mark) -- at phone width there isn't room for the full
                name AND a search control AND both nav links without
                something overflowing the pill; the mark alone still
                identifies the brand, matching how the search label below
                already collapses to icon-only at the same breakpoint.
              */}
              <Link
                href="/patients?tab=today"
                className="flex shrink-0 items-center gap-2 text-lg font-bold tracking-tight transition-opacity hover:opacity-80"
              >
                <BrandMark />
                <span className="hidden sm:inline">Beauty Med Spa</span>
              </Link>

              {/*
                The flexible middle column only exists at `sm` and up --
                below that, `GlobalPatientSearch` moves into the right-hand
                group instead (still reachable, just icon-only, matching
                its own pre-existing mobile collapse), since there isn't
                enough width for a real middle column on a phone screen.
              */}
              <div className="hidden flex-1 px-2 sm:flex sm:max-w-xs sm:px-4">
                <GlobalPatientSearch />
              </div>

              {/*
                Labeled "Front Desk", not "Patients" -- this section now
                covers today's schedule, the calendar, walk-in capacity,
                and rebooking outreach, not just a patient list, and
                "Front Desk" names who it's for (matching the
                front-desk-agent framing this whole dashboard is built
                around) rather than undersellling it as one narrow view.
                The route itself stays `/patients` -- that's about
                where patient detail pages live (`/patients/{id}`), not
                what this section is called in the nav. `NavLinks`
                highlights whichever of these actually matches the
                current route.
              */}
              <div className="flex shrink-0 items-center gap-3 sm:gap-4">
                <div className="w-9 sm:hidden">
                  <GlobalPatientSearch />
                </div>
                <NavLinks />
              </div>
            </nav>
          </div>
          {/*
            Content stays at its own `max-w-5xl` — wider than the nav on
            purpose (see above) — so a data table has room to breathe
            without the nav trying to match it column-for-column.
            `2xl:max-w-7xl` lets it grow further on genuinely large
            displays (e.g. a 32" monitor) — a fixed 1024px cap on a much
            wider screen was squeezing dense schedule-table columns (time,
            phone) enough to visibly truncate real content, not just leave
            extra whitespace.
          */}
          {/*
            `pt-[60px]` (not the same `py-6` the bottom keeps) -- the sticky
            nav sits close above this, and even top/bottom padding left
            barely any breathing room between the nav's own bottom edge and
            the page's first heading, reported as visibly cramped. Bumped
            again (from `pt-10`/40px to 60px, 1.5x) per follow-up feedback
            that it still read as too tight.
          */}
          <main className="mx-auto max-w-5xl px-3 pb-6 pt-[60px] lg:px-8 2xl:max-w-7xl">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
