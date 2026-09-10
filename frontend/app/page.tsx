/**
 * App root (`/`).
 *
 * The spec only calls for two pages — the Patient Table and the Analytics
 * Dashboard — so there's no real "home" page to render here. This route
 * just redirects straight to `/patients`.
 */

import { redirect } from "next/navigation";

/** Redirects `/` to `/patients`. */
export default function Home() {
  redirect("/patients");
}
