"use client";

/**
 * A small, self-dismissing confirmation banner. Currently used only for the
 * "Build Custom Analytics" create flow (success/failure), which previously
 * gave no feedback beyond the modal silently closing -- per direct
 * feedback, there needs to be a visible "created"/"failed" confirmation.
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
      className={`fixed bottom-6 right-6 z-[60] rounded-full px-4 py-2 text-sm font-medium text-white shadow-lg transition-opacity ${
        variant === "success" ? "bg-brand-sage" : "bg-coral"
      }`}
    >
      {message}
    </div>
  );
}
