"use client";

import { useEffect, useMemo, useState } from "react";
import { format, isToday } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import {
  Clock3,
  LogIn,
  LogOut,
  Search,
  Users,
  Activity,
  CheckCircle2,
  Loader2,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Employee = any;
type CheckRecord = any;

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  game_master: "Game Master",
};

const initials = (e?: Employee) =>
  `${e?.name?.[0] ?? ""}${e?.surname?.[0] ?? ""}`.toUpperCase() || "?";

function elapsed(from: Date, now: Date) {
  const mins = Math.max(0, Math.floor((now.getTime() - from.getTime()) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h} h ${m.toString().padStart(2, "0")} min` : `${m} min`;
}

function EmployeeAvatar({ employee, className }: { employee?: Employee; className?: string }) {
  return (
    <Avatar className={className}>
      <AvatarImage src={employee?.avatar || "/avatar-default.png"} alt="" />
      <AvatarFallback className="bg-primary/10 font-medium text-primary">
        {initials(employee)}
      </AvatarFallback>
    </Avatar>
  );
}

export function CheckinPanel({
  employees,
  records,
  active,
  onRegistered,
}: {
  employees: Employee[];
  records: CheckRecord[];
  active: CheckRecord[];
  onRegistered: () => Promise<void> | void;
}) {
  const [now, setNow] = useState(() => new Date());
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [submitting, setSubmitting] = useState<"in" | "out" | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const activeById = useMemo(() => {
    const map = new Map<string, CheckRecord>();
    for (const r of active) map.set(String(r.employeeId), r);
    return map;
  }, [active]);

  const todayRecords = useMemo(
    () => records.filter((r) => isToday(new Date(r.time))),
    [records]
  );
  const todayIn = todayRecords.filter((r) => r.type === "in").length;
  const todayOut = todayRecords.length - todayIn;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? employees.filter((e) =>
          `${e.name} ${e.surname} ${e.username ?? ""}`.toLowerCase().includes(q)
        )
      : employees;
    // Primero los que están en turno, luego alfabético
    return [...list].sort((a, b) => {
      const aa = activeById.has(String(a._id)) ? 0 : 1;
      const bb = activeById.has(String(b._id)) ? 0 : 1;
      return aa - bb || `${a.name} ${a.surname}`.localeCompare(`${b.name} ${b.surname}`, "es");
    });
  }, [employees, query, activeById]);

  const selected = employees.find((e) => String(e._id) === selectedId);
  const selectedActive = selected ? activeById.get(String(selected._id)) : undefined;

  async function register(type: "in" | "out") {
    if (!selected) return;
    setSubmitting(type);
    try {
      const res = await fetch("/api/employees/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: selected._id, type }),
      });
      if (!res.ok) throw new Error();
      toast.success(
        type === "in"
          ? `Entrada registrada · ${selected.name}`
          : `Salida registrada · ${selected.name}`,
        { description: format(new Date(), "HH:mm 'h'") }
      );
      setSelectedId("");
      setQuery("");
      await onRegistered();
    } catch {
      toast.error("Error al registrar el fichaje");
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* ───── Cabecera: reloj + resumen del día ───── */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,2fr)]">
        <Card className="overflow-hidden border-0 bg-primary text-primary-foreground shadow-md">
          <CardContent className="flex h-full items-center justify-between gap-4 p-6">
            <div>
              <p className="text-xs font-medium uppercase tracking-widest opacity-75">
                Hora actual
              </p>
              <p className="mt-1 font-mono text-4xl font-semibold tabular-nums sm:text-5xl">
                {format(now, "HH:mm")}
                <span className="text-2xl opacity-60 sm:text-3xl">:{format(now, "ss")}</span>
              </p>
              <p className="mt-1 text-sm capitalize opacity-80">
                {format(now, "EEEE, d 'de' MMMM", { locale: es })}
              </p>
            </div>
            <Clock3 className="h-14 w-14 shrink-0 opacity-20" aria-hidden />
          </CardContent>
        </Card>

        <div className="grid grid-cols-3 gap-3">
          <StatTile
            label="En turno"
            value={active.length}
            icon={<Users className="h-4 w-4" />}
            tone="emerald"
          />
          <StatTile
            label="Entradas hoy"
            value={todayIn}
            icon={<LogIn className="h-4 w-4" />}
            tone="primary"
          />
          <StatTile
            label="Salidas hoy"
            value={todayOut}
            icon={<LogOut className="h-4 w-4" />}
            tone="rose"
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {/* ───── Registrar fichaje ───── */}
        <Card>
          <CardHeader className="gap-3 pb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <LogIn className="h-5 w-5 text-primary" />
                Registrar fichaje
              </CardTitle>
              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar empleado…"
                  aria-label="Buscar empleado"
                  className="h-10 pl-9"
                />
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* Rejilla de empleados */}
            {filtered.length === 0 ? (
              <p className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
                {employees.length === 0 ? "No hay empleados registrados." : "Ningún empleado coincide con la búsqueda."}
              </p>
            ) : (
              <div
                role="radiogroup"
                aria-label="Empleado"
                className="grid max-h-[340px] grid-cols-2 gap-3 overflow-y-auto p-1 sm:grid-cols-3 xl:grid-cols-4"
              >
                {filtered.map((e) => {
                  const id = String(e._id);
                  const isActive = activeById.has(id);
                  const isSelected = id === selectedId;
                  return (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => setSelectedId(isSelected ? "" : id)}
                      className={cn(
                        "group relative flex flex-col items-center gap-2 rounded-xl border bg-card px-3 py-4 text-center transition-all",
                        "hover:border-primary/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        isSelected && "border-primary bg-primary/5 ring-2 ring-primary/30"
                      )}
                    >
                      {isSelected && (
                        <CheckCircle2 className="absolute right-2 top-2 h-4 w-4 text-primary" />
                      )}
                      <div className="relative">
                        <EmployeeAvatar employee={e} className="h-14 w-14" />
                        <span
                          className={cn(
                            "absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-card",
                            isActive ? "bg-emerald-500" : "bg-muted-foreground/30"
                          )}
                          aria-hidden
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium leading-tight">
                          {e.name} {e.surname}
                        </p>
                        <p
                          className={cn(
                            "mt-0.5 text-xs",
                            isActive ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                          )}
                        >
                          {isActive ? "En turno" : "Fuera de turno"}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Panel de acción */}
            <div
              className={cn(
                "rounded-2xl border p-4 transition-colors sm:p-5",
                selected ? "bg-muted/40" : "border-dashed"
              )}
            >
              {selected ? (
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-4">
                    <EmployeeAvatar employee={selected} className="h-14 w-14 border-2 border-primary/40" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-semibold">
                          {selected.name} {selected.surname}
                        </p>
                        <button
                          type="button"
                          onClick={() => setSelectedId("")}
                          aria-label="Quitar selección"
                          className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {ROLE_LABELS[selected.role] ?? "Empleado"}
                        {selected.escape ? ` · ${selected.escape}` : ""}
                      </p>
                      <p
                        className={cn(
                          "mt-1 text-sm",
                          selectedActive ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                        )}
                      >
                        {selectedActive
                          ? `En turno desde las ${format(new Date(selectedActive.time), "HH:mm")} · ${elapsed(new Date(selectedActive.time), now)}`
                          : "Actualmente fuera de turno"}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
                    <Button
                      size="lg"
                      onClick={() => register("in")}
                      disabled={!!submitting}
                      variant={selectedActive ? "outline" : "default"}
                      className={cn(
                        "h-12 sm:min-w-36",
                        !selectedActive && "bg-emerald-600 text-white hover:bg-emerald-700"
                      )}
                    >
                      {submitting === "in" ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <LogIn className="mr-2 h-5 w-5" />}
                      Entrada
                    </Button>
                    <Button
                      size="lg"
                      onClick={() => register("out")}
                      disabled={!!submitting}
                      variant={selectedActive ? "destructive" : "outline"}
                      className="h-12 sm:min-w-36"
                    >
                      {submitting === "out" ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <LogOut className="mr-2 h-5 w-5" />}
                      Salida
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  Selecciona un empleado para fichar su entrada o salida
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ───── Columna derecha ───── */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    {active.length > 0 && (
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                    )}
                    <span
                      className={cn(
                        "relative inline-flex h-2.5 w-2.5 rounded-full",
                        active.length > 0 ? "bg-emerald-500" : "bg-muted-foreground/40"
                      )}
                    />
                  </span>
                  En turno ahora
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {active.length}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {active.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Nadie está en turno en este momento.
                </p>
              ) : (
                <ul className="divide-y">
                  {active.map((r) => (
                    <li key={String(r._id)} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                      <EmployeeAvatar employee={r.employee} className="h-9 w-9" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {r.employee?.name} {r.employee?.surname}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Desde las {format(new Date(r.time), "HH:mm")}
                          {!isToday(new Date(r.time)) && ` (${format(new Date(r.time), "d MMM", { locale: es })})`}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium tabular-nums text-emerald-700 dark:text-emerald-400">
                        {elapsed(new Date(r.time), now)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4 text-primary" />
                Actividad de hoy
              </CardTitle>
            </CardHeader>
            <CardContent>
              {todayRecords.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Todavía no hay fichajes hoy.
                </p>
              ) : (
                <ol className="relative max-h-[320px] space-y-3 overflow-y-auto pr-1">
                  {todayRecords.slice(0, 20).map((r) => {
                    const isIn = r.type === "in";
                    return (
                      <li key={String(r._id)} className="flex items-center gap-3">
                        <span
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                            isIn
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                          )}
                          aria-hidden
                        >
                          {isIn ? <LogIn className="h-4 w-4" /> : <LogOut className="h-4 w-4" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {r.employee?.name} {r.employee?.surname}
                          </p>
                          <p className="text-xs text-muted-foreground">{isIn ? "Entrada" : "Salida"}</p>
                        </div>
                        <time className="shrink-0 font-mono text-sm tabular-nums text-muted-foreground">
                          {format(new Date(r.time), "HH:mm")}
                        </time>
                      </li>
                    );
                  })}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: "emerald" | "primary" | "rose";
}) {
  const tones = {
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    primary: "bg-primary/10 text-primary",
    rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  } as const;
  return (
    <Card className="shadow-sm">
      <CardContent className="flex h-full flex-col justify-between gap-3 p-4 sm:p-5">
        <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", tones[tone])}>{icon}</span>
        <div>
          <p className="text-2xl font-semibold tabular-nums sm:text-3xl">{value}</p>
          <p className="text-xs text-muted-foreground sm:text-sm">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
