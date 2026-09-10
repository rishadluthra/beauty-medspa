"use client";

/**
 * Client-side context providers for the app.
 *
 * Currently just wraps `children` in a TanStack Query `QueryClientProvider`,
 * which is what powers every `useQuery` call in the patient table and
 * analytics charts (caching, refetching, loading/error state, etc.).
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

/**
 * Provides a TanStack Query `QueryClient` to the component tree.
 *
 * The `QueryClient` is created inside `useState(() => new QueryClient())`
 * rather than as a module-level constant. That keeps a single stable
 * instance across re-renders of this component (React won't re-run the
 * initializer on subsequent renders), while still creating a fresh instance
 * per client/request rather than sharing one across users. This matters for
 * Next.js's App Router server/client split: a module-level singleton risks
 * being reused across different users' requests on the server, whereas
 * `Providers` itself is a client component, so each browser session gets
 * its own client-created `QueryClient`.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
