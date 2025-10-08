"use client";

import { DoorOpen, CalendarDays, LayoutDashboard, Heart, Compass, ExternalLink } from "lucide-react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-950 dark:to-black">
      {/* SECCIÓN PRINCIPAL */}
      <main className="flex flex-col flex-1 items-center justify-center p-6">
        {/* LOGO */}
        <div className="flex items-center gap-3 mb-10">
          <div className="p-3 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 shadow-md">
            <DoorOpen className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-800 dark:text-white">
            Escape CRM
          </h1>
        </div>

        <p className="text-slate-600 dark:text-slate-300 text-center max-w-xl mb-12 text-base">
          Plataforma para la gestión completa de <span className="font-semibold text-indigo-600">Escape Rooms</span>: controla tus reservas, empleados y salas en un solo lugar.
        </p>

        {/* TARJETAS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 w-full max-w-5xl">
          {/* CARD DEMO RESERVAS */}
          <Card className="relative group overflow-hidden rounded-3xl shadow-lg border-none bg-white/80 dark:bg-slate-800/70 backdrop-blur-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] flex flex-col justify-between">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 opacity-80 group-hover:opacity-100 transition" />
            <CardHeader className="relative z-10 flex flex-col items-center text-center p-10">
              <div className="p-5 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 mb-6 shadow-md group-hover:scale-110 transition-transform">
                <CalendarDays className="h-10 w-10 text-white" />
              </div>
              <CardTitle className="text-2xl font-semibold text-slate-800 dark:text-white mb-2">
                Demo de Reservas
              </CardTitle>
              <CardDescription className="text-slate-600 dark:text-slate-300 text-base">
                Explora la experiencia de reserva que verán tus clientes en tiempo real.
              </CardDescription>
            </CardHeader>
            <CardContent className="relative z-10 flex flex-col sm:flex-row justify-center gap-3 p-6 pt-0">
              <Button
                asChild
                variant="default"
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow flex items-center gap-2"
              >
                <Link target="_blank" href="/bookings/fobia">
                  Fobia
                  <ExternalLink className="h-4 w-4 opacity-80 group-hover:opacity-100 transition" />
                </Link>
              </Button>

              <Button
                asChild
                variant="default"
                className="bg-purple-600 hover:bg-purple-700 text-white font-medium shadow flex items-center gap-2"
              >
                <Link target="_blank" href="/bookings/action-gates">
                  Action Gates
                  <ExternalLink className="h-4 w-4 opacity-80 group-hover:opacity-100 transition" />
                </Link>
              </Button>

              <Button
                asChild
                variant="outline"
                className="text-slate-700 dark:text-slate-200 font-medium shadow-sm flex items-center gap-2"
              >
                <Link target="_blank" href="/bookings">
                  Todas las salas
                  <ExternalLink className="h-4 w-4 opacity-80 group-hover:opacity-100 transition" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* CARD CRM */}
          <Link target="_blank" href="/dashboard/rooms" className="group">
            <Card className="relative overflow-hidden rounded-3xl shadow-lg border-none bg-white/80 dark:bg-slate-800/70 backdrop-blur-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] flex flex-col justify-between h-full">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 opacity-80 group-hover:opacity-100 transition" />
              <CardHeader className="relative z-10 flex flex-col items-center text-center p-10">
                <div className="p-5 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-500 mb-6 shadow-md group-hover:scale-110 transition-transform">
                  <LayoutDashboard className="h-10 w-10 text-white" />
                </div>
                <CardTitle className="text-2xl font-semibold text-slate-800 dark:text-white mb-2">
                  Dashboard CRM
                </CardTitle>
                <CardDescription className="text-slate-600 dark:text-slate-300 text-base mb-6">
                  Administra tus salas, empleados y turnos desde un entorno profesional.
                </CardDescription>
              </CardHeader>

              {/* Botón de acceso */}
              <CardContent className="relative z-10 flex justify-center p-6 pt-0">
                <Button
                  asChild
                  variant="default"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow flex items-center gap-2"
                >
                  <Link target="_blank" href="/dashboard/rooms">
                    Acceso al CRM
                    <LayoutDashboard className="h-4 w-4 opacity-80 group-hover:opacity-100 transition" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </Link>

        </div>
      </main>

      {/* FOOTER */}
      <footer className="border-t bg-muted/30 backdrop-blur-sm w-full">
        <div className="mx-auto flex max-w-7xl flex-col sm:flex-row items-center justify-between px-4 py-4 text-xs text-muted-foreground gap-2">
          {/* Izquierda */}
          <div className="flex items-center gap-2">
            <DoorOpen className="h-4 w-4 text-primary" />
            <span className="font-medium">Escape CRM</span>
            <span>© {new Date().getFullYear()}</span>
          </div>

          {/* Centro */}
          <div className="hidden sm:flex items-center gap-1 text-muted-foreground/80">
            <Heart className="h-3 w-3 text-red-500" />
            <span>Hecho con pasión para gestores de Escape Rooms</span>
          </div>

          {/* Derecha */}
          <div className="flex items-center gap-2 text-muted-foreground/80">
            <Compass className="h-4 w-4 text-primary/80" />
            <span>Gestión, reservas y control en un solo lugar</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
