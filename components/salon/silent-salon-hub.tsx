"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Scissors,
  Clock,
  ShieldCheck,
  Code2,
  Columns,
  Smartphone,
  LayoutDashboard,
  ExternalLink,
  CheckCircle2,
  VolumeX,
} from "lucide-react";
import { BookingWidget } from "./booking-widget";
import { SalonDashboard } from "./salon-dashboard";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Appointment } from "@/lib/salon/types";
import { formatDuration, formatEuro } from "@/lib/salon/calculator";

export function SilentSalonHub() {
  const [activeSalonSlug, setActiveSalonSlug] =
    useState<string>("atelier-lumiere");
  const [viewMode, setViewMode] = useState<"split" | "widget" | "dashboard">(
    "split",
  );
  const [lastBooked, setLastBooked] = useState<Appointment | null>(null);

  return (
    <div className="min-h-screen flex flex-col bg-stone-100/70 dark:bg-stone-950 text-stone-900 dark:text-stone-100">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 border-b border-stone-200/80 dark:border-stone-800 bg-white/90 dark:bg-stone-950/90 backdrop-blur">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-stone-900 dark:bg-amber-400 text-white dark:text-stone-950 flex items-center justify-center font-bold text-sm">
              <Scissors className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-tight text-sm sm:text-base">
                  SILENT SALON
                </span>
                <span className="hidden sm:inline-block text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300">
                  SaaS OS für Friseursalons
                </span>
              </div>
              <p className="text-[11px] text-stone-500 hidden md:block">
                Smarte Vorab-Qualifizierung · Dynamische Zeitslots · Stripe
                No-Show-Schutz
              </p>
            </div>
          </div>

          {/* View Switcher (Split / Widget / Dashboard) */}
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-100/80 dark:bg-stone-900 p-1 text-xs">
              <button
                type="button"
                onClick={() => setViewMode("split")}
                className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all ${
                  viewMode === "split"
                    ? "bg-white dark:bg-stone-800 text-stone-900 dark:text-white shadow-sm"
                    : "text-stone-600 dark:text-stone-400"
                }`}
              >
                <Columns className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Live Split-View</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("widget")}
                className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all ${
                  viewMode === "widget"
                    ? "bg-white dark:bg-stone-800 text-stone-900 dark:text-white shadow-sm"
                    : "text-stone-600 dark:text-stone-400"
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Kunden-Widget</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("dashboard")}
                className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all ${
                  viewMode === "dashboard"
                    ? "bg-white dark:bg-stone-800 text-stone-900 dark:text-white shadow-sm"
                    : "text-stone-600 dark:text-stone-400"
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Steuerzentrale</span>
              </button>
            </div>

            {/* Tenant Switcher */}
            <select
              aria-label="Aktiven Salon-Mandanten wählen"
              value={activeSalonSlug}
              onChange={(e) => setActiveSalonSlug(e.target.value)}
              className="hidden lg:block px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-xs font-semibold"
            >
              <option value="atelier-lumiere">
                Mandant 1: Atelier Lumière (Berlin)
              </option>
              <option value="urban-craft">
                Mandant 2: URBAN CRAFT (München)
              </option>
            </select>

            <Link
              href={`/embed/${activeSalonSlug}`}
              target="_blank"
              className="hidden xl:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 text-xs font-semibold hover:bg-stone-100 dark:hover:bg-stone-800"
            >
              <span>/embed/{activeSalonSlug}</span>
              <ExternalLink className="w-3 h-3" />
            </Link>

            <ThemeSwitcher />
          </div>
        </div>
      </header>

      {/* Value Proposition Banner */}
      <section className="border-b border-stone-200/70 dark:border-stone-800 bg-white dark:bg-stone-900/40 py-5 px-4 sm:px-6">
        <div className="max-w-[1440px] mx-auto flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1 max-w-2xl">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              Kein Telefonklingeln am Stuhl. Keine falschen Zeitpuffer. Keine
              No-Shows.
            </h1>
            <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400">
              Links bucht der Endkunde in unter 60 Sekunden inklusive{" "}
              <strong>dynamischer Haarlängen- & Dichte-Kalkulation</strong>.
              Rechts synchronisiert sich die{" "}
              <strong>tageslichttaugliche Salon-Steuerzentrale</strong> in
              Echtzeit.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs shrink-0">
            <div className="px-3 py-2 rounded-xl bg-stone-100/80 dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600 shrink-0" />
              <div>
                <div className="font-bold">Dynamische Slots</div>
                <div className="text-[10px] text-stone-500">
                  Basis + Haarlänge/Dichte
                </div>
              </div>
            </div>
            <div className="px-3 py-2 rounded-xl bg-stone-100/80 dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <div className="font-bold">No-Show-Schutz</div>
                <div className="text-[10px] text-stone-500">
                  Stripe Deposit & SMS
                </div>
              </div>
            </div>
            <div className="px-3 py-2 rounded-xl bg-stone-100/80 dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 flex items-center gap-2">
              <VolumeX className="w-4 h-4 text-teal-600 shrink-0" />
              <div>
                <div className="font-bold">Silent Cut</div>
                <div className="text-[10px] text-stone-500">
                  Ruhe-Option buchbar
                </div>
              </div>
            </div>
            <div className="px-3 py-2 rounded-xl bg-stone-100/80 dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 flex items-center gap-2">
              <Code2 className="w-4 h-4 text-violet-600 shrink-0" />
              <div>
                <div className="font-bold">1-Zeilen Embed</div>
                <div className="text-[10px] text-stone-500">
                  Shadow-DOM isoliert
                </div>
              </div>
            </div>
          </div>
        </div>

        {lastBooked && (
          <div className="max-w-[1440px] mx-auto mt-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-900 dark:text-emerald-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong>Live-Sync erfolgreich:</strong> Termin für{" "}
                <strong>{lastBooked.customerName}</strong> ({lastBooked.date},{" "}
                {lastBooked.startTime}–{lastBooked.customerEndTime} Uhr ·{" "}
                {formatDuration(lastBooked.totalDurationMinutes)} ·{" "}
                {formatEuro(lastBooked.totalPriceCents)}) wurde sofort im
                Salon-Tagesplan blockiert!
              </span>
            </div>
            <button
              type="button"
              onClick={() => setLastBooked(null)}
              className="text-[11px] underline opacity-80 hover:opacity-100"
            >
              Ausblenden
            </button>
          </div>
        )}
      </section>

      {/* Main Workbench Area */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto p-4 sm:p-6">
        {viewMode === "split" && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            {/* Left Column: Customer Embeddable Widget */}
            <div className="xl:col-span-5 space-y-3">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
                    1. Für den Endkunden: Das Embeddable Widget
                  </span>
                </div>
                <Link
                  href={`/embed/${activeSalonSlug}`}
                  target="_blank"
                  className="text-xs font-semibold text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-1"
                >
                  <span>Standalone öffnen</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>

              <BookingWidget
                salonSlug={activeSalonSlug}
                onBookingCreated={(appt) => setLastBooked(appt)}
              />
            </div>

            {/* Right Column: Hairdresser & Team Dashboard */}
            <div className="xl:col-span-7 space-y-3">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
                    2. Für Friseur & Team: Die Steuerzentrale (Echtzeit-Sync)
                  </span>
                </div>
                <Link
                  href="/dashboard"
                  className="text-xs font-semibold text-stone-700 dark:text-stone-300 hover:underline flex items-center gap-1"
                >
                  <span>Vollbild-Dashboard</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>

              <SalonDashboard
                salonSlug={activeSalonSlug}
                onSalonChange={setActiveSalonSlug}
                compactMode
              />
            </div>
          </div>
        )}

        {viewMode === "widget" && (
          <div className="py-4">
            <BookingWidget
              salonSlug={activeSalonSlug}
              onBookingCreated={(appt) => setLastBooked(appt)}
            />
          </div>
        )}

        {viewMode === "dashboard" && (
          <SalonDashboard
            salonSlug={activeSalonSlug}
            onSalonChange={setActiveSalonSlug}
          />
        )}
      </main>
    </div>
  );
}
