// Cópia de segurança de todos os dados da Torre para um ficheiro JSON local (o plano grátis do Supabase não faz cópias).
// Uso: npm run copia                    -> grava em business-center/torre-copias/ (pasta fora do git)
//      npm run copia -- C:\outra\pasta
// Precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { copiaDeTudo } from "../lib/copia";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no .env.local.");
  const s = createClient(url, chave, { auth: { persistSession: false } });
  const pasta = process.argv[2] ?? path.join(process.cwd(), "..", "..", "business-center", "torre-copias");
  mkdirSync(pasta, { recursive: true });
  const copia = await copiaDeTudo(s);
  const f = path.join(pasta, `torre-copia-${copia.feita_em.slice(0, 10)}.json`);
  writeFileSync(f, JSON.stringify(copia, null, 1), "utf8");
  const linhas = Object.entries(copia.tabelas).map(([t, l]) => `${t} ${l.length}`).join(", ");
  console.log(`Cópia gravada em ${f}\n${linhas}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
