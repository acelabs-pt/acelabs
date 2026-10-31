// Compara o Word gerado pela app com o Word FINAL, depois de a solicitadora o editar, e lista tudo
// o que ela mudou (parágrafo a parágrafo, palavra a palavra). É a medida da distância entre o
// contrato gerado e o contrato ideal: quanto menos mudanças, melhor o gerador.
//
// Uso: npm run comparar:final -- <gerado.docx> <final.docx> [relatorio.md]
//
// Cada contrato corrigido por ela devia gerar um par de ficheiros (o que a app gerou e o que ficou
// assinado). Com 5 a 10 pares vêem-se as correcções que se repetem - essas são as que se
// automatizam. Um .docx com alterações registadas (track changes) deve ser aceite/guardado antes.

import fs from "fs";
import { textoDoDocx } from "../lib/cpcv-leitor";

function paragrafos(texto: string): string[] {
  return texto
    .split("\n")
    .map((l) => l.replace(/_{3,}/g, "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

// Subsequência comum mais longa entre duas listas; devolve os pares de índices alinhados.
function lcs<T>(a: T[], b: T[], igual: (x: T, y: T) => boolean): [number, number][] {
  const n = a.length;
  const m = b.length;
  const t: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      t[i][j] = igual(a[i], b[j]) ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1]);
    }
  }
  const pares: [number, number][] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (igual(a[i], b[j])) {
      pares.push([i, j]);
      i++;
      j++;
    } else if (t[i + 1][j] >= t[i][j + 1]) i++;
    else j++;
  }
  return pares;
}

function palavras(s: string): string[] {
  return s.split(/\s+/).filter(Boolean);
}

// "palavra [-removida-] {+acrescentada+}"
function diffPalavras(gerado: string, final: string): { texto: string; removidas: number; acrescentadas: number } {
  const a = palavras(gerado);
  const b = palavras(final);
  const pares = lcs(a, b, (x, y) => x === y);
  const partes: string[] = [];
  let i = 0;
  let j = 0;
  let removidas = 0;
  let acrescentadas = 0;
  const fechar = (ate_i: number, ate_j: number) => {
    const r = a.slice(i, ate_i);
    const n = b.slice(j, ate_j);
    if (r.length) partes.push(`[-${r.join(" ")}-]`);
    if (n.length) partes.push(`{+${n.join(" ")}+}`);
    removidas += r.length;
    acrescentadas += n.length;
  };
  for (const [pi, pj] of pares) {
    fechar(pi, pj);
    partes.push(a[pi]);
    i = pi + 1;
    j = pj + 1;
  }
  fechar(a.length, b.length);
  return { texto: partes.join(" "), removidas, acrescentadas };
}

function similaridade(x: string, y: string): number {
  const a = new Set(palavras(x.toLowerCase()));
  const b = new Set(palavras(y.toLowerCase()));
  if (a.size === 0 || b.size === 0) return 0;
  let comuns = 0;
  for (const p of a) if (b.has(p)) comuns++;
  return comuns / (a.size + b.size - comuns);
}

export type ResultadoComparacao = {
  linhas: string[];
  totais: { paragrafosGerados: number; iguais: number; alterados: number; removidos: number; acrescentados: number; palavrasRemovidas: number; palavrasAcrescentadas: number; fidelidade: number };
};

export function compararTextos(textoGerado: string, textoFinal: string): ResultadoComparacao {
  const G = paragrafos(textoGerado);
  const F = paragrafos(textoFinal);
  const ancoras = lcs(G, F, (x, y) => x === y);
  const linhas: string[] = [];
  const t = { paragrafosGerados: G.length, iguais: ancoras.length, alterados: 0, removidos: 0, acrescentados: 0, palavrasRemovidas: 0, palavrasAcrescentadas: 0, fidelidade: 0 };

  // Entre duas âncoras ficam parágrafos que mudaram, desapareceram ou apareceram: emparelha os
  // parecidos (por ordem) e o resto conta como removido/acrescentado.
  const processarIntervalo = (gi: number, gf: number, fi: number, ff: number) => {
    const gs = G.slice(gi, gf);
    const fs_ = F.slice(fi, ff);
    let j = 0;
    for (const g of gs) {
      let melhor = -1;
      let melhorSim = 0.35;
      for (let k = j; k < fs_.length; k++) {
        const s = similaridade(g, fs_[k]);
        if (s > melhorSim) {
          melhorSim = s;
          melhor = k;
        }
      }
      if (melhor === -1) {
        linhas.push(`REMOVIDO: ${g}`);
        t.removidos++;
        t.palavrasRemovidas += palavras(g).length;
        continue;
      }
      for (let k = j; k < melhor; k++) {
        linhas.push(`ACRESCENTADO: ${fs_[k]}`);
        t.acrescentados++;
        t.palavrasAcrescentadas += palavras(fs_[k]).length;
      }
      const d = diffPalavras(g, fs_[melhor]);
      linhas.push(`ALTERADO: ${d.texto}`);
      t.alterados++;
      t.palavrasRemovidas += d.removidas;
      t.palavrasAcrescentadas += d.acrescentadas;
      j = melhor + 1;
    }
    for (let k = j; k < fs_.length; k++) {
      linhas.push(`ACRESCENTADO: ${fs_[k]}`);
      t.acrescentados++;
      t.palavrasAcrescentadas += palavras(fs_[k]).length;
    }
  };

  let gi = 0;
  let fi = 0;
  for (const [ag, af] of ancoras) {
    processarIntervalo(gi, ag, fi, af);
    gi = ag + 1;
    fi = af + 1;
  }
  processarIntervalo(gi, G.length, fi, F.length);

  const palavrasFinal = F.reduce((n, p) => n + palavras(p).length, 0) || 1;
  t.fidelidade = Math.max(0, Math.round((1 - (t.palavrasRemovidas + t.palavrasAcrescentadas) / (2 * palavrasFinal)) * 1000) / 10);
  return { linhas, totais: t };
}

async function main() {
  const [geradoPath, finalPath, saida] = process.argv.slice(2);
  if (!geradoPath || !finalPath) {
    console.error("Uso: npm run comparar:final -- <gerado.docx> <final.docx> [relatorio.md]");
    process.exit(1);
  }
  const [tg, tf] = await Promise.all([textoDoDocx(fs.readFileSync(geradoPath)), textoDoDocx(fs.readFileSync(finalPath))]);
  const { linhas, totais } = compararTextos(tg, tf);
  const resumo =
    `Parágrafos gerados: ${totais.paragrafosGerados} | iguais: ${totais.iguais} | alterados: ${totais.alterados} | ` +
    `removidos: ${totais.removidos} | acrescentados: ${totais.acrescentados}\n` +
    `Palavras removidas: ${totais.palavrasRemovidas} | acrescentadas: ${totais.palavrasAcrescentadas} | ` +
    `fidelidade do gerado ao final: ${totais.fidelidade}%`;
  const relatorio = `${resumo}\n\n${linhas.length ? linhas.join("\n\n") : "Sem alterações: o contrato final é igual ao gerado."}\n`;
  console.log(relatorio);
  if (saida) fs.writeFileSync(saida, relatorio, "utf8");
}

// Só corre quando chamado como script (o ficheiro também exporta compararTextos para testes).
if (process.argv[1] && /comparar-final/.test(process.argv[1])) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
