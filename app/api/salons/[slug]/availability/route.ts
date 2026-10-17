import { NextRequest, NextResponse } from "next/server";
import { computeAvailableSlots } from "@/lib/salon/availability";
import { calculateBookingQuote } from "@/lib/salon/calculator";
import {
  createInitialAppointments,
  createInitialTimeOffBlocks,
  getOffsetDateStr,
  INITIAL_MEMBERS,
  INITIAL_MODIFIERS,
  INITIAL_SALONS,
  INITIAL_SERVICES,
  INITIAL_WORKING_HOURS,
} from "@/lib/salon/seed-data";
import {
  HairDensityCode,
  HairLengthCode,
  QualificationSelection,
} from "@/lib/salon/types";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const salon = INITIAL_SALONS.find((s) => s.slug === slug);

  if (!salon) {
    return NextResponse.json(
      { error: "Salon nicht gefunden." },
      { status: 404, headers: corsHeaders },
    );
  }

  const sp = request.nextUrl.searchParams;
  const salonServices = INITIAL_SERVICES.filter((s) => s.salonId === salon.id);
  const serviceId = sp.get("serviceId") || salonServices[0]?.id;
  const service = salonServices.find((s) => s.id === serviceId);

  if (!service) {
    return NextResponse.json(
      { error: "Dienstleistung nicht gefunden." },
      { status: 404, headers: corsHeaders },
    );
  }

  const date = sp.get("date") || getOffsetDateStr(0);
  const memberId = sp.get("memberId") || "any";
  const hairLengthCode =
    (sp.get("hairLength") as HairLengthCode) || "length_medium";
  const hairDensityCode =
    (sp.get("hairDensity") as HairDensityCode) || "density_normal";
  const addonCodes = (sp.get("addons") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const prefersSilentCut = sp.get("silentCut") === "true";

  const selection: QualificationSelection = {
    hairLengthCode,
    hairDensityCode,
    addonCodes,
    prefersSilentCut,
    customerNotes: "",
  };

  const salonModifiers = INITIAL_MODIFIERS.filter(
    (m) => m.salonId === salon.id,
  );
  const salonMembers = INITIAL_MEMBERS.filter((m) => m.salonId === salon.id);
  const selectedStylist =
    memberId !== "any"
      ? salonMembers.find((m) => m.id === memberId)
      : undefined;

  const quote = calculateBookingQuote({
    salon,
    service,
    modifiers: salonModifiers,
    selection,
    stylist: selectedStylist,
  });

  const slots = computeAvailableSlots({
    salon,
    date,
    serviceId: service.id,
    customerDurationMinutes: quote.customerDurationMinutes,
    totalBlockedMinutes: quote.totalBlockedMinutes,
    requestedMemberId: memberId,
    members: salonMembers,
    workingHours: INITIAL_WORKING_HOURS,
    timeOffBlocks: createInitialTimeOffBlocks(),
    appointments: createInitialAppointments(),
  });

  return NextResponse.json(
    {
      salon: {
        id: salon.id,
        slug: salon.slug,
        name: salon.name,
        timezone: salon.timezone,
        currency: salon.currency,
      },
      date,
      quote,
      slots,
    },
    { headers: corsHeaders },
  );
}
