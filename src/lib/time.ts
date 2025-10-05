// src/lib/time.ts
export function hhmmToDate(dateISO: string, hhmm: string) {
  // crea Date local como "YYYY-MM-DDTHH:mm:00"
  return new Date(`${dateISO}T${hhmm}:00`);
}
export function enumerateSlots(dateISO: string, slots: {start:string;end:string}[], stepMin: number) {
  const out: { start: Date; end: Date }[] = [];
  for (const s of slots) {
    let cursor = hhmmToDate(dateISO, s.start);
    const hardEnd = hhmmToDate(dateISO, s.end);
    while (cursor < hardEnd) {
      const end = new Date(cursor.getTime() + stepMin * 60_000);
      if (end > hardEnd) break;
      out.push({ start: new Date(cursor), end });
      cursor = end;
    }
  }
  return out;
}
