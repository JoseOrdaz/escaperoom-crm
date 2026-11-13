import type { Db, ObjectId } from "mongodb";

const digits = (s?: string) => (s ?? "").replace(/\D/g, "").replace(/^(00)?34(?=\d{9}$)/, "");
const norm = (s?: string) =>
  (s ?? "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");

/**
 * Busca el cliente que corresponde a estos datos o lo crea.
 *
 * El email por sí solo no identifica a una persona: un colaborador o agencia
 * puede reservar para muchos clientes distintos con el mismo correo. Por eso
 * solo reutilizamos un cliente existente si coincide el email Y además el
 * teléfono (o, si no hay teléfono, el nombre). En otro caso se crea un cliente
 * nuevo aunque comparta email.
 */
export async function findOrCreateCustomer(
  db: Db,
  input: { name?: string; email: string; phone?: string }
): Promise<ObjectId> {
  const email = input.email.toLowerCase().trim();
  const name = (input.name ?? "").trim() || email;
  const phone = (input.phone ?? "").trim();

  const sameEmail = await db
    .collection("customers")
    .find({ email }, { projection: { _id: 1, name: 1, phone: 1 } })
    .toArray();

  const match = sameEmail.find((c) =>
    digits(phone) ? digits(c.phone) === digits(phone) : norm(c.name) === norm(name)
  );

  if (match) {
    // Completa el teléfono si el cliente existente no lo tenía
    if (phone && !c_hasPhone(match.phone)) {
      await db.collection("customers").updateOne({ _id: match._id }, { $set: { phone, updatedAt: new Date() } });
    }
    return match._id as ObjectId;
  }

  const res = await db.collection("customers").insertOne({
    name,
    email,
    phone,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return res.insertedId;
}

function c_hasPhone(p?: string) {
  return digits(p).length > 0;
}
