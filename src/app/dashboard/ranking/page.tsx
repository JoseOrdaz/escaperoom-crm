"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Medal, Timer, Trophy, UsersRound } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatTime } from "@/components/reservations/ranking-fields";
import { cn } from "@/lib/utils";

type Row = {
  _id: string; roomId: string; roomName: string; escape: string; start: string; players: number;
  customerName: string; teamName: string; score: number | null; timeSeconds: number | null;
};
type Room = { _id: string; name: string; escape: string };

const PERIODS = [
  { v: "all", label: "Histórico" },
  { v: "year", label: "Este año" },
  { v: "month", label: "Este mes" },
];
const fmtDate = (d: string) => new Date(d).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
const MEDAL = ["text-amber-500", "text-slate-400", "text-orange-700"];

export default function RankingPage() {
  const [roomId, setRoomId] = useState("all");
  const [period, setPeriod] = useState("all");
  const [data, setData] = useState<{ rooms: Room[]; rows: Row[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const q = new URLSearchParams({ period, ...(roomId !== "all" ? { roomId } : {}) });
    fetch(`/api/ranking?${q}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setData({ rooms: j.rooms ?? [], rows: j.rows ?? [] }))
      .finally(() => setLoading(false));
  }, [roomId, period]);

  const rows = useMemo(() => data?.rows ?? [], [data]);
  const podium = rows.slice(0, 3);
  const escapes = [...new Set((data?.rooms ?? []).map((r) => r.escape))];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight"><Trophy className="size-6 text-amber-500" /> Ranking</h1>
          <p className="text-sm text-muted-foreground">Mejores equipos por puntuación; a igualdad de puntos gana el menor tiempo. Se rellena al editar una reserva.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={roomId} onValueChange={setRoomId}>
            <SelectTrigger className="w-56 bg-card"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las salas</SelectItem>
              {escapes.map((e) =>
                (data?.rooms ?? []).filter((r) => r.escape === e).map((r) => (
                  <SelectItem key={r._id} value={r._id}>{escapes.length > 1 ? `${r.name} · ${e}` : r.name}</SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <div className="inline-flex rounded-xl bg-muted p-1">
            {PERIODS.map((p) => (
              <button key={p.v} type="button" onClick={() => setPeriod(p.v)} className={cn("rounded-lg px-3 py-1.5 text-sm font-medium", period === p.v ? "bg-card shadow-sm" : "text-muted-foreground")}>{p.label}</button>
            ))}
          </div>
        </div>
      </div>

      {loading && !data ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Cargando…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card p-10 text-center">
          <Trophy className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">Todavía no hay resultados</p>
          <p className="text-sm text-muted-foreground">Abre una reserva, rellena «Ranking» (equipo, puntuación y tiempo) y guarda.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {podium.map((r, i) => (
              <div key={r._id} className={cn("relative overflow-hidden rounded-2xl border bg-card p-5 shadow-sm", i === 0 && "border-amber-300 bg-gradient-to-br from-amber-50 to-card")}>
                <Medal className={cn("absolute right-4 top-4 size-8", MEDAL[i])} />
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{i + 1}º puesto</p>
                <p className="mt-1 truncate pr-10 text-lg font-semibold">{r.teamName || r.customerName || "Equipo sin nombre"}</p>
                <p className="truncate text-sm text-muted-foreground">{r.roomName} · {fmtDate(r.start)}</p>
                <div className="mt-4 flex items-end gap-5">
                  <div><p className="text-3xl font-bold tabular-nums">{r.score ?? "—"}</p><p className="text-xs text-muted-foreground">puntos</p></div>
                  <div><p className="flex items-center gap-1 text-lg font-semibold tabular-nums"><Timer className="size-4 text-muted-foreground" />{formatTime(r.timeSeconds) || "—"}</p><p className="text-xs text-muted-foreground">tiempo</p></div>
                </div>
              </div>
            ))}
          </div>

          <div className={cn("overflow-hidden rounded-2xl border bg-card shadow-sm", loading && "opacity-60")}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="w-14 px-4 py-3">#</th><th className="px-4 py-3">Equipo</th><th className="px-4 py-3">Sala</th>
                    <th className="px-4 py-3">Fecha</th><th className="px-4 py-3 text-center">Jugadores</th>
                    <th className="px-4 py-3 text-right">Puntos</th><th className="px-4 py-3 text-right">Tiempo</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((r, i) => (
                    <tr key={r._id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-semibold tabular-nums">{i < 3 ? <Medal className={cn("size-5", MEDAL[i])} aria-label={`${i + 1}º`} /> : i + 1}</td>
                      <td className="px-4 py-3"><p className="font-medium">{r.teamName || "Sin nombre"}</p>{r.customerName && <p className="text-xs text-muted-foreground">{r.customerName}</p>}</td>
                      <td className="px-4 py-3">{r.roomName}{escapes.length > 1 && <span className="block text-xs text-muted-foreground">{r.escape}</span>}</td>
                      <td className="px-4 py-3 text-muted-foreground">{fmtDate(r.start)}</td>
                      <td className="px-4 py-3"><span className="flex items-center justify-center gap-1"><UsersRound className="size-3.5 text-muted-foreground" />{r.players}</span></td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">{r.score ?? "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatTime(r.timeSeconds) || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
