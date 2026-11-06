// Os filtros da lista de movimentos, num só sítio: o ecrã e a exportação em CSV mostram exatamente o mesmo.

import { normalizar } from "./texto";
import type { Movimento } from "./tipos";

export type FiltrosMovimentos = { conta?: string; mes?: string; categoria?: string; socio?: string; sem?: string; entidade?: string; q?: string };

export function filtrarMovimentos(movimentos: Movimento[], f: FiltrosMovimentos, faltaFatura: Set<string>): Movimento[] {
  const termos = normalizar(f.q ?? "").split(/\s+/).filter(Boolean);
  return movimentos.filter((m) => {
    if (f.conta && m.conta_id !== f.conta) return false;
    if (f.mes && !m.data.startsWith(f.mes)) return false;
    if (f.categoria && m.categoria_id !== f.categoria) return false;
    if (f.socio && m.socio_id !== f.socio) return false;
    if (f.entidade && m.entidade_id !== f.entidade) return false;
    if (f.sem === "categoria" && m.categoria_id) return false;
    if (f.sem === "fatura" && !faltaFatura.has(m.id)) return false;
    if (termos.length) {
      // Procura no texto e no valor (12,30 ou 12.30).
      const v = (Math.abs(m.valor) / 100).toFixed(2);
      const alvo = normalizar(`${m.descricao} ${m.notas ?? ""} ${v} ${v.replace(".", ",")}`);
      if (!termos.every((x) => alvo.includes(x))) return false;
    }
    return true;
  });
}

/** Folha CSV que abre bem no Excel em português: ";" a separar, vírgula decimal, UTF-8 com BOM. */
export function folhaCsv(cabecalho: string[], linhas: (string | number | null | undefined)[][]): string {
  const cel = (v: string | number | null | undefined) => {
    const x = (v ?? "").toString().replace(/\r?\n/g, " ");
    return /[;"]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x;
  };
  return "﻿" + [cabecalho, ...linhas].map((l) => l.map(cel).join(";")).join("\r\n");
}

export const euroCsv = (c: number | null | undefined) => (c === null || c === undefined ? "" : (c / 100).toFixed(2).replace(".", ","));
