import { Schema, model, models } from "mongoose";

const CustomerSchema = new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true, index: true },
  phone: { type: String, trim: true },
  language: { type: String, enum: ["es","en","ru"], default: "es" },
  notes: { type: String, default: "" },
}, { timestamps: true });

CustomerSchema.index({ email: 1 }, { unique: true, sparse: true });

export type CustomerDoc = {
  _id: string;
  name: string; email: string; phone?: string; language?: "es"|"en"|"ru"; notes?: string;
  createdAt: Date; updatedAt: Date;
}

export const Customer = models.Customer || model("Customer", CustomerSchema);
