import Link from "next/link";
import type { ObjectId } from "mongodb";
import {
  ArrowRight, CalendarCheck2, CalendarClock, Clock, Euro, Gauge, Hourglass, Languages, Sparkles, UserPlus, UsersRound,
} from "lucide-react";
import { connectDB } from "@/lib/db";
import { getAccess, scopedRooms } from "@/lib/access";
import { RoomsCharts, type MonthPoint } from "@/components/dashboard/charts";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

/* ───────── Fechas: las sesiones se guardan como hora de pared en UTC ───────── */
const TZ = "Europe/Madrid";
function todayParts() {
  const [y, m, d] = new Intl.DateTimeFormat("sv-SE", { timeZone: TZ }).format(new Date()).split("-").map(Number);
  return { y, m: m - 1, d };
}
const utcDay = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));
const p2 = (n: number) => String(n).padStart(2, "0");
const hhmm = (d: Date) => `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`;
const eur = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
const DAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

type Resv = {
  _id: ObjectId; roomId: ObjectId; start: Date; end: Date; players: number; price?: number; status?: string;
  language?: string; customerId?: ObjectId; createdAt?: Date; notes?: string;
};

async function loadDashboard(roomIds: ObjectId[], rooms: { _id: ObjectId; name: string; schedule?: any }[]) {
  const db = await connectDB();
  const { y, m, d } = todayParts();
  const today = utcDay(y, m, d);
  const tomorrow = utcDay(y, m, d + 1);
  const weekday = (today.getUTCDay() + 6) % 7; // 0 = lunes
  const weekStart = utcDay(y, m, d - weekday);
  const weekEnd = utcDay(y, m, d - weekday + 7);
  const monthStart = utcDay(y, m, 1);
  const nextMonth = utcDay(y, m + 1, 1);
  const prevMonthStart = utcDay(y, m - 1, 1);
  const sixMonthsAgo = utcDay(y, m - 5, 1);
  const in7 = utcDay(y, m, d + 7);

  const R = db.collection<Resv>("reservations");
  const inScope = { roomId: { $in: roomIds } };
  const active = { ...inScope, status: { $ne: "cancelada" } };

  const [todayList, weekList, monthCount, prevMonthCount, monthRevenueAgg, pending, next7, monthlyRows, byStatus, byLanguage, recent, newCustomers, revenueByRoom] =
    await Promise.all([
      R.find({ ...inScope, start: { $gte: today, $lt: tomorrow } }).sort({ start: 1 }).toArray(),
      R.find({ ...active, start: { $gte: weekStart, $lt: weekEnd } }, { projection: { start: 1 } }).toArray(),
      R.countDocuments({ ...active, start: { $gte: monthStart, $lt: nextMonth } }),
      R.countDocuments({ ...active, start: { $gte: prevMonthStart, $lt: monthStart } }),
      R.aggregate([{ $match: { ...active, start: { $gte: monthStart, $lt: nextMonth } } }, { $group: { _id: null, total: { $sum: "$price" } } }]).toArray(),
      R.countDocuments({ ...inScope, status: "pendiente", start: { $gte: today } }),
      R.aggregate([
        { $match: { ...active, start: { $gte: today, $lt: in7 } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$start" } }, count: { $sum: 1 }, players: { $sum: "$players" } } },
      ]).toArray(),
      R.aggregate([
        { $match: { ...active, start: { $gte: sixMonthsAgo, $lt: nextMonth } } },
        { $group: { _id: { y: { $year: "$start" }, m: { $month: "$start" } }, count: { $sum: 1 }, revenue: { $sum: "$price" } } },
      ]).toArray(),
      R.aggregate([{ $match: { ...inScope, start: { $gte: monthStart, $lt: nextMonth } } }, { $group: { _id: "$status", n: { $sum: 1 } } }]).toArray(),
      R.aggregate([{ $match: { ...active, start: { $gte: sixMonthsAgo } } }, { $group: { _id: "$language", n: { $sum: 1 } } }]).toArray(),
      R.find({ ...inScope, createdAt: { $exists: true } }).sort({ createdAt: -1 }).limit(6).toArray(),
      db.collection("reservations").distinct("customerId", { ...inScope, createdAt: { $gte: monthStart } }).then(async (ids) => {
        const valid = ids.filter(Boolean);
        return db.collection("customers").countDocuments({ _id: { $in: valid }, createdAt: { $gte: monthStart } });
      }),
      R.aggregate([{ $match: active }, { $group: { _id: "$roomId", revenue: { $sum: "$price" }, count: { $sum: 1 } } }]).toArray(),
    ]);

  // Clientes de las reservas mostradas
  const custIds = [...todayList, ...recent].map((r) => r.customerId).filter(Boolean) as ObjectId[];
  const customers = await db.collection("customers").find({ _id: { $in: custIds } }, { projection: { name: 1, phone: 1 } }).toArray();
  const custName = new Map(customers.map((c) => [String(c._id), c.name as string]));
  const roomName = new Map(rooms.map((r) => [String(r._id), r.name]));

  // Ocupación de la semana: sesiones reservadas / franjas del horario semanal
  let weekSlots = 0;
  for (let i = 0; i < 7; i++) {
    const day = utcDay(y, m, d - weekday + i);
    const key = DAY_KEYS[day.getUTCDay()];
    const ymd = day.toISOString().slice(0, 10);
    for (const r of rooms) {
      const s = r.schedule ?? {};
      if (s.daysOff?.some((x: { date: string }) => x.date === ymd)) continue;
      const ov = s.overrides?.find((x: { date: string }) => x.date === ymd);
      weekSlots += (ov ? ov.slots : s.template?.[key])?.length ?? 0;
    }
  }

  const monthly: MonthPoint[] = Array.from({ length: 6 }, (_, i) => {
    const dt = utcDay(y, m - 5 + i, 1);
    const row = monthlyRows.find((r) => r._id.y === dt.getUTCFullYear() && r._id.m === dt.getUTCMonth() + 1);
    return {
      key: `${dt.getUTCFullYear()}-${dt.getUTCMonth() + 1}`,
      label: dt.toLocaleDateString("es-ES", { month: "short", timeZone: "UTC" }).replace(".", ""),
      count: row?.count ?? 0,
      revenue: row?.revenue ?? 0,
    };
  });

  const days = Array.from({ length: 7 }, (_, i) => {
    const dt = utcDay(y, m, d + i);
    const key = dt.toISOString().slice(0, 10);
    const row = next7.find((r) => r._id === key);
    return {
      key,
      label: i === 0 ? "Hoy" : i === 1 ? "Mañana" : dt.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", timeZone: "UTC" }),
      count: row?.count ?? 0,
      players: row?.players ?? 0,
    };
  });

  return {
    today,
    todayList: todayList.map((r) => ({ ...r, roomName: roomName.get(String(r.roomId)) ?? "Sala", customer: r.customerId ? custName.get(String(r.customerId)) : undefined })),
    weekCount: weekList.length,
    weekSlots,
    monthCount,
    prevMonthCount,
    monthRevenue: monthRevenueAgg[0]?.total ?? 0,
    pending,
    days,
    monthly,
    byStatus: Object.fromEntries(byStatus.map((s) => [s._id ?? "pendiente", s.n])) as Record<string, number>,
    byLanguage: Object.fromEntries(byLanguage.map((s) => [s._id ?? "es", s.n])) as Record<string, number>,
    recent: recent.map((r) => ({ ...r, roomName: roomName.get(String(r.roomId)) ?? "Sala", customer: r.customerId ? custName.get(String(r.customerId)) : undefined })),
    newCustomers,
    byRoom: revenueByRoom.map((r) => ({ name: roomName.get(String(r._id)) ?? "Sala", revenue: r.revenue ?? 0, count: r.count })),
  };
}

/* ───────── UI ───────── */
const STATUS: Record<string, { label: string; dot: string; chip: string }> = {
  pendiente: { label: "Pendiente", dot: "bg-amber-500", chip: "bg-amber-500/10 text-amber-700" },
  confirmada: { label: "Confirmada", dot: "bg-emerald-500", chip: "bg-emerald-500/10 text-emerald-700" },
  cancelada: { label: "Cancelada", dot: "bg-rose-400", chip: "bg-rose-500/10 text-rose-700" },
};
const LANG: Record<string, string> = { es: "Español", en: "Inglés", ru: "Ruso" };

function Kpi({ icon: Icon, label, value, hint, tone }: { icon: typeof Euro; label: string; value: string; hint?: React.ReactNode; tone?: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{label}</p>
        <span className={cn("flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary", tone)}><Icon className="size-4" /></span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums sm:text-3xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SplitBar({ title, icon: Icon, parts }: { title: string; icon: typeof Euro; parts: { label: string; value: number; color: string }[] }) {
  const total = parts.reduce((n, p) => n + p.value, 0);
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm">
      <h2 className="mb-4 flex items-center gap-2 font-semibold"><Icon className="size-4 text-primary" />{title}</h2>
      {total === 0 ? (
        <p className="text-sm text-muted-foreground">Sin datos.</p>
      ) : (
        <>
          <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={parts.map((p) => `${p.label}: ${p.value}`).join(", ")}>
            {parts.filter((p) => p.value).map((p) => (
              <span key={p.label} className={p.color} style={{ width: `${(p.value / total) * 100}%` }} title={`${p.label}: ${p.value}`} />
            ))}
          </div>
          <ul className="mt-4 space-y-2 text-sm">
            {parts.map((p) => (
              <li key={p.label} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2"><span className={cn("size-2.5 rounded-full", p.color)} />{p.label}</span>
                <span className="tabular-nums text-muted-foreground">{p.value} · {Math.round((p.value / total) * 100)} %</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export default async function DashboardHome() {
  const access = await getAccess();
  if (!access) return null; // el layout redirige al login
  const db = await connectDB();
  const rooms = (await scopedRooms(db, access)) as { _id: ObjectId; name: string }[];
  const full = await db.collection("rooms").find({ _id: { $in: rooms.map((r) => r._id) } }, { projection: { name: 1, schedule: 1 } }).toArray();
  const data = await loadDashboard(full.map((r) => r._id as ObjectId), full as never);
  const isAdmin = access.isAdmin;

  const delta = data.prevMonthCount ? Math.round(((data.monthCount - data.prevMonthCount) / data.prevMonthCount) * 100) : null;
  const occupancy = data.weekSlots ? Math.round((data.weekCount / data.weekSlots) * 100) : 0;
  const todayPlayers = data.todayList.filter((r) => r.status !== "cancelada").reduce((n, r) => n + (r.players || 0), 0);
  const maxDay = Math.max(1, ...data.days.map((x) => x.count));
  const hour = Number(new Intl.DateTimeFormat("es-ES", { hour: "numeric", hour12: false, timeZone: TZ }).format(new Date()));
  const greeting = hour < 14 ? "Buenos días" : hour < 21 ? "Buenas tardes" : "Buenas noches";
  const nowWall = (() => {
    const t = new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
    const [h, mi] = t.split(":").map(Number);
    return new Date(data.today.getTime() + (h * 60 + mi) * 60000);
  })();
  const todayLabel = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: TZ }).format(new Date());

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm capitalize text-muted-foreground">{todayLabel}</p>
          <h1 className="text-2xl font-semibold tracking-tight">{greeting}, {access.name.split(" ")[0]}</h1>
        </div>
        <p className="text-sm text-muted-foreground">{access.escapes.join(" · ")}</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi icon={CalendarClock} label="Hoy" value={String(data.todayList.filter((r) => r.status !== "cancelada").length)} hint={`${todayPlayers} jugadores`} />
        <Kpi icon={CalendarCheck2} label="Esta semana" value={String(data.weekCount)} hint={`de ${data.weekSlots} sesiones posibles`} />
        <Kpi
          icon={Sparkles}
          label="Este mes"
          value={String(data.monthCount)}
          hint={delta === null ? "reservas" : <span className={delta >= 0 ? "text-emerald-700" : "text-rose-700"}>{delta >= 0 ? "▲" : "▼"} {Math.abs(delta)} % vs. mes anterior</span>}
        />
        {isAdmin && <Kpi icon={Euro} label="Facturado este mes" value={eur(data.monthRevenue)} hint="sin canceladas" />}
        <Kpi icon={Hourglass} label="Por confirmar" value={String(data.pending)} hint="reservas pendientes futuras" tone={data.pending ? "bg-amber-500/10 text-amber-700" : undefined} />
        <Kpi icon={UserPlus} label="Clientes nuevos" value={String(data.newCustomers)} hint="este mes" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {/* Agenda de hoy */}
        <section className="rounded-2xl border bg-card shadow-sm">
          <header className="flex items-center justify-between gap-3 border-b px-5 py-4">
            <h2 className="flex items-center gap-2 font-semibold"><Clock className="size-4 text-primary" />Agenda de hoy</h2>
            <Link href="/dashboard/reservations" className="flex items-center gap-1 text-sm text-primary hover:underline">Calendario <ArrowRight className="size-3.5" /></Link>
          </header>
          {data.todayList.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">No hay sesiones hoy.</p>
          ) : (
            <ol className="divide-y">
              {data.todayList.map((r) => {
                const st = STATUS[r.status ?? "pendiente"] ?? STATUS.pendiente;
                const isNow = nowWall >= r.start && nowWall < r.end && r.status !== "cancelada";
                const past = nowWall >= r.end;
                return (
                  <li key={String(r._id)} className={cn("flex items-center gap-4 px-5 py-3", (past || r.status === "cancelada") && "opacity-55", isNow && "bg-primary/5")}>
                    <div className="w-14 shrink-0 text-center">
                      <p className="font-semibold tabular-nums">{hhmm(r.start)}</p>
                      <p className="text-xs tabular-nums text-muted-foreground">{hhmm(r.end)}</p>
                    </div>
                    <span className={cn("h-10 w-1 shrink-0 rounded-full", st.dot)} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 font-medium">
                        <span className="truncate">{r.roomName}</span>
                        {isNow && <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase text-primary-foreground">En juego</span>}
                        {r.language && r.language !== "es" && <span className="rounded bg-sky-500/10 px-1.5 text-[10px] font-bold text-sky-700">{r.language.toUpperCase()}</span>}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">{r.customer ?? "Sin cliente"}{r.notes ? ` · ${r.notes}` : ""}</p>
                    </div>
                    <span className="hidden shrink-0 items-center gap-1 text-sm text-muted-foreground sm:flex"><UsersRound className="size-4" />{r.players}</span>
                    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-medium", st.chip)}>{st.label}</span>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <div className="space-y-6">
          {/* Próximos 7 días */}
          <section className="rounded-2xl border bg-card p-5 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 font-semibold"><CalendarCheck2 className="size-4 text-primary" />Próximos 7 días</h2>
            <div className="flex h-32 items-end gap-2">
              {data.days.map((x) => (
                <div key={x.key} className="flex flex-1 flex-col items-center gap-1.5" title={`${x.label}: ${x.count} sesiones, ${x.players} jugadores`}>
                  <span className="text-xs font-medium tabular-nums">{x.count || ""}</span>
                  <span className="w-full max-w-6 rounded-t bg-primary" style={{ height: `${Math.max((x.count / maxDay) * 80, x.count ? 4 : 0)}px` }} />
                  <span className="text-[11px] capitalize text-muted-foreground">{x.label}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Ocupación */}
          <section className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-semibold"><Gauge className="size-4 text-primary" />Ocupación esta semana</h2>
              <span className="text-2xl font-semibold tabular-nums">{occupancy} %</span>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted">
              <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.min(100, occupancy)}%` }} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{data.weekCount} sesiones reservadas de {data.weekSlots} franjas del horario</p>
          </section>
        </div>
      </div>

      {/* Gráficas */}
      {isAdmin ? (
        <RoomsCharts monthly={data.monthly} byRoom={data.byRoom} />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <SplitBar
          title="Estado este mes"
          icon={CalendarCheck2}
          parts={[
            { label: "Confirmadas", value: data.byStatus.confirmada ?? 0, color: "bg-emerald-500" },
            { label: "Pendientes", value: data.byStatus.pendiente ?? 0, color: "bg-amber-500" },
            { label: "Canceladas", value: data.byStatus.cancelada ?? 0, color: "bg-rose-400" },
          ]}
        />
        <SplitBar
          title="Idioma de las partidas"
          icon={Languages}
          parts={Object.entries(LANG).map(([k, label], i) => ({ label, value: data.byLanguage[k] ?? 0, color: ["bg-primary", "bg-sky-500", "bg-fuchsia-600"][i] }))}
        />

        {/* Actividad reciente */}
        <section className="rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 font-semibold"><Sparkles className="size-4 text-primary" />Últimas reservas creadas</h2>
          {data.recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin actividad.</p>
          ) : (
            <ul className="space-y-3">
              {data.recent.map((r) => (
                <li key={String(r._id)} className="flex items-start justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{r.customer ?? "Sin cliente"}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {r.roomName} · {r.start.toLocaleDateString("es-ES", { day: "numeric", month: "short", timeZone: "UTC" })} {hhmm(r.start)}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {r.createdAt ? new Intl.RelativeTimeFormat("es", { numeric: "auto" }).format(-Math.round((Date.now() - new Date(r.createdAt).getTime()) / 86400000), "day") : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
