import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { RoomCreateForm } from "@/app/dashboard/rooms/_components/room-create-form";

export const dynamic = "force-dynamic";

export default function NewRoomPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Nueva sala</h1>
          <p className="text-sm text-muted-foreground">Crea la sala y después añade precios y horarios.</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/dashboard/rooms"><ArrowLeft className="size-4" /> Volver</Link>
        </Button>
      </div>

      <RoomCreateForm />
    </div>
  );
}
