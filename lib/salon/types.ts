export type StaffRole = "owner" | "manager" | "stylist" | "receptionist";

export type QualificationDimension = "hair_length" | "hair_density" | "addon";

export type HairLengthCode =
  | "length_short"
  | "length_medium"
  | "length_long"
  | "length_xl";

export type HairDensityCode =
  | "density_normal"
  | "density_thick"
  | "density_curly_thick";

export type PaymentStatus =
  | "not_required"
  | "pending_deposit"
  | "deposit_paid"
  | "paid_in_full"
  | "refunded"
  | "forfeited";

export type AppointmentStatus =
  | "pending_deposit"
  | "confirmed"
  | "checked_in"
  | "completed"
  | "cancelled"
  | "no_show";

export interface Salon {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  timezone: string;
  currency: "EUR";
  brandColor: string;
  accentBg: string;
  slotIntervalMinutes: 15 | 20 | 30;
  bufferMinutes: number;
  cancellationHours: number;
  defaultDepositThresholdCents: number;
  defaultDepositDurationMinutes: number;
  defaultDepositPercent: number;
  stripeConnected: boolean;
  stripeAccountId: string;
  reminderEmailHours: number[];
  reminderSmsEnabled: boolean;
  rating: number;
  reviewCount: number;
}

export interface SalonMember {
  id: string;
  salonId: string;
  role: StaffRole;
  displayName: string;
  title: string;
  bio: string;
  avatarInitials: string;
  colorHex: string;
  badgeBg: string;
  badgeText: string;
  isActive: boolean;
  isBookable: boolean;
  specialties: string[];
  serviceIds: string[];
  /** Optional speed/duration delta in minutes (e.g. -5 for Master, +10 for Junior) */
  durationMultiplierMinutes?: number;
  /** Optional senior tier surcharge in cents */
  seniorSurchargeCents?: number;
}

export interface ServiceCategory {
  id: string;
  salonId: string;
  name: string;
  description: string;
  iconName: string;
  sortOrder: number;
}

export interface Service {
  id: string;
  salonId: string;
  categoryId: string;
  name: string;
  description: string;
  includedSteps: string[];
  baseDurationMinutes: number;
  bufferAfterMinutes: number;
  basePriceCents: number;
  requiresDeposit: boolean;
  depositType: "none" | "fixed" | "percent";
  depositValue: number; // cents if fixed, 0-100 if percent
  requiresQualification: boolean;
  allowAddons: boolean;
  isPopular?: boolean;
  isActive: boolean;
}

export interface QualificationModifier {
  id: string;
  salonId: string;
  dimension: QualificationDimension;
  code: string;
  label: string;
  shortLabel: string;
  subtitle: string;
  extraDurationMinutes: number;
  extraPriceCents: number;
  isDefault?: boolean;
  sortOrder: number;
}

export interface WorkingHoursRule {
  memberId: string;
  dayOfWeek: number; // 0 = Sun, 1 = Mon ... 6 = Sat
  isWorking: boolean;
  startTime: string; // "09:00"
  endTime: string; // "18:30"
  breakStart?: string; // "13:00"
  breakEnd?: string; // "13:45"
}

export interface TimeOffBlock {
  id: string;
  salonId: string;
  memberId: string;
  date: string; // "YYYY-MM-DD"
  startTime: string; // "14:00"
  endTime: string; // "15:30"
  reason: string;
}

export interface CustomerProfile {
  id: string;
  salonId: string;
  fullName: string;
  email: string;
  phone: string;
  hairLength: HairLengthCode;
  hairDensity: HairDensityCode;
  colorFormulaNotes: string;
  preferredBeverage: string;
  prefersSilentCut: boolean;
  noShowCount: number;
  totalVisits: number;
  lastVisitDate?: string;
}

export interface QualificationSelection {
  hairLengthCode: HairLengthCode;
  hairDensityCode: HairDensityCode;
  addonCodes: string[];
  prefersSilentCut: boolean;
  customerNotes: string;
}

export interface QuoteBreakdownItem {
  label: string;
  category: "base" | "length" | "density" | "addon" | "stylist" | "buffer";
  minutesDelta: number;
  priceDeltaCents: number;
}

export interface CalculatedQuote {
  serviceId: string;
  serviceName: string;
  baseDurationMinutes: number;
  lengthExtraMinutes: number;
  densityExtraMinutes: number;
  addonsExtraMinutes: number;
  stylistAdjustmentMinutes: number;
  bufferMinutes: number;
  /** Visible treatment duration for the customer (without internal cleanup buffer) */
  customerDurationMinutes: number;
  /** Exact calendar block duration including cleanup/turnaround buffer */
  totalBlockedMinutes: number;
  basePriceCents: number;
  extraPriceCents: number;
  totalPriceCents: number;
  requiresDeposit: boolean;
  depositAmountCents: number;
  remainingSalonCents: number;
  depositExplanation: string;
  breakdown: QuoteBreakdownItem[];
}

export interface AvailableSlot {
  startTime: string; // "10:15"
  endTime: string; // "11:40"
  customerEndTime: string; // "11:35"
  assignedMemberId: string;
  assignedMemberName: string;
  availableMemberIds: string[];
  /** True when this slot seamlessly connects to an existing booking or break without leaving a dead 15-30m gap */
  isOptimalGapFill: boolean;
  gapFillReason?: string;
}

export interface Appointment {
  id: string;
  publicToken: string;
  salonId: string;
  memberId: string;
  serviceId: string;
  customerId?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  date: string; // "YYYY-MM-DD"
  startTime: string; // "10:00"
  endTime: string; // "12:15" (includes buffer)
  customerEndTime: string; // "12:10"
  baseDurationMinutes: number;
  extraDurationMinutes: number;
  bufferMinutes: number;
  totalDurationMinutes: number;
  qualification: QualificationSelection;
  qualificationSummary: string[];
  totalPriceCents: number;
  depositRequired: boolean;
  depositAmountCents: number;
  paymentStatus: PaymentStatus;
  stripePaymentIntentId?: string;
  status: AppointmentStatus;
  prefersSilentCut: boolean;
  customerNotes?: string;
  formulaNotesSnapshot?: string;
  beverageSnapshot?: string;
  reminder24hStatus: "scheduled" | "sent" | "delivered";
  reminder2hSmsStatus: "scheduled" | "sent" | "delivered";
  createdAt: string;
}
