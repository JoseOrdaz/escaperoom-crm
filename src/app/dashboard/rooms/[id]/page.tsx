import { notFound } from "next/navigation";
import { connectDB } from "@/lib/db";
import { ObjectId } from "mongodb";
import { RoomEditForm } from "@/app/dashboard/rooms/_components/room-edit-form";

export const dynamic = "force-dynamic";

export default async function RoomEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // ✅ Esperamos el objeto params antes de usarlo
  const { id } = await params;

  const db = await connectDB();
  const room = await db.collection("rooms").findOne({ _id: new ObjectId(id) });

  if (!room) return notFound();

  // ✅ Normaliza valores con fallback seguros
  const normalizedRoom = {
    ...room,
    _id: room._id.toString(),
    imageUrl: room.imageUrl ?? "",
    capacityMin: room.capacityMin ?? 2,
    capacityMax: room.capacityMax ?? 6,
    durationMinutes: room.durationMinutes ?? 60,
    priceTable: Array.isArray(room.priceTable) ? room.priceTable : [],
    schedule: {
      template: {
        monday: room.schedule?.template?.monday ?? [],
        tuesday: room.schedule?.template?.tuesday ?? [],
        wednesday: room.schedule?.template?.wednesday ?? [],
        thursday: room.schedule?.template?.thursday ?? [],
        friday: room.schedule?.template?.friday ?? [],
        saturday: room.schedule?.template?.saturday ?? [],
        sunday: room.schedule?.template?.sunday ?? [],
      },
      daysOff: room.schedule?.daysOff ?? [],
      overrides: room.schedule?.overrides ?? [],
    },
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{normalizedRoom.name}</h1>
        <p className="text-sm text-muted-foreground">
          Editar configuración de la sala
        </p>
      </div>
      <RoomEditForm room={normalizedRoom as any} />
    </div>
  );
}
