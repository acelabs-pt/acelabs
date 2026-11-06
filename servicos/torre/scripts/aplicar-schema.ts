// Corre o supabase/schema.sql no projeto da Torre (pode correr-se as vezes que for preciso).
// Uso: npm run schema
// Precisa de TORRE_DB_URL no .env.local: a ligação "Session pooler" do Supabase (Connect > Session pooler), com a password
// da base de dados. Fica só neste computador.
import { readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";

async function main() {
  const url = process.env.TORRE_DB_URL;
  if (!url) {
    console.error("Falta TORRE_DB_URL no .env.local.");
    process.exit(1);
  }
  const sql = readFileSync(path.join(__dirname, "..", "supabase", "schema.sql"), "utf8");
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    await c.query(sql);
    const { rows } = await c.query("select count(*)::int as n from public.categorias");
    console.log(`Schema aplicado. ${rows[0].n} categorias.`);
  } finally {
    await c.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
