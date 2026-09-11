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
import { KpiCard } from "@/components/analytics/KpiCard";
import { ReorderModal } from "@/components/analytics/ReorderModal";
import { Toast } from "@/components/analytics/Toast";
import { api } from "@/lib/api";
import { resolveChartRef } from "@/lib/chartRefs";
import { getDefaultChart } from "@/lib/defaultCharts";
import { formatCents } from "@/lib/format";
import { MAX_CUSTOM_VIEWS } from "@/lib/customViews";

const ALL_GRAPHS_TAB = "all";

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
  const [isReorderOpen, setReorderOpen] = useState(false);
  const [confirmingDeleteView, setConfirmingDeleteView] = useState(false);
  const [toast, setToast] = useState<{ message: string; variant: "success" | "error" } | null>(null);

  const activeView = activeTab === ALL_GRAPHS_TAB ? undefined : customViews?.find((v) => v.id === activeTab);
  const activeRefs = activeTab === ALL_GRAPHS_TAB ? (graphOrder?.chart_refs ?? []) : (activeView?.chart_refs ?? []);
  const resolvedItems = customReports
    ? activeRefs.map((ref) => resolveChartRef(ref, customReports)).filter((item): item is NonNullable<typeof item> => item !== null)
    : [];

  const reorderMutation = useMutation({
    mutationFn: (refs: string[]) =>
      activeTab === ALL_GRAPHS_TAB ? api.setGraphOrder(refs) : api.updateCustomView(activeTab, refs),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activeTab === ALL_GRAPHS_TAB ? ["graph-order"] : ["custom-views"] });
      setReorderOpen(false);
    },
  });

  const deleteViewMutation = useMutation({
    mutationFn: () => api.deleteCustomView(activeTab),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-views"] });
      setToast({ message: "Custom view deleted", variant: "success" });
      setActiveTab(ALL_GRAPHS_TAB);
      setConfirmingDeleteView(false);
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
            className="rounded-full border border-brand-bg/20 px-4 py-1.5 text-sm font-medium text-brand-bg/80 transition-colors hover:border-brand-gold hover:text-brand-bg disabled:cursor-not-allowed disabled:opacity-40"
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

      {isReorderOpen && (
        <ReorderModal
          title={activeTab === ALL_GRAPHS_TAB ? "Reorder All Graphs" : `Reorder: ${activeView?.name}`}
          items={resolvedItems}
          allowRemove={activeTab !== ALL_GRAPHS_TAB}
          isSaving={reorderMutation.isPending}
          onSave={(refs) => reorderMutation.mutate(refs)}
          onClose={() => setReorderOpen(false)}
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

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setReorderOpen(true)}
            className="rounded-full border border-brand-bg/20 px-4 py-1.5 text-sm font-medium text-brand-bg/80 backdrop-blur-sm transition-colors hover:border-brand-gold hover:text-brand-bg"
          >
            Reorder
          </button>
          {activeView &&
            (confirmingDeleteView ? (
              <div className="flex items-center gap-1 text-sm">
                <span className="text-brand-bg/70">Delete this view?</span>
                <button
                  type="button"
                  disabled={deleteViewMutation.isPending}
                  onClick={() => deleteViewMutation.mutate()}
                  className="rounded-full border border-coral px-3 py-1 text-coral transition-colors hover:bg-coral hover:text-white disabled:opacity-50"
                >
                  {deleteViewMutation.isPending ? "…" : "Yes"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDeleteView(false)}
                  className="rounded-full border border-brand-bg/20 px-3 py-1 text-brand-bg/70 transition-colors hover:border-brand-gold"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingDeleteView(true)}
                className="rounded-full border border-brand-bg/20 px-4 py-1.5 text-sm font-medium text-brand-bg/80 backdrop-blur-sm transition-colors hover:border-coral hover:text-coral"
              >
                Delete View
              </button>
            ))}
        </div>
      </div>

      {/*
        Every graph -- default and custom alike -- renders full row width,
        one per row (not a 2-up grid): this list is drag-reorderable, and a
        linear stack is what that requires; it also gives every chart the
        same "more room to breathe" benefit custom reports already got
        (some have up to 10 series, needing real width for their legend
        and axis labels to stay readable).
      */}
      <div className="space-y-4">
        {resolvedItems.map((item) =>
          item.isDefault ? (
            <DefaultChartSlot key={item.ref} chart={getDefaultChart(item.ref.slice("default:".length))!} />
          ) : (
            <CustomReportCard
              key={item.ref}
              report={item.report!}
              showDeleteButton={activeTab === ALL_GRAPHS_TAB}
              onDeleted={() => setToast({ message: "Custom graph deleted", variant: "success" })}
              onDeleteFailed={() => setToast({ message: "Failed to delete custom graph", variant: "error" })}
            />
          ),
        )}
        {activeTab !== ALL_GRAPHS_TAB && resolvedItems.length === 0 && (
          <p className="text-brand-bg/70">This view has no graphs left to show. Delete it, or build a new one.</p>
        )}
      </div>
    </div>
  );
}
