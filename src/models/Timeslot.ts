// src/models/Timeslot.ts
import { Schema, model, models, Types } from "mongoose";

const TimeslotSchema = new Schema({
  roomId: { type: Types.ObjectId, ref: "Room", required: true },
  start: { type: Date, required: true },
  end: { type: Date, required: true },
  status: { type: String, enum: ["open", "blocked", "booked"], default: "open" },
}, { timestamps: true });

export default models.Timeslot || model("Timeslot", TimeslotSchema);
