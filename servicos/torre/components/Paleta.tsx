"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { indicePesquisa, type Resultado } from "@/app/acoes-pesquisa";
import { euros } from "@/lib/dinheiro";
import { normalizar } from "@/lib/texto";

// Pesquisa rápida e comandos (Ctrl K / Cmd K, ou "/"), como no Linear e no Attio: encontra qualquer movimento, fatura,
// fornecedor ou débito, e faz as ações mais comuns sem andar pelos menus.

const ACOES: { titulo: string; detalhe: string; href: string; procura: string }[] = [
  { titulo: "Carregar faturas", detalhe: "PDF ou fotografia", href: "/faturas#caixa", procura: "carregar faturas recibo upload fotografia pdf" },
  { titulo: "Rever faturas", detalhe: "As que estão por rever", href: "/faturas?ver=rever", procura: "rever faturas por rever" },
  { titulo: "Importar extrato", detalhe: "CSV do banco", href: "/movimentos/importar", procura: "importar extrato banco csv" },
  { titulo: "Lançar movimento", detalhe: "Despesa ou receita à mão", href: "/movimentos?novo=1", procura: "lancar novo movimento despesa receita manual" },
  { titulo: "Despesas sem fatura", detalhe: "Movimentos à espera de fatura", href: "/movimentos?sem=fatura", procura: "sem fatura falta faturas em falta" },
  { titulo: "Por classificar", detalhe: "Movimentos sem categoria", href: "/movimentos?sem=categoria", procura: "por classificar sem categoria" },
  { titulo: "Pacote do contabilista", detalhe: "ZIP do mês com faturas e movimentos", href: "/faturas#pacote", procura: "pacote contabilista zip mes exportar" },
  { titulo: "Resultados", detalhe: "Proveitos e custos por mês", href: "/resultados", procura: "resultados p&l pl proveitos custos lucro iva trimestre" },
  { titulo: "Tesouraria", detalhe: "Previsão do caixa e autonomia", href: "/tesouraria", procura: "tesouraria caixa previsao autonomia dinheiro runway" },
  { titulo: "Clientes", detalhe: "Contratos e mensalidades", href: "/contactos?ver=clientes", procura: "clientes contratos mensalidades mrr" },
  { titulo: "Novo cliente ou fornecedor", detalhe: "Criar a ficha", href: "/contactos?novo=1#novo", procura: "novo cliente fornecedor criar contrato" },
  { titulo: "Mudar PIN", detalhe: "A tua conta", href: "/pin", procura: "mudar pin codigo password palavra passe" },
];

const ROTULO: Record<Resultado["tipo"], string> = { fatura: "Faturas", entidade: "Fornecedores e clientes", debito: "Débitos diretos", conta: "Contas", movimento: "Movimentos" };

function dinheiro(v?: number, moeda?: string) {
  if (v === undefined) return null;
  return !moeda || moeda === "EUR" ? euros(v) : `${(v / 100).toLocaleString("pt-PT", { minimumFractionDigits: 2 })} ${moeda}`;
}

export default function Paleta() {
  const [aberta, setAberta] = useState(false);
  const [q, setQ] = useState("");
  const [indice, setIndice] = useState<Resultado[] | null>(null);
  const [sel, setSel] = useState(0);
  const entrada = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const abrir = () => setAberta(true);
    const tecla = (e: KeyboardEvent) => {
      const escrever = e.target instanceof HTMLElement && (e.target.closest("input, textarea, select, [contenteditable]") !== null);
      if ((e.key === "k" || e.key === "K") && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setAberta((a) => !a);
      } else if (e.key === "/" && !escrever) {
        e.preventDefault();
        setAberta(true);
      }
    };
    window.addEventListener("torre:pesquisa", abrir);
    window.addEventListener("keydown", tecla);
    return () => {
      window.removeEventListener("torre:pesquisa", abrir);
      window.removeEventListener("keydown", tecla);
    };
  }, []);

  useEffect(() => {
    if (!aberta) return;
    setQ("");
    setSel(0);
    setTimeout(() => entrada.current?.focus(), 10);
    indicePesquisa().then(setIndice).catch(() => setIndice([]));
  }, [aberta]);

  const lista = useMemo(() => {
    const termos = normalizar(q).split(/\s+/).filter(Boolean);
    const bate = (texto: string) => {
      const n = normalizar(texto);
      return termos.every((t) => n.includes(t));
    };
    const acoes = ACOES.filter((a) => !termos.length || bate(`${a.titulo} ${a.procura}`)).map((a) => ({ grupo: "Ações", titulo: a.titulo, detalhe: a.detalhe, href: a.href, valor: undefined as string | null | undefined }));
    if (!termos.length) return acoes;
    const grupos = new Map<string, typeof acoes>();
    for (const r of indice ?? []) {
      if (!bate(`${r.titulo} ${r.procura}`)) continue;
      const g = ROTULO[r.tipo];
      const l = grupos.get(g) ?? [];
      if (l.length < (r.tipo === "movimento" ? 8 : 5)) l.push({ grupo: g, titulo: r.titulo, detalhe: r.detalhe, href: r.href, valor: dinheiro(r.valor, r.moeda) });
      grupos.set(g, l);
    }
    const ordem = ["Faturas", "Fornecedores e clientes", "Débitos diretos", "Contas", "Movimentos"];
    return [...acoes.slice(0, 3), ...ordem.flatMap((g) => grupos.get(g) ?? [])];
  }, [q, indice]);

  function ir(href: string) {
    setAberta(false);
    router.push(href);
  }

  if (!aberta) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Pesquisa rápida">
      <button type="button" aria-label="Fechar" className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={() => setAberta(false)} />
      <div className="anim-paleta relative w-full max-w-xl overflow-hidden rounded-3xl border border-linha bg-white shadow-2xl">
        <input
          ref={entrada}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setSel(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setAberta(false);
            else if (e.key === "ArrowDown") {
              e.preventDefault();
              setSel((s) => Math.min(s + 1, lista.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setSel((s) => Math.max(s - 1, 0));
            } else if (e.key === "Enter" && lista[sel]) ir(lista[sel].href);
          }}
          placeholder="Procura um fornecedor, valor, descrição... ou uma ação"
          className="w-full border-b border-linha px-5 py-4 text-lg outline-none placeholder:text-secundario"
          aria-label="Pesquisar"
        />
        <ul className="max-h-[55vh] overflow-y-auto p-2" role="listbox">
          {lista.length === 0 && <li className="px-3 py-6 text-center text-base text-secundario">{indice ? "Nada encontrado." : "A carregar..."}</li>}
          {lista.map((r, i) => (
            <li key={`${r.grupo}-${r.href}-${i}`} role="option" aria-selected={i === sel}>
              {(i === 0 || lista[i - 1].grupo !== r.grupo) && <p className="px-3 pb-1 pt-3 text-xs font-semibold text-secundario">{r.grupo}</p>}
              <button
                type="button"
                onMouseMove={() => setSel(i)}
                onClick={() => ir(r.href)}
                className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left ${i === sel ? "bg-azul-suave" : ""}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base text-tinta">{r.titulo}</span>
                  <span className="block truncate text-xs text-secundario">{r.detalhe}</span>
                </span>
                {r.valor && <span className="numero shrink-0 text-sm font-semibold text-tinta">{r.valor}</span>}
              </button>
            </li>
          ))}
        </ul>
        <p className="hidden border-t border-linha px-5 py-2 text-xs text-secundario sm:block">Setas para escolher, Enter para abrir, Esc para fechar.</p>
      </div>
    </div>
  );
}
