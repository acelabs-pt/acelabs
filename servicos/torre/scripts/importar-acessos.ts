// Importa a lista inicial de acessos para a Torre, sem duplicar (o mesmo serviço com a mesma conta não entra duas vezes).
// O ficheiro fica FORA do git (o repositório é público): business-center/torre-acessos-inicial.json, uma lista de objetos com
// os campos da tabela `acessos` (servico, categoria, para_que, url, conta, dono, onde_esta, dois_fatores, custo_mensal em
// euros, renovacao, estado, notas). Recusa correr se algum campo tiver aspeto de segredo: só nomes e localizações.
// Uso: npm run acessos                       (insere os que faltam)
//      npm run acessos -- --validar          (só confere o ficheiro, sem ligar à base de dados)
//      npm run acessos -- outro-ficheiro.json
// Precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local, e do SQL dos acessos já corrido (npm run schema).
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { chaveAcesso, lerAcesso, type CamposAcesso } from "../lib/acessos";

async function main() {
  const args = process.argv.slice(2);
  const soValidar = args.includes("--validar");
  const ficheiro = args.find((a) => !a.startsWith("--")) ?? path.join(__dirname, "..", "..", "..", "business-center", "torre-acessos-inicial.json");
  if (!existsSync(ficheiro)) {
    console.error(`Não encontrei ${ficheiro}.`);
    process.exit(1);
  }
  let bruto: unknown;
  try {
    bruto = JSON.parse(readFileSync(ficheiro, "utf8"));
  } catch (e) {
    console.error(`O ficheiro não é JSON válido: ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  }
  if (!Array.isArray(bruto)) {
    console.error("O ficheiro tem de ser uma lista de acessos ([ {...}, {...} ]).");
    process.exit(1);
  }

  // Tudo validado antes de escrever o que quer que seja: um segredo em qualquer linha trava a importação inteira.
  const linhas: CamposAcesso[] = [];
  const problemas: string[] = [];
  bruto.forEach((o, i) => {
    const r = lerAcesso((o ?? {}) as Record<string, unknown>);
    const nome = typeof (o as { servico?: unknown })?.servico === "string" ? (o as { servico: string }).servico : `linha ${i + 1}`;
    if ("erro" in r) problemas.push(`${nome}: ${r.erro}`);
    else linhas.push(r);
  });
  const vistos = new Set<string>();
  for (const l of linhas) {
    const k = chaveAcesso(l);
    if (vistos.has(k)) problemas.push(`${l.servico}${l.conta ? ` (${l.conta})` : ""}: aparece duas vezes no ficheiro.`);
    vistos.add(k);
  }
  if (problemas.length) {
    console.error(`Nada foi importado. ${problemas.length} ${problemas.length === 1 ? "problema" : "problemas"}:`);
    for (const p of problemas) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(`${linhas.length} acessos no ficheiro, todos válidos e sem aspeto de segredo.`);
  if (soValidar) return;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) {
    console.error("Falta NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no .env.local.");
    process.exit(1);
  }
  const s = createClient(url, chave, { auth: { persistSession: false } });
  const { data: existentes, error } = await s.from("acessos").select("servico, conta");
  if (error) {
    console.error(`Não consegui ler os acessos (${error.message}). O SQL dos acessos já correu? (npm run schema)`);
    process.exit(1);
  }
  const ja = new Set((existentes ?? []).map((a) => chaveAcesso(a)));
  const novos = linhas.filter((l) => !ja.has(chaveAcesso(l)));
  if (novos.length) {
    const { error: e2 } = await s.from("acessos").insert(novos);
    if (e2) {
      console.error(`Erro ao inserir: ${e2.message}`);
      process.exit(1);
    }
  }
  console.log(`Inseridos ${novos.length}. Já existiam ${linhas.length - novos.length}.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
