/**
 * A small "Default" / "Custom" badge shown near a graph's title in the
 * "All Graphs" tab and inside the reorder/picker modals -- lets someone
 * tell at a glance which cards are the app's fixed charts versus
 * something a manager built themselves.
 */
export function GraphBadge({ isDefault }: { isDefault: boolean }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
        isDefault ? "bg-brand-dark/10 text-brand-dark/60" : "bg-brand-gold/20 text-brand-gold-dark"
      }`}
    >
      {isDefault ? "Default" : "Custom"}
    </span>
  );
}
