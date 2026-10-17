"use client";

import { useCallback, useEffect, useState } from "react";
import {
  minutesToTime,
  timeToMinutes,
  verifySlotAvailability,
} from "./availability";
import { calculateBookingQuote } from "./calculator";
import {
  createInitialAppointments,
  createInitialTimeOffBlocks,
  INITIAL_CATEGORIES,
  INITIAL_CUSTOMERS,
  INITIAL_MEMBERS,
  INITIAL_MODIFIERS,
  INITIAL_SALONS,
  INITIAL_SERVICES,
  INITIAL_WORKING_HOURS,
} from "./seed-data";
import {
  Appointment,
  AppointmentStatus,
  CustomerProfile,
  QualificationModifier,
  QualificationSelection,
  Salon,
  SalonMember,
  Service,
  ServiceCategory,
  TimeOffBlock,
  WorkingHoursRule,
} from "./types";

const STORAGE_KEY = "silent_salon_v2_state";
const CHANNEL_NAME = "silent_salon_realtime_sync";

export interface SalonSystemState {
  salons: Salon[];
  members: SalonMember[];
  categories: ServiceCategory[];
  services: Service[];
  modifiers: QualificationModifier[];
  workingHours: WorkingHoursRule[];
  timeOffBlocks: TimeOffBlock[];
  customers: CustomerProfile[];
  appointments: Appointment[];
}

function getDefaultState(): SalonSystemState {
  return {
    salons: INITIAL_SALONS,
    members: INITIAL_MEMBERS,
    categories: INITIAL_CATEGORIES,
    services: INITIAL_SERVICES,
    modifiers: INITIAL_MODIFIERS,
    workingHours: INITIAL_WORKING_HOURS,
    timeOffBlocks: createInitialTimeOffBlocks(),
    customers: INITIAL_CUSTOMERS,
    appointments: createInitialAppointments(),
  };
}

let memoryState: SalonSystemState | null = null;
const listeners = new Set<(state: SalonSystemState) => void>();
let broadcastChannel: BroadcastChannel | null = null;

function initClientStore(): SalonSystemState {
  if (typeof window === "undefined") {
    return getDefaultState();
  }

  if (memoryState) {
    return memoryState;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SalonSystemState;
      if (parsed && Array.isArray(parsed.salons) && parsed.salons.length > 0) {
        memoryState = parsed;
      }
    }
  } catch {
    // Fallback to default seed state
  }

  if (!memoryState) {
    memoryState = getDefaultState();
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryState));
    } catch {
      // Ignore quota errors
    }
  }

  if (!broadcastChannel && "BroadcastChannel" in window) {
    broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
    broadcastChannel.onmessage = (event) => {
      if (event.data && event.data.type === "STATE_UPDATED") {
        memoryState = event.data.payload as SalonSystemState;
        listeners.forEach((l) => {
          if (memoryState) l(memoryState);
        });
      }
    };
  }

  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        memoryState = JSON.parse(e.newValue) as SalonSystemState;
        listeners.forEach((l) => {
          if (memoryState) l(memoryState);
        });
      } catch {
        // Ignore parse error
      }
    }
  });

  return memoryState;
}

function commitState(next: SalonSystemState) {
  memoryState = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage error
    }
    if (broadcastChannel) {
      broadcastChannel.postMessage({
        type: "STATE_UPDATED",
        payload: next,
      });
    }
  }
  listeners.forEach((l) => l(next));
}

