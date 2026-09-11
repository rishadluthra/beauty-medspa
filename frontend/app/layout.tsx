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
          */}
          <div className="sticky top-3 z-50 px-3 lg:top-4 lg:px-8">
            <nav className="mx-auto flex max-w-7xl items-center justify-between rounded-full border border-brand-gold/10 bg-brand-bg/80 px-6 py-3 text-brand-dark shadow-lg shadow-brand-gold/10 backdrop-blur-xl">
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
            Capped at the same `max-w-7xl` as the nav above, so page
            content lines up under it instead of stretching edge-to-edge
            on wide monitors — without this, a table with only a handful
            of short-text columns spreads them across the full viewport
            width with huge, uneven gaps between them.
          */}
          <main className="mx-auto max-w-7xl px-3 py-6 lg:px-8">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
