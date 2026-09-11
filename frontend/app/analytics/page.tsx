"use client";

/**
 * Analytics Dashboard page (`/analytics`) — the second of the two pages
 * required by the spec. The KPI row is fetched here (via `api.getOverview`)
 * and always shown, regardless of tab. Below it sits the tab bar: "All
 * Graphs" (every default chart + every saved custom report, badged, in a
 * persisted, manually-reorderable order) plus up to 3 saved custom views
 * (named, curated, independently-ordered subsets of the same pool of
 * graphs) -- see `lib/chartRefs.ts` for how a "default:<key>"/
 * "custom:<report_id>" ref resolves to something renderable.
 *
 * Three things that used to be here were removed, not just visually
 * demoted:
 *  - The "New Patients (30d)" KPI always read 0 -- it compared patient
 *    creation dates against the real `datetime.utcnow()`, but every other
 *    "today"-relative view in this app is anchored to the dataset's own
 *    reference date instead (see the backend's `get_reference_now`), since
 *    this is a frozen seed dataset far behind the real current date. This
 *    one never got that treatment. Removed outright, along with its
 *    backend field, rather than patched, since nothing else depended on it.
 *  - The Payment Status pie chart: `Payment.status` in this dataset is
 *    100% "paid" (verified live), so it could only ever render as one
 *    single-color circle.
 *  - The Appointment Status pie chart, per direct request.
 *  For both charts, the backend endpoint/repository function was left in
 *  place -- still a live, tested, reusable query worth keeping for a
 *  future AI/NL-query consumer even with no chart currently on top of it.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { AnalyticsTabBar } from "@/components/analytics/AnalyticsTabBar";
import { BuildCustomAnalyticsModal } from "@/components/analytics/BuildCustomAnalyticsModal";
import { CreateCustomViewModal } from "@/components/analytics/CreateCustomViewModal";
import { CustomReportCard } from "@/components/analytics/CustomReportCard";
import { DefaultChartSlot } from "@/components/analytics/DefaultChartSlot";
import { EditViewModal } from "@/components/analytics/EditViewModal";
import { KpiCard } from "@/components/analytics/KpiCard";
import { Toast } from "@/components/analytics/Toast";
import { api } from "@/lib/api";
import { resolveChartRef, type ResolvedChartRef } from "@/lib/chartRefs";
import { MAX_CUSTOM_VIEWS } from "@/lib/customViews";
import { getDefaultChart } from "@/lib/defaultCharts";
import { formatCents } from "@/lib/format";

const ALL_GRAPHS_TAB = "all";

// These two default charts pair into one row instead of each taking a full
// row (per direct request) -- but ONLY when they land next to each other
// in the active order (true by default; see `lib/defaultCharts.tsx`'s own
// ordering comment). If someone drags a third graph between them, they
// simply stop pairing and render full-width again, rather than fighting
// the reorder feature with a fixed layout rule.
const PAIRED_DEFAULT_KEYS = new Set(["patients_by_source", "patients_by_gender"]);

function defaultKeyOf(item: ResolvedChartRef): string | null {
  return item.isDefault ? item.ref.slice("default:".length) : null;
}

/** Groups the ordered, resolved graph list into render nodes, pairing the two charts above when adjacent. */
function renderGraphs(items: ResolvedChartRef[]) {
  const nodes: React.ReactNode[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const next = items[i + 1];
    const key = defaultKeyOf(item);
    const nextKey = next ? defaultKeyOf(next) : null;

    if (key && nextKey && key !== nextKey && PAIRED_DEFAULT_KEYS.has(key) && PAIRED_DEFAULT_KEYS.has(nextKey)) {
      nodes.push(
        <div key={item.ref} className="grid gap-4 md:grid-cols-2">
          <DefaultChartSlot chart={getDefaultChart(key)!} />
          <DefaultChartSlot chart={getDefaultChart(nextKey)!} />
        </div>,
      );
      i++; // consumed `next` as part of the pair
      continue;
    }

    nodes.push(
      item.isDefault ? (
        <DefaultChartSlot key={item.ref} chart={getDefaultChart(key!)!} />
      ) : (
        <CustomReportCard key={item.ref} report={item.report!} />
      ),
    );
  }
  return nodes;
}

