import {
  Appointment,
  AvailableSlot,
  Salon,
  SalonMember,
  TimeOffBlock,
  WorkingHoursRule,
} from "./types";

export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function minutesToTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function rangesOverlap(
  startA: number,
  endA: number,
  startB: number,
  endB: number,
): boolean {
  return startA < endB && endA > startB;
}

export function getDayOfWeekFromDate(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

interface BusyInterval {
  start: number;
  end: number;
  source: "appointment" | "break" | "time_off";
}

function getStylistBusyIntervals(params: {
  memberId: string;
  date: string;
  workingHours?: WorkingHoursRule;
  timeOffBlocks: TimeOffBlock[];
  appointments: Appointment[];
}): BusyInterval[] {
  const { memberId, date, workingHours, timeOffBlocks, appointments } = params;
  const intervals: BusyInterval[] = [];

  if (workingHours?.breakStart && workingHours?.breakEnd) {
    intervals.push({
      start: timeToMinutes(workingHours.breakStart),
      end: timeToMinutes(workingHours.breakEnd),
      source: "break",
    });
  }

  for (const off of timeOffBlocks) {
    if (off.memberId === memberId && off.date === date) {
      intervals.push({
        start: timeToMinutes(off.startTime),
        end: timeToMinutes(off.endTime),
        source: "time_off",
      });
    }
  }

  for (const appt of appointments) {
    if (
      appt.memberId === memberId &&
      appt.date === date &&
      (appt.status === "confirmed" ||
        appt.status === "checked_in" ||
        appt.status === "pending_deposit")
    ) {
      intervals.push({
        start: timeToMinutes(appt.startTime),
        end: timeToMinutes(appt.endTime),
        source: "appointment",
      });
    }
  }

  return intervals.sort((a, b) => a.start - b.start);
}

/**
 * Computes all conflict-free available time slots for a dynamically calculated treatment duration.
 * Takes into account:
 * - Stylist specialization for the chosen service
 * - Weekly working hours & lunch breaks
 * - Vacation / Time-off blocks
 * - Active bookings (with turnaround buffer)
 * - Smart Gap-Fill detection (prioritizing slots that don't leave dead 15-25 min gaps)
 */
export function computeAvailableSlots(params: {
  salon: Salon;
  date: string;
  serviceId: string;
  customerDurationMinutes: number;
  totalBlockedMinutes: number;
  requestedMemberId: string | "any";
  members: SalonMember[];
  workingHours: WorkingHoursRule[];
  timeOffBlocks: TimeOffBlock[];
  appointments: Appointment[];
}): AvailableSlot[] {
  const {
    salon,
    date,
    serviceId,
    customerDurationMinutes,
    totalBlockedMinutes,
    requestedMemberId,
    members,
    workingHours,
    timeOffBlocks,
    appointments,
  } = params;

  const dayOfWeek = getDayOfWeekFromDate(date);

  // Filter stylists who are active, bookable, and specialized in this service
  const eligibleMembers = members.filter(
    (m) =>
      m.isActive &&
      m.isBookable &&
      m.serviceIds.includes(serviceId) &&
      (requestedMemberId === "any" || m.id === requestedMemberId),
  );

  if (eligibleMembers.length === 0) {
    return [];
  }

  // Determine earliest start and latest end across eligible stylists
  let earliestMinute = 24 * 60;
  let latestMinute = 0;

  const memberSchedules = new Map<
    string,
    {
      member: SalonMember;
      rule: WorkingHoursRule;
      busy: BusyInterval[];
      workStart: number;
      workEnd: number;
    }
  >();

  for (const member of eligibleMembers) {
    const rule = workingHours.find(
      (w) => w.memberId === member.id && w.dayOfWeek === dayOfWeek,
    );
    if (!rule || !rule.isWorking) continue;

    const workStart = timeToMinutes(rule.startTime);
    const workEnd = timeToMinutes(rule.endTime);
    if (workStart < earliestMinute) earliestMinute = workStart;
    if (workEnd > latestMinute) latestMinute = workEnd;

    const busy = getStylistBusyIntervals({
      memberId: member.id,
      date,
      workingHours: rule,
      timeOffBlocks,
      appointments,
    });

    memberSchedules.set(member.id, {
      member,
      rule,
      busy,
      workStart,
      workEnd,
    });
  }

  if (memberSchedules.size === 0) {
    return [];
  }

  const step = salon.slotIntervalMinutes;
  const slots: AvailableSlot[] = [];

  for (
    let slotStart = earliestMinute;
    slotStart + totalBlockedMinutes <= latestMinute;
    slotStart += step
  ) {
    const slotEnd = slotStart + totalBlockedMinutes;
    const customerEnd = slotStart + customerDurationMinutes;

    const candidates: Array<{
      member: SalonMember;
      isGapFill: boolean;
      gapFillReason?: string;
    }> = [];

    for (const [, sched] of memberSchedules) {
      if (slotStart < sched.workStart || slotEnd > sched.workEnd) {
        continue;
      }

      const hasConflict = sched.busy.some((b) =>
        rangesOverlap(slotStart, slotEnd, b.start, b.end),
      );
      if (hasConflict) {
        continue;
      }

      // Check if this slot starts right after a busy block / work start
      // OR ends right before a busy block / work end (zero dead gap!)
      const touchesStartOfDay = slotStart === sched.workStart;
      const touchesEndOfPrevious = sched.busy.some((b) => b.end === slotStart);
      const touchesStartOfNext = sched.busy.some((b) => b.start === slotEnd);

      const isGapFill = touchesEndOfPrevious || touchesStartOfNext;
      let gapFillReason: string | undefined;
      if (touchesEndOfPrevious && touchesStartOfNext) {
        gapFillReason = "Füllt eine Kalenderlücke exakt aus";
      } else if (touchesEndOfPrevious) {
        gapFillReason = "Nahtloser Anschluss ohne Leerlauf";
      } else if (touchesStartOfNext) {
        gapFillReason = "Endet exakt vor Folgetermin/Pause";
      } else if (touchesStartOfDay) {
        gapFillReason = "Erster Slot des Tages";
      }

      candidates.push({
        member: sched.member,
        isGapFill,
        gapFillReason,
      });
    }

    if (candidates.length > 0) {
      // Prefer stylists where this slot creates a seamless connection (no dead calendar gap)
      candidates.sort((a, b) => Number(b.isGapFill) - Number(a.isGapFill));
      const best = candidates[0];

      slots.push({
        startTime: minutesToTime(slotStart),
        endTime: minutesToTime(slotEnd),
        customerEndTime: minutesToTime(customerEnd),
        assignedMemberId: best.member.id,
        assignedMemberName: best.member.displayName,
        availableMemberIds: candidates.map((c) => c.member.id),
        isOptimalGapFill: best.isGapFill,
        gapFillReason: best.gapFillReason,
      });
    }
  }

  return slots;
}

/**
 * Checks if a specific [startTime, endTime) on a given date and stylist is completely conflict-free.
 */
export function verifySlotAvailability(params: {
  memberId: string;
  date: string;
  startTime: string;
  endTime: string;
  workingHours: WorkingHoursRule[];
  timeOffBlocks: TimeOffBlock[];
  appointments: Appointment[];
  excludeAppointmentId?: string;
}): { ok: boolean; conflictReason?: string } {
  const {
    memberId,
    date,
    startTime,
    endTime,
    workingHours,
    timeOffBlocks,
    appointments,
    excludeAppointmentId,
  } = params;

  const dayOfWeek = getDayOfWeekFromDate(date);
  const rule = workingHours.find(
    (w) => w.memberId === memberId && w.dayOfWeek === dayOfWeek,
  );

  if (!rule || !rule.isWorking) {
    return {
      ok: false,
      conflictReason: "Stylist arbeitet an diesem Wochentag nicht.",
    };
  }

  const startMin = timeToMinutes(startTime);
  const endMin = timeToMinutes(endTime);
  const workStart = timeToMinutes(rule.startTime);
  const workEnd = timeToMinutes(rule.endTime);

  if (startMin < workStart || endMin > workEnd) {
    return {
      ok: false,
      conflictReason: `Außerhalb der Arbeitszeit (${rule.startTime}–${rule.endTime} Uhr).`,
    };
  }

  if (rule.breakStart && rule.breakEnd) {
    const bStart = timeToMinutes(rule.breakStart);
    const bEnd = timeToMinutes(rule.breakEnd);
    if (rangesOverlap(startMin, endMin, bStart, bEnd)) {
      return {
        ok: false,
        conflictReason: `Überschneidet sich mit der Pause (${rule.breakStart}–${rule.breakEnd} Uhr).`,
      };
    }
  }

  for (const off of timeOffBlocks) {
    if (off.memberId === memberId && off.date === date) {
      if (
        rangesOverlap(
          startMin,
          endMin,
          timeToMinutes(off.startTime),
          timeToMinutes(off.endTime),
        )
      ) {
        return {
          ok: false,
          conflictReason: `Zeitraum blockiert (${off.reason}: ${off.startTime}–${off.endTime} Uhr).`,
        };
      }
    }
  }

  for (const appt of appointments) {
    if (appt.id === excludeAppointmentId) continue;
    if (
      appt.memberId === memberId &&
      appt.date === date &&
      (appt.status === "confirmed" ||
        appt.status === "checked_in" ||
        appt.status === "pending_deposit")
    ) {
      if (
        rangesOverlap(
          startMin,
          endMin,
          timeToMinutes(appt.startTime),
          timeToMinutes(appt.endTime),
        )
      ) {
        return {
          ok: false,
          conflictReason: `Überschneidung mit bestehendem Termin von ${appt.customerName} (${appt.startTime}–${appt.endTime} Uhr).`,
        };
      }
    }
  }

  return { ok: true };
}
