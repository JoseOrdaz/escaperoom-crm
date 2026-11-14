/**
 * Cálculo de precios compartido entre servidor y cliente.
 *
 * Cada sala tiene una tabla de precios por nº de jugadores (`priceTable`) y,
 * opcionalmente, reglas de precio para días concretos (y, si se indica, solo
 * para una franja horaria): `schedule.priceRules`.
 */
export type PriceRule = {
  date: string; // YYYY-MM-DD
  start?: string; // HH:mm (opcional: si falta, aplica todo el día)
  end?: string; // HH:mm (exclusivo)
  adjustType: "percent" | "amount";
  /** percent: -20 = 20 % más barato · amount: +10 = 10 € más caro (por grupo) */
  value: number;
  label?: string;
};

type PricedRoom = {
  priceTable?: { players: number; price: number }[];
  schedule?: { priceRules?: PriceRule[] } | null;
};

export function basePriceFor(room: PricedRoom | null | undefined, players?: number | null) {
  const row = room?.priceTable?.find((p) => Number(p.players) === Number(players ?? 0));
  return row ? Number(row.price) : 0;
}

/** Regla aplicable a ese día/hora. Si hay varias, gana la que tiene franja horaria. */
export function findPriceRule(room: PricedRoom | null | undefined, ymd?: string | null, hhmm?: string | null) {
  if (!ymd) return null;
  const rules = (room?.schedule?.priceRules ?? []).filter((r) => r?.date === ymd);
  const timed = hhmm
    ? rules.find((r) => r.start && r.end && hhmm >= r.start && hhmm < r.end)
    : undefined;
  return timed ?? rules.find((r) => !r.start && !r.end) ?? null;
}

export function priceFor(
  room: PricedRoom | null | undefined,
  players?: number | null,
  ymd?: string | null,
  hhmm?: string | null
) {
  const base = basePriceFor(room, players);
  const rule = findPriceRule(room, ymd, hhmm);
  if (!rule || !base) return { base, price: base, rule: null as PriceRule | null };
  const raw =
    rule.adjustType === "percent" ? base + (base * Number(rule.value)) / 100 : base + Number(rule.value);
  const price = Math.max(0, Math.round(raw * 100) / 100);
  return { base, price, rule };
}

export function describeRule(rule: PriceRule) {
  const sign = rule.value > 0 ? "+" : "";
  const amount = rule.adjustType === "percent" ? `${sign}${rule.value} %` : `${sign}${rule.value} €`;
  const hours = rule.start && rule.end ? ` (${rule.start}–${rule.end})` : "";
  return `${rule.label?.trim() || "Precio especial"}${hours}: ${amount}`;
}

/** Limpia las reglas que llegan del formulario antes de guardarlas */
export function normPriceRules(input: unknown): PriceRule[] {
  const hhmm = /^\d{2}:\d{2}$/;
  return (Array.isArray(input) ? input : [])
    .map((r: any) => {
      const start = hhmm.test(r?.start ?? "") ? r.start : undefined;
      const end = hhmm.test(r?.end ?? "") ? r.end : undefined;
      const timed = start && end && start < end;
      return {
        date: String(r?.date ?? ""),
        ...(timed ? { start, end } : {}),
        adjustType: r?.adjustType === "amount" ? "amount" : "percent",
        value: Number(r?.value),
        label: String(r?.label ?? "").slice(0, 80),
      } as PriceRule;
    })
    .filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date) && Number.isFinite(r.value) && r.value !== 0);
}
