import Link from "next/link";
import { connectDB } from "@/lib/db";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  CalendarCheck2, CircleDollarSign, Users,
} from "lucide-react";
import { RowActions } from "./_components/row-actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export const dynamic = "force-dynamic";

type RoomListItem = {
  _id: string;
  name: string;
  active: boolean;
  durationMinutes: number;
  capacityMin: number;
  capacityMax: number;
  priceCount: number;
  staffAssigned: boolean;
  imageUrl?: string;
  reservationsCount: number;
  revenue: number;
};

function initialsFromName(name: string) {
  return (
    name
      ?.split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "SL"
  );
}

function formatEUR(v: number) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(v || 0);
}

async function getRooms(): Promise<RoomListItem[]> {
  const db = await connectDB();

  const docs = await db.collection("rooms").aggregate([
    {
      $lookup: {
        from: "reservations",
        localField: "_id",
        foreignField: "roomId",
        as: "reservations",
      },
    },
    {
      $addFields: {
        reservationsCount: { $size: "$reservations" },
        revenue: { $sum: "$reservations.price" },
      },
    },
    {
      $project: {
        name: 1,
        active: 1,
        durationMinutes: 1,
        capacityMin: 1,
        capacityMax: 1,
        priceTable: 1,
        staffId: 1,
        imageUrl: 1,
        reservationsCount: 1,
        revenue: 1,
      },
    },
    { $sort: { name: 1 } },
  ]).toArray();

  return docs.map((d: any) => ({
    _id: d._id.toString(),
    name: d.name,
    active: !!d.active,
    durationMinutes: d.durationMinutes ?? 60,
    capacityMin: d.capacityMin ?? 2,
    capacityMax: d.capacityMax ?? 6,
    priceCount: Array.isArray(d.priceTable) ? d.priceTable.length : 0,
    staffAssigned: Boolean(d.staffId),
    imageUrl: typeof d.imageUrl === "string" ? d.imageUrl : "",
    reservationsCount: d.reservationsCount ?? 0,
    revenue: d.revenue ?? 0,
  }));
}

// ➡️ pedir estadísticas a la API
async function getStats() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/reservations?stats=1`, {
    cache: "no-store",
  });
  if (!res.ok) return { totalReservations: 0, reservationsThisMonth: 0, totalRevenue: 0 };
  return res.json();
}

// ➡️ contar clientes totales
async function getTotalCustomers(): Promise<number> {
  const db = await connectDB();
  return db.collection("customers").countDocuments();
}

export default async function RoomsPage() {
  const [rooms, stats, totalCustomers] = await Promise.all([
    getRooms(),
    getStats(),
    getTotalCustomers(),
  ]);

  const totalRevenue = rooms.reduce((a, r) => a + (r.revenue || 0), 0);

  return (
    <div className="space-y-6">
      {/* Migas + toolbar */}
      <div className="flex items-center justify-between">
        <div>
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Salas</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Salas</h1>
          <p className="text-sm text-muted-foreground">
            Gestiona salas, horarios y precios por jugadores
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* <Input placeholder="Buscar…" className="hidden w-[240px] md:block" /> */}
          <Button asChild>
            <Link href="/dashboard/rooms/new">+ Añadir sala</Link>
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total histórico */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total reservas</CardTitle>
            <CalendarCheck2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalReservations}</div>
            <p className="text-xs text-muted-foreground">Histórico</p>
          </CardContent>
        </Card>

        {/* Este mes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reservas este mes</CardTitle>
            <CalendarCheck2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.reservationsThisMonth}</div>
            <p className="text-xs text-muted-foreground">Desde el día 1</p>
          </CardContent>
        </Card>

        {/* Facturado */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Facturado</CardTitle>
            <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatEUR(totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">Bruto total</p>
          </CardContent>
        </Card>

        {/* Clientes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCustomers}</div>
            <p className="text-xs text-muted-foreground">Únicos en la base</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla */}
      <Card className="p-6">
        <CardHeader className="pb-0">
          <CardTitle className="text-base">Listado</CardTitle>
          <CardDescription>Resumen de configuración y métricas por sala</CardDescription>
        </CardHeader>
        <Separator />
        <CardContent className="p-0">
          {rooms.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              No hay salas aún. Crea la primera con “Añadir sala”.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sala</TableHead>
                  <TableHead className="w-[110px]">Estado</TableHead>
                  <TableHead className="w-[130px]">Jugadores</TableHead>
                  <TableHead className="w-[110px]">Duración</TableHead>
                  <TableHead className="w-[110px]">Reservas</TableHead>
                  <TableHead className="w-[140px]">Facturado</TableHead>
                  <TableHead className="w-[72px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rooms.map((r) => (
                  <TableRow key={r._id} className="align-middle">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={r.imageUrl || undefined} alt={r.name} />
                          <AvatarFallback>{initialsFromName(r.name)}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{r.name}</span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge variant={r.active ? "default" : "secondary"}>
                        {r.active ? "Activa" : "Inactiva"}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      {r.capacityMin}–{r.capacityMax}
                    </TableCell>

                    <TableCell>{r.durationMinutes} min</TableCell>

                    <TableCell>{r.reservationsCount}</TableCell>

                    <TableCell>{formatEUR(r.revenue)}</TableCell>

                    <TableCell className="text-right">
                      <RowActions id={r._id} name={r.name} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