export function useSalonStore() {
  const [state, setState] = useState<SalonSystemState>(() =>
    getDefaultState(),
  );
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const initial = initClientStore();
    setState(initial);
    setIsHydrated(true);

    const listener = (updated: SalonSystemState) => {
      setState(updated);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const createQualifiedBooking = useCallback(
    (input: {
      salonId: string;
      serviceId: string;
      memberId: string;
      date: string;
      startTime: string;
      selection: QualificationSelection;
      customerName: string;
      customerEmail: string;
      customerPhone: string;
      preferredBeverage?: string;
    }): { ok: boolean; appointment?: Appointment; error?: string } => {
      const current = initClientStore();
      const salon = current.salons.find((s) => s.id === input.salonId);
      const service = current.services.find((s) => s.id === input.serviceId);
      const stylist = current.members.find((m) => m.id === input.memberId);

      if (!salon || !service || !stylist) {
        return {
          ok: false,
          error: "Salon, Leistung oder Stylist wurde nicht gefunden.",
        };
      }

      const salonModifiers = current.modifiers.filter(
        (m) => m.salonId === salon.id,
      );

      const quote = calculateBookingQuote({
        salon,
        service,
        modifiers: salonModifiers,
        selection: input.selection,
        stylist,
      });

      const startMin = timeToMinutes(input.startTime);
      const customerEndTime = minutesToTime(
        startMin + quote.customerDurationMinutes,
      );
      const endTime = minutesToTime(startMin + quote.totalBlockedMinutes);

      // Verify GiST-equivalent non-overlapping slot rule before committing
      const check = verifySlotAvailability({
        memberId: stylist.id,
        date: input.date,
        startTime: input.startTime,
        endTime,
        workingHours: current.workingHours,
        timeOffBlocks: current.timeOffBlocks,
        appointments: current.appointments,
      });

      if (!check.ok) {
        return {
          ok: false,
          error:
            check.conflictReason ||
            "Dieser Zeitslot wurde soeben vergeben. Bitte wähle einen anderen Slot.",
        };
      }

      // Check or create CRM customer profile
      const existingCustomer = current.customers.find(
        (c) =>
          c.salonId === salon.id &&
          c.email.toLowerCase() === input.customerEmail.trim().toLowerCase(),
      );

      const customerId = existingCustomer
        ? existingCustomer.id
        : `cust-${Date.now()}`;

      const updatedCustomers = existingCustomer
        ? current.customers.map((c) =>
            c.id === existingCustomer.id
              ? {
                  ...c,
                  fullName: input.customerName.trim(),
                  phone: input.customerPhone.trim(),
                  hairLength: input.selection.hairLengthCode,
                  hairDensity: input.selection.hairDensityCode,
                  prefersSilentCut: input.selection.prefersSilentCut,
                  preferredBeverage:
                    input.preferredBeverage || c.preferredBeverage,
                  totalVisits: c.totalVisits + 1,
                  lastVisitDate: input.date,
                }
              : c,
          )
        : [
            ...current.customers,
            {
              id: customerId,
              salonId: salon.id,
              fullName: input.customerName.trim(),
              email: input.customerEmail.trim(),
              phone: input.customerPhone.trim(),
              hairLength: input.selection.hairLengthCode,
              hairDensity: input.selection.hairDensityCode,
              colorFormulaNotes:
                "Neukunde über Online-Widget (Vorab-Qualifizierung abgeschlossen).",
              preferredBeverage:
                input.preferredBeverage || "Cappuccino / Stilles Wasser",
              prefersSilentCut: input.selection.prefersSilentCut,
              noShowCount: 0,
              totalVisits: 1,
              lastVisitDate: input.date,
            },
          ];

      const summaryItems = quote.breakdown
        .filter((b) => b.category !== "base")
        .map((b) =>
          b.minutesDelta > 0
            ? `${b.label.replace(/^[^:]+:\s*/, "")} (+${b.minutesDelta} Min.)`
            : b.label,
        );

      const newAppointment: Appointment = {
        id: `appt-${Date.now()}`,
        publicToken:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `tok-${Date.now()}`,
        salonId: salon.id,
        memberId: stylist.id,
        serviceId: service.id,
        customerId,
        customerName: input.customerName.trim(),
        customerEmail: input.customerEmail.trim(),
        customerPhone: input.customerPhone.trim(),
        date: input.date,
        startTime: input.startTime,
        customerEndTime,
        endTime,
        baseDurationMinutes: quote.baseDurationMinutes,
        extraDurationMinutes:
          quote.lengthExtraMinutes +
          quote.densityExtraMinutes +
          quote.addonsExtraMinutes +
          quote.stylistAdjustmentMinutes,
        bufferMinutes: quote.bufferMinutes,
        totalDurationMinutes: quote.totalBlockedMinutes,
        qualification: input.selection,
        qualificationSummary:
          summaryItems.length > 0
            ? summaryItems
            : [`${service.name} (${quote.customerDurationMinutes} Min.)`],
        totalPriceCents: quote.totalPriceCents,
        depositRequired: quote.requiresDeposit,
        depositAmountCents: quote.depositAmountCents,
        paymentStatus: quote.requiresDeposit ? "deposit_paid" : "not_required",
        stripePaymentIntentId: quote.requiresDeposit
          ? `pi_3QvLive_${Math.random().toString(36).slice(2, 10)}`
          : undefined,
        status: "confirmed",
        prefersSilentCut: input.selection.prefersSilentCut,
        customerNotes: input.selection.customerNotes || undefined,
        formulaNotesSnapshot: existingCustomer?.colorFormulaNotes,
        beverageSnapshot:
          input.preferredBeverage ||
          existingCustomer?.preferredBeverage ||
          "Wasser / Kaffee nach Wunsch",
        reminder24hStatus: "scheduled",
        reminder2hSmsStatus: "scheduled",
        createdAt: new Date().toISOString(),
      };

      const nextState: SalonSystemState = {
        ...current,
        customers: updatedCustomers,
        appointments: [...current.appointments, newAppointment],
      };

      commitState(nextState);

      return { ok: true, appointment: newAppointment };
    },
    [],
  );

  const updateAppointmentStatus = useCallback(
    (appointmentId: string, status: AppointmentStatus) => {
      const current = initClientStore();
      const nextState: SalonSystemState = {
        ...current,
        appointments: current.appointments.map((a) =>
          a.id === appointmentId
            ? {
                ...a,
                status,
                paymentStatus:
                  status === "completed"
                    ? "paid_in_full"
                    : status === "no_show" && a.depositRequired
                      ? "forfeited"
                      : a.paymentStatus,
              }
            : a,
        ),
      };
      commitState(nextState);
    },
    [],
  );

  const addTimeOffBlock = useCallback(
    (block: Omit<TimeOffBlock, "id">) => {
      const current = initClientStore();
      const newBlock: TimeOffBlock = {
        ...block,
        id: `off-${Date.now()}`,
      };
      commitState({
        ...current,
        timeOffBlocks: [...current.timeOffBlocks, newBlock],
      });
    },
    [],
  );

  const removeTimeOffBlock = useCallback((blockId: string) => {
    const current = initClientStore();
    commitState({
      ...current,
      timeOffBlocks: current.timeOffBlocks.filter((b) => b.id !== blockId),
    });
  }, []);

  const updateModifier = useCallback(
    (
      modifierId: string,
      patch: Partial<
        Pick<
          QualificationModifier,
          "extraDurationMinutes" | "extraPriceCents" | "label"
        >
      >,
    ) => {
      const current = initClientStore();
      commitState({
        ...current,
        modifiers: current.modifiers.map((m) =>
          m.id === modifierId ? { ...m, ...patch } : m,
        ),
      });
    },
    [],
  );

  const updateService = useCallback(
    (
      serviceId: string,
      patch: Partial<
        Pick<
          Service,
          | "baseDurationMinutes"
          | "basePriceCents"
          | "requiresDeposit"
          | "depositValue"
          | "bufferAfterMinutes"
        >
      >,
    ) => {
      const current = initClientStore();
      commitState({
        ...current,
        services: current.services.map((s) =>
          s.id === serviceId ? { ...s, ...patch } : s,
        ),
      });
    },
    [],
  );

  const updateCustomerNotes = useCallback(
    (
      customerId: string,
      patch: Partial<
        Pick<
          CustomerProfile,
          "colorFormulaNotes" | "preferredBeverage" | "prefersSilentCut"
        >
      >,
    ) => {
      const current = initClientStore();
      commitState({
        ...current,
        customers: current.customers.map((c) =>
          c.id === customerId ? { ...c, ...patch } : c,
        ),
      });
    },
    [],
  );

  const resetDemoData = useCallback(() => {
    const fresh = getDefaultState();
    commitState(fresh);
  }, []);

  return {
    state,
    isHydrated,
    createQualifiedBooking,
    updateAppointmentStatus,
    addTimeOffBlock,
    removeTimeOffBlock,
    updateModifier,
    updateService,
    updateCustomerNotes,
    resetDemoData,
  };
}
