// src/models/Booking.ts
import { Schema, model, models, Types } from "mongoose";

const BookingSchema = new Schema({
  customerId: { type: Types.ObjectId, ref: "Customer", required: true },
  roomId: { type: Types.ObjectId, ref: "Room", required: true },
  timeslotId: { type: Types.ObjectId, ref: "Timeslot", required: true, unique: true },
  players: { type: Number, default: 2 },
  status: { type: String, enum: ["pending", "confirmed", "cancelled"], default: "pending" },
}, { timestamps: true });

export default models.Booking || model("Booking", BookingSchema);
