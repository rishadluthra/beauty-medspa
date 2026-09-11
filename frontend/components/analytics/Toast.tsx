"use client";

/**
 * A small, self-dismissing confirmation banner used across the self-serve
 * analytics feature's create/delete flows for graphs and views. Bottom-
 * center (not bottom-right) per direct request -- the most visible spot
 * for a confirmation someone should actually notice, not a corner that's
 * easy to miss while looking at the graph they just acted on.
 */

import { useEffect } from "react";

interface Props {
  message: string;
  variant: "success" | "error";
  onDismiss: () => void;
}

export function Toast({ message, variant, onDismiss }: Props) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 3500);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      role="status"
      className={`fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-full px-4 py-2 text-sm font-medium text-white shadow-lg transition-opacity ${
        variant === "success" ? "bg-brand-sage" : "bg-coral"
      }`}
    >
      {message}
    </div>
  );
}
