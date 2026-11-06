// Testes da Torre. Uso: npm run testar
//  1. unidade: dinheiro, extratos, regras, débitos diretos e contas dos sócios (sem rede);
//  2. integração: regras de acesso (só sócios ativos), duplicados e registo de ações, contra o Supabase do .env.local,
//     só com TORRE_TESTES_PERMITIDOS=1 (cria e apaga os seus próprios dados de teste).
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { correrUnidade } from "./unidade";
import { correrIntegracao } from "./integracao";

function lerEnv(f: string): Record<string, string> {
  const o: Record<string, string> = {};
  if (!existsSync(f)) return o;
  for (const l of readFileSync(f, "utf8").split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) o[m[1]] = m[2].trim().replace(/^"|"$/g, "");
  }
  return o;
}

async function main() {
  correrUnidade();
  const env = lerEnv(path.join(__dirname, "..", ".env.local"));
  if (env.TORRE_TESTES_PERMITIDOS !== "1" || !env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log("Integração saltada: falta TORRE_TESTES_PERMITIDOS=1 ou SUPABASE_SERVICE_ROLE_KEY no .env.local.");
    return;
  }
  await correrIntegracao(env);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
