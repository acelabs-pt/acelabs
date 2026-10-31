"use client";

import { EsqueletoLista } from "@/components/Esqueleto";
import { useEffect, useState } from "react";
import { naApp, partilhar } from "@/lib/nativo";
import { useParams } from "next/navigation";
import Link from "next/link";
import { sbBrowser } from "@/lib/supabase-browser";
import { dataDoDia, dataLocal, diaDeHoje, NOME_FOLLOW_UP, type Acao, type Angariacao } from "@/lib/angariacao";
import { formatarDia, inicioDoDia } from "@/lib/datas";
import { linkWhatsapp } from "@/lib/whatsapp";

const REGIME = { exclusivo: "em exclusivo", nao_exclusivo: "não exclusivo" } as const;
const DIAS_PERIODO = 30;

type AngComContacto = Angariacao & { proprietarios: { contactos: { nome: string; telemovel: string | null } } | null };

// Agrupa as ações por finalidade, para dar um fio condutor ao texto de cada período.
const TEMAS = [
  {
    frase: "preparar e posicionar o imóvel no mercado",
    acoes: ["Fotografias/Vídeo", "Placa de Venda", "Inserção Portais/Site", "Refresh do Anúncio"],
  },
  {
    frase: "divulgar o imóvel junto de compradores e parceiros",
    acoes: ["Distribuição Flyers", "Newsletter Base de Dados", "Campanha Social Media", "Campanha META", "Newsletter Agências"],
  },
  {
    frase: "procurar compradores de forma ativa",
    acoes: ["Propostas Múltiplas", "Open House", "Parceria negócios na zona"],
  },
  { frase: "manter o proprietário informado", acoes: [NOME_FOLLOW_UP] },
];
const TEMA_OUTRAS = "desenvolver ações à medida deste imóvel";

const nomeAcao = (a: Acao) => (a.follow_up ? "Follow up com o proprietário" : a.nome);
const dataCurta = (d: Date) => d.toLocaleDateString("pt-PT", { day: "numeric", month: "long" });
const dataLonga = (d: Date) => d.toLocaleDateString("pt-PT", { day: "numeric", month: "long", year: "numeric" });
const curta = (d: Date) => d.toLocaleDateString("pt-PT", { day: "numeric", month: "numeric" });

function fraseDoPeriodo(acoes: Acao[]): string {
  const frases = TEMAS.filter((t) => acoes.some((a) => t.acoes.includes(a.nome))).map((t) => t.frase);
  if (acoes.some((a) => !TEMAS.some((t) => t.acoes.includes(a.nome)))) frases.push(TEMA_OUTRAS);
  const lista = frases.length > 1 ? `${frases.slice(0, -1).join(", ")} e ${frases[frases.length - 1]}` : frases[0];
  return `Neste período, o trabalho centrou-se em ${lista}.`;
}

