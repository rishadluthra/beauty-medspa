"use client";

/**
 * Global patient search — a command-palette-style lookup reachable from
 * every page (it lives in the root nav), for the front desk's most common
 * real action: a call comes in, and the agent needs to pull the patient's
 * record up in a couple keystrokes rather than navigating to the Patients
 * page, switching to the All Patients tab, and typing into its filter
 * panel. Opens via the search icon in the nav or the Cmd/Ctrl+K shortcut;
 * closes on Escape, a backdrop click, or picking a result.
 *
 * Reuses the existing `GET /api/patients?search=` endpoint (the same one
 * behind the All Patients tab's filter, including the anchored-email-match
 * fix -- see ATTENTION_TO_DETAIL.md) rather than a separate lookup, so this
 * and the All Patients search can never quietly drift apart on what counts
 * as a match.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { formatPhone } from "@/lib/format";

const RESULT_COUNT = 8;
const DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 2;

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

export function GlobalPatientSearch() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Global Cmd/Ctrl+K shortcut, from anywhere in the app.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen(true);
      } else if (e.key === "Escape") {
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Autofocus the input the moment the overlay opens.
  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  // Debounce so every keystroke doesn't fire its own request.
  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [query]);

  const trimmed = debouncedQuery.trim();
  const { data, isFetching } = useQuery({
    queryKey: ["patients", "global-search", trimmed],
    queryFn: () => api.getPatients({ search: trimmed, page_size: RESULT_COUNT }),
    enabled: isOpen && trimmed.length >= MIN_QUERY_LENGTH,
  });

  function close() {
    setIsOpen(false);
    setQuery("");
    setDebouncedQuery("");
  }

  function goToPatient(id: string) {
    router.push(`/patients/${id}`);
    close();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Search patients"
        className="flex items-center gap-1.5 rounded-full border border-brand-dark/10 px-3 py-1.5 text-sm text-brand-dark/60 transition-colors hover:border-brand-gold hover:text-brand-dark"
      >
        <SearchIcon />
        <span className="hidden sm:inline">Search</span>
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-start justify-center bg-brand-dark/60 px-3 pt-24 backdrop-blur-sm"
          onClick={close}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-brand-gold/10 bg-brand-bg text-brand-dark shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-brand-dark/10 px-4 py-3">
              <SearchIcon />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search patients by name, email, or phone…"
                className="w-full bg-transparent text-sm text-brand-dark outline-none placeholder:text-brand-dark/40"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <kbd className="hidden rounded border border-brand-dark/15 px-1.5 py-0.5 text-[10px] text-brand-dark/40 sm:block">Esc</kbd>
            </div>

            <div className="max-h-96 overflow-y-auto p-2">
              {trimmed.length < MIN_QUERY_LENGTH && (
                <p className="p-4 text-center text-sm text-brand-dark/40">Keep typing to search…</p>
              )}
              {trimmed.length >= MIN_QUERY_LENGTH && isFetching && (
                <p className="p-4 text-center text-sm text-brand-dark/40">Searching…</p>
              )}
              {trimmed.length >= MIN_QUERY_LENGTH && !isFetching && data?.items.length === 0 && (
                <p className="p-4 text-center text-sm text-brand-dark/40">No patients found.</p>
              )}
              {data?.items.map((patient) => (
                <button
                  key={patient.id}
                  type="button"
                  onClick={() => goToPatient(patient.id)}
                  className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-brand-gold/10"
                >
                  <span className="font-medium">{patient.first_name} {patient.last_name}</span>
                  <span className="text-sm text-brand-dark/50">{formatPhone(patient.phone)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
