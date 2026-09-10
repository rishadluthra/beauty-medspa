import type { CSSProperties } from "react";

/**
 * Visual styling for the patient "source" badge, keyed by the raw backend
 * enum value (not the formatted display label).
 *
 * Colors are the real brand color(s) of each platform, not arbitrary picks:
 *  - phone: Apple's iOS "system green" (#34C759), the color of the iPhone
 *    Phone app icon.
 *  - instagram: Instagram's actual brand gradient (yellow -> orange -> pink
 *    -> purple -> blue), per their published brand assets — not a flattened
 *    single color.
 *  - tiktok: solid black, matching the background of TikTok's app icon.
 *    (TikTok's other brand colors are a cyan/red glitch-shadow effect on
 *    text, which doesn't translate cleanly to a small table badge — the
 *    black background is the more instantly recognizable choice.)
 *  - google: Google's blue (#4285F4), the same blue Google uses on its own
 *    "Sign in with Google" buttons — the closest thing Google has to a
 *    single "primary" brand color despite the four-color logo.
 *  - website: not a third-party brand — this is the med spa's own website,
 *    so it uses the app's existing brand teal (matches the nav/chart accent
 *    color used elsewhere) rather than an arbitrary color.
 *  - in_person: no brand to match. Given a warm, human color (rose) that's
 *    deliberately distinct from the amber already used elsewhere in this
 *    app to mean "pending", to avoid implying an unrelated status.
 */
const SOURCE_BADGE_STYLE: Record<string, CSSProperties> = {
  phone: { backgroundColor: "#34C759" },
  instagram: {
    background: "linear-gradient(45deg, #FEDA75, #FA7E1E, #D62976, #962FBF, #4F5BD5)",
  },
  tiktok: { backgroundColor: "#000000" },
  google: { backgroundColor: "#4285F4" },
  website: { backgroundColor: "#0f766e" },
  in_person: { backgroundColor: "#F43F5E" },
};

const FALLBACK_STYLE: CSSProperties = { backgroundColor: "#64748b" };

/** Returns the badge background style for a given raw `source` value, falling back to a neutral gray for any unrecognized value. */
export function getSourceBadgeStyle(source: string): CSSProperties {
  return SOURCE_BADGE_STYLE[source] ?? FALLBACK_STYLE;
}
