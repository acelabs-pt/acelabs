// Junta os ficheiros SQL do Cockpit, pela ordem certa, num só ficheiro (instalar_tudo.sql, fora do git) para colar
// de uma vez no SQL Editor do Supabase de um cliente novo. Uso: npm run sql
import { readFileSync, writeFileSync } from "node:fs";

const ORDEM = [
  "create_tables.sql",
  "migracao_zonas_correspondencias.sql",
  "migracao_escala.sql",
  "migracao_seguranca.sql",
  "migracao_notificacoes.sql",
  "migracao_apagar_conta.sql",
  "migracao_multiempresa.sql",
];
const partes = ORDEM.map((f) => `-- ============================================================\n-- ${f}\n-- ============================================================\n${readFileSync(f, "utf8").replace(/\r\n/g, "\n")}`);
writeFileSync("instalar_tudo.sql", `-- Gerado por npm run sql. Para um projeto Supabase NOVO e vazio. Nao editar a mao.\n\n${partes.join("\n\n")}\n`);
console.log(`instalar_tudo.sql escrito (${ORDEM.length} ficheiros).`);
