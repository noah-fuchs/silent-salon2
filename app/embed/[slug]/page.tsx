import { BookingWidget } from "@/components/salon/booking-widget";

export default async function EmbedSalonPage({
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
