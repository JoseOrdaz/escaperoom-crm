"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { DoorOpen, Clock3, UserCog, Calendar, LogIn, LogOut } from "lucide-react";

export function DashboardHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<{ name?: string; role?: string } | null>(null);

  // Leer sesión de la cookie (guardada como JSON)
  useEffect(() => {
    const cookie = document.cookie
      .split("; ")
      .find((row) => row.startsWith("session_user="));
    if (cookie) {
      try {
        const value = decodeURIComponent(cookie.split("=")[1]);
        const parsed = JSON.parse(value);
        setUser(parsed);
      } catch {
        setUser(null);
      }
    }
  }, []);

  const navLinks = [
    { href: "/dashboard/rooms", label: "Salas" },
    { href: "/dashboard/reservations", label: "Calendario" },
    { href: "/dashboard/bookings", label: "Reservas" },
    { href: "/dashboard/customers", label: "Clientes" },
    { href: "/dashboard/employees", label: "Empleados" },
  ];

  // Helpers de estado activo
  const isActive = (href: string) => pathname.startsWith(href);
  const isCheckinActive = pathname.startsWith("/dashboard/employees");
  const isDemoActive = pathname === "/bookings" || pathname.startsWith("/bookings/");

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
        {/* Logo + Marca */}
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold text-foreground hover:text-primary transition"
        >
          <DoorOpen className="h-5 w-5 text-primary" />
          <span className="tracking-tight">Escape CRM</span>
        </Link>

        {/* Navegación principal */}
        <nav className="ml-6 hidden items-center gap-4 text-sm font-medium md:flex">
          {navLinks.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`transition ${
                  active
                    ? "text-primary font-semibold border-b-2 border-primary pb-1"
                    : "text-muted-foreground hover:text-foreground border-b-2 border-transparent"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Espaciador */}
        <div className="flex-1" />

        {/* Botones rápidos */}
        <div className="flex items-center gap-3">
          {/* FICHAJES */}
          <Button
            size="sm"
            variant={isCheckinActive ? "default" : "outline"}
            className={`hidden sm:flex items-center gap-1 font-medium transition ${
              isCheckinActive
                ? "bg-primary text-white shadow"
                : "border-primary/30 hover:border-primary hover:text-primary"
            }`}
            onClick={() => {
              if (window.location.pathname === "/dashboard/employees") {
                window.location.hash = "checkin";
              } else {
                window.location.href = "/dashboard/employees#checkin";
              }
            }}
          >
            <Clock3 className="h-4 w-4 mr-1" />
            Fichajes
          </Button>

          {/* DEMO RESERVA CLIENTES */}
          <Button
            size="sm"
            variant={isDemoActive ? "default" : "secondary"}
            className={`hidden sm:flex items-center gap-1 font-medium transition ${
              isDemoActive
                ? "bg-primary text-white shadow"
                : "hover:bg-primary hover:text-white"
            }`}
            asChild
          >
            <Link href="/bookings">
              <Calendar className="h-4 w-4 mr-1" />
              Demo reserva clientes
            </Link>
          </Button>
        </div>

        <Separator orientation="vertical" className="mx-3 h-6" />

        {/* Usuario / Sesión */}
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Badge variant="secondary" className="hidden sm:flex items-center gap-1">
                <UserCog className="mr-1 h-4 w-4" /> {user.role || "Usuario"}
              </Badge>
              <Avatar className="h-8 w-8 border">
                <AvatarImage src="/avatar-default.png" alt={user.name} />
                <AvatarFallback>
                  {user.name?.[0] ?? "U"}
                </AvatarFallback>
              </Avatar>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await fetch("/api/auth/logout", { method: "POST" });
                  document.cookie =
                    "session_user=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
                  router.push("/login");
                }}
              >
                <LogOut className="w-4 h-4 mr-1" />
                Cerrar sesión
              </Button>
            </>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={() => router.push("/login")}
              className="flex items-center gap-1"
            >
              <LogIn className="w-4 h-4 mr-1" />
              Iniciar sesión
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
