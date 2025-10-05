import { Schema, model, models, Types } from "mongoose";

const ReservationSchema = new Schema({
  roomId: { type: Types.ObjectId, required: true, index: true, ref: "Room" },
  roomName: { type: String, trim: true }, // opcional si quieres denormalizar para vista
  start: { type: Date, required: true, index: true },
  end:   { type: Date, required: true, index: true },
  players: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true, min: 0 },
  language: { type: String, enum: ["es","en","ru"], default: "es" },
  customerId: { type: Types.ObjectId, ref: "Customer", required: true, index: true },
  description: { type: String, default: "" },
  notes: { type: String, default: "" },
}, { timestamps: true });

// (Opcional) Índice para evitar solapes por sala y franja (ajústalo a tu lógica)
ReservationSchema.index(
  { roomId: 1, start: 1, end: 1 },
  { name: "uniq_room_timeslot", unique: false } // pon unique: true si tu negocio lo permite
);

export type ReservationDoc = {
  _id: string; roomId: string; roomName?: string;
  start: Date; end: Date; players: number; price: number;
  language: "es"|"en"|"ru";
  customerId: string; description?: string; notes?: string;
  createdAt: Date; updatedAt: Date;
};

export const Reservation = models.Reservation || model("Reservation", ReservationSchema);
