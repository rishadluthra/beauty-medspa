/**
 * Must stay in sync with the backend's `custom_views.MAX_CUSTOM_VIEWS`.
 *
 * The cap exists at all because views are shared, unowned state (this app
 * has no per-user auth to scope cleanup to) -- without any limit, tabs
 * could accumulate indefinitely with no one accountable for pruning them.
 * 3 was the original pick but proved too tight for the actual use case
 * ("build different dashboards to track different things" reasonably
 * wants more than 3: e.g. Marketing, Provider Performance, New Patient
 * Trends, Seasonality). Raised to 6 -- the tab bar already wraps
 * gracefully at that count (Front Desk's own tab bar runs 5 tabs
 * comfortably), and each view is just a small ordered ref list, not
 * meaningfully more expensive to store than 3 were.
 */
export const MAX_CUSTOM_VIEWS = 6;
