"use client";

import { Trophy } from "lucide-react";
import { Input } from "@/components/ui/input";

export type Ranking = { teamName?: string; score?: number | null; timeSeconds?: number | null } | null | undefined;
export type RankingState = { teamName: string; score: string; time: string };

const p2 = (n: number) => String(n).padStart(2, "0");
export const formatTime = (s?: number | null) => (s === null || s === undefined ? "" : `${p2(Math.floor(s / 60))}:${p2(s % 60)}`);

export const rankingToState = (r: Ranking): RankingState => ({
  teamName: r?.teamName ?? "",
  score: r?.score === null || r?.score === undefined ? "" : String(r.score),
  time: formatTime(r?.timeSeconds),
});

/** Estado del formulario → cuerpo para la API. `false` si hay datos inválidos. */
export function rankingToBody(s: RankingState): { teamName: string; score: number | null; timeSeconds: number | null } | null | false {
  const teamName = s.teamName.trim();
  const scoreTxt = s.score.trim();
  const timeTxt = s.time.trim();
  if (!teamName && !scoreTxt && !timeTxt) return null;
  const score = scoreTxt ? Number(scoreTxt.replace(",", ".")) : null;
  if (score !== null && (!Number.isFinite(score) || score < 0)) return false;
  let timeSeconds: number | null = null;
  if (timeTxt) {
    const m = /^(\d{1,3}):([0-5]\d)$/.exec(timeTxt) ?? (/^\d{1,3}$/.test(timeTxt) ? [timeTxt, timeTxt, "00"] : null);
    if (!m) return false;
    timeSeconds = Number(m[1]) * 60 + Number(m[2]);
  }
  return { teamName, score, timeSeconds };
}

export function RankingFields({ value, onChange }: { value: RankingState; onChange: (v: RankingState) => void }) {
  return (
    <section className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
      <div className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700"><Trophy className="size-4" /></span>
        <div>
          <h3 className="text-sm font-semibold">Ranking</h3>
          <p className="text-xs text-muted-foreground">Resultado del equipo tras la partida. Aparece en el apartado Ranking.</p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_120px_120px]">
        <div className="space-y-1.5">
          <label htmlFor="rk-team" className="text-xs font-medium">Nombre del equipo</label>
          <Input id="rk-team" className="bg-card" maxLength={80} value={value.teamName} onChange={(e) => onChange({ ...value, teamName: e.target.value })} placeholder="Ej.: Los Intrépidos" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="rk-score" className="text-xs font-medium">Puntuación</label>
          <Input id="rk-score" className="bg-card" inputMode="numeric" value={value.score} onChange={(e) => onChange({ ...value, score: e.target.value })} placeholder="0–100" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="rk-time" className="text-xs font-medium">Tiempo (mm:ss)</label>
          <Input id="rk-time" className="bg-card" value={value.time} onChange={(e) => onChange({ ...value, time: e.target.value })} placeholder="52:30" />
        </div>
      </div>
    </section>
  );
}
