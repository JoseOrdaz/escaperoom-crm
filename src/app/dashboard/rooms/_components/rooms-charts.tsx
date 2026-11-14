"use client";

import { useState } from "react";
import { BarChart3, TrendingUp } from "lucide-react";

export type MonthPoint = { key: string; label: string; count: number; revenue: number };
export type RoomRevenue = { name: string; revenue: number; count: number };

const eur = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

/** Escala "bonita" para el eje (0, paso, 2·paso…) */
function niceMax(v: number) {
  if (v <= 0) return 4;
  const pow = 10 ** Math.floor(Math.log10(v));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s * 4 >= v) ?? pow * 10;
  return step * 4;
}

function ChartCard({ icon: Icon, title, subtitle, children }: { icon: typeof BarChart3; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="size-4" /></span>
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

/* ───────── Reservas por mes (columnas) ───────── */
function MonthlyChart({ data }: { data: MonthPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(...data.map((d) => d.count)));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(max * t));
  const H = 180;
  const total = data.reduce((n, d) => n + d.count, 0);
  const last = data[data.length - 1];
  const prev = data[data.length - 2];
  const delta = prev && prev.count ? Math.round(((last.count - prev.count) / prev.count) * 100) : null;

  return (
    <ChartCard icon={BarChart3} title="Reservas por mes" subtitle={`Últimos ${data.length} meses · ${total} reservas (sin canceladas)`}>
      <div className="mb-4 flex items-baseline gap-3">
        <span className="text-3xl font-semibold tabular-nums">{last?.count ?? 0}</span>
        <span className="text-sm text-muted-foreground">este mes</span>
        {delta !== null && (
          <span className={delta >= 0 ? "text-sm font-medium text-emerald-700" : "text-sm font-medium text-rose-700"}>
            {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)} % vs. mes anterior
          </span>
        )}
      </div>

      <div className="relative" style={{ height: H + 28 }} onMouseLeave={() => setHover(null)}>
        {/* rejilla + eje Y */}
        {ticks.map((t) => (
          <div key={t} className="absolute inset-x-0 flex items-center gap-2" style={{ bottom: 28 + (t / max) * H - 6 }}>
            <span className="w-6 text-right text-[11px] tabular-nums text-muted-foreground">{t}</span>
            <span className={t === 0 ? "h-px flex-1 bg-border" : "h-px flex-1 bg-border/50"} />
          </div>
        ))}
        {/* columnas */}
        <div className="absolute inset-y-0 left-8 right-0 flex items-end">
          {data.map((d, i) => {
            const h = (d.count / max) * H;
            const active = hover === i;
            return (
              <div
                key={d.key}
                className="relative flex h-full flex-1 cursor-default flex-col items-center justify-end"
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                tabIndex={0}
                aria-label={`${d.label}: ${d.count} reservas, ${eur(d.revenue)}`}
              >
                <div
                  className={active || hover === null ? "w-6 rounded-t bg-primary transition-opacity" : "w-6 rounded-t bg-primary opacity-40 transition-opacity"}
                  style={{ height: Math.max(h, d.count ? 3 : 0) }}
                />
                <span className="mt-2 h-5 text-xs capitalize text-muted-foreground">{d.label}</span>
                {active && (
                  <div className="pointer-events-none absolute z-10 w-max -translate-y-2 rounded-lg border bg-popover px-3 py-2 text-xs shadow-lg" style={{ bottom: h + 28 }}>
                    <p className="font-medium capitalize">{d.label}</p>
                    <p className="tabular-nums">{d.count} reservas</p>
                    <p className="tabular-nums text-muted-foreground">{eur(d.revenue)} facturado</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <table className="sr-only">
        <caption>Reservas por mes</caption>
        <thead><tr><th>Mes</th><th>Reservas</th><th>Facturado</th></tr></thead>
        <tbody>{data.map((d) => <tr key={d.key}><td>{d.label}</td><td>{d.count}</td><td>{eur(d.revenue)}</td></tr>)}</tbody>
      </table>
    </ChartCard>
  );
}

/* ───────── Facturación por sala (barras horizontales) ───────── */
function RevenueByRoom({ data }: { data: RoomRevenue[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const sorted = [...data].sort((a, b) => b.revenue - a.revenue);
  const max = Math.max(1, ...sorted.map((d) => d.revenue));
  const total = sorted.reduce((n, d) => n + d.revenue, 0);

  return (
    <ChartCard icon={TrendingUp} title="Facturación por sala" subtitle={`Histórico · ${eur(total)} en total`}>
      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin datos todavía.</p>
      ) : (
        <ul className="space-y-3" onMouseLeave={() => setHover(null)}>
          {sorted.map((d, i) => {
            const active = hover === i;
            return (
              <li
                key={d.name}
                className="grid grid-cols-[minmax(0,140px)_minmax(0,1fr)_72px] items-center gap-3"
                onMouseEnter={() => setHover(i)}
                title={`${d.name}: ${eur(d.revenue)} · ${d.count} reservas`}
              >
                <span className="truncate text-sm">{d.name}</span>
                <span className="relative h-3.5 rounded-r bg-muted/60">
                  <span
                    className={hover === null || active ? "absolute inset-y-0 left-0 rounded-r bg-primary transition-opacity" : "absolute inset-y-0 left-0 rounded-r bg-primary opacity-40 transition-opacity"}
                    style={{ width: `${Math.max((d.revenue / max) * 100, d.revenue ? 1.5 : 0)}%` }}
                  />
                </span>
                <span className="text-right text-sm font-medium tabular-nums">{eur(d.revenue)}</span>
              </li>
            );
          })}
        </ul>
      )}
      <table className="sr-only">
        <caption>Facturación por sala</caption>
        <thead><tr><th>Sala</th><th>Facturado</th><th>Reservas</th></tr></thead>
        <tbody>{sorted.map((d) => <tr key={d.name}><td>{d.name}</td><td>{eur(d.revenue)}</td><td>{d.count}</td></tr>)}</tbody>
      </table>
    </ChartCard>
  );
}

export function RoomsCharts({ monthly, byRoom }: { monthly: MonthPoint[]; byRoom: RoomRevenue[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <MonthlyChart data={monthly} />
      <RevenueByRoom data={byRoom} />
    </div>
  );
}
