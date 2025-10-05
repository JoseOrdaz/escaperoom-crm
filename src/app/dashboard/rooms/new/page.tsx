import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { RoomCreateForm } from "@/app/dashboard/rooms/_components/room-create-form";

export const dynamic = "force-dynamic";

export default function NewRoomPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Nueva sala</h1>
          <p className="text-sm text-muted-foreground">Crea la sala y después añade precios y horarios.</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/dashboard/rooms">← Volver</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datos básicos</CardTitle>
          <CardDescription>Nombre, estado, capacidad y duración del juego</CardDescription>
        </CardHeader>
        <Separator />
        <CardContent className="pt-6">
          <RoomCreateForm />
        </CardContent>
      </Card>
    </div>
  );
}
