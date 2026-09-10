import type { Metadata } from "next";
import Link from "next/link";

import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Beauty Med Spa Dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <Providers>
          <nav className="flex gap-6 border-b bg-white px-6 py-4">
            <Link href="/patients" className="font-medium hover:text-teal-600">
              Patients
            </Link>
            <Link href="/analytics" className="font-medium hover:text-teal-600">
              Analytics
            </Link>
          </nav>
          <main className="p-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
