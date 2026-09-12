"use client";

/**
 * Mobile-only ("<sm") nav menu: a single hamburger button that opens a dropdown holding
 * search + both page links -- matching the design reference given for this (Decoda
 * Health's own mobile header: full logo+wordmark, one hamburger button, nothing else in
 * between). Replaces the previous mobile layout, which crammed a bare search icon and
 * both "Front Desk"/"Analytics" text links directly into the nav bar alongside a
 * logo-only (no wordmark) mark -- the wordmark hiding below `sm` was a deliberate
 * tradeoff at the time for exactly that crowding, which this menu removes the need for:
 * the wordmark can stay visible at every width now that the nav's right side is just one
 * button instead of three separate controls.
 *
 * Reuses `GlobalPatientSearch`/`NavLinks` rather than re-implementing search or
 * active-route detection here -- both already take a variant prop for this exact
 * "render as a menu row" case (see their own docs), so this component only owns the
 * menu's own open/closed state and the dropdown shell.
 */

import { useEffect, useRef, useState } from "react";

import { GlobalPatientSearch } from "@/components/GlobalPatientSearch";
import { NavLinks } from "@/components/NavLinks";

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-5 w-5">
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </svg>
  );
}

export function MobileNavMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Standard dropdown behavior: clicking anywhere outside the button/card closes it --
  // same pattern `PatientFilters`/`ScheduleFilters` already use.
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative sm:hidden">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-label="Open menu"
        aria-expanded={isOpen}
        className="flex h-9 w-9 items-center justify-center rounded-full text-brand-dark/70 transition-colors hover:bg-brand-dark/5 hover:text-brand-dark"
      >
        <MenuIcon />
      </button>

      <div
        className={`absolute right-0 top-full z-30 mt-2 w-56 origin-top-right rounded-2xl border border-brand-gold/10 bg-brand-bg p-2 shadow-xl transition-all duration-150 ease-out ${
          isOpen ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0"
        }`}
      >
        <div onClick={() => setIsOpen(false)}>
          <GlobalPatientSearch variant="menuItem" />
        </div>
        <div className="my-1 border-t border-brand-dark/10" />
        <NavLinks variant="menu" onNavigate={() => setIsOpen(false)} />
      </div>
    </div>
  );
}
