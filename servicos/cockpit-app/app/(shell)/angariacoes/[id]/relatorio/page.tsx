"use client";

import { EsqueletoLista } from "@/components/Esqueleto";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { sbBrowser } from "@/lib/supabase-browser";
import { blocoDeDia, dataDoDia, diaDeHoje, type Acao, type Angariacao } from "@/lib/angariacao";
import { formatarDia, somarDias } from "@/lib/datas";

const REGIME = { exclusivo: "Em exclusivo", nao_exclusivo: "Não exclusivo" } as const;
const SEMANAS_A_FRENTE = 4;

type AngComContacto = Angariacao & { proprietarios: { contactos: { nome: string; telemovel: string | null } } | null };
type Grupo = { nome: string; vezes: number; ultima: Date; notas: { quando: Date; texto: string }[] };

const curta = (d: Date) => d.toLocaleDateString("pt-PT", { day: "numeric", month: "numeric" });

// Relatório para o proprietário: o que já foi feito pelo imóvel (agrupado por tipo de ação, com as notas)
// e o que vem nas próximas semanas. Ações em atraso ficam de fora. "Imprimir" guarda em PDF.
export default function Relatorio() {
  const { id } = useParams<{ id: string }>();
  const [ang, setAng] = useState<AngComContacto | null>(null);
  const [acoes, setAcoes] = useState<Acao[]>([]);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    (async () => {
      const sb = sbBrowser();
      const [r1, r2] = await Promise.all([
        sb.from("angariacoes").select("*, proprietarios(contactos(nome, telemovel))").eq("id", id).single(),
        sb.from("angariacao_acoes").select("*").eq("angariacao_id", id).order("dia"),
      ]);
      if (r1.data) setAng(r1.data as unknown as AngComContacto);
      setAcoes((r2.data ?? []) as Acao[]);
    })();
  }, [id]);

  if (!ang) return <EsqueletoLista n={3} />;

  const agora = new Date();
  const dia = Math.max(0, Math.min(diaDeHoje(ang.inicio), ang.duracao_dias));
  const feitas = acoes.filter((a) => a.feita);
  const contactosComProprietario = feitas.filter((a) => a.follow_up).length;

  // O que foi feito, agrupado por tipo de ação (sem os follow ups, que contam à parte)
  const grupos = Object.values(
    feitas
      .filter((a) => !a.follow_up)
      .reduce<Record<string, Grupo>>((m, a) => {
        const quando = a.feita_em ? new Date(a.feita_em) : dataDoDia(ang.inicio, a.dia);
        const g = (m[a.nome] ??= { nome: a.nome, vezes: 0, ultima: quando, notas: [] });
        g.vezes++;
        if (quando > g.ultima) g.ultima = quando;
        if (a.feedback?.trim()) g.notas.push({ quando, texto: a.feedback.trim() });
        return m;
      }, {})
  ).sort((x, y) => y.ultima.getTime() - x.ultima.getTime());

  // O que vem nas próximas semanas: ações por fazer cujo bloco ainda não terminou e começa antes do limite
  const limite = somarDias(agora, SEMANAS_A_FRENTE * 7);
  const proximas = [
    ...new Set(
      acoes
        .filter((a) => !a.feita && !a.follow_up)
        .filter((a) => dataDoDia(ang.inicio, blocoDeDia(a.dia) * 10) >= agora && dataDoDia(ang.inicio, a.dia) <= limite)
        .sort((a, b) => a.dia - b.dia)
        .map((a) => a.nome)
    ),
  ];

  const tel = ang.proprietarios?.contactos.telemovel ?? null;
  const resumo = [
    `Ponto de situação: ${ang.titulo} (${formatarDia(agora)})`,
    ang.vendido_em ? `Imóvel vendido a ${formatarDia(new Date(ang.vendido_em + "T00:00:00"))}.` : `Estamos no dia ${dia} de ${ang.duracao_dias} do contrato.`,
    `Já fizemos ${feitas.length - contactosComProprietario} ${feitas.length - contactosComProprietario === 1 ? "ação" : "ações"} pelo seu imóvel:`,
    ...grupos.map((g) => `- ${g.nome}${g.vezes > 1 ? ` (${g.vezes} vezes, a última a ${curta(g.ultima)})` : ` (${curta(g.ultima)})`}`),
    ...(proximas.length && !ang.vendido_em ? ["", `Nas próximas semanas: ${proximas.join(", ")}.`] : []),
    "",
    "Qualquer dúvida, estou ao dispor.",
  ].join("\n");

  async function copiar() {
    try {
      await navigator.clipboard.writeText(resumo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      window.prompt("Copia o resumo:", resumo);
    }
  }

  const tile = "rounded-2xl bg-white p-4 print:border print:border-black/10";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href={`/angariacoes/${ang.id}`} className="text-sm font-medium text-azul-escuro">
          &larr; Plano
        </Link>
        <div className="flex flex-wrap gap-2">
          <button onClick={copiar} className="rounded-full bg-black/5 px-4 py-2 text-sm font-medium text-tinta">
            {copiado ? "Copiado" : "Copiar resumo"}
          </button>
          {tel && (
            <a
              href={`https://wa.me/${tel.replace(/\D/g, "")}?text=${encodeURIComponent(resumo)}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-verde px-4 py-2 text-sm font-semibold text-tinta"
            >
              Enviar por WhatsApp
            </a>
          )}
          <button onClick={() => window.print()} className="rounded-full bg-tinta px-4 py-2 text-sm font-semibold text-white">
            Guardar em PDF
          </button>
        </div>
      </div>

      <header>
        <p className="text-sm text-secundario">Relatório de angariação · {formatarDia(agora)}</p>
        <h1 className="mt-1 text-4xl font-bold leading-tight tracking-tight text-tinta">{ang.titulo}</h1>
        <p className="mt-2 text-sm text-secundario">
          {ang.proprietarios?.contactos.nome ?? "Proprietário não indicado"}
          {ang.regime ? ` · ${REGIME[ang.regime]}` : ""} · contrato de {ang.duracao_dias} dias, de {formatarDia(dataDoDia(ang.inicio, 0))} a{" "}
          {formatarDia(dataDoDia(ang.inicio, ang.duracao_dias - 1))}
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className={tile}>
          <p className="text-4xl font-bold tracking-tight text-tinta">{feitas.length - contactosComProprietario}</p>
          <p className="text-sm text-secundario">ações realizadas</p>
        </div>
        <div className={tile}>
          <p className="text-4xl font-bold tracking-tight text-tinta">{grupos.length}</p>
          <p className="text-sm text-secundario">formas de divulgação</p>
        </div>
        <div className={`${tile} col-span-2 sm:col-span-1`}>
          {ang.vendido_em ? (
            <>
              <p className="text-2xl font-bold tracking-tight text-tinta">Vendido</p>
              <p className="text-sm text-secundario">a {formatarDia(new Date(ang.vendido_em + "T00:00:00"))}</p>
            </>
          ) : (
            <>
              <p className="text-4xl font-bold tracking-tight text-tinta">
                {dia}
                <span className="text-lg font-semibold text-secundario"> / {ang.duracao_dias}</span>
              </p>
              <p className="text-sm text-secundario">dias de contrato</p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/[0.06]">
                <div className="h-full rounded-full bg-azul" style={{ width: `${(dia / ang.duracao_dias) * 100}%` }} />
              </div>
            </>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight text-tinta">O que já fizemos</h2>
        {grupos.length === 0 ? (
          <p className="text-sm text-secundario">Ainda não há ações realizadas.</p>
        ) : (
          <ul className="divide-y divide-black/[0.06] rounded-3xl bg-white px-5 print:border print:border-black/10">
            {grupos.map((g) => (
              <li key={g.nome} className="py-4 [break-inside:avoid]">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-base font-semibold text-tinta">{g.nome}</p>
                  <p className="shrink-0 text-sm text-secundario">
                    {g.vezes > 1 ? `${g.vezes} vezes · a última a ${curta(g.ultima)}` : `a ${curta(g.ultima)}`}
                  </p>
                </div>
                {g.notas.length > 0 && (
                  <ul className="mt-2 space-y-1.5">
                    {g.notas.map((n, i) => (
                      <li key={i} className="rounded-xl bg-black/[0.035] px-3 py-2 text-sm text-tinta">
                        <span className="text-secundario">{curta(n.quando)}: </span>
                        {n.texto}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
        {contactosComProprietario > 0 && (
          <p className="text-sm text-secundario">
            E {contactosComProprietario} {contactosComProprietario === 1 ? "contacto consigo" : "contactos consigo"} para ponto de situação.
          </p>
        )}
      </section>

      {!ang.vendido_em && proximas.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold tracking-tight text-tinta">Nas próximas semanas</h2>
          <ul className="flex flex-wrap gap-2">
            {proximas.map((n) => (
              <li key={n} className="rounded-full bg-azul-suave px-3 py-1.5 text-sm font-medium text-azul-escuro print:border print:border-black/10">
                {n}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