/** Top-level route component for `/analytics`. */
export default function AnalyticsPage() {
  const queryClient = useQueryClient();

  // KPI summary is fetched here (rather than inside a child component)
  // since it feeds the row of KpiCards rendered directly by this page.
  const { data: overview, isLoading, isError } = useQuery({
    queryKey: ["analytics", "overview"],
    queryFn: api.getOverview,
  });

  const { data: customReports } = useQuery({ queryKey: ["custom-reports"], queryFn: api.getCustomReports });
  const { data: graphOrder } = useQuery({ queryKey: ["graph-order"], queryFn: api.getGraphOrder });
  const { data: customViews } = useQuery({ queryKey: ["custom-views"], queryFn: api.getCustomViews });

  const [activeTab, setActiveTab] = useState<string>(ALL_GRAPHS_TAB);
  const [isBuildModalOpen, setBuildModalOpen] = useState(false);
  const [isCreateViewModalOpen, setCreateViewModalOpen] = useState(false);
  const [isEditViewOpen, setEditViewOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; variant: "success" | "error" } | null>(null);

  const activeView = activeTab === ALL_GRAPHS_TAB ? undefined : customViews?.find((v) => v.id === activeTab);
  const activeRefs = activeTab === ALL_GRAPHS_TAB ? (graphOrder?.chart_refs ?? []) : (activeView?.chart_refs ?? []);
  const resolvedItems = customReports
    ? activeRefs.map((ref) => resolveChartRef(ref, customReports)).filter((item): item is NonNullable<typeof item> => item !== null)
    : [];

  // On "All Graphs", a row dropped from the saved list isn't just hidden --
  // there's no other place for "All Graphs" to keep a reference to a graph
  // that still exists, so removing a custom row here means actually
  // deleting that report (see EditViewModal's own docstring). On a view,
  // dropping a row only ever touches that view's own ref list.
  const editSaveMutation = useMutation({
    mutationFn: async (newRefs: string[]) => {
      if (activeTab === ALL_GRAPHS_TAB) {
        const removedCustomIds = resolvedItems
          .filter((item) => !item.isDefault && !newRefs.includes(item.ref))
          .map((item) => item.report!.id);
        for (const id of removedCustomIds) {
          await api.deleteCustomReport(id);
        }
        await api.setGraphOrder(newRefs);
        return removedCustomIds.length;
      }
      await api.updateCustomView(activeTab, newRefs);
      return 0;
    },
    onSuccess: (deletedCount) => {
      if (activeTab === ALL_GRAPHS_TAB) {
        queryClient.invalidateQueries({ queryKey: ["graph-order"] });
        if (deletedCount > 0) queryClient.invalidateQueries({ queryKey: ["custom-reports"] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["custom-views"] });
      }
      setEditViewOpen(false);
      if (deletedCount > 0) {
        setToast({ message: deletedCount === 1 ? "Custom graph deleted" : `${deletedCount} custom graphs deleted`, variant: "success" });
      }
    },
    onError: () => setToast({ message: "Failed to save changes", variant: "error" }),
  });

  const deleteViewMutation = useMutation({
    mutationFn: () => api.deleteCustomView(activeTab),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-views"] });
      setToast({ message: "Custom view deleted", variant: "success" });
      setActiveTab(ALL_GRAPHS_TAB);
      setEditViewOpen(false);
    },
    onError: () => setToast({ message: "Failed to delete custom view", variant: "error" }),
  });

  const tabs = [
    { key: ALL_GRAPHS_TAB, label: "All Graphs" },
    ...(customViews ?? []).map((v) => ({ key: v.id, label: v.name })),
  ];
  const atViewCap = (customViews?.length ?? 0) >= MAX_CUSTOM_VIEWS;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Analytics</h1>
        {/*
          Two ways to build something: a single new graph (the existing
          metric x dimension x time grain pivot builder), or a whole new
          curated dashboard tab made of graphs that already exist (or ones
          created inline, right there in that picker). Saved reports/views
          are shared across every viewer (this app has no per-user auth).
          "Create Custom View" uses a frosted-glass treatment (matching the
          menu bar's own look) rather than a plain outline -- per direct
          request, to read as more prominent than a bare secondary button
          without competing with the solid-gold primary CTA next to it.
        */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setBuildModalOpen(true)}
            className="rounded-full bg-brand-gold px-4 py-1.5 text-sm font-medium text-brand-dark transition-colors hover:bg-brand-gold-dark"
          >
            + Create New Graph
          </button>
          <button
            type="button"
            disabled={atViewCap}
            title={atViewCap ? `You've reached the limit of ${MAX_CUSTOM_VIEWS} custom views.` : undefined}
            onClick={() => setCreateViewModalOpen(true)}
            className="rounded-full border border-brand-gold/10 bg-brand-bg/50 px-4 py-1.5 text-sm font-medium text-brand-dark shadow-lg shadow-brand-gold/10 backdrop-blur-xl transition-colors hover:bg-brand-bg/70 disabled:cursor-not-allowed disabled:opacity-40"
          >
            + Create Custom View
          </button>
        </div>
      </div>

      {isBuildModalOpen && (
        <BuildCustomAnalyticsModal
          onClose={() => setBuildModalOpen(false)}
          onCreated={() => setToast({ message: "Custom graph created", variant: "success" })}
          onFailed={() => setToast({ message: "Failed to create custom graph", variant: "error" })}
        />
      )}

      {isCreateViewModalOpen && customReports && (
        <CreateCustomViewModal
          customReports={customReports}
          onClose={() => setCreateViewModalOpen(false)}
          onViewCreated={(view) => {
            setToast({ message: "Custom view created", variant: "success" });
            setActiveTab(view.id);
          }}
          onViewFailed={() => setToast({ message: "Failed to create custom view", variant: "error" })}
          onGraphCreated={() => setToast({ message: "Custom graph created", variant: "success" })}
          onGraphFailed={() => setToast({ message: "Failed to create custom graph", variant: "error" })}
        />
      )}

      {isEditViewOpen && (
        <EditViewModal
          title={activeTab === ALL_GRAPHS_TAB ? "Edit All Graphs" : `Edit View: ${activeView?.name}`}
          items={resolvedItems}
          mode={activeTab === ALL_GRAPHS_TAB ? "allGraphs" : "view"}
          isSaving={editSaveMutation.isPending}
          onSave={(refs) => editSaveMutation.mutate(refs)}
          onClose={() => setEditViewOpen(false)}
          onDeleteView={() => deleteViewMutation.mutate()}
          isDeletingView={deleteViewMutation.isPending}
        />
      )}

      {toast && <Toast message={toast.message} variant={toast.variant} onDismiss={() => setToast(null)} />}

      {isLoading && <p className="text-brand-bg/70">Loading overview…</p>}
      {isError && <p className="text-coral">Could not load analytics overview.</p>}

      {overview && (
        // `md:grid-cols-3` (no further lg override) gives two clean, even
        // rows of 3 for these 6 KPIs from medium screens up through large
        // ones, rather than an uneven 4-then-2 split. Single column on
        // mobile (not 2) -- a 2-up grid on a narrow phone leaves too
        // little width for a long formatted-currency value (e.g. a
        // six-figure Total Revenue) to fit without overflowing.
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          <KpiCard label="Total Patients" value={overview.total_patients.toLocaleString()} />
          {/*
            Retention: of patients who've come in at least once, what
            share came back for a second (non-cancelled) visit. Placed
            second, right after the headline patient count, since it's a
            core "how healthy is this business" answer the spec calls out
            explicitly -- not a minor stat to bury at the end of the row.
          */}
          <KpiCard label="Repeat Patient Rate" value={`${(overview.repeat_patient_rate * 100).toFixed(1)}%`} />
          <KpiCard label="Total Revenue" value={formatCents(overview.total_revenue_cents)} />
          <KpiCard label="Total Appointments" value={overview.total_appointments.toLocaleString()} />
          <KpiCard label="Avg. Transaction" value={formatCents(overview.avg_transaction_cents)} />
          <KpiCard label="Cancellation Rate" value={`${(overview.cancellation_rate * 100).toFixed(1)}%`} />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <AnalyticsTabBar tabs={tabs} activeKey={activeTab} onSelect={setActiveTab} />

        <button
          type="button"
          onClick={() => setEditViewOpen(true)}
          className="rounded-full border border-brand-bg/20 px-4 py-1.5 text-sm font-medium text-brand-bg/80 backdrop-blur-sm transition-colors hover:border-brand-gold hover:text-brand-bg"
        >
          Edit View
        </button>
      </div>

      <div className="space-y-4">
        {renderGraphs(resolvedItems)}
        {activeTab !== ALL_GRAPHS_TAB && resolvedItems.length === 0 && (
          <p className="text-brand-bg/70">This view has no graphs left to show. Delete it, or build a new one.</p>
        )}
      </div>
    </div>
  );
}
