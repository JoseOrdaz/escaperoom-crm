// src/types/db.ts
export type PriceRow = { players: number; price: number };

export type DaySlot = { start: string; end: string }; // "HH:mm"
export type WeekTemplate = {
  monday?: DaySlot[]; tuesday?: DaySlot[]; wednesday?: DaySlot[];
  thursday?: DaySlot[]; friday?: DaySlot[]; saturday?: DaySlot[]; sunday?: DaySlot[];
};

export type DayOverride = { date: string; slots: DaySlot[] }; // "YYYY-MM-DD"

export type RoomDoc = {
  _id?: any;
  name: string;
  active: boolean;
  durationMinutes: number;        // p.ej. 60 o 90
  capacityMin: number;            // p.ej. 2
  capacityMax: number;            // p.ej. 12
  priceTable: PriceRow[];         // [{players:4, price:100}, ...]
  staffId?: any;                  // empleado asignado opcional
  schedule: {
    template: WeekTemplate;       // horario por día de la semana
    overrides?: DayOverride[];    // excepciones por fecha
  };
  createdAt?: Date; updatedAt?: Date;
};
