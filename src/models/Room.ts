// src/models/Room.ts
import { Schema, model, models } from "mongoose";

const RoomSchema = new Schema({
  name: { type: String, required: true },
  capacity: { type: Number, default: 6 },
  durationMinutes: { type: Number, default: 60 },
  active: { type: Boolean, default: true },
}, { timestamps: true });

export default models.Room || model("Room", RoomSchema);
