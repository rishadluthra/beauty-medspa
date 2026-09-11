/**
 * Analytics page tab bar -- "All Graphs" plus up to 3 saved custom views.
 * Same translucent glass-bubble styling as the Front Desk page's own tab
 * bar (`app/patients/page.tsx`), per direct request to match that UI,
 * copied verbatim rather than re-derived: every tab is its own bordered,
 * blurred pill, with the active one solid/opaque instead of translucent.
 */
interface Tab {
  key: string;
  label: string;
}

interface Props {
  tabs: Tab[];
  activeKey: string;
  onSelect: (key: string) => void;
}

export function AnalyticsTabBar({ tabs, activeKey, onSelect }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onSelect(t.key)}
          aria-pressed={activeKey === t.key}
          className={`rounded-full border px-4 py-1.5 text-sm font-medium backdrop-blur-sm transition-colors ${
            activeKey === t.key
              ? "border-brand-bg/20 bg-brand-bg text-brand-dark shadow-lg shadow-brand-gold/10"
              : "border-brand-bg/20 bg-brand-bg/10 text-brand-bg/70 hover:border-brand-gold hover:bg-brand-bg/20 hover:text-brand-bg"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
