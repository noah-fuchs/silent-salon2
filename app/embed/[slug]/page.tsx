import { Suspense } from "react";
import { BookingWidget } from "@/components/salon/booking-widget";

export function generateStaticParams() {
  return [{ slug: "atelier-lumiere" }, { slug: "urban-craft" }];
}

async function EmbedSalonContent({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ embedded?: string }>;
}) {
  const { slug } = await params;
  const { embedded } = await searchParams;
  const isEmbedded = embedded === "1" || embedded === "true";

  return (
    <div
      className={
        isEmbedded
          ? "w-full p-1 bg-transparent"
          : "min-h-screen w-full bg-stone-100/80 dark:bg-stone-950 py-6 px-3 sm:px-6 flex flex-col items-center justify-center"
      }
    >
      <BookingWidget salonSlug={slug} embedded={isEmbedded} />
      {!isEmbedded && (
        <p className="mt-4 text-[11px] text-stone-500 text-center">
          Silent Salon Widget · Isolierte Multi-Tenant-Instanz (
          <code className="font-mono">{slug}</code>)
        </p>
      )}
    </div>
  );
}

export default function EmbedSalonPage(props: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ embedded?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen w-full flex items-center justify-center p-6 text-xs text-stone-500">
          Widget wird geladen...
        </div>
      }
    >
      <EmbedSalonContent {...props} />
    </Suspense>
  );
}
