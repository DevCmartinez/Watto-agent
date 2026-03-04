import bcrypt from "bcryptjs";
// Numero de rondas de hashing (10 es el estandar recomendado)
const SALT_ROUNDS = 10;
// Hashear un texto plano (ej: password)
export async function hashear(texto: string): Promise<string> {
  return bcrypt.hash(texto, SALT_ROUNDS);
}
// Comparar texto plano con el hash almacenado
export async function verificarHash(
  textoPlano: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(textoPlano, hash);
}
