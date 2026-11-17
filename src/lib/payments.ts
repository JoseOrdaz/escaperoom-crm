/**
 * Cobros de las reservas (cliente y servidor, sin dependencias).
 *
 * Una reserva puede tener `payment` (registrado desde el CRM). Si no lo tiene, se
 * deduce de los datos de la plataforma anterior (`legacy.paymentStatus`,
 * `legacy.paidAmount`, `legacy.paymentMethod`) sin modificar la base de datos.
 */

export type PaymentStatus = "pendiente" | "parcial" | "pagado";
export type PaymentMethod = "efectivo" | "tarjeta" | "bizum" | "transferencia" | "online" | "local" | "otro";

export type Payment = {
  status: PaymentStatus;
  paidAmount: number;
  method: PaymentMethod | null;
  paidAt: string | Date | null;
  by?: string;
  note?: string;
  source: "crm" | "plataforma-anterior" | "sin-datos";
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  pendiente: "Pendiente",
  parcial: "Parcial",
  pagado: "Cobrado",
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  bizum: "Bizum",
  transferencia: "Transferencia",
  online: "Online",
  local: "En el local",
  otro: "Otro",
};
export const PAYMENT_METHODS = Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[];

const round2 = (n: number) => Math.round(n * 100) / 100;

function legacyMethod(raw: unknown): PaymentMethod | null {
  const s = String(raw ?? "").toLowerCase();
  if (!s) return null;
  if (s.includes("sitio") || s.includes("local")) return "local";
  if (s.includes("efectivo") || s.includes("cash")) return "efectivo";
  if (s.includes("bizum")) return "bizum";
  if (s.includes("transfer")) return "transferencia";
  if (s.includes("tarjeta") || s.includes("card") || s.includes("stripe") || s.includes("paypal") || s.includes("online")) return "online";
  return "otro";
}

/** Estado de cobro efectivo de una reserva */
export function paymentOf(r: { price?: number; payment?: Partial<Payment> | null; legacy?: Record<string, unknown> | null }): Payment {
  const price = Number(r.price ?? 0);
  if (r.payment && r.payment.status) {
    return {
      status: r.payment.status,
      paidAmount: round2(Number(r.payment.paidAmount ?? 0)),
      method: r.payment.method ?? null,
      paidAt: r.payment.paidAt ?? null,
      by: r.payment.by,
      note: r.payment.note,
      source: "crm",
    };
  }
  const raw = String(r.legacy?.paymentStatus ?? "").toLowerCase();
  if (!raw) return { status: "pendiente", paidAmount: 0, method: null, paidAt: null, source: "sin-datos" };
  const amount = Number(r.legacy?.paidAmount ?? 0) || 0;
  const hasPaid = raw.includes("pagado") && !raw.includes("parcial");
  const hasPending = raw.includes("pendiente");
  const status: PaymentStatus = raw.includes("parcial") || (hasPaid && hasPending) ? "parcial" : hasPaid ? "pagado" : "pendiente";
  return {
    status,
    paidAmount: round2(status === "pagado" ? amount || price : amount),
    method: legacyMethod(r.legacy?.paymentMethod),
    paidAt: null,
    source: "plataforma-anterior",
  };
}

/** Lo que queda por cobrar */
export const outstanding = (price: number, p: Payment) => (p.status === "pagado" ? 0 : Math.max(0, round2(price - p.paidAmount)));
