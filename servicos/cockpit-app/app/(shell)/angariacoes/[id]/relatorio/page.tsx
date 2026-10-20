"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { sbBrowser } from "@/lib/supabase-browser";
import { blocoDeDia, dataDoDia, diaDeHoje, type Acao, type Angariacao } from "@/lib/angariacao";
import { formatarDia } from "@/lib/datas";

const REGIME = { exclusivo: "Em exclusivo", nao_exclusivo: "Não exclusivo" } as const;

// Relatório das ações feitas desde o início do contrato. "Imprimir" permite guardar em PDF.
export default function Relatorio() {
  const { id } = useParams<{ id: string }>();
  const [ang, setAng] = useState<Angariacao | null>(null);
  const [acoes, setAcoes] = useState<Acao[]>([]);

  useEffect(() => {
    (async () => {
      const sb = sbBrowser();
      const [r1, r2] = await Promise.all([
        sb.from("angariacoes").select("*, proprietarios(contactos(nome))").eq("id", id).single(),
        sb.from("angariacao_acoes").select("*").eq("angariacao_id", id).order("dia"),
      ]);
      if (r1.data) setAng(r1.data as unknown as Angariacao);
      setAcoes((r2.data ?? []) as Acao[]);
    })();
  }, [id]);

  if (!ang) return <p className="text-sm text-secundario">A carregar...</p>;

  const feitas = acoes.filter((a) => a.feita).sort((a, b) => (a.feita_em ?? "").localeCompare(b.feita_em ?? ""));
  const pendentes = acoes.filter((a) => !a.feita);
  const dia = diaDeHoje(ang.inicio);
  const nome = (a: Acao) => (a.follow_up ? "Follow up com o proprietário" : a.nome);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between print:hidden">
        <Link href={`/angariacoes/${ang.id}`} className="text-sm text-azul">&larr; Plano</Link>
        <button onClick={() => window.print()} className="rounded-xl bg-azul px-4 py-2 text-sm font-semibold text-white">
          Imprimir / guardar em PDF
        </button>
      </div>

      <header>
        <p className="text-xs text-secundario">Relatório de angariação · {formatarDia(new Date())}</p>
        <h1 className="text-2xl font-semibold text-tinta">{ang.titulo}</h1>
        <p className="text-sm text-secundario">
          {ang.proprietarios?.contactos.nome ?? "Proprietário não indicado"}
          {ang.regime ? ` · ${REGIME[ang.regime]}` : ""} · contrato de {ang.duracao_dias} dias, de{" "}
          {formatarDia(dataDoDia(ang.inicio, 0))} a {formatarDia(dataDoDia(ang.inicio, ang.duracao_dias - 1))}
        </p>
        <p className="mt-1 text-sm text-tinta">
          {ang.vendido_em ? `Vendido a ${formatarDia(new Date(ang.vendido_em + "T00:00:00"))}. ` : dia >= 1 && dia <= ang.duracao_dias ? `Estamos no dia ${dia}. ` : ""}
          {feitas.length} de {acoes.length} ações realizadas.
        </p>
      </header>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-tinta">Ações realizadas</h2>
        {feitas.length === 0 ? (
          <p className="text-sm text-secundario">Ainda não há ações realizadas.</p>
        ) : (
          <ul className="divide-y divide-black/10 rounded-2xl bg-white shadow-sm print:shadow-none">
            {feitas.map((a) => (
              <li key={a.id} className="px-4 py-3">
                <p className="text-sm font-medium text-tinta">{nome(a)}</p>
                <p className="text-xs text-secundario">
                  Feita a {a.feita_em ? formatarDia(new Date(a.feita_em)) : "-"} · bloco dos dias {(blocoDeDia(a.dia) - 1) * 10 + 1} a {blocoDeDia(a.dia) * 10}
                </p>
                {a.feedback && <p className="mt-1 text-sm text-tinta">{a.feedback}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {pendentes.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-tinta">Ainda por fazer</h2>
          <ul className="divide-y divide-black/10 rounded-2xl bg-white shadow-sm print:shadow-none">
            {pendentes.map((a) => (
              <li key={a.id} className="flex justify-between gap-2 px-4 py-2 text-sm">
                <span className="text-tinta">{nome(a)}</span>
                <span className="shrink-0 text-xs text-secundario">dias {(blocoDeDia(a.dia) - 1) * 10 + 1} a {blocoDeDia(a.dia) * 10}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
