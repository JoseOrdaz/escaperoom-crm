export function passwordError(password) {
  if (typeof password !== "string" || password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
    return "La contraseña debe tener al menos 8 caracteres y no superar 72 bytes.";
  }
  return null;
}
