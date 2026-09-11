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

            Deliberately narrower than the page content below it
            (`max-w-lg` = 512px vs. `<main>`'s `max-w-5xl` = 1024px, i.e.
            about half) — with only a wordmark and two links in it, a nav
            pill stretched to the content's full width reads as an oddly
            long, sparse bar sitting over a much busier table.
          */}
          <div className="sticky top-3 z-50 flex justify-center px-3 lg:top-4 lg:px-8">
            <nav className="flex w-full max-w-lg items-center justify-between rounded-full border border-brand-gold/10 bg-brand-bg/80 px-6 py-3 text-brand-dark shadow-lg shadow-brand-gold/10 backdrop-blur-xl">
              <span className="text-lg font-bold tracking-tight">Beauty Med Spa</span>
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
            </nav>
          </div>
          {/*
            Content stays at its own `max-w-5xl` — wider than the nav on
            purpose (see above) — so a data table has room to breathe
            without the nav trying to match it column-for-column.
          */}
          <main className="mx-auto max-w-5xl px-3 py-6 lg:px-8">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
