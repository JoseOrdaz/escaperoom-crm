import { PublicBooking } from "@/components/public-booking/public-booking";

/** ?sala=<id o nombre> → solo el calendario de esa sala (para la página de cada sala en la web) */
export default async function Page({ searchParams }: { searchParams: Promise<{ sala?: string }> }) {
  const { sala } = await searchParams;
  return <PublicBooking escape="Action Gates" initialRoom={sala} />;
}
