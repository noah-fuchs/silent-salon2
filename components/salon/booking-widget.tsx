"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Check,
  CheckCircle2,
  Calendar,
  Clock,
  Sparkles,
  ShieldCheck,
  CreditCard,
  VolumeX,
  ChevronRight,
  ChevronLeft,
  UserCheck,
  BellRing,
  Coffee,
  Info,
  Scissors,
  Download,
  MapPin,
  Star,
} from "lucide-react";
import { computeAvailableSlots } from "@/lib/salon/availability";
import {
  calculateBookingQuote,
  formatDuration,
  formatEuro,
} from "@/lib/salon/calculator";
import { getOffsetDateStr } from "@/lib/salon/seed-data";
import { useSalonStore } from "@/lib/salon/store";
import {
  Appointment,
  AvailableSlot,
  HairDensityCode,
  HairLengthCode,
  QualificationSelection,
} from "@/lib/salon/types";

interface BookingWidgetProps {
  salonSlug?: string;
  embedded?: boolean;
  onBookingCreated?: (appointment: Appointment) => void;
}

const BEVERAGE_OPTIONS = [
  "Cappuccino (Hafermilch)",
  "Iced Matcha Latte",
  "Doppelter Espresso",
  "Frischer Minz-Ingwer-Tee",
  "Stilles Wasser / Crémant",
];

