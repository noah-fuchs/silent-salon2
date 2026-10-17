"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  Clock,
  ShieldCheck,
  VolumeX,
  Coffee,
  Sparkles,
  Users,
  Sliders,
  Code2,
  Plus,
  Trash2,
  Copy,
  Check,
  Smartphone,
  Tablet,
  RotateCcw,
  Database,
  BellRing,
  FlaskConical,
  CreditCard,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { formatDuration, formatEuro } from "@/lib/salon/calculator";
import {
  DEFAULT_ANCHOR_DATE,
  getClientTodayDateStr,
  getOffsetDateStr,
} from "@/lib/salon/seed-data";
import { useSalonStore } from "@/lib/salon/store";
import { AppointmentStatus } from "@/lib/salon/types";

interface SalonDashboardProps {
  salonSlug?: string;
  onSalonChange?: (slug: string) => void;
  compactMode?: boolean;
}

export function SalonDashboard({
  salonSlug = "atelier-lumiere",
  onSalonChange,
  compactMode = false,
}: SalonDashboardProps) {
  const {
    state,
    updateAppointmentStatus,
    addTimeOffBlock,
    removeTimeOffBlock,
    updateModifier,
    updateService,
    updateCustomerNotes,
    resetDemoData,
  } = useSalonStore();

  const salon = useMemo(
    () =>
      state.salons.find((s) => s.slug === salonSlug) || state.salons[0],
    [state.salons, salonSlug],
  );

  const [activeTab, setActiveTab] = useState<
    "schedule" | "catalog" | "crm" | "embed"
  >("schedule");
  const [anchorDate, setAnchorDate] = useState<string>(DEFAULT_ANCHOR_DATE);
  const [selectedDate, setSelectedDate] = useState<string>(DEFAULT_ANCHOR_DATE);
  const [selectedMemberFilter, setSelectedMemberFilter] = useState<
    string | "all"
  >("all");
  const [deviceViewMode, setDeviceViewMode] = useState<"reception" | "pocket">(
    "reception",
  );

  // Sync real client date after mount in browser (avoids Next.js prerender new Date() warnings)
  useEffect(() => {
    const today = getClientTodayDateStr();
    setAnchorDate(today);
    setSelectedDate(today);
  }, []);

  // Quick Time-off Blocker form state
  const [showBlockerForm, setShowBlockerForm] = useState(false);
  const [blockerMemberId, setBlockerMemberId] = useState<string>("");
  const [blockerStart, setBlockerStart] = useState<string>("12:00");
  const [blockerEnd, setBlockerEnd] = useState<string>("13:00");
  const [blockerReason, setBlockerReason] = useState<string>(
    "Pause / Internes Farb-Training",
  );

  // Copy feedback for embed code
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  const members = useMemo(
    () => state.members.filter((m) => m.salonId === salon.id && m.isActive),
    [state.members, salon.id],
  );

  const services = useMemo(
    () => state.services.filter((s) => s.salonId === salon.id),
    [state.services, salon.id],
  );

  const modifiers = useMemo(
    () =>
      state.modifiers
        .filter((m) => m.salonId === salon.id)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [state.modifiers, salon.id],
  );

  const customers = useMemo(
    () => state.customers.filter((c) => c.salonId === salon.id),
    [state.customers, salon.id],
  );

  const dayAppointments = useMemo(
    () =>
      state.appointments
        .filter((a) => a.salonId === salon.id && a.date === selectedDate)
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [state.appointments, salon.id, selectedDate],
  );

  const dayTimeOff = useMemo(
    () =>
      state.timeOffBlocks.filter(
        (t) => t.salonId === salon.id && t.date === selectedDate,
      ),
    [state.timeOffBlocks, salon.id, selectedDate],
  );

  const filteredAppointments = useMemo(() => {
    if (selectedMemberFilter === "all") return dayAppointments;
    return dayAppointments.filter((a) => a.memberId === selectedMemberFilter);
  }, [dayAppointments, selectedMemberFilter]);

  // Calculate Daily Operational KPIs
  const kpis = useMemo(() => {
    const activeAppts = dayAppointments.filter(
      (a) => a.status !== "cancelled",
    );
    const totalRevenueCents = activeAppts.reduce(
      (sum, a) => sum + a.totalPriceCents,
      0,
    );
    const securedDepositsCents = activeAppts.reduce(
      (sum, a) => sum + a.depositAmountCents,
      0,
    );
    const savedOvertimeMinutes = activeAppts.reduce(
      (sum, a) => sum + a.extraDurationMinutes,
      0,
    );
    const silentCutCount = activeAppts.filter(
      (a) => a.prefersSilentCut,
    ).length;

    return {
      totalBookings: activeAppts.length,
      totalRevenueCents,
      securedDepositsCents,
      savedOvertimeMinutes,
      silentCutCount,
    };
  }, [dayAppointments]);

  const dateButtons = useMemo(() => {
    return [-1, 0, 1, 2, 3].map((offset) => {
      const iso = getOffsetDateStr(offset, anchorDate);
      const [y, m, d] = iso.split("-").map(Number);
      const dateObj = new Date(Date.UTC(y, m - 1, d));
      const label =
        offset === -1
          ? "Gestern"
          : offset === 0
            ? "Heute"
            : offset === 1
              ? "Morgen"
              : new Intl.DateTimeFormat("de-DE", {
                  weekday: "short",
                  timeZone: "UTC",
                }).format(dateObj);
      const formatted = new Intl.DateTimeFormat("de-DE", {
        day: "2-digit",
        month: "2-digit",
        timeZone: "UTC",
      }).format(dateObj);
      return { iso, label, formatted };
    });
  }, [anchorDate]);

  const handleAddBlocker = (e: React.FormEvent) => {
    e.preventDefault();
    const targetMemberId = blockerMemberId || members[0]?.id;
    if (!targetMemberId) return;
    addTimeOffBlock({
      salonId: salon.id,
      memberId: targetMemberId,
      date: selectedDate,
      startTime: blockerStart,
      endTime: blockerEnd,
      reason: blockerReason || "Abwesend / Pause",
    });
    setShowBlockerForm(false);
  };

  const copyCode = (key: string, text: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedSnippet(key);
      setTimeout(() => setCopiedSnippet(null), 2000);
    }
  };

  const scriptSnippet = `<!-- Silent Salon Widget (Shadow-DOM isoliert, < 60 Sek. Buchung) -->
<div id="silent-salon-widget"></div>
<script
  src="${typeof window !== "undefined" ? window.location.origin : "https://app.silentsalon.de"}/embed.js"
  data-salon="${salon.slug}"
  data-mode="inline"
  data-color="${salon.brandColor}"
  async
></script>`;

  const iframeSnippet = `<iframe
  src="${typeof window !== "undefined" ? window.location.origin : "https://app.silentsalon.de"}/embed/${salon.slug}?embedded=1"
  style="width:100%;min-height:700px;border:0;border-radius:20px;"
  allow="payment *"
  title="Online Terminbuchung – ${salon.name}"
></iframe>`;

  return (
    <div className="w-full rounded-3xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100 shadow-sm overflow-hidden">
      {/* Top Daylight Bar */}
      <div className="border-b border-stone-200 dark:border-stone-800 bg-stone-50/90 dark:bg-stone-900/80 px-5 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-2xl text-white flex items-center justify-center font-bold text-sm shadow-sm shrink-0"
            style={{ backgroundColor: salon.brandColor }}
          >
            SS
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
                Salon-Steuerzentrale · Multi-Tenant
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live-Sync aktiv
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <select
                aria-label="Salon Mandant wechseln"
                value={salon.slug}
                onChange={(e) => onSalonChange?.(e.target.value)}
                className="font-bold text-base sm:text-lg bg-transparent border-b border-dashed border-stone-400 focus:outline-none cursor-pointer"
              >
                {state.salons.map((s) => (
                  <option
                    key={s.id}
                    value={s.slug}
                    className="bg-white text-stone-900"
                  >
                    {s.name} ({s.city})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setDeviceViewMode("reception")}
              className={`px-2.5 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-colors ${
                deviceViewMode === "reception"
                  ? "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900"
                  : "text-stone-600 dark:text-stone-400"
              }`}
            >
              <Tablet className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">iPad Rezeption</span>
            </button>
            <button
              type="button"
              onClick={() => setDeviceViewMode("pocket")}
              className={`px-2.5 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-colors ${
                deviceViewMode === "pocket"
                  ? "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900"
                  : "text-stone-600 dark:text-stone-400"
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Stylist-Hosentasche</span>
            </button>
          </div>

          <button
            type="button"
            onClick={resetDemoData}
            title="Demo-Daten auf Ausgangszustand zurücksetzen"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-800 text-xs font-medium text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Demo Reset</span>
          </button>

          {!compactMode && (
            <Link
              href={`/embed/${salon.slug}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-900 text-white dark:bg-amber-400 dark:text-stone-950 text-xs font-semibold"
            >
              <span>Widget isoliert öffnen</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      </div>

      {/* Operational KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-4 sm:px-6 bg-stone-50/40 dark:bg-stone-900/30 border-b border-stone-200 dark:border-stone-800">
        <div className="rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-white dark:bg-stone-900 p-3.5">
          <div className="text-[11px] font-medium text-stone-500 flex items-center justify-between">
            <span>Tagesumsatz ({selectedDate === anchorDate ? "Heute" : selectedDate})</span>
            <CreditCard className="w-3.5 h-3.5 text-stone-400" />
          </div>
          <div className="text-lg sm:text-xl font-bold mt-1">
            {formatEuro(kpis.totalRevenueCents)}
          </div>
          <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium mt-0.5">
            {kpis.totalBookings} aktive Behandlungen
          </div>
        </div>

        <div className="rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-white dark:bg-stone-900 p-3.5">
          <div className="text-[11px] font-medium text-stone-500 flex items-center justify-between">
            <span>No-Show-Schutz (Stripe)</span>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-lg sm:text-xl font-bold mt-1 text-emerald-700 dark:text-emerald-400">
            {formatEuro(kpis.securedDepositsCents)}
          </div>
          <div className="text-[11px] text-stone-500 mt-0.5">
            Vorab-Anzahlungen gesichert
          </div>
        </div>

        <div className="rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-white dark:bg-stone-900 p-3.5">
          <div className="text-[11px] font-medium text-stone-500 flex items-center justify-between">
            <span>Verhinderter Zeitverzug</span>
            <Clock className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-lg sm:text-xl font-bold mt-1 text-amber-700 dark:text-amber-400">
            +{kpis.savedOvertimeMinutes} Min.
          </div>
          <div className="text-[11px] text-stone-500 mt-0.5">
            Durch Haar-Qualifizierung eingeplant
          </div>
        </div>

        <div className="rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-white dark:bg-stone-900 p-3.5">
          <div className="text-[11px] font-medium text-stone-500 flex items-center justify-between">
            <span>Ruhe-Termine („Silent Cut“)</span>
            <VolumeX className="w-3.5 h-3.5 text-teal-600" />
          </div>
          <div className="text-lg sm:text-xl font-bold mt-1 text-teal-700 dark:text-teal-400">
            {kpis.silentCutCount} Gäste
          </div>
          <div className="text-[11px] text-stone-500 mt-0.5">
            Kein Telefonklingeln · Voller Fokus
          </div>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="flex overflow-x-auto border-b border-stone-200 dark:border-stone-800 px-4 sm:px-6 bg-white dark:bg-stone-950 gap-1">
        {[
          {
            id: "schedule",
            label: "Tagesablauf & Kalender",
            icon: Calendar,
          },
          {
            id: "catalog",
            label: "Kalkulations-Engine & Leistungen",
            icon: Sliders,
          },
          {
            id: "crm",
            label: "Kunden-Akte & Rezepturen",
            icon: Users,
          },
          {
            id: "embed",
            label: "Widget-Einbettung & RLS-Architektur",
            icon: Code2,
          },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() =>
                setActiveTab(
                  tab.id as "schedule" | "catalog" | "crm" | "embed",
                )
              }
              className={`py-3.5 px-3.5 border-b-2 text-xs sm:text-sm font-semibold flex items-center gap-2 whitespace-nowrap transition-colors ${
                active
                  ? "border-stone-900 dark:border-amber-400 text-stone-900 dark:text-white"
                  : "border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-300"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: SCHEDULE & DAILY TIMELINE */}
      {activeTab === "schedule" && (
        <div className="p-4 sm:p-6 space-y-5">
          {/* Date & Stylist Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {dateButtons.map((d) => {
                const active = selectedDate === d.iso;
                return (
                  <button
                    key={d.iso}
                    type="button"
                    onClick={() => setSelectedDate(d.iso)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                      active
                        ? "border-stone-900 bg-stone-900 text-white dark:border-amber-400 dark:bg-amber-400 dark:text-stone-950"
                        : "border-stone-200 dark:border-stone-800 hover:border-stone-400"
                    }`}
                  >
                    <span>{d.label}</span>{" "}
                    <span className="opacity-70 font-normal">{d.formatted}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setSelectedMemberFilter("all")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    selectedMemberFilter === "all"
                      ? "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-950"
                      : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300"
                  }`}
                >
                  Alle Stylisten ({members.length})
                </button>
                {members.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedMemberFilter(m.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      selectedMemberFilter === m.id
                        ? "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-950"
                        : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300"
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: m.colorHex }}
                    />
                    <span>{m.displayName.split(" ")[0]}</span>
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setShowBlockerForm((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 text-xs font-semibold hover:bg-stone-100 dark:hover:bg-stone-800"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Pause / Blocker</span>
              </button>
            </div>
          </div>

          {/* Quick Blocker Form */}
          {showBlockerForm && (
            <form
              onSubmit={handleAddBlocker}
              className="rounded-2xl border border-amber-400/50 bg-amber-50/50 dark:bg-amber-950/20 p-4 grid grid-cols-1 sm:grid-cols-5 gap-3 items-end"
            >
              <div>
                <label className="text-[11px] font-semibold block mb-1">
                  Stylist
                </label>
                <select
                  value={blockerMemberId || members[0]?.id}
                  onChange={(e) => setBlockerMemberId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs"
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.displayName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold block mb-1">
                  Von
                </label>
                <input
                  type="time"
                  value={blockerStart}
                  onChange={(e) => setBlockerStart(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold block mb-1">
                  Bis
                </label>
                <input
                  type="time"
                  value={blockerEnd}
                  onChange={(e) => setBlockerEnd(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold block mb-1">
                  Grund
                </label>
                <input
                  type="text"
                  value={blockerReason}
                  onChange={(e) => setBlockerReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2 px-3 rounded-xl bg-stone-900 text-white dark:bg-amber-400 dark:text-stone-950 text-xs font-semibold"
                >
                  Zeit blockieren
                </button>
              </div>
            </form>
          )}

          {/* Active Time-off Blocks */}
          {dayTimeOff.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {dayTimeOff.map((off) => {
                const m = members.find((mem) => mem.id === off.memberId);
                return (
                  <div
                    key={off.id}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-xs"
                  >
                    <Clock className="w-3.5 h-3.5 text-stone-500" />
                    <span>
                      <strong>{m?.displayName.split(" ")[0]}</strong>:{" "}
                      {off.startTime}–{off.endTime} Uhr ({off.reason})
                    </span>
                    <button
                      type="button"
                      onClick={() => removeTimeOffBlock(off.id)}
                      className="text-stone-400 hover:text-red-600"
                      title="Blocker entfernen"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Appointments View: Pocket Mode (Single Feed) vs Reception Columns */}
          <div
            className={
              deviceViewMode === "pocket"
                ? "max-w-md mx-auto space-y-3 border-2 border-stone-200 dark:border-stone-800 rounded-3xl p-4 bg-stone-50/50 dark:bg-stone-900/40"
                : "grid grid-cols-1 md:grid-cols-2 gap-4"
            }
          >
            {deviceViewMode === "pocket" && (
              <div className="text-center pb-2 border-b border-stone-200 dark:border-stone-800">
                <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">
                  Smartphone Hosentaschen-Modus · Tageslichttauglich
                </span>
              </div>
            )}

            {filteredAppointments.length === 0 ? (
              <div className="col-span-full rounded-2xl border border-dashed border-stone-300 dark:border-stone-800 p-8 text-center text-stone-500 text-sm">
                Keine Termine für diesen Filter am {selectedDate}. Buche rechts
                im Kunden-Widget einen neuen Termin, um die Echtzeit-Aufnahme zu
                testen!
              </div>
            ) : (
              filteredAppointments.map((appt) => {
                const stylist = members.find((m) => m.id === appt.memberId);
                const service = services.find((s) => s.id === appt.serviceId);

                const statusStyles: Record<
                  AppointmentStatus,
                  { badge: string; label: string }
                > = {
                  pending_deposit: {
                    badge: "bg-amber-100 text-amber-900",
                    label: "Wartet auf Anzahlung",
                  },
                  confirmed: {
                    badge:
                      "bg-sky-100 text-sky-900 dark:bg-sky-500/20 dark:text-sky-200",
                    label: "Bestätigt",
                  },
                  checked_in: {
                    badge:
                      "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200",
                    label: "Im Salon (Eingecheckt)",
                  },
                  completed: {
                    badge:
                      "bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300",
                    label: "Abgeschlossen",
                  },
                  cancelled: {
                    badge: "bg-red-100 text-red-800",
                    label: "Storniert",
                  },
                  no_show: {
                    badge: "bg-red-200 text-red-950",
                    label: "No-Show (Anzahlung einbehalten)",
                  },
                };

                const st = statusStyles[appt.status];

                return (
                  <div
                    key={appt.id}
                    className={`rounded-2xl border p-4 transition-all bg-white dark:bg-stone-900 flex flex-col justify-between gap-3 ${
                      appt.status === "checked_in"
                        ? "border-emerald-500/70 shadow-sm"
                        : appt.status === "cancelled" ||
                            appt.status === "no_show"
                          ? "border-stone-200 opacity-60"
                          : "border-stone-200 dark:border-stone-800"
                    }`}
                  >
                    <div className="space-y-2.5">
                      {/* Time, Stylist & Status Row */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded-lg bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-950 font-bold text-xs">
                            {appt.startTime} – {appt.customerEndTime}
                          </span>
                          {stylist && (
                            <span
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-white"
                              style={{ backgroundColor: stylist.colorHex }}
                            >
                              <span>{stylist.displayName}</span>
                            </span>
                          )}
                        </div>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${st.badge}`}
                        >
                          {st.label}
                        </span>
                      </div>

                      {/* Customer & Service Title */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-bold text-base">
                              {appt.customerName}
                            </h4>
                            {appt.prefersSilentCut && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-teal-500/15 text-teal-800 dark:text-teal-300 border border-teal-500/30">
                                <VolumeX className="w-3 h-3" />
                                Silent Cut
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-semibold text-stone-700 dark:text-stone-300 mt-0.5">
                            {service?.name || "Behandlung"}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-sm">
                            {formatEuro(appt.totalPriceCents)}
                          </div>
                          <div className="text-[11px] text-stone-500">
                            {formatDuration(appt.totalDurationMinutes)} Block
                          </div>
                        </div>
                      </div>

                      {/* Dynamic Qualification Breakdown Pills */}
                      <div className="flex flex-wrap gap-1.5">
                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-900 dark:text-amber-200 font-medium">
                          Basis {appt.baseDurationMinutes} Min.
                          {appt.extraDurationMinutes > 0
                            ? ` + ${appt.extraDurationMinutes} Min. Haar-Qualifizierung`
                            : ""}
                        </span>
                        {appt.qualificationSummary.map((item, i) => (
                          <span
                            key={i}
                            className="text-[11px] px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300"
                          >
                            {item}
                          </span>
                        ))}
                      </div>

                      {/* Customer Preferences & Formula Box */}
                      <div className="rounded-xl bg-stone-50 dark:bg-stone-950/70 border border-stone-200/70 dark:border-stone-800 p-2.5 space-y-1 text-xs">
                        {appt.beverageSnapshot && (
                          <div className="flex items-center gap-1.5 text-stone-700 dark:text-stone-300">
                            <Coffee className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                            <span>
                              Getränk: <strong>{appt.beverageSnapshot}</strong>
                            </span>
                          </div>
                        )}
                        {appt.formulaNotesSnapshot && (
                          <div className="flex items-start gap-1.5 text-stone-600 dark:text-stone-400">
                            <FlaskConical className="w-3.5 h-3.5 text-violet-600 shrink-0 mt-0.5" />
                            <span>
                              <strong>Rezeptur:</strong>{" "}
                              {appt.formulaNotesSnapshot}
                            </span>
                          </div>
                        )}
                        {appt.customerNotes && (
                          <div className="text-stone-600 dark:text-stone-400 italic">
                            „{appt.customerNotes}“
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Deposit Status & Quick One-Tap Actions */}
                    <div className="pt-2.5 border-t border-stone-100 dark:border-stone-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        {appt.depositRequired ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            {formatEuro(appt.depositAmountCents)} Stripe
                            Anzahlung
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-stone-500">
                            <BellRing className="w-3.5 h-3.5 text-emerald-600" />
                            SMS & E-Mail aktiv
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {appt.status === "confirmed" && (
                          <button
                            type="button"
                            onClick={() =>
                              updateAppointmentStatus(appt.id, "checked_in")
                            }
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                          >
                            Einchecken
                          </button>
                        )}
                        {appt.status === "checked_in" && (
                          <button
                            type="button"
                            onClick={() =>
                              updateAppointmentStatus(appt.id, "completed")
                            }
                            className="px-2.5 py-1 rounded-lg bg-stone-900 hover:bg-stone-800 text-white dark:bg-stone-100 dark:text-stone-950 font-semibold"
                          >
                            Abschließen
                          </button>
                        )}
                        {(appt.status === "confirmed" ||
                          appt.status === "checked_in") && (
                          <button
                            type="button"
                            onClick={() =>
                              updateAppointmentStatus(appt.id, "no_show")
                            }
                            className="px-2 py-1 rounded-lg border border-stone-200 dark:border-stone-700 text-stone-500 hover:text-red-600"
                            title="Als No-Show markieren"
                          >
                            No-Show
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 2: CATALOG & DYNAMIC QUALIFICATION MATRIX */}
      {activeTab === "catalog" && (
        <div className="p-4 sm:p-6 space-y-6">
          <div className="rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-300/60 p-4 flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <div className="font-bold text-sm text-stone-900 dark:text-stone-100">
                Live-Kalkulations-Matrix (Löst das Friseur-Kalkulations-Dilemma)
              </div>
              <p className="text-stone-600 dark:text-stone-300">
                Jede Änderung an den Minuten- oder Preis-Aufschlägen unten wirkt
                sich <strong>sofort in Echtzeit</strong> auf das Kunden-Widget
                und die Kalender-Slot-Berechnung aus.
              </p>
            </div>
          </div>

          {/* Qualification Modifiers Editor */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-stone-500">
              1. Dynamische Zeit- & Preisaufschläge (Haarlänge, Dichte & Add-ons)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {modifiers.map((mod) => (
                <div
                  key={mod.id}
                  className="rounded-2xl border border-stone-200 dark:border-stone-800 p-3.5 flex items-center justify-between gap-3 bg-white dark:bg-stone-900"
                >
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-stone-500">
                      {mod.dimension === "hair_length"
                        ? "Haarlänge"
                        : mod.dimension === "hair_density"
                          ? "Haardichte"
                          : "Zusatzwunsch"}
                    </span>
                    <div className="font-semibold text-sm mt-1">
                      {mod.label}
                    </div>
                    <div className="text-[11px] text-stone-500">
                      {mod.subtitle}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <label className="text-[10px] text-stone-400 block">
                        +Minuten
                      </label>
                      <input
                        type="number"
                        step={5}
                        min={0}
                        max={120}
                        value={mod.extraDurationMinutes}
                        onChange={(e) =>
                          updateModifier(mod.id, {
                            extraDurationMinutes:
                              parseInt(e.target.value, 10) || 0,
                          })
                        }
                        className="w-16 px-2 py-1 rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-xs font-bold text-right"
                      />
                    </div>
                    <div className="text-right">
                      <label className="text-[10px] text-stone-400 block">
                        +Aufpreis (€)
                      </label>
                      <input
                        type="number"
                        step={1}
                        min={0}
                        max={200}
                        value={Math.round(mod.extraPriceCents / 100)}
                        onChange={(e) =>
                          updateModifier(mod.id, {
                            extraPriceCents:
                              (parseInt(e.target.value, 10) || 0) * 100,
                          })
                        }
                        className="w-16 px-2 py-1 rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-xs font-bold text-right"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Base Services Editor */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-stone-500">
              2. Basisleistungen & Stripe Anzahlungs-Regeln
            </h3>
            <div className="space-y-2.5">
              {services.map((srv) => (
                <div
                  key={srv.id}
                  className="rounded-2xl border border-stone-200 dark:border-stone-800 p-4 flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-stone-900"
                >
                  <div className="max-w-md">
                    <div className="font-bold text-sm">{srv.name}</div>
                    <div className="text-xs text-stone-500 mt-0.5">
                      {srv.description}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div>
                      <label className="text-[10px] text-stone-400 block">
                        Basisdauer (Min.)
                      </label>
                      <input
                        type="number"
                        step={5}
                        min={15}
                        max={360}
                        value={srv.baseDurationMinutes}
                        onChange={(e) =>
                          updateService(srv.id, {
                            baseDurationMinutes:
                              parseInt(e.target.value, 10) || 30,
                          })
                        }
                        className="w-20 px-2.5 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-stone-400 block">
                        Basispreis (€)
                      </label>
                      <input
                        type="number"
                        step={1}
                        min={10}
                        max={900}
                        value={Math.round(srv.basePriceCents / 100)}
                        onChange={(e) =>
                          updateService(srv.id, {
                            basePriceCents:
                              (parseInt(e.target.value, 10) || 0) * 100,
                          })
                        }
                        className="w-20 px-2.5 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-stone-400 block">
                        No-Show Anzahlung
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          updateService(srv.id, {
                            requiresDeposit: !srv.requiresDeposit,
                          })
                        }
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                          srv.requiresDeposit
                            ? "border-amber-500 bg-amber-500/15 text-amber-900 dark:text-amber-200"
                            : "border-stone-200 dark:border-stone-700 text-stone-500"
                        }`}
                      >
                        {srv.requiresDeposit
                          ? `Pflicht (${srv.depositValue}%)`
                          : "Automatisch ab 120m"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CUSTOMER CRM & FORMULA NOTES */}
      {activeTab === "crm" && (
        <div className="p-4 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold">
                Kunden-Kartei, Farbrezepturen & Vorlieben
              </h3>
              <p className="text-xs text-stone-500">
                Jeder Stylist sieht vor dem Termin die genaue Farbmischung,
                Haarlänge und das Lieblingsgetränk.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {customers.map((cust) => (
              <div
                key={cust.id}
                className="rounded-2xl border border-stone-200 dark:border-stone-800 p-4 space-y-3 bg-white dark:bg-stone-900"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm sm:text-base">
                        {cust.fullName}
                      </h4>
                      {cust.prefersSilentCut && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-500/15 text-teal-800 dark:text-teal-300">
                          <VolumeX className="w-3 h-3" />
                          Silent Cut
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-stone-500">
                      {cust.email} · {cust.phone}
                    </p>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-stone-100 dark:bg-stone-800">
                    {cust.totalVisits} Besuche
                  </span>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-stone-500 block mb-1">
                    Farbrezeptur & Technik-Notiz (Live editierbar)
                  </label>
                  <textarea
                    rows={2}
                    value={cust.colorFormulaNotes}
                    onChange={(e) =>
                      updateCustomerNotes(cust.id, {
                        colorFormulaNotes: e.target.value,
                      })
                    }
                    className="w-full p-2.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 text-xs"
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-stone-600 dark:text-stone-400 pt-1">
                  <span className="inline-flex items-center gap-1">
                    <Coffee className="w-3.5 h-3.5 text-amber-600" />
                    {cust.preferredBeverage}
                  </span>
                  <span>
                    No-Shows:{" "}
                    <strong
                      className={
                        cust.noShowCount > 0
                          ? "text-amber-600"
                          : "text-emerald-600"
                      }
                    >
                      {cust.noShowCount}
                    </strong>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: EMBED GENERATOR & SUPABASE RLS ARCHITECTURE */}
      {activeTab === "embed" && (
        <div className="p-4 sm:p-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* WordPress / Webflow / Squarespace Script Embed */}
            <div className="rounded-2xl border border-stone-200 dark:border-stone-800 p-4 space-y-3 bg-white dark:bg-stone-900">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                    Option A · Empfohlen für WordPress, Webflow & Squarespace
                  </span>
                  <h4 className="font-bold text-sm mt-0.5">
                    Shadow-DOM Isoliertes Widget-Script
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => copyCode("script", scriptSnippet)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-950 text-xs font-semibold"
                >
                  {copiedSnippet === "script" ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Kopiert!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Snippet kopieren</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-3 rounded-xl bg-stone-950 text-stone-100 text-[11px] font-mono overflow-x-auto leading-relaxed">
                {scriptSnippet}
              </pre>
              <p className="text-[11px] text-stone-500">
                Kein Styling-Konflikt auf Drittseiten: Das Script kapselt das
                Widget in einem Shadow-DOM-Container und passt die Höhe per{" "}
                <code>postMessage</code> automatisch an.
              </p>
            </div>

            {/* Direct Iframe Embed */}
            <div className="rounded-2xl border border-stone-200 dark:border-stone-800 p-4 space-y-3 bg-white dark:bg-stone-900">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                    Option B · Universeller Iframe-Block
                  </span>
                  <h4 className="font-bold text-sm mt-0.5">
                    Direkte Iframe-Einbettung (inkl. Apple Pay Freigabe)
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => copyCode("iframe", iframeSnippet)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 text-xs font-semibold"
                >
                  {copiedSnippet === "iframe" ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Kopiert!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Iframe kopieren</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-3 rounded-xl bg-stone-950 text-stone-100 text-[11px] font-mono overflow-x-auto leading-relaxed">
                {iframeSnippet}
              </pre>
              <p className="text-[11px] text-stone-500">
                REST-Endpunkt für eigene Frontends verfügbar unter:{" "}
                <code className="font-mono text-amber-700 dark:text-amber-400">
                  GET /api/salons/{salon.slug}/availability
                </code>
              </p>
            </div>
          </div>

          {/* Database & RLS Architecture Summary */}
          <div className="rounded-2xl border border-stone-200 dark:border-stone-800 p-4 sm:p-5 bg-stone-50/70 dark:bg-stone-900/50 space-y-3">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-amber-600" />
              <h4 className="font-bold text-sm">
                Supabase Postgres & RLS Sicherheits-Fundament
              </h4>
            </div>
            <p className="text-xs text-stone-600 dark:text-stone-400">
              Hinterlegt in{" "}
              <code className="font-mono">
                supabase/migrations/20261017000001_silent_salon_schema.sql
              </code>
              :
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
                <div className="font-bold mb-1">
                  1. GiST Anti-Überbuchungs-Garantie
                </div>
                <p className="text-stone-500 text-[11px]">
                  <code>
                    EXCLUDE USING gist (member_id WITH =, tstzrange(starts_at,
                    ends_at) WITH &amp;&amp;)
                  </code>{" "}
                  verhindert doppelte Buchungen selbst bei gleichzeitigen
                  Requests auf Datenbank-Ebene.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
                <div className="font-bold mb-1">
                  2. Strikte Multi-Tenancy (RLS)
                </div>
                <p className="text-stone-500 text-[11px]">
                  Jeder Salon operiert isoliert über{" "}
                  <code>(select private.is_salon_member(salon_id))</code> mit
                  gecachten Subqueries und vollständigen Foreign-Key-Indizes.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
                <div className="font-bold mb-1">
                  3. Dynamische Dauer-Persistenz
                </div>
                <p className="text-stone-500 text-[11px]">
                  Speichert <code>base_duration_minutes</code>,{" "}
                  <code>extra_duration_minutes</code>,{" "}
                  <code>qualification_data (JSONB)</code> und Stripe-Deposit-Status
                  revisionssicher pro Termin.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
