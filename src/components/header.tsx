import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, DoorOpen, CalendarClock, Users, Settings, Bell } from "lucide-react";

export function DashboardHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
        {/* Logo + marca */}
        <Link href="/dashboard/rooms" className="flex items-center gap-2 font-semibold">
          <DoorOpen className="h-5 w-5" />
          <span>Escape CRM</span>
        </Link>

        {/* Nav */}
        <nav className="ml-6 hidden items-center gap-4 text-sm font-medium md:flex">
          <Link href="/dashboard/rooms" className="text-muted-foreground hover:text-foreground">Salas</Link>
          <Link href="/dashboard/reservations" className="text-muted-foreground hover:text-foreground">Calendario</Link>
          <Link href="/dashboard/bookings" className="text-muted-foreground hover:text-foreground">Reservas</Link>
          <Link href="/dashboard/customers" className="text-muted-foreground hover:text-foreground">Clientes</Link>
        </nav>

        {/* Grow */}
        <div className="flex-1" />

        {/* Search */}
        {/* <div className="hidden md:block">
          <Input placeholder="Buscar salas o reservas…" className="w-[280px]" />
        </div> */}

        {/* Iconos */}
        <Button variant="ghost" size="icon" aria-label="Notificaciones">
          <Bell className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Ajustes">
          <Settings className="h-5 w-5" />
        </Button>

        <Separator orientation="vertical" className="mx-1 h-6" />

        {/* Usuario */}
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="hidden sm:flex items-center gap-1">
            <CalendarDays className="mr-1 h-4 w-4" /> Admin
          </Badge>
          <Avatar className="h-8 w-8">
            <AvatarFallback>AG</AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  );
}
