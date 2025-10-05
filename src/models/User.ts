// src/models/User.ts
import { Schema, model, models } from "mongoose";

const UserSchema = new Schema({
  name: String,
  email: { type: String, unique: true },
  passwordHash: String,
  role: { type: String, enum: ["admin", "manager", "agent"], default: "agent" },
}, { timestamps: true });

export default models.User || model("User", UserSchema);
