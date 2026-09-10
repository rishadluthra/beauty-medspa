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
      <body className="min-h-screen bg-brand-bg text-brand-dark">
        <Providers>
          <nav className="flex items-center justify-between border-b border-brand-dark/10 bg-white/80 px-6 py-4 backdrop-blur">
            <span className="text-lg font-semibold tracking-tight">Beauty Med Spa</span>
            <div className="flex gap-2">
              <Link
                href="/patients"
                className="rounded-full px-4 py-1.5 text-sm font-medium transition-colors hover:bg-brand-gold/10 hover:text-brand-gold-dark"
              >
                Patients
              </Link>
              <Link
                href="/analytics"
                className="rounded-full px-4 py-1.5 text-sm font-medium transition-colors hover:bg-brand-gold/10 hover:text-brand-gold-dark"
              >
                Analytics
              </Link>
            </div>
          </nav>
          <main className="p-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
