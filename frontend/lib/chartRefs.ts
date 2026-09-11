/**
 * Shared helpers for working with chart refs ("default:<key>" /
 * "custom:<report_id>") -- the string identifiers the "All Graphs" order
 * and custom views store, resolved against the default-chart registry
 * and the live list of saved custom reports.
 */

import { getDefaultChart } from "./defaultCharts";
import type { CustomReport } from "./types";

export function defaultRef(key: string): string {
  return `default:${key}`;
}

export function customRef(reportId: string): string {
  return `custom:${reportId}`;
}

export interface ResolvedChartRef {
  ref: string;
  label: string;
  isDefault: boolean;
  /** The matching CustomReport, when `!isDefault`. */
  report?: CustomReport;
}

/**
 * Resolves a chart ref to its display label and kind. Returns `null` for a
 * ref that no longer resolves to anything real -- a custom report ref
 * whose report has since been deleted. Callers should skip a `null`
 * result rather than render a broken card for it (see `CustomView`'s
 * "live, not a snapshot" design: a stale reference just quietly
 * disappears from the list it's in).
 */
export function resolveChartRef(ref: string, customReports: CustomReport[]): ResolvedChartRef | null {
  if (ref.startsWith("default:")) {
    const key = ref.slice("default:".length);
    const entry = getDefaultChart(key);
    return entry ? { ref, label: entry.label, isDefault: true } : null;
  }
  if (ref.startsWith("custom:")) {
    const id = ref.slice("custom:".length);
    const report = customReports.find((r) => r.id === id);
    return report ? { ref, label: report.title, isDefault: false, report } : null;
  }
  return null;
}