// Relatório para o proprietário, em A4 vertical: só as ações realizadas, contadas como uma história
// ao longo do contrato. Nunca mostra ações por fazer ou em atraso (nem no resumo para copiar ou enviar).
// Por cima da folha: copiar o resumo, enviar por WhatsApp ao proprietário e guardar em PDF.
export default function Relatorio() {
  const { id } = useParams<{ id: string }>();
  const [ang, setAng] = useState<AngComContacto | null>(null);
  const [acoes, setAcoes] = useState<Acao[]>([]);
  const [copiado, setCopiado] = useState(false);
  const [nativa, setNativa] = useState(false);
  useEffect(() => setNativa(naApp()), []);

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

  const feitas = acoes.filter((a) => a.feita).sort((a, b) => (a.feita_em ?? "").localeCompare(b.feita_em ?? ""));
  const inicio = dataLocal(ang.inicio);
  const fim = dataDoDia(ang.inicio, ang.duracao_dias - 1);
  const dia = diaDeHoje(ang.inicio);
  const proprietario = ang.proprietarios?.contactos.nome;
  const tel = ang.proprietarios?.contactos.telemovel ?? null;

  // período do contrato (30 dias) em que cada ação foi realmente feita
  const periodos = new Map<number, Acao[]>();
  for (const a of feitas) {
    const diaFeito = a.feita_em ? Math.round((inicioDoDia(new Date(a.feita_em)).getTime() - inicio.getTime()) / 86400000) : a.dia;
    const p = Math.max(0, Math.floor(diaFeito / DIAS_PERIODO));
    periodos.set(p, [...(periodos.get(p) ?? []), a]);
  }
  const ordenados = [...periodos.entries()].sort((x, y) => x[0] - y[0]);

  // Resumo curto para copiar ou mandar por WhatsApp: as mesmas ações, agrupadas por nome
  const porNome = new Map<string, { vezes: number; ultima: Date }>();
  for (const a of feitas) {
    const quando = a.feita_em ? new Date(a.feita_em) : dataDoDia(ang.inicio, a.dia);
    const g = porNome.get(nomeAcao(a)) ?? { vezes: 0, ultima: quando };
    g.vezes++;
    if (quando > g.ultima) g.ultima = quando;
    porNome.set(nomeAcao(a), g);
  }
  const agora = new Date();
  const resumo = [
    `Ponto de situação: ${ang.titulo} (${formatarDia(agora)})`,
    ang.vendido_em
      ? `Imóvel vendido a ${formatarDia(new Date(ang.vendido_em + "T00:00:00"))}.`
      : dia >= 1 && dia <= ang.duracao_dias
      ? `Estamos no dia ${dia} de ${ang.duracao_dias} do contrato.`
      : "",
    feitas.length ? `Já fizemos ${feitas.length} ${feitas.length === 1 ? "ação" : "ações"} pelo seu imóvel:` : "Ainda não há ações realizadas para apresentar.",
    ...[...porNome.entries()].map(([nome, g]) => `- ${nome}${g.vezes > 1 ? ` (${g.vezes} vezes, a última a ${curta(g.ultima)})` : ` (${curta(g.ultima)})`}`),
    "",
    "Qualquer dúvida, estou ao dispor.",
  ]
    .filter((l, i) => l !== "" || i > 2)
    .join("\n");

  async function copiar() {
    try {
      await navigator.clipboard.writeText(resumo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      window.prompt("Copia o resumo:", resumo);
    }
  }

  return (
    <div>
      <style>{`
        @page { size: A4 portrait; margin: 16mm; }
        @media print { body { background: #fff !important; } .folha { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      `}</style>

      <div className="mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href={`/angariacoes/${ang.id}`} className="text-sm font-medium text-azul-escuro">
          &larr; Plano
        </Link>
        <div className="flex flex-wrap gap-2">
          <button onClick={copiar} className="rounded-full bg-black/5 px-4 py-2 text-sm font-medium text-tinta">
            {copiado ? "Copiado" : "Copiar resumo"}
          </button>
          {nativa && (
            <button onClick={() => void partilhar({ titulo: ang.titulo, texto: resumo })} className="rounded-full bg-azul px-4 py-2 text-sm font-semibold text-white">
              Partilhar
            </button>
          )}
          {tel && (
            <a href={linkWhatsapp(tel, resumo)} target="_blank" rel="noreferrer" className="rounded-full bg-verde px-4 py-2 text-sm font-semibold text-tinta">
              Enviar por WhatsApp
            </a>
          )}
          <button onClick={() => window.print()} className="rounded-full bg-tinta px-4 py-2 text-sm font-semibold text-white">
            Guardar em PDF
          </button>
        </div>
      </div>

      <article className="folha mx-auto max-w-[210mm] bg-white p-6 text-tinta shadow-sm sm:p-10 print:max-w-none print:p-0 print:shadow-none">
        <header className="border-b border-black/10 pb-5">
          <p className="text-xs font-medium text-azul-escuro">Relatório de angariação</p>
          <h1 className="mt-1 text-3xl font-semibold leading-tight">{ang.titulo}</h1>
          <p className="mt-2 text-sm text-secundario">
            {proprietario ? `${proprietario} · ` : ""}
            {ang.regime ? `Contrato ${REGIME[ang.regime]} · ` : "Contrato "}
            {ang.duracao_dias} dias, de {dataCurta(inicio)} a {dataLonga(fim)}
          </p>
          <p className="mt-1 text-xs text-secundario">Emitido a {dataLonga(agora)}</p>
        </header>

        <section className="py-5 text-[15px] leading-relaxed">
          <p>
            Este relatório resume o trabalho realizado na angariação deste imóvel desde o início do contrato
            {ang.vendido_em
              ? `, até à venda, a ${dataLonga(new Date(ang.vendido_em + "T00:00:00"))}`
              : dia >= 1 && dia <= ang.duracao_dias
              ? `, e reflete o ponto em que estamos, o dia ${dia} de ${ang.duracao_dias}`
              : ""}
            .{" "}
            {feitas.length === 0
              ? "Ainda não há ações realizadas para apresentar."
              : `Foram realizadas ${feitas.length} ${feitas.length === 1 ? "ação" : "ações"}, apresentadas por período e pela ordem em que aconteceram.`}
          </p>
        </section>

        {ordenados.map(([p, lista]) => {
          const de = p * DIAS_PERIODO + 1;
          const ate = (p + 1) * DIAS_PERIODO;
          return (
            <section key={p} className="break-inside-avoid border-t border-black/10 py-5">
              <h2 className="text-lg font-semibold">
                {p === 0 ? "Primeiros 30 dias" : `Dias ${de} a ${ate}`}
                <span className="ml-2 text-sm font-normal text-secundario">
                  {dataCurta(dataDoDia(ang.inicio, de - 1))} a {dataCurta(dataDoDia(ang.inicio, ate - 1))}
                </span>
              </h2>
              <p className="mt-1 text-[15px] leading-relaxed text-secundario">{fraseDoPeriodo(lista)}</p>
              <ul className="mt-3 space-y-3">
                {lista.map((a) => (
                  <li key={a.id} className="break-inside-avoid border-l-2 border-azul pl-3">
                    <p className="text-[15px] font-medium">{nomeAcao(a)}</p>
                    <p className="text-xs text-secundario">{a.feita_em ? dataCurta(new Date(a.feita_em)) : ""}</p>
                    {a.feedback && <p className="mt-1 text-sm leading-relaxed">{a.feedback}</p>}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

        {feitas.length > 0 && <p className="border-t border-black/10 pt-5 text-sm text-secundario">Ficamos ao dispor para qualquer esclarecimento.</p>}
      </article>
    </div>
  );
}
