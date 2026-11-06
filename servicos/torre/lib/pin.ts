// Entrar com PIN (6 algarismos). O PIN não é a password do Supabase: a password é derivada do PIN com um segredo que só o
// servidor da Torre tem (TORRE_PIN_SEGREDO). Assim, quem tentar adivinhar PINs diretamente no Supabase não consegue (teria
// de adivinhar 64 caracteres), e pela Torre há o bloqueio de 10 tentativas por email (supabase/schema.sql, pin_falhas).
// Só no servidor e nos scripts locais.

import { createHmac } from "node:crypto";

export const TAMANHO_PIN = 6;

export function senhaDoPin(email: string, pin: string): string {
  const segredo = process.env.TORRE_PIN_SEGREDO;
  if (!segredo || segredo.length < 32) throw new Error("Falta TORRE_PIN_SEGREDO (32+ caracteres) no ambiente.");
  return "T1-" + createHmac("sha256", segredo).update(`${email.trim().toLowerCase()}:${pin}`).digest("hex");
}

/** Erro em português se o PIN não servir; null se servir. Recusa os óbvios (000000, 123456, 654321...). */
export function problemaDoPin(pin: string): string | null {
  if (!new RegExp(`^\\d{${TAMANHO_PIN}}$`).test(pin)) return `O PIN tem de ter ${TAMANHO_PIN} algarismos.`;
  if (/^(\d)\1+$/.test(pin)) return "PIN demasiado fácil: algarismos todos iguais.";
  const d = pin.split("").map(Number);
  const passo = d[1] - d[0];
  if (Math.abs(passo) === 1 && d.every((x, i) => i === 0 || x - d[i - 1] === passo)) return "PIN demasiado fácil: algarismos seguidos.";
  return null;
}
