"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CalendarRange, ClipboardList, Clock3, Download, LogIn, LogOut, Printer, Timer, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Employee = { _id: string; name?: string; surname?: string; username?: string };
type CheckRecord = { employeeId: string; type: "in" | "out"; time: string; employee?: Employee };

type Shift = {
  employeeId: string;
  name: string;
  inAt: Date | null;
  outAt: Date | null;
  minutes: number | null;
  issue: "sin-salida" | "sin-entrada" | "abierto" | "largo" | null;
};

const ISSUE_LABEL: Record<NonNullable<Shift["issue"]>, string> = {
  "sin-salida": "Falta la salida",
  "sin-entrada": "Salida sin entrada",
  abierto: "Trabajando ahora",
  largo: "Turno de más de 12 h",
};

const dayKey = (d: Date) => d.toLocaleDateString("sv-SE");
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const fmtTime = (d: Date | null) => (d ? d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : "—");
const fmtDate = (d: Date) => d.toLocaleDateString("es-ES", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
export const fmtHours = (min: number) => `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, "0")} min`;
const empName = (e?: Employee) => [e?.name, e?.surname].filter(Boolean).join(" ") || e?.username || "Empleado";

const PRESETS: { v: string; label: string; range: () => [Date, Date] }[] = [
  { v: "week", label: "Esta semana", range: () => { const t = startOfDay(new Date()); const m = addDays(t, -((t.getDay() + 6) % 7)); return [m, addDays(m, 6)]; } },
  { v: "last-week", label: "Semana pasada", range: () => { const t = startOfDay(new Date()); const m = addDays(t, -((t.getDay() + 6) % 7) - 7); return [m, addDays(m, 6)]; } },
  { v: "month", label: "Este mes", range: () => { const t = new Date(); return [new Date(t.getFullYear(), t.getMonth(), 1), new Date(t.getFullYear(), t.getMonth() + 1, 0)]; } },
  { v: "last-month", label: "Mes pasado", range: () => { const t = new Date(); return [new Date(t.getFullYear(), t.getMonth() - 1, 1), new Date(t.getFullYear(), t.getMonth(), 0)]; } },
];

/** Empareja entradas y salidas de cada empleado en turnos */
export function buildShifts(records: CheckRecord[], now = new Date()): Shift[] {
  const byEmp = new Map<string, CheckRecord[]>();
  for (const r of records) {
    const id = String(r.employeeId);
    byEmp.set(id, [...(byEmp.get(id) ?? []), r]);
  }
  const shifts: Shift[] = [];
  for (const [id, list] of byEmp) {
    const sorted = [...list].sort((a, b) => +new Date(a.time) - +new Date(b.time));
    const name = empName(sorted[0]?.employee);
    let open: Date | null = null;
    for (const r of sorted) {
      const t = new Date(r.time);
      if (r.type === "in") {
        if (open) shifts.push({ employeeId: id, name, inAt: open, outAt: null, minutes: null, issue: "sin-salida" });
        open = t;
      } else if (open) {
        const minutes = (t.getTime() - open.getTime()) / 60000;
        shifts.push({ employeeId: id, name, inAt: open, outAt: t, minutes, issue: minutes > 12 * 60 ? "largo" : null });
        open = null;
      } else {
        shifts.push({ employeeId: id, name, inAt: null, outAt: t, minutes: null, issue: "sin-entrada" });
      }
    }
    if (open) {
      const sameDay = dayKey(open) === dayKey(now);
      shifts.push({
        employeeId: id, name, inAt: open, outAt: null,
        minutes: sameDay ? (now.getTime() - open.getTime()) / 60000 : null,
        issue: sameDay ? "abierto" : "sin-salida",
      });
    }
  }
  return shifts.sort((a, b) => +(b.inAt ?? b.outAt!) - +(a.inAt ?? a.outAt!));
}

export function CheckinReport({ employees, records }: { employees: Employee[]; records: CheckRecord[] }) {
  const [preset, setPreset] = useState("month");
  const [from, setFrom] = useState(() => dayKey(PRESETS[2].range()[0]));
  const [to, setTo] = useState(() => dayKey(PRESETS[2].range()[1]));
  const [employee, setEmployee] = useState("__all__");
  const [onlyIssues, setOnlyIssues] = useState(false);

  const allShifts = useMemo(() => buildShifts(records), [records]);
  const shifts = useMemo(() => {
    const a = new Date(`${from}T00:00:00`);
    const b = addDays(new Date(`${to}T00:00:00`), 1);
    return allShifts.filter((s) => {
      const t = s.inAt ?? s.outAt!;
      return t >= a && t < b && (employee === "__all__" || s.employeeId === employee) && (!onlyIssues || (s.issue && s.issue !== "abierto"));
    });
  }, [allShifts, from, to, employee, onlyIssues]);

  const summary = useMemo(() => {
    const m = new Map<string, { id: string; name: string; minutes: number; shifts: number; days: Set<string>; issues: number }>();
    for (const s of shifts) {
      const e = m.get(s.employeeId) ?? { id: s.employeeId, name: s.name, minutes: 0, shifts: 0, days: new Set<string>(), issues: 0 };
      if (s.minutes !== null && s.issue !== "abierto") e.minutes += s.minutes;
      e.shifts += 1;
      e.days.add(dayKey(s.inAt ?? s.outAt!));
      if (s.issue && s.issue !== "abierto") e.issues += 1;
      m.set(s.employeeId, e);
    }
    return [...m.values()].sort((a, b) => b.minutes - a.minutes);
  }, [shifts]);
  const totalMin = summary.reduce((n, e) => n + e.minutes, 0);
  const totalIssues = summary.reduce((n, e) => n + e.issues, 0);
  const maxMin = Math.max(1, ...summary.map((e) => e.minutes));

  function choose(v: string) {
    setPreset(v);
    const [a, b] = PRESETS.find((p) => p.v === v)!.range();
    setFrom(dayKey(a));
    setTo(dayKey(b));
  }

  const csvRows = () =>
    shifts.map((s) => [
      s.name, dayKey(s.inAt ?? s.outAt!), fmtTime(s.inAt), fmtTime(s.outAt),
      s.minutes !== null && s.issue !== "abierto" ? (s.minutes / 60).toFixed(2).replace(".", ",") : "",
      s.issue ? ISSUE_LABEL[s.issue] : "",
    ]);

  function exportCsv() {
    const head = ["Empleado", "Fecha", "Entrada", "Salida", "Horas", "Incidencia"];
    const resumen = summary.map((e) => [e.name, "", "", `${e.days.size} días · ${e.shifts} turnos`, (e.minutes / 60).toFixed(2).replace(".", ","), e.issues ? `${e.issues} incidencias` : ""]);
    const all = [head, ...csvRows(), [], ["RESUMEN"], ...resumen];
    const blob = new Blob(["﻿" + all.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `fichajes_${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function print() {
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Informe de fichajes ${from} – ${to}</title>
      <style>body{font-family:system-ui,sans-serif;margin:32px;color:#111}h1{font-size:20px;margin:0}p{color:#555;margin:4px 0 20px}
      table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:28px}th,td{border-bottom:1px solid #ddd;padding:6px 8px;text-align:left}
      th{background:#f4f4f6}td.n{text-align:right;font-variant-numeric:tabular-nums}.warn{color:#b45309}h2{font-size:15px}</style></head><body>
      <h1>Informe de fichajes</h1><p>Del ${new Date(from + "T00:00:00").toLocaleDateString("es-ES")} al ${new Date(to + "T00:00:00").toLocaleDateString("es-ES")} · Total ${fmtHours(totalMin)}</p>
      <h2>Resumen por empleado</h2><table><tr><th>Empleado</th><th>Días</th><th>Turnos</th><th>Horas</th><th>Incidencias</th></tr>
      ${summary.map((e) => `<tr><td>${esc(e.name)}</td><td class="n">${e.days.size}</td><td class="n">${e.shifts}</td><td class="n">${fmtHours(e.minutes)}</td><td class="n">${e.issues || ""}</td></tr>`).join("")}</table>
      <h2>Detalle de turnos</h2><table><tr><th>Empleado</th><th>Fecha</th><th>Entrada</th><th>Salida</th><th>Duración</th><th>Incidencia</th></tr>
      ${shifts.map((s) => `<tr><td>${esc(s.name)}</td><td>${fmtDate(s.inAt ?? s.outAt!)}</td><td>${fmtTime(s.inAt)}</td><td>${fmtTime(s.outAt)}</td><td class="n">${s.minutes !== null ? fmtHours(s.minutes) : "—"}</td><td class="warn">${s.issue ? ISSUE_LABEL[s.issue] : ""}</td></tr>`).join("")}</table>
      <p style="margin-top:40px">Firma de la empresa: ____________________ &nbsp;&nbsp; Firma del trabajador: ____________________</p>
      <script>window.onload=()=>window.print()</script></body></html>`);
    w.document.close();
  }

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="size-5 text-primary" />
          <div>
            <h2 className="font-semibold">Informe de fichajes</h2>
            <p className="text-xs text-muted-foreground">Turnos (entrada → salida), horas por empleado e incidencias.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!shifts.length}><Download className="size-4" /> CSV / Excel</Button>
          <Button variant="outline" size="sm" onClick={print} disabled={!shifts.length}><Printer className="size-4" /> Imprimir / PDF</Button>
        </div>
      </section>

      <section className="flex flex-wrap items-center gap-2">
        <div className="inline-flex flex-wrap rounded-xl bg-muted p-1">
          {PRESETS.map((p) => (
            <button key={p.v} type="button" onClick={() => choose(p.v)} className={cn("rounded-lg px-3 py-1.5 text-sm font-medium", preset === p.v ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}>{p.label}</button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <CalendarRange className="size-4 text-muted-foreground" />
          <Input type="date" aria-label="Desde" value={from} max={to} onChange={(e) => { setPreset("custom"); setFrom(e.target.value); }} className="h-9 w-[150px]" />
          <span className="text-muted-foreground">–</span>
          <Input type="date" aria-label="Hasta" value={to} min={from} onChange={(e) => { setPreset("custom"); setTo(e.target.value); }} className="h-9 w-[150px]" />
        </div>
        <Select value={employee} onValueChange={setEmployee}>
          <SelectTrigger aria-label="Empleado" className="h-9 w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos los empleados</SelectItem>
            {employees.map((e) => <SelectItem key={e._id} value={e._id}>{empName(e)}</SelectItem>)}
          </SelectContent>
        </Select>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-primary" checked={onlyIssues} onChange={(e) => setOnlyIssues(e.target.checked)} /> Solo incidencias
        </label>
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat icon={Timer} label="Horas totales" value={fmtHours(totalMin)} />
        <Stat icon={Users} label="Empleados con fichajes" value={String(summary.length)} />
        <Stat icon={AlertTriangle} label="Incidencias" value={String(totalIssues)} warn={totalIssues > 0} onClick={totalIssues ? () => setOnlyIssues(true) : undefined} />
      </div>

      {summary.length > 0 && (
        <section className="rounded-2xl border bg-card p-5 shadow-sm">
          <h3 className="mb-3 font-semibold">Horas por empleado</h3>
          <ul className="space-y-3">
            {summary.map((e) => (
              <li key={e.id}>
                <button type="button" onClick={() => setEmployee(employee === e.id ? "__all__" : e.id)} className="w-full text-left">
                  <div className="flex flex-wrap justify-between gap-2 text-sm">
                    <span className="font-medium">{e.name}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {e.days.size} días · {e.shifts} turnos · media {fmtHours(e.days.size ? e.minutes / e.days.size : 0)}/día ·{" "}
                      <span className="font-semibold text-foreground">{fmtHours(e.minutes)}</span>
                      {e.issues > 0 && <span className="ml-2 text-amber-700">⚠ {e.issues}</span>}
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${(e.minutes / maxMin) * 100}%` }} />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-4 py-3">Empleado</th><th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Entrada</th><th className="px-4 py-3">Salida</th><th className="px-4 py-3 text-right">Duración</th><th className="px-4 py-3">Incidencia</th></tr>
            </thead>
            <tbody className="divide-y">
              {shifts.map((s, i) => (
                <tr key={i} className={cn("hover:bg-muted/30", s.issue && s.issue !== "abierto" && "bg-amber-50/50")}>
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3 capitalize text-muted-foreground">{fmtDate(s.inAt ?? s.outAt!)}</td>
                  <td className="px-4 py-3"><span className="flex items-center gap-1.5"><LogIn className="size-3.5 text-emerald-600" />{fmtTime(s.inAt)}</span></td>
                  <td className="px-4 py-3"><span className="flex items-center gap-1.5"><LogOut className="size-3.5 text-rose-600" />{fmtTime(s.outAt)}</span></td>
                  <td className="px-4 py-3 text-right tabular-nums">{s.minutes !== null ? fmtHours(s.minutes) : "—"}</td>
                  <td className="px-4 py-3">
                    {s.issue && (
                      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", s.issue === "abierto" ? "bg-emerald-500/10 text-emerald-700" : "bg-amber-500/10 text-amber-800")}>
                        {s.issue === "abierto" ? <Clock3 className="size-3" /> : <AlertTriangle className="size-3" />}{ISSUE_LABEL[s.issue]}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {shifts.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No hay fichajes en este periodo.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({ icon: Icon, label, value, warn, onClick }: { icon: typeof Timer; label: string; value: string; warn?: boolean; onClick?: () => void }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag type={onClick ? "button" : undefined} onClick={onClick} className="flex items-center gap-3 rounded-2xl border bg-card p-4 text-left shadow-sm">
      <span className={cn("flex size-10 items-center justify-center rounded-xl", warn ? "bg-amber-500/10 text-amber-700" : "bg-primary/10 text-primary")}><Icon className="size-5" /></span>
      <span>
        <span className="block text-sm text-muted-foreground">{label}</span>
        <span className="text-xl font-semibold tabular-nums">{value}</span>
      </span>
    </Tag>
  );
}
