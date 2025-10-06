"use client";

import { DoorOpen, CalendarDays, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 p-6">
      {/* LOGO */}
      <div className="flex items-center gap-3 mb-12">
        <div className="p-3 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 shadow-md">
          <DoorOpen className="h-10 w-10 text-white" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-slate-800 dark:text-white">
          Escape CRM
        </h1>
      </div>

      {/* CONTENEDOR DE CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 w-full max-w-5xl px-4">
        {/* CARD 1 */}
        <Link href="/bookings" className="group">
          <Card
            className="relative overflow-hidden border-none shadow-xl backdrop-blur-xl bg-white/70 dark:bg-slate-800/70 rounded-3xl transition-all hover:scale-[1.03] hover:shadow-2xl hover:bg-white/90 dark:hover:bg-slate-800/90"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10 opacity-70 group-hover:opacity-100 transition-opacity" />
            <CardHeader className="relative z-10 flex flex-col items-center text-center p-10">
              <div className="p-5 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 mb-6 shadow-lg">
                <CalendarDays className="h-10 w-10 text-white" />
              </div>
              <CardTitle className="text-2xl font-semibold mb-2 text-slate-800 dark:text-white">
                Hacer una Reserva
              </CardTitle>
              <CardDescription className="text-slate-600 dark:text-slate-300 text-base">
                Gestiona y crea nuevas reservas de forma rápida y visual
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        {/* CARD 2 */}
        <Link href="/dashboard/rooms" className="group">
          <Card
            className="relative overflow-hidden border-none shadow-xl backdrop-blur-xl bg-white/70 dark:bg-slate-800/70 rounded-3xl transition-all hover:scale-[1.03] hover:shadow-2xl hover:bg-white/90 dark:hover:bg-slate-800/90"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 opacity-70 group-hover:opacity-100 transition-opacity" />
            <CardHeader className="relative z-10 flex flex-col items-center text-center p-10">
              <div className="p-5 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-500 mb-6 shadow-lg">
                <LayoutDashboard className="h-10 w-10 text-white" />
              </div>
              <CardTitle className="text-2xl font-semibold mb-2 text-slate-800 dark:text-white">
                Dashboard CRM
              </CardTitle>
              <CardDescription className="text-slate-600 dark:text-slate-300 text-base">
                Accede al panel de control y gestiona tus salas y reservas
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>

      <footer className="mt-16 text-sm text-slate-500 dark:text-slate-400">
        © {new Date().getFullYear()} Escape CRM — Todos los derechos reservados
      </footer>
    </div>
  );
}
