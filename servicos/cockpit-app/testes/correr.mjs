// Corre a bateria de testes do Cockpit e resume o resultado. Uso (na pasta servicos/cockpit-app):
//
//   npm run testar                 todos os testes
//   npm run testar -- pesquisa     só alguns (nomes dos ficheiros, sem extensão)
//
// Precisa de:
//   - o servidor de desenvolvimento a correr: npx next dev -p 3001
//   - um ficheiro .env.testes (não vai para o Git) com:
//       SUPABASE_SERVICE_ROLE_KEY=<chave de administrador do projeto de TESTE>
//       TESTES_PERMITIDOS_EM=<referência do projeto de teste, a parte antes de .supabase.co>
// Os testes criam utilizadores e dados temporários (marcados "ZZ" ou "claude-teste-") e apagam-nos no fim.
// PROTEÇÃO: só correm se o projeto do .env.local for o indicado em TESTES_PERMITIDOS_EM. Nunca apontar a um cliente.
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

const env = { ...process.env };
for (const f of [".env.local", ".env.testes"]) {
  const p = path.join(raiz, f);
  if (!existsSync(p)) continue;
  for (const l of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
  }
}

const falha = (msg) => {
  console.error(msg);
  process.exit(1);
};
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) falha("Falta NEXT_PUBLIC_SUPABASE_URL (.env.local) ou SUPABASE_SERVICE_ROLE_KEY (.env.testes).");
if (!env.TESTES_PERMITIDOS_EM || !env.NEXT_PUBLIC_SUPABASE_URL.includes(`//${env.TESTES_PERMITIDOS_EM}.`)) {
  falha(`Proteção: o .env.local aponta para ${env.NEXT_PUBLIC_SUPABASE_URL}, que não é o projeto de teste indicado em TESTES_PERMITIDOS_EM. Os testes escrevem dados: nunca correm num cliente.`);
}

const TODOS = [
  "unidade-importacao.ts", "unidade-correspondencias.ts", "unidade-ics.ts", "conta.js", "dashboard.js", "gestos.js", "gestos-crm.js",
  "pesquisa.js", "chamadas.js", "funis.js", "calendario.js", "calendario-telemovel.js", "exportar.js", "exportar-tudo.js", "whatsapp.js", "importar.js",
  "documentos.js", "semrede.js", "acessibilidade.js",
];
const pedidos = process.argv.slice(2);
const lista = pedidos.length ? pedidos.map((n) => TODOS.find((t) => t.startsWith(n + ".")) ?? (n === "publicado" ? "publicado.js" : n)) : TODOS;

if (lista.some((t) => !t.startsWith("unidade") && t !== "publicado.js")) {
  try {
    const r = await fetch("http://localhost:3001/login");
    if (!r.ok) throw new Error();
  } catch {
    falha("O servidor de desenvolvimento não responde em http://localhost:3001. Arranca-o com: npx next dev -p 3001");
  }
}
if (lista.includes("publicado.js") && !env.BASE) falha('Para "publicado", indica o endereço: BASE=https://... npm run testar -- publicado');

const resultados = path.join(raiz, "testes", "resultados");
mkdirSync(resultados, { recursive: true });
env.SP = resultados;
const tsx = path.join(path.dirname(require.resolve("tsx/package.json")), "dist", "cli.mjs");

let totalOk = 0;
let totalFalhas = 0;
const linhas = [];
for (const t of lista) {
  const ficheiro = path.join(raiz, "testes", t);
  if (!existsSync(ficheiro)) {
    linhas.push(`  ?    ${t}: não existe`);
    totalFalhas++;
    continue;
  }
  const args = t.endsWith(".ts") ? [tsx, "--tsconfig", path.join(raiz, "tsconfig.json"), ficheiro] : [ficheiro];
  const inicio = Date.now();
  const r = spawnSync(process.execPath, args, { cwd: raiz, env, encoding: "utf8", timeout: 10 * 60 * 1000 });
  const saida = `${r.stdout ?? ""}\n${r.stderr ?? ""}`;
  const ok = (saida.match(/^OK\b/gm) ?? []).length;
  const falhas = saida.split("\n").filter((l) => /^FALHA\b/.test(l));
  const rebentou = r.status !== 0 && !falhas.length;
  totalOk += ok;
  totalFalhas += falhas.length + (rebentou ? 1 : 0);
  const estado = falhas.length || rebentou ? "FALHA" : "ok   ";
  linhas.push(`${estado} ${t.padEnd(30)} ${String(ok).padStart(3)} ok  ${falhas.length} falhas  ${Math.round((Date.now() - inicio) / 1000)}s`);
  for (const f of falhas) linhas.push(`        ${f}`);
  if (rebentou) linhas.push(`        terminou com erro: ${saida.trim().split("\n").slice(-3).join(" | ").slice(0, 300)}`);
  console.log(linhas.slice(-1 - falhas.length - (rebentou ? 1 : 0)).join("\n"));
}
console.log(`\n${totalOk} verificações passaram, ${totalFalhas} ${totalFalhas === 1 ? "falhou" : "falharam"}. Screenshots em testes/resultados/.`);
process.exit(totalFalhas ? 1 : 0);