export function BookingWidget({
  salonSlug = "atelier-lumiere",
  embedded = false,
  onBookingCreated,
}: BookingWidgetProps) {
  const { state, createQualifiedBooking } = useSalonStore();

  const salon = useMemo(
    () =>
      state.salons.find((s) => s.slug === salonSlug) || state.salons[0],
    [state.salons, salonSlug],
  );

  const categories = useMemo(
    () =>
      state.categories
        .filter((c) => c.salonId === salon.id)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [state.categories, salon.id],
  );

  const services = useMemo(
    () => state.services.filter((s) => s.salonId === salon.id && s.isActive),
    [state.services, salon.id],
  );

  const modifiers = useMemo(
    () =>
      state.modifiers
        .filter((m) => m.salonId === salon.id)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [state.modifiers, salon.id],
  );

  const members = useMemo(
    () =>
      state.members.filter(
        (m) => m.salonId === salon.id && m.isActive && m.isBookable,
      ),
    [state.members, salon.id],
  );

  // Step state: 1 = Service, 2 = Qualification, 3 = Stylist & Slot, 4 = Checkout, 5 = Confirmed
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");
  const [selectedServiceId, setSelectedServiceId] = useState<string>(
    () => services[0]?.id || "srv-cut-style",
  );

  // Sync default service when tenant changes
  useEffect(() => {
    if (
      services.length > 0 &&
      !services.some((s) => s.id === selectedServiceId)
    ) {
      setSelectedServiceId(services[0].id);
      setStep(1);
    }
  }, [services, selectedServiceId]);

  const selectedService = useMemo(
    () =>
      services.find((s) => s.id === selectedServiceId) || services[0],
    [services, selectedServiceId],
  );

  // Qualification state
  const [hairLengthCode, setHairLengthCode] =
    useState<HairLengthCode>("length_medium");
  const [hairDensityCode, setHairDensityCode] =
    useState<HairDensityCode>("density_normal");
  const [addonCodes, setAddonCodes] = useState<string[]>([]);
  const [prefersSilentCut, setPrefersSilentCut] = useState<boolean>(false);
  const [customerNotes, setCustomerNotes] = useState<string>("");

  // Stylist & Date & Slot state
  const [selectedMemberId, setSelectedMemberId] = useState<string | "any">(
    "any",
  );
  const [selectedDate, setSelectedDate] = useState<string>(() =>
    getOffsetDateStr(0),
  );
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);

  // Customer Checkout state
  const [customerName, setCustomerName] = useState<string>("");
  const [customerEmail, setCustomerEmail] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [preferredBeverage, setPreferredBeverage] = useState<string>(
    BEVERAGE_OPTIONS[0],
  );
  const [paymentMethod, setPaymentMethod] = useState<
    "apple_pay" | "card" | "klarna"
  >("apple_pay");
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [confirmedBooking, setConfirmedBooking] =
    useState<Appointment | null>(null);

  // Notify parent iframe of height changes for seamless embedding
  useEffect(() => {
    if (!embedded || typeof window === "undefined") return;
    const sendHeight = () => {
      window.parent?.postMessage(
        {
          source: "silent-salon-widget",
          type: "RESIZE",
          height: document.body.scrollHeight,
        },
        "*",
      );
    };
    sendHeight();
    const timer = setTimeout(sendHeight, 120);
    return () => clearTimeout(timer);
  }, [embedded, step, selectedServiceId, hairLengthCode, hairDensityCode, addonCodes]);

  const selection: QualificationSelection = useMemo(
    () => ({
      hairLengthCode,
      hairDensityCode,
      addonCodes,
      prefersSilentCut,
      customerNotes,
    }),
    [hairLengthCode, hairDensityCode, addonCodes, prefersSilentCut, customerNotes],
  );

  const activeStylistForQuote = useMemo(() => {
    if (selectedMemberId !== "any") {
      return members.find((m) => m.id === selectedMemberId) || null;
    }
    if (selectedSlot) {
      return (
        members.find((m) => m.id === selectedSlot.assignedMemberId) || null
      );
    }
    return null;
  }, [selectedMemberId, selectedSlot, members]);

  const quote = useMemo(() => {
    if (!selectedService) return null;
    return calculateBookingQuote({
      salon,
      service: selectedService,
      modifiers,
      selection,
      stylist: activeStylistForQuote,
    });
  }, [salon, selectedService, modifiers, selection, activeStylistForQuote]);

  const eligibleStylists = useMemo(() => {
    if (!selectedService) return members;
    return members.filter((m) => m.serviceIds.includes(selectedService.id));
  }, [members, selectedService]);

  // Reset selected stylist if they don't offer the newly selected service
  useEffect(() => {
    if (
      selectedMemberId !== "any" &&
      !eligibleStylists.some((m) => m.id === selectedMemberId)
    ) {
      setSelectedMemberId("any");
    }
  }, [eligibleStylists, selectedMemberId]);

  const dateOptions = useMemo(() => {
    return Array.from({ length: 7 }, (_, idx) => {
      const iso = getOffsetDateStr(idx);
      const [y, m, d] = iso.split("-").map(Number);
      const dateObj = new Date(y, m - 1, d);
      const weekdayShort = new Intl.DateTimeFormat("de-DE", {
        weekday: "short",
      }).format(dateObj);
      const dayMonth = new Intl.DateTimeFormat("de-DE", {
        day: "2-digit",
        month: "2-digit",
      }).format(dateObj);
      return {
        iso,
        label: idx === 0 ? "Heute" : idx === 1 ? "Morgen" : weekdayShort,
        subLabel: dayMonth,
      };
    });
  }, []);

  const availableSlots = useMemo(() => {
    if (!selectedService || !quote) return [];
    return computeAvailableSlots({
      salon,
      date: selectedDate,
      serviceId: selectedService.id,
      customerDurationMinutes: quote.customerDurationMinutes,
      totalBlockedMinutes: quote.totalBlockedMinutes,
      requestedMemberId: selectedMemberId,
      members,
      workingHours: state.workingHours,
      timeOffBlocks: state.timeOffBlocks,
      appointments: state.appointments,
    });
  }, [
    salon,
    selectedDate,
    selectedService,
    quote,
    selectedMemberId,
    members,
    state.workingHours,
    state.timeOffBlocks,
    state.appointments,
  ]);

  // Keep selectedSlot valid if qualification changes duration
  useEffect(() => {
    if (!selectedSlot) return;
    const matching = availableSlots.find(
      (s) => s.startTime === selectedSlot.startTime,
    );
    if (!matching) {
      setSelectedSlot(null);
    } else if (
      matching.customerEndTime !== selectedSlot.customerEndTime ||
      matching.assignedMemberId !== selectedSlot.assignedMemberId
    ) {
      setSelectedSlot(matching);
    }
  }, [availableSlots, selectedSlot]);

  const toggleAddon = (code: string) => {
    setAddonCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  };

  const handleCompleteBooking = (e: React.FormEvent) => {
    e.preventDefault();
    setBookingError(null);

    if (!selectedService || !selectedSlot || !quote) {
      setBookingError("Bitte wähle einen gültigen Zeitslot aus.");
      return;
    }

    if (!customerName.trim() || !customerEmail.trim() || !customerPhone.trim()) {
      setBookingError(
        "Bitte gib deinen Namen, deine E-Mail und Mobilnummer für die Terminbestätigung an.",
      );
      return;
    }

    const result = createQualifiedBooking({
      salonId: salon.id,
      serviceId: selectedService.id,
      memberId: selectedSlot.assignedMemberId,
      date: selectedDate,
      startTime: selectedSlot.startTime,
      selection,
      customerName,
      customerEmail,
      customerPhone,
      preferredBeverage,
    });

    if (!result.ok || !result.appointment) {
      setBookingError(
        result.error || "Termin konnte nicht reserviert werden.",
      );
      return;
    }

    setConfirmedBooking(result.appointment);
    setStep(5);
    if (onBookingCreated) {
      onBookingCreated(result.appointment);
    }
  };

  const handleDownloadIcs = () => {
    if (!confirmedBooking || !selectedService) return;
    const dtStart =
      confirmedBooking.date.replace(/-/g, "") +
      "T" +
      confirmedBooking.startTime.replace(":", "") +
      "00";
    const dtEnd =
      confirmedBooking.date.replace(/-/g, "") +
      "T" +
      confirmedBooking.customerEndTime.replace(":", "") +
      "00";

    const icsLines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Silent Salon SaaS//DE",
      "BEGIN:VEVENT",
      `UID:${confirmedBooking.publicToken}@silentsalon.de`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${selectedService.name} bei ${salon.name}`,
      `LOCATION:${salon.address}`,
      `DESCRIPTION:Dein qualifizierter Friseurtermin (${confirmedBooking.totalDurationMinutes} Min.). ${confirmedBooking.prefersSilentCut ? "Silent Cut (Ruhe-Termin) aktiviert." : ""}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const blob = new Blob([icsLines], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `termin-${salon.slug}-${confirmedBooking.date}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const lengthModifiers = modifiers.filter(
    (m) => m.dimension === "hair_length",
  );
  const densityModifiers = modifiers.filter(
    (m) => m.dimension === "hair_density",
  );
  const addonModifiers = modifiers.filter((m) => m.dimension === "addon");

  const filteredServices =
    selectedCategoryId === "all"
      ? services
      : services.filter((s) => s.categoryId === selectedCategoryId);

  const extraQualifiedMinutes = quote
    ? quote.lengthExtraMinutes +
      quote.densityExtraMinutes +
      quote.addonsExtraMinutes
    : 0;

  return (
    <div className="w-full max-w-2xl mx-auto rounded-3xl border border-stone-200/90 dark:border-stone-800 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100 shadow-xl overflow-hidden transition-all">
      {/* Salon Header Bar */}
      <div className="bg-stone-900 text-stone-50 px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: salon.brandColor }}
              />
              <span className="text-xs uppercase tracking-widest text-stone-400 font-medium">
                Direktbuchung · Unter 60 Sek.
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-semibold tracking-tight mt-0.5">
              {salon.name}
            </h2>
            <p className="text-xs text-stone-300 flex items-center gap-1.5 mt-0.5">
              <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>{salon.address}</span>
            </p>
          </div>
          <div className="flex flex-col items-end">
            <div className="inline-flex items-center gap-1 bg-stone-800/90 border border-stone-700 px-2.5 py-1 rounded-full text-xs font-medium text-amber-300">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span>{salon.rating}</span>
              <span className="text-stone-400">({salon.reviewCount})</span>
            </div>
            <span className="text-[11px] text-stone-400 mt-1">
              Echtzeit-Kapazitätskalkulation
            </span>
          </div>
        </div>

        {/* Live Dynamic Duration & Price Bar */}
        {quote && step < 5 && (
          <div className="mt-3.5 pt-3 border-t border-stone-800 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-400/30 text-amber-200 font-medium">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  Reserviert:{" "}
                  <strong>{formatDuration(quote.customerDurationMinutes)}</strong>
                </span>
              </span>
              {extraQualifiedMinutes > 0 && (
                <span className="text-stone-300 hidden sm:inline">
                  ({quote.baseDurationMinutes} Min. Basis +{" "}
                  <span className="text-amber-300 font-medium">
                    {extraQualifiedMinutes} Min. Haar-Profil
                  </span>
                  )
                </span>
              )}
              {prefersSilentCut && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-500/20 text-teal-200 border border-teal-400/30 font-medium">
                  <VolumeX className="w-3 h-3" />
                  Silent Cut
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-stone-400">Richtpreis:</span>
              <span className="text-sm font-bold text-white">
                {formatEuro(quote.totalPriceCents)}
              </span>
              {quote.requiresDeposit ? (
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[11px] font-medium">
                  {formatEuro(quote.depositAmountCents)} Anzahlung
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[11px] font-medium">
                  0 € Anzahlung
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Stepper Navigation */}
      {step < 5 && (
        <div className="grid grid-cols-4 border-b border-stone-200 dark:border-stone-800 bg-stone-50/80 dark:bg-stone-900/50 text-xs">
          {[
            { num: 1, title: "1. Leistung" },
            { num: 2, title: "2. Haar-Check" },
            { num: 3, title: "3. Wunschslot" },
            { num: 4, title: "4. Abschluss" },
          ].map((item) => {
            const isCurrent = step === item.num;
            const isDone = step > item.num;
            const canClick =
              item.num < step ||
              (item.num === 2 && Boolean(selectedService)) ||
              (item.num === 3 && Boolean(selectedService));
            return (
              <button
                key={item.num}
                type="button"
                disabled={!canClick}
                onClick={() => canClick && setStep(item.num as 1 | 2 | 3 | 4)}
                className={`py-3 px-2 flex items-center justify-center gap-1.5 font-medium border-b-2 transition-colors ${
                  isCurrent
                    ? "border-stone-900 dark:border-amber-400 text-stone-900 dark:text-white bg-white dark:bg-stone-900"
                    : isDone
                      ? "border-emerald-600 text-emerald-700 dark:text-emerald-400 hover:bg-stone-100/70"
                      : "border-transparent text-stone-400 cursor-not-allowed"
                }`}
              >
                {isDone ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                ) : null}
                <span className="truncate">{item.title}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Body Content */}
      <div className="p-5 sm:p-6">
        {/* STEP 1: SERVICE SELECTION */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold">
                  Welche Behandlung wünschst du dir?
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Wähle deine Basisleistung – im nächsten Schritt passen wir die
                  Dauer exakt an dein Haar an.
                </p>
              </div>
            </div>

            {/* Category Pills */}
            {categories.length > 1 && (
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => setSelectedCategoryId("all")}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                    selectedCategoryId === "all"
                      ? "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900"
                      : "bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300"
                  }`}
                >
                  Alle Leistungen
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategoryId(cat.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                      selectedCategoryId === cat.id
                        ? "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900"
                        : "bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300"
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            )}

            {/* Service Cards */}
            <div className="space-y-2.5">
              {filteredServices.map((srv) => {
                const isSelected = srv.id === selectedService?.id;
                return (
                  <div
                    key={srv.id}
                    onClick={() => {
                      setSelectedServiceId(srv.id);
                      setStep(2);
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        setSelectedServiceId(srv.id);
                        setStep(2);
                      }
                    }}
                    className={`group rounded-2xl border p-4 cursor-pointer transition-all ${
                      isSelected
                        ? "border-stone-900 dark:border-amber-400 bg-stone-50/90 dark:bg-stone-900/90 ring-1 ring-stone-900 dark:ring-amber-400"
                        : "border-stone-200 dark:border-stone-800 hover:border-stone-400 dark:hover:border-stone-700"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-sm sm:text-base">
                            {srv.name}
                          </span>
                          {srv.isPopular && (
                            <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-300">
                              Beliebt
                            </span>
                          )}
                          {srv.requiresDeposit && (
                            <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-stone-200/80 text-stone-700 dark:bg-stone-800 dark:text-stone-300">
                              Mit Anzahlungsschutz
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
                          {srv.description}
                        </p>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {srv.includedSteps.map((st) => (
                            <span
                              key={st}
                              className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300"
                            >
                              <Check className="w-3 h-3 text-emerald-600" />
                              {st}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm sm:text-base font-bold">
                          ab {formatEuro(srv.basePriceCents)}
                        </div>
                        <div className="text-xs text-stone-500 flex items-center justify-end gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          <span>{formatDuration(srv.baseDurationMinutes)}</span>
                        </div>
                        <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-stone-900 dark:text-amber-400 group-hover:translate-x-0.5 transition-transform">
                          Wählen <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 2: SMART QUALIFICATION (HAIR LENGTH, DENSITY, ADDONS, SILENT CUT) */}
        {step === 2 && selectedService && quote && (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                  Smarte Vorab-Qualifizierung · 10 Sekunden
                </span>
                <h3 className="text-base sm:text-lg font-semibold mt-0.5">
                  Damit wir uns genau die richtige Zeit für dich nehmen
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Kein Zeitdruck im Salon: Deine Angaben berechnen automatisch
                  dein reales Zeitfenster im Kalender.
                </p>
              </div>
            </div>

            {selectedService.requiresQualification ? (
              <>
                {/* 1. Hair Length */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-300 block">
                    1. Deine aktuelle Haarlänge
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {lengthModifiers.map((mod) => {
                      const active = hairLengthCode === mod.code;
                      return (
                        <button
                          key={mod.id}
                          type="button"
                          onClick={() =>
                            setHairLengthCode(mod.code as HairLengthCode)
                          }
                          className={`text-left p-3.5 rounded-2xl border transition-all flex flex-col justify-between ${
                            active
                              ? "border-stone-900 dark:border-amber-400 bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-950 shadow-sm"
                              : "border-stone-200 dark:border-stone-800 hover:border-stone-400 bg-white dark:bg-stone-900/50"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 w-full">
                            <span className="font-semibold text-xs sm:text-sm">
                              {mod.label}
                            </span>
                            <span
                              className={`text-[11px] px-2 py-0.5 rounded-full font-medium shrink-0 ${
                                active
                                  ? "bg-white/20 text-white dark:bg-stone-900/15 dark:text-stone-900"
                                  : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300"
                              }`}
                            >
                              {mod.extraDurationMinutes > 0
                                ? `+${mod.extraDurationMinutes} Min.`
                                : "Basiszeit"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2 mt-1.5 text-[11px] opacity-80">
                            <span>{mod.subtitle}</span>
                            {mod.extraPriceCents > 0 && (
                              <span className="font-semibold shrink-0">
                                +{formatEuro(mod.extraPriceCents)}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Hair Density */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-300 block">
                    2. Deine Haardichte & Struktur
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {densityModifiers.map((mod) => {
                      const active = hairDensityCode === mod.code;
                      return (
                        <button
                          key={mod.id}
                          type="button"
                          onClick={() =>
                            setHairDensityCode(mod.code as HairDensityCode)
                          }
                          className={`text-left p-3.5 rounded-2xl border transition-all flex flex-col justify-between ${
                            active
                              ? "border-stone-900 dark:border-amber-400 bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-950 shadow-sm"
                              : "border-stone-200 dark:border-stone-800 hover:border-stone-400 bg-white dark:bg-stone-900/50"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-semibold text-xs sm:text-sm">
                              {mod.label}
                            </span>
                          </div>
                          <p className="text-[11px] opacity-80 mt-1">
                            {mod.subtitle}
                          </p>
                          <div className="mt-2 pt-1.5 border-t border-current/10 flex items-center justify-between text-[11px] font-medium">
                            <span>
                              {mod.extraDurationMinutes > 0
                                ? `+${mod.extraDurationMinutes} Min. Zeitpuffer`
                                : "Standard-Dauer"}
                            </span>
                            {mod.extraPriceCents > 0 && (
                              <span>+{formatEuro(mod.extraPriceCents)}</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-2xl bg-stone-100/80 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-4 text-xs text-stone-600 dark:text-stone-300 flex items-center gap-3">
                <Scissors className="w-5 h-5 text-stone-700 dark:text-amber-400 shrink-0" />
                <div>
                  Für <strong>{selectedService.name}</strong> ist eine feste
                  Basisdauer von{" "}
                  <strong>
                    {formatDuration(selectedService.baseDurationMinutes)}
                  </strong>{" "}
                  hinterlegt. Du kannst unten optional Verwöhn-Upgrades oder
                  einen Ruhe-Termin wählen.
                </div>
              </div>
            )}

            {/* 3. Optional Add-on Wishes */}
            {selectedService.allowAddons && addonModifiers.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-300 block">
                  3. Optionale Verwöhn- & Pflege-Upgrades
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {addonModifiers.map((addon) => {
                    const checked = addonCodes.includes(addon.code);
                    return (
                      <button
                        key={addon.id}
                        type="button"
                        onClick={() => toggleAddon(addon.code)}
                        className={`text-left p-3 rounded-xl border transition-all flex items-start gap-3 ${
                          checked
                            ? "border-amber-600 bg-amber-50/70 dark:bg-amber-500/10 dark:border-amber-400"
                            : "border-stone-200 dark:border-stone-800 hover:border-stone-300"
                        }`}
                      >
                        <div
                          className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                            checked
                              ? "bg-amber-600 border-amber-600 text-white"
                              : "border-stone-400"
                          }`}
                        >
                          {checked && <Check className="w-3 h-3" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold truncate">
                              {addon.label}
                            </span>
                          </div>
                          <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                            {addon.subtitle}
                          </p>
                          <div className="flex items-center gap-2 mt-1 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                            <span>+{addon.extraDurationMinutes} Min.</span>
                            <span>·</span>
                            <span>+{formatEuro(addon.extraPriceCents)}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 4. Signature Silent Salon Toggle */}
            <div
              onClick={() => setPrefersSilentCut((v) => !v)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  setPrefersSilentCut((v) => !v);
                }
              }}
              className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                prefersSilentCut
                  ? "border-teal-600 bg-teal-50/70 dark:bg-teal-950/40 dark:border-teal-500"
                  : "border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/40"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-teal-600/10 text-teal-700 dark:text-teal-300 shrink-0">
                  <VolumeX className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-semibold flex items-center gap-2">
                    <span>Ruhe-Termin („Silent Cut“) wünschen</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-600/15 text-teal-800 dark:text-teal-300 font-medium">
                      Kostenfrei
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                    Nach der professionellen Beratung genießt du deinen Termin in
                    entspannter Stille ohne Smalltalk – dein Stylist weiß vorab
                    Bescheid.
                  </p>
                </div>
              </div>
              <div
                className={`w-10 h-6 rounded-full p-0.5 transition-colors shrink-0 ${
                  prefersSilentCut
                    ? "bg-teal-600"
                    : "bg-stone-300 dark:bg-stone-700"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    prefersSilentCut ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between pt-2 border-t border-stone-200 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-600 dark:text-stone-400 hover:text-stone-900 px-3 py-2 rounded-xl"
              >
                <ChevronLeft className="w-4 h-4" />
                Leistung ändern
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white dark:bg-amber-500 dark:text-stone-950 font-semibold text-xs sm:text-sm shadow-sm transition-all"
              >
                <span>
                  Passende Slots für{" "}
                  {formatDuration(quote.customerDurationMinutes)} finden
                </span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: STYLIST & REAL-TIME SLOT PICKER */}
        {step === 3 && selectedService && quote && (
          <div className="space-y-5">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                Echtzeit-Kalenderabgleich · Keine Überbuchung
              </span>
              <h3 className="text-base sm:text-lg font-semibold mt-0.5">
                Stylist & freien Wunschtermin wählen
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Es werden ausschließlich Zeitslots angezeigt, die{" "}
                <strong>
                  {formatDuration(quote.customerDurationMinutes)}
                </strong>{" "}
                am Stück ohne Überschneidung mit Pausen oder Folgeterminen frei
                haben.
              </p>
            </div>

            {/* Stylist Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-300 block">
                Bei wem möchtest du buchen?
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedMemberId("any")}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    selectedMemberId === "any"
                      ? "border-stone-900 bg-stone-900 text-white dark:border-amber-400 dark:bg-stone-100 dark:text-stone-950"
                      : "border-stone-200 dark:border-stone-800 hover:border-stone-400"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold text-xs">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold truncate">
                        Nächster Profi
                      </div>
                      <div className="text-[10px] opacity-75 truncate">
                        Maximale Auswahl
                      </div>
                    </div>
                  </div>
                </button>

                {eligibleStylists.map((member) => {
                  const active = selectedMemberId === member.id;
                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => setSelectedMemberId(member.id)}
                      className={`p-3 rounded-2xl border text-left transition-all ${
                        active
                          ? "border-stone-900 bg-stone-900 text-white dark:border-amber-400 dark:bg-stone-100 dark:text-stone-950"
                          : "border-stone-200 dark:border-stone-800 hover:border-stone-400"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-7 h-7 rounded-full text-white flex items-center justify-center font-semibold text-xs shrink-0"
                          style={{ backgroundColor: member.colorHex }}
                        >
                          {member.avatarInitials}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold truncate">
                            {member.displayName}
                          </div>
                          <div className="text-[10px] opacity-75 truncate">
                            {member.title.split("·")[0]}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 7-Day Date Strip */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-300 block">
                Tag auswählen
              </label>
              <div className="grid grid-cols-7 gap-1.5">
                {dateOptions.map((d) => {
                  const active = selectedDate === d.iso;
                  return (
                    <button
                      key={d.iso}
                      type="button"
                      onClick={() => setSelectedDate(d.iso)}
                      className={`py-2.5 px-1 rounded-xl border text-center transition-all ${
                        active
                          ? "border-stone-900 bg-stone-900 text-white dark:border-amber-400 dark:bg-amber-400 dark:text-stone-950 shadow-sm"
                          : "border-stone-200 dark:border-stone-800 hover:border-stone-400 bg-stone-50/50 dark:bg-stone-900/40"
                      }`}
                    >
                      <div className="text-[11px] font-semibold truncate">
                        {d.label}
                      </div>
                      <div className="text-[10px] opacity-75 mt-0.5">
                        {d.subLabel}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Available Slots Grid */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-300">
                  Verfügbare Startzeiten ({availableSlots.length} Slots für{" "}
                  {formatDuration(quote.customerDurationMinutes)})
                </label>
                <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-300 font-medium">
                  <Sparkles className="w-3 h-3" />
                  Ideal-Slot = Nahtloser Anschluss
                </span>
              </div>

              {availableSlots.length === 0 ? (
                <div className="rounded-2xl border border-amber-300/60 bg-amber-50/60 dark:bg-amber-950/20 p-5 text-center space-y-2">
                  <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                    Kein durchgehender{" "}
                    {formatDuration(quote.customerDurationMinutes)}-Slot an
                    diesem Tag frei
                  </p>
                  <p className="text-xs text-stone-600 dark:text-stone-400">
                    Da deine Behandlung inkl. Haar-Qualifizierung{" "}
                    {formatDuration(quote.customerDurationMinutes)} benötigt,
                    schützen wir dich und das Team vor Überbuchungen. Bitte
                    wähle den nächsten Tag oder „Nächster Profi“.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-64 overflow-y-auto pr-1">
                  {availableSlots.map((slot) => {
                    const isPicked =
                      selectedSlot?.startTime === slot.startTime;
                    return (
                      <button
                        key={slot.startTime}
                        type="button"
                        onClick={() => {
                          setSelectedSlot(slot);
                          setStep(4);
                        }}
                        className={`relative p-2.5 rounded-xl border text-left transition-all ${
                          isPicked
                            ? "border-stone-900 bg-stone-900 text-white dark:border-amber-400 dark:bg-amber-400 dark:text-stone-950 shadow-sm"
                            : slot.isOptimalGapFill
                              ? "border-amber-400/80 bg-amber-50/50 dark:bg-amber-500/10 hover:border-amber-500"
                              : "border-stone-200 dark:border-stone-800 hover:border-stone-400"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold">
                            {slot.startTime}
                          </span>
                          {slot.isOptimalGapFill && (
                            <Sparkles
                              className={`w-3.5 h-3.5 ${
                                isPicked ? "text-amber-300" : "text-amber-600"
                              }`}
                            />
                          )}
                        </div>
                        <div className="text-[10px] opacity-75 mt-0.5 truncate">
                          bis {slot.customerEndTime} Uhr
                        </div>
                        <div className="text-[10px] font-medium truncate mt-0.5 opacity-90">
                          {slot.assignedMemberName.split(" ")[0]}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer Navigation */}
            <div className="flex items-center justify-between pt-2 border-t border-stone-200 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-600 dark:text-stone-400 hover:text-stone-900 px-3 py-2 rounded-xl"
              >
                <ChevronLeft className="w-4 h-4" />
                Haar-Angaben anpassen
              </button>
              {selectedSlot && (
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white dark:bg-amber-500 dark:text-stone-950 font-semibold text-xs sm:text-sm"
                >
                  <span>Weiter mit {selectedSlot.startTime} Uhr</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* STEP 4: CHECKOUT, REMINDERS & STRIPE NO-SHOW DEPOSIT */}
        {step === 4 && selectedService && selectedSlot && quote && (
          <form onSubmit={handleCompleteBooking} className="space-y-5">
            {/* Qualification & Slot Summary Box */}
            <div className="rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                    Deine maßgeschneiderte Reservierung
                  </span>
                  <h4 className="text-sm sm:text-base font-bold mt-0.5">
                    {selectedService.name}
                  </h4>
                  <p className="text-xs text-stone-600 dark:text-stone-400 mt-0.5 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 font-medium text-stone-900 dark:text-stone-100">
                      <Calendar className="w-3.5 h-3.5 text-amber-600" />
                      {selectedDate} · {selectedSlot.startTime}–
                      {selectedSlot.customerEndTime} Uhr
                    </span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                      Stylist: <strong>{selectedSlot.assignedMemberName}</strong>
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="text-xs font-medium text-amber-700 dark:text-amber-400 underline shrink-0"
                >
                  Ändern
                </button>
              </div>

              {/* Transparent Dynamic Breakdown */}
              <div className="border-t border-stone-200 dark:border-stone-800 pt-2.5 space-y-1.5 text-xs">
                {quote.breakdown.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-stone-600 dark:text-stone-300"
                  >
                    <span>{item.label}</span>
                    <span className="font-medium">
                      {item.minutesDelta > 0 ? `${item.minutesDelta} Min.` : ""}{" "}
                      · {formatEuro(item.priceDeltaCents)}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-1.5 border-t border-stone-200/80 dark:border-stone-800 font-bold text-stone-900 dark:text-white text-sm">
                  <span>
                    Gesamt ({formatDuration(quote.customerDurationMinutes)}{" "}
                    reserviert)
                  </span>
                  <span>{formatEuro(quote.totalPriceCents)}</span>
                </div>
              </div>
            </div>

            {/* Customer Contact Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold block mb-1">
                  Vor- und Nachname *
                </label>
                <input
                  type="text"
                  required
                  placeholder="z. B. Elena Bergmann"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900"
                />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">
                  Mobilnummer (für SMS-Erinnerung) *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="+49 172 1234567"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900"
                />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">
                  E-Mail-Adresse *
                </label>
                <input
                  type="email"
                  required
                  placeholder="name@beispiel.de"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900"
                />
              </div>
              <div>
                <label className="text-xs font-semibold flex items-center gap-1 mb-1">
                  <Coffee className="w-3.5 h-3.5 text-amber-700" />
                  <span>Wunschgetränk beim Ankommen</span>
                </label>
                <select
                  value={preferredBeverage}
                  onChange={(e) => setPreferredBeverage(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-sm"
                >
                  {BEVERAGE_OPTIONS.map((bev) => (
                    <option key={bev} value={bev}>
                      {bev}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">
                  Optionaler Hinweis an deinen Stylisten
                </label>
                <input
                  type="text"
                  placeholder="z. B. Empfindliche Kopfhaut, Inspiration..."
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-sm"
                />
              </div>
            </div>

            {/* No-Show Protection / Stripe Deposit vs. Free Reservation */}
            {quote.requiresDeposit ? (
              <div className="rounded-2xl border-2 border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/20 p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0" />
                    <div>
                      <div className="text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100">
                        Anzahlung zur Termin-Garantie:{" "}
                        {formatEuro(quote.depositAmountCents)}
                      </div>
                      <p className="text-[11px] text-stone-600 dark:text-stone-400">
                        Restbetrag im Salon:{" "}
                        <strong>{formatEuro(quote.remainingSalonCents)}</strong>{" "}
                        · Bis {salon.cancellationHours}h vorher kostenlos
                        stornierbar.
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-stone-900 text-white">
                    Stripe Verified
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "apple_pay", label: "Apple Pay / GPay" },
                    { id: "card", label: "Kreditkarte" },
                    { id: "klarna", label: "Klarna Sofort" },
                  ].map((pm) => (
                    <button
                      key={pm.id}
                      type="button"
                      onClick={() =>
                        setPaymentMethod(
                          pm.id as "apple_pay" | "card" | "klarna",
                        )
                      }
                      className={`py-2 px-2.5 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 ${
                        paymentMethod === pm.id
                          ? "border-stone-900 bg-stone-900 text-white dark:border-amber-400 dark:bg-amber-400 dark:text-stone-950"
                          : "border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900"
                      }`}
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span className="truncate">{pm.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 p-3.5 flex items-center gap-3 text-xs">
                <BellRing className="w-4 h-4 text-emerald-600 shrink-0" />
                <div className="text-stone-700 dark:text-stone-300">
                  <strong>Kostenlose Online-Reservierung (0 € Anzahlung)</strong>{" "}
                  – Du erhältst automatisch 24 Std. vorher eine E-Mail und 2 Std.
                  vorher eine SMS-Erinnerung.
                </div>
              </div>
            )}

            {bookingError && (
              <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-300 p-3 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
                <Info className="w-4 h-4 shrink-0" />
                <span>{bookingError}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-stone-200 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-600 hover:text-stone-900 px-3 py-2 rounded-xl"
              >
                <ChevronLeft className="w-4 h-4" />
                Zurück
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-stone-900 hover:bg-stone-800 text-white dark:bg-amber-500 dark:text-stone-950 font-semibold text-xs sm:text-sm shadow-md transition-all"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {quote.requiresDeposit
                    ? `Jetzt verbindlich buchen (${formatEuro(quote.depositAmountCents)} Anzahlung)`
                    : "Termin jetzt verbindlich reservieren"}
                </span>
              </button>
            </div>
          </form>
        )}

        {/* STEP 5: INSTANT BOOKING CONFIRMATION */}
        {step === 5 && confirmedBooking && selectedService && (
          <div className="space-y-5 py-2">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Echtzeit-Synchronisation abgeschlossen
              </span>
              <h3 className="text-lg sm:text-xl font-bold">
                Dein Termin bei {salon.name} ist bestätigt!
              </h3>
              <p className="text-xs text-stone-500 max-w-md mx-auto">
                Der Zeitslot über{" "}
                <strong>
                  {formatDuration(confirmedBooking.totalDurationMinutes)}
                </strong>{" "}
                wurde im Kalender von{" "}
                <strong>
                  {
                    members.find((m) => m.id === confirmedBooking.memberId)
                      ?.displayName
                  }
                </strong>{" "}
                reserviert und in der Salon-Steuerzentrale eingetragen.
              </p>
            </div>

            <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-stone-50/80 dark:bg-stone-900 p-4 space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-stone-500">Buchungs-ID:</span>
                <span className="font-mono font-semibold">
                  #{confirmedBooking.id.slice(-6).toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Datum & Uhrzeit:</span>
                <span className="font-semibold">
                  {confirmedBooking.date} · {confirmedBooking.startTime}–
                  {confirmedBooking.customerEndTime} Uhr
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Qualifiziertes Zeitfenster:</span>
                <span className="font-semibold text-amber-700 dark:text-amber-400">
                  {confirmedBooking.baseDurationMinutes} Min. Basis +{" "}
                  {confirmedBooking.extraDurationMinutes} Min. Haar-Profil
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Gesamtpreis / Status:</span>
                <span className="font-semibold">
                  {formatEuro(confirmedBooking.totalPriceCents)}{" "}
                  {confirmedBooking.depositRequired
                    ? `(${formatEuro(confirmedBooking.depositAmountCents)} Anzahlung bezahlt)`
                    : "(Zahlung im Salon)"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Erinnerungs-Pipeline:</span>
                <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                  ✓ 24h E-Mail & 2h SMS aktiv
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleDownloadIcs}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 text-xs font-semibold hover:bg-stone-100 dark:hover:bg-stone-800"
              >
                <Download className="w-4 h-4" />
                <span>In Kalender speichern (.ics)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedSlot(null);
                  setConfirmedBooking(null);
                  setStep(1);
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-950 text-xs font-semibold"
              >
                <span>Weitere Buchung testen</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
