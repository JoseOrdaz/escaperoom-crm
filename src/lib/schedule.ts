// src/lib/schedule.ts
export type TimeSlot = { start: string; end: string } // "HH:mm"
export type WeekTemplate = {
  monday: TimeSlot[]; tuesday: TimeSlot[]; wednesday: TimeSlot[];
  thursday: TimeSlot[]; friday: TimeSlot[]; saturday: TimeSlot[]; sunday: TimeSlot[];
}
export type DayOff = { date: string; reason?: string }  // YYYY-MM-DD
export type OverrideDay = { date: string; slots: TimeSlot[] } // YYYY-MM-DD

export type RoomConfigLite = {
  _id: string
  name: string
  durationMinutes: number
  capacityMin: number
  capacityMax: number
  priceTable: { players: number; price: number }[]
  schedule: {
    template: WeekTemplate
    daysOff: DayOff[]
    overrides: OverrideDay[]
  }
}

export function getDayKeyFromDate(dateStr: string):
  "monday"|"tuesday"|"wednesday"|"thursday"|"friday"|"saturday"|"sunday" {
  const d = new Date(dateStr + "T00:00:00")
  const day = d.getUTCDay() // 0=Sunday ... 6=Saturday
  return (["sunday","monday","tuesday","wednesday","thursday","friday","saturday"] as const)[day]
}

function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number)
  return h * 60 + m
}
function toHHMM(mins: number) {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`
}

export function getSlotsForDate(room: RoomConfigLite, dateStr: string): TimeSlot[] {
  // día cerrado?
  if (room.schedule.daysOff?.some(d => d.date === dateStr)) return []
  // override?
  const ov = room.schedule.overrides?.find(o => o.date === dateStr)
  if (ov) return ov.slots || []
  // semanal
  const key = getDayKeyFromDate(dateStr)
  return room.schedule.template?.[key] || []
}

/** genera horas de inicio posibles respetando duration */
export function generateStartTimesForDate(room: RoomConfigLite, dateStr: string): string[] {
  const dur = Number(room.durationMinutes) || 60
  const slots = getSlotsForDate(room, dateStr)
  const result: string[] = []
  for (const s of slots) {
    const start = toMinutes(s.start)
    const end = toMinutes(s.end)
    for (let t = start; t + dur <= end; t += dur) {
      result.push(toHHMM(t))
    }
  }
  return result
}

export function priceForPlayers(room: RoomConfigLite, players: number): number {
  const row = room.priceTable?.find(p => Number(p.players) === Number(players))
  return row ? Number(row.price) : 0
}
