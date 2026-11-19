// Ensaio de uma importação, sem gravar nada: lê o Excel/CSV de um cliente e mostra o que o Cockpit faria com ele
// (que coluna liga a quê, quantas linhas entram, erros, avisos, duplicados dentro do ficheiro e colunas que se perdem).
// Usa as mesmas funções da página Importar. Não liga à base de dados: duplicados contra o que já está no Cockpit não se veem.
//
//   npx tsx scripts/ensaiar-importacao.ts <ficheiro.xlsx|.csv> [compradores|proprietarios|angariacoes] [--folha "Nome"] [--detalhe]
//
// Sem entidade, ensaia as três e diz qual encaixa melhor. Nunca imprime nomes nem contactos, só números de linha e mensagens.
import { readFileSync } from "node:fs";
import path from "node:path";
import readXlsxFile, { readSheetNames } from "read-excel-file/node";
import { lerCsv } from "../lib/importar/ficheiro";
import { ESQUEMAS, type Entidade } from "../lib/importar/esquemas";
import { acharCabecalho, juntarNomes, mapearAutomatico, validar } from "../lib/importar/validar";

const args = process.argv.slice(2);
const ficheiro = args.find((a) => !a.startsWith("--") && /\.(xlsx|csv|txt|tsv)$/i.test(a));
const pedida = args.find((a) => ["compradores", "proprietarios", "angariacoes"].includes(a)) as Entidade | undefined;
const iFolha = args.indexOf("--folha");
const folhaPedida = iFolha >= 0 ? args[iFolha + 1] : undefined;
const detalhe = args.includes("--detalhe");
if (!ficheiro) {
  console.log('Uso: npx tsx scripts/ensaiar-importacao.ts <ficheiro.xlsx|.csv> [compradores|proprietarios|angariacoes] [--folha "Nome"] [--detalhe]');
  process.exit(1);
}

const textoDe = (v: unknown) => (v == null ? "" : v instanceof Date ? v.toISOString().slice(0, 10) : String(v));

async function lerFolhas(): Promise<{ nome: string; linhas: string[][] }[]> {
  if (/\.xlsx$/i.test(ficheiro!)) {
    const nomes = await readSheetNames(ficheiro!);
    const escolhidas = folhaPedida ? nomes.filter((n) => n.toLowerCase() === folhaPedida.toLowerCase()) : nomes;
    if (!escolhidas.length) throw new Error(`Folha "${folhaPedida}" não existe. Folhas: ${nomes.join(", ")}`);
    const out = [];
    for (const nome of escolhidas) {
      const linhas = (await readXlsxFile(ficheiro!, { sheet: nome })).map((l) => l.map(textoDe)).filter((l) => l.some((c) => c.trim() !== ""));
      out.push({ nome, linhas });
    }
    return out;
  }
  const buf = readFileSync(ficheiro!);
  let texto = new TextDecoder("utf-8").decode(buf);
  if (texto.includes("�")) texto = new TextDecoder("windows-1252").decode(buf);
  return [{ nome: path.basename(ficheiro!), linhas: lerCsv(texto) }];
}

function ensaiar(e: Entidade, todas: string[][], imprimir: boolean) {
  const iCab = acharCabecalho(e, todas);
  const j = juntarNomes(todas[iCab] ?? [], todas.slice(iCab + 1));
  const cab = j.cabecalho;
  const dados = j.linhas;
  const mapa = mapearAutomatico(e, cab, dados);
  const res = validar(e, dados, mapa, { telemoveis: new Set(), emails: new Set(), titulos: new Set() });
  const comErro = res.filter((r) => r.erros.length);
  const dup = res.filter((r) => !r.erros.length && r.duplicada);
  const entram = res.filter((r) => !r.erros.length && !r.duplicada);
  const ligadas = Object.values(mapa).filter((v) => v != null).length;
  if (!imprimir) return { ligadas, entram: entram.length };

  console.log(`\n=== ${ESQUEMAS[e].titulo} ===`);
  if (iCab > 0) console.log(`Cabeçalho encontrado na linha ${iCab + 1} (as de cima são ignoradas).`);
  console.log("Colunas ligadas:");
  for (const c of ESQUEMAS[e].colunas) {
    const i = mapa[c.chave];
    console.log(`  ${c.rotulo.padEnd(30)} <- ${i == null ? "(nenhuma)" : `"${cab[i]}"`}${c.obrigatoria && i == null ? "   !! OBRIGATÓRIA" : ""}`);
  }
  const usadas = new Set(Object.values(mapa).filter((v): v is number => v != null));
  const perdidas = cab.map((h, k) => ({ h, k })).filter(({ h, k }) => h.trim() && !usadas.has(k));
  if (perdidas.length) {
    console.log("Colunas do ficheiro que NÃO entram (ligar à mão no passo 'rever' ou juntar em Observações antes):");
    for (const { h, k } of perdidas) {
      const cheias = dados.filter((l) => (l[k] ?? "").trim()).length;
      console.log(`  "${h}" (${cheias} linhas preenchidas)`);
    }
  }
  console.log(`\nLinhas de dados: ${res.length} | entram: ${entram.length} | duplicadas no ficheiro: ${dup.length} | com erro (não entram): ${comErro.length}`);

  const contar = (lista: string[]) => {
    const m = new Map<string, number>();
    // agrupa mensagens iguais tirando o valor entre aspas
    for (const s of lista) {
      const k = s.replace(/"[^"]*"/g, '"…"');
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const erros = contar(res.flatMap((r) => r.erros));
  const avisos = contar(res.flatMap((r) => r.avisos));
  if (erros.length) {
    console.log("Erros (a linha não entra):");
    for (const [m, n] of erros) console.log(`  ${String(n).padStart(4)} x ${m}`);
  }
  if (avisos.length) {
    console.log("Avisos (a linha entra, o campo fica vazio ou como está):");
    for (const [m, n] of avisos) console.log(`  ${String(n).padStart(4)} x ${m}`);
  }
  if (detalhe) {
    console.log("Por linha (só número da linha no ficheiro e mensagens):");
    for (const r of res) if (r.erros.length || r.avisos.length || r.duplicada) console.log(`  linha ${r.n + iCab}: ${[...r.erros, ...r.avisos, r.duplicada ?? ""].filter(Boolean).join(" | ")}`);
  }
  return { ligadas, entram: entram.length };
}

lerFolhas()
  .then((folhas) => {
    for (const f of folhas) {
      if (!f.linhas.length) continue;
      console.log(`\n##### Folha: ${f.nome} (${f.linhas.length} linhas com conteúdo)`);
      if (pedida) {
        ensaiar(pedida, f.linhas, true);
      } else {
        const ents: Entidade[] = ["compradores", "proprietarios", "angariacoes"];
        const pont = ents.map((e) => ({ e, ...ensaiar(e, f.linhas, false) })).sort((a, b) => b.ligadas - a.ligadas || b.entram - a.entram);
        console.log(`Encaixa melhor em: ${ESQUEMAS[pont[0].e].titulo} (${pont[0].ligadas} colunas reconhecidas). Outras: ${pont.slice(1).map((p) => `${ESQUEMAS[p.e].titulo} ${p.ligadas}`).join(", ")}`);
        ensaiar(pont[0].e, f.linhas, true);
      }
    }
    process.exit(0);
  })
  .catch((err) => {
    console.error(String(err?.message ?? err));
    process.exit(1);
  });
