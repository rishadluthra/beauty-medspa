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

            Sized `max-w-xl`/`2xl:max-w-2xl` -- a step up from the earlier
            `max-w-lg`/`2xl:max-w-xl` now that the nav holds a real search
            control (not just a wordmark and two links), so it needs a bit
            more room without crowding.

            `bg-brand-bg/50` (not the earlier `/80`) is what actually makes
            this read as translucent frosted glass rather than a solid
            cream bar -- at 80% opacity the cream so thoroughly dominated
            the blurred dark page content behind it that the "glass" effect
            was effectively invisible; halving it lets that backdrop
            genuinely show through.
          */}
          <div className="sticky top-3 z-50 flex justify-center px-3 lg:top-4 lg:px-8">
            <nav className="flex w-full max-w-xl items-center justify-between rounded-full border border-brand-gold/10 bg-brand-bg/50 px-6 py-3 text-brand-dark shadow-lg shadow-brand-gold/10 backdrop-blur-xl 2xl:max-w-2xl">
              <span className="flex items-center gap-2 text-lg font-bold tracking-tight">
                <BrandMark />
                Beauty Med Spa
              </span>
              <div className="flex items-center gap-4">
                <GlobalPatientSearch />
                <div className="flex gap-8">
                  <Link
                    href="/patients"
                    className="text-sm font-medium transition-colors hover:text-brand-gold-dark"
                  >
                    Patients
                  </Link>
                  <Link
                    href="/analytics"
                    className="text-sm font-medium transition-colors hover:text-brand-gold-dark"
                  >
                    Analytics
                  </Link>
                </div>
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
          <main className="mx-auto max-w-5xl px-3 py-6 lg:px-8 2xl:max-w-7xl">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
