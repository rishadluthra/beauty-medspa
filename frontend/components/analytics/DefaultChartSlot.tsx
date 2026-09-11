/**
 * Renders one of the 7 fixed default charts with a "Default" badge floated
 * in its top-right corner -- an overlay, not a prop threaded into each
 * chart component, so none of the 7 existing chart components need to
 * change shape just to support a badge that only matters in the "All
 * Graphs" tab / view context they didn't originally know about.
 */
import type { DefaultChartEntry } from "@/lib/defaultCharts";

import { GraphBadge } from "./GraphBadge";

export function DefaultChartSlot({ chart }: { chart: DefaultChartEntry }) {
  const { Component } = chart;
  return (
    <div className="relative">
      <div className="pointer-events-none absolute right-5 top-5 z-10">
        <GraphBadge isDefault />
      </div>
      <Component />
    </div>
  );
}
