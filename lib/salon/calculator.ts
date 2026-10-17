import {
  CalculatedQuote,
  QualificationModifier,
  QualificationSelection,
  QuoteBreakdownItem,
  Salon,
  SalonMember,
  Service,
} from "./types";

export function formatEuro(cents: number): string {
  const euros = cents / 100;
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(euros);
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} Min.`;
  }
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `${hrs} Std.`;
  }
  return `${hrs} Std. ${mins} Min.`;
}

/**
 * Dynamically calculates total treatment duration, calendar block duration (with buffer),
 * transparent price, and automatic No-Show Stripe deposit requirements based on
 * the customer's pre-qualification answers (hair length, density, add-on wishes, and stylist).
 */
export function calculateBookingQuote(params: {
  salon: Salon;
  service: Service;
  modifiers: QualificationModifier[];
  selection: QualificationSelection;
  stylist?: SalonMember | null;
}): CalculatedQuote {
  const { salon, service, modifiers, selection, stylist } = params;

  const breakdown: QuoteBreakdownItem[] = [
    {
      label: `${service.name} (Basisleistung)`,
      category: "base",
      minutesDelta: service.baseDurationMinutes,
      priceDeltaCents: service.basePriceCents,
    },
  ];

  let lengthExtraMinutes = 0;
  let densityExtraMinutes = 0;
  let addonsExtraMinutes = 0;
  let extraPriceCents = 0;

  if (service.requiresQualification) {
    const lengthMod = modifiers.find(
      (m) =>
        m.dimension === "hair_length" && m.code === selection.hairLengthCode,
    );
    if (
      lengthMod &&
      (lengthMod.extraDurationMinutes !== 0 || lengthMod.extraPriceCents !== 0)
    ) {
      lengthExtraMinutes = lengthMod.extraDurationMinutes;
      extraPriceCents += lengthMod.extraPriceCents;
      breakdown.push({
        label: `Haarlänge: ${lengthMod.label}`,
        category: "length",
        minutesDelta: lengthMod.extraDurationMinutes,
        priceDeltaCents: lengthMod.extraPriceCents,
      });
    }

    const densityMod = modifiers.find(
      (m) =>
        m.dimension === "hair_density" && m.code === selection.hairDensityCode,
    );
    if (
      densityMod &&
      (densityMod.extraDurationMinutes !== 0 ||
        densityMod.extraPriceCents !== 0)
    ) {
      densityExtraMinutes = densityMod.extraDurationMinutes;
      extraPriceCents += densityMod.extraPriceCents;
      breakdown.push({
        label: `Haardichte: ${densityMod.label}`,
        category: "density",
        minutesDelta: densityMod.extraDurationMinutes,
        priceDeltaCents: densityMod.extraPriceCents,
      });
    }
  }

  if (service.allowAddons && selection.addonCodes.length > 0) {
    for (const code of selection.addonCodes) {
      const addon = modifiers.find(
        (m) => m.dimension === "addon" && m.code === code,
      );
      if (addon) {
        addonsExtraMinutes += addon.extraDurationMinutes;
        extraPriceCents += addon.extraPriceCents;
        breakdown.push({
          label: `Zusatzwunsch: ${addon.label}`,
          category: "addon",
          minutesDelta: addon.extraDurationMinutes,
          priceDeltaCents: addon.extraPriceCents,
        });
      }
    }
  }

  let stylistAdjustmentMinutes = 0;
  if (stylist) {
    if (stylist.durationMultiplierMinutes) {
      stylistAdjustmentMinutes = stylist.durationMultiplierMinutes;
    }
    if (stylist.seniorSurchargeCents && stylist.seniorSurchargeCents > 0) {
      extraPriceCents += stylist.seniorSurchargeCents;
      breakdown.push({
        label: `${stylist.title} (${stylist.displayName})`,
        category: "stylist",
        minutesDelta: stylistAdjustmentMinutes,
        priceDeltaCents: stylist.seniorSurchargeCents,
      });
    }
  }

  const rawCustomerMinutes =
    service.baseDurationMinutes +
    lengthExtraMinutes +
    densityExtraMinutes +
    addonsExtraMinutes +
    stylistAdjustmentMinutes;

  const customerDurationMinutes = Math.max(15, rawCustomerMinutes);
  const bufferMinutes = service.bufferAfterMinutes ?? salon.bufferMinutes;
  const totalBlockedMinutes = customerDurationMinutes + bufferMinutes;

  const totalPriceCents = service.basePriceCents + extraPriceCents;

  // Determine No-Show protection / Stripe deposit requirement:
  // Triggered either if the base service explicitly requires deposit OR if the dynamically
  // qualified appointment reaches the salon's high-value threshold (e.g. >= 120 min or >= 120 EUR).
  const exceedsDynamicThreshold =
    customerDurationMinutes >= salon.defaultDepositDurationMinutes ||
    totalPriceCents >= salon.defaultDepositThresholdCents;

  const requiresDeposit =
    service.requiresDeposit ||
    (service.depositType !== "none" && exceedsDynamicThreshold);

  let depositAmountCents = 0;
  if (requiresDeposit) {
    if (service.depositType === "fixed" && service.depositValue > 0) {
      depositAmountCents = Math.min(totalPriceCents, service.depositValue);
    } else {
      const percent =
        service.depositValue > 0
          ? service.depositValue
          : salon.defaultDepositPercent;
      // Round to nearest 100 cents (1 EUR) for clean customer UX
      depositAmountCents =
        Math.round((totalPriceCents * (percent / 100)) / 100) * 100;
    }
  }

  const remainingSalonCents = Math.max(0, totalPriceCents - depositAmountCents);

  const depositExplanation = requiresDeposit
    ? `Für zeitintensive Behandlungen (${formatDuration(customerDurationMinutes)}) wird eine Anzahlung von ${formatEuro(depositAmountCents)} via Stripe reserviert und im Salon zu 100 % verrechnet. Kostenlose Stornierung bis ${salon.cancellationHours} Std. vor Termin.`
    : `Kostenlose Sofort-Reservierung inklusive automatischer Termin-Erinnerung per E-Mail (${salon.reminderEmailHours[0] ?? 24}h vorher) & SMS.`;

  return {
    serviceId: service.id,
    serviceName: service.name,
    baseDurationMinutes: service.baseDurationMinutes,
    lengthExtraMinutes,
    densityExtraMinutes,
    addonsExtraMinutes,
    stylistAdjustmentMinutes,
    bufferMinutes,
    customerDurationMinutes,
    totalBlockedMinutes,
    basePriceCents: service.basePriceCents,
    extraPriceCents,
    totalPriceCents,
    requiresDeposit,
    depositAmountCents,
    remainingSalonCents,
    depositExplanation,
    breakdown,
  };
}
