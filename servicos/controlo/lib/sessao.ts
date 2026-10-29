import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// Entrada na plataforma de controlo: uma password dos sócios (guardada só como hash em CONTROLO_PASSWORD_HASH, gerado
// por `npm run password`) e um cookie assinado de 8 horas. A app corre só no computador de quem a usa, por isso isto é a
// segunda barreira (a primeira é não estar publicada).

const OITO_HORAS = 8 * 3600;

function segredo(): string {
  const s = process.env.CONTROLO_SEGREDO;
  if (!s || s.length < 32) throw new Error("Falta CONTROLO_SEGREDO (pelo menos 32 caracteres) no .env.local. Corre: npm run password");
  return s;
}

export function criarHash(password: string): string {
  const sal = randomBytes(16).toString("hex");
  return `scrypt$${sal}$${scryptSync(password, sal, 32).toString("hex")}`;
}

export function passwordCerta(password: string): boolean {
  const h = process.env.CONTROLO_PASSWORD_HASH;
  if (!h) return false;
  const [tipo, sal, hex] = h.split("$");
  if (tipo !== "scrypt" || !sal || !hex) return false;
  const a = scryptSync(password, sal, 32);
  const b = Buffer.from(hex, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function criarCookie(): { valor: string; maxAge: number } {
  const exp = Math.floor(Date.now() / 1000) + OITO_HORAS;
  const corpo = String(exp);
  const sig = createHmac("sha256", segredo()).update(corpo).digest("hex");
  return { valor: `${corpo}.${sig}`, maxAge: OITO_HORAS };
}

export function cookieValido(valor: string | undefined): boolean {
  if (!valor) return false;
  const [corpo, sig] = valor.split(".");
  if (!corpo || !sig) return false;
  const esperado = createHmac("sha256", segredo()).update(corpo).digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b) && Number(corpo) > Date.now() / 1000;
}
