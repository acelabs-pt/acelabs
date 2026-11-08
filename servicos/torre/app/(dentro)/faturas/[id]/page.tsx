import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirSocio } from "@/lib/sessao";
import { carregar } from "@/lib/dados";
import { sugerirMovimentos } from "@/lib/ligar";
import { nomeTipoDoc } from "@/lib/qr-fatura";
import { apagarFatura } from "../../../acoes-faturas";
import FormFatura, { type OpcaoMovimento } from "@/components/FormFatura";
import BotaoConfirmar from "@/components/BotaoConfirmar";
import { Etiqueta, emMoeda } from "@/components/ui";

export default async function RevisaoFatura({ params, searchParams }: { params: { id: string }; searchParams: { seguinte?: string } }) {
  const { s } = await exigirSocio();
  const t = await carregar(s);
  const f = t.faturas.find((x) => x.id === params.id);
  if (!f) notFound();

  const conta = new Map(t.contas.map((c) => [c.id, c.nome]));
  const ocupados = new Set(t.faturas.filter((x) => x.id !== f.id).map((x) => x.movimento_id).filter(Boolean) as string[]);
  const sugestoes = sugerirMovimentos(f, t.movimentos, ocupados);
  const opcoes: OpcaoMovimento[] = [];
  const atual = f.movimento_id ? t.movimentos.find((m) => m.id === f.movimento_id) : null;
  if (atual) opcoes.push({ id: atual.id, data: atual.data, descricao: atual.descricao, conta: (atual.conta_id ? conta.get(atual.conta_id) : "Sem conta") ?? "", valor: atual.valor, motivos: [], atual: true });
  for (const x of sugestoes)
    if (x.movimento.id !== atual?.id)
      opcoes.push({ id: x.movimento.id, data: x.movimento.data, descricao: x.movimento.descricao, conta: (x.movimento.conta_id ? conta.get(x.movimento.conta_id) : "Sem conta") ?? "", valor: x.movimento.valor, motivos: x.motivos, pontos: x.pontos });

  // Para pré-preencher a categoria quando se escolhe outro fornecedor: a última usada com cada um.
  const categoriaPorEntidade: Record<string, string> = {};
  for (const m of [...t.movimentos].reverse()) if (m.entidade_id && m.categoria_id) categoriaPorEntidade[m.entidade_id] = m.categoria_id;
  for (const x of [...t.faturas].reverse()) if (x.entidade_id && x.categoria_id && x.estado === "confirmada") categoriaPorEntidade[x.entidade_id] = x.categoria_id;

  const porRever = t.faturas.filter((x) => x.estado === "rever");
  const posicao = porRever.findIndex((x) => x.id === f.id);
  const ficheiro = `/faturas/${f.id}/ficheiro`;
  const imagem = f.ficheiro_tipo?.startsWith("image/");

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/faturas" className="text-sm font-semibold text-azul">Faturas</Link>
        {f.estado === "rever" && posicao >= 0 && (
          <span className="text-sm text-secundario">{searchParams.seguinte ? "Seguinte: " : ""}{posicao + 1} de {porRever.length} por rever</span>
        )}
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-tinta">{f.emitente_nome || "Fatura"}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-base text-secundario">
            <span>{nomeTipoDoc(f.tipo_doc)}{f.numero ? ` ${f.numero}` : ""}</span>
            {f.estado === "confirmada" && <Etiqueta cor="verde">Confirmada</Etiqueta>}
            {f.estado === "rever" && <Etiqueta cor="azul">Por rever</Etiqueta>}
            {f.atcud && <span className="text-xs">ATCUD {f.atcud}</span>}
          </p>
        </div>
        <p className="numero text-3xl font-bold tracking-tight text-tinta">{emMoeda(f.total, f.moeda)}</p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <section className="min-w-0 overflow-hidden rounded-3xl border border-linha bg-white lg:sticky lg:top-6">
          {f.ficheiro ? (
            <>
              {imagem ? (
                // eslint-disable-next-line @next/next/no-img-element -- ficheiro privado servido pela própria Torre
                <img src={ficheiro} alt={`Documento ${f.ficheiro_nome ?? ""}`} className="max-h-[75vh] w-full object-contain" />
              ) : (
                <iframe src={`${ficheiro}#toolbar=0&view=FitH`} title="Documento" className="hidden h-[75vh] w-full md:block" />
              )}
              <div className="flex items-center justify-between gap-3 border-t border-linha px-4 py-3 text-sm">
                <span className="truncate text-secundario">{f.ficheiro_nome}</span>
                <a href={ficheiro} target="_blank" rel="noopener" className="shrink-0 font-semibold text-azul">Abrir o documento</a>
              </div>
            </>
          ) : (
            <p className="p-6 text-base text-secundario">Sem ficheiro.</p>
          )}
        </section>

        <section className="min-w-0 rounded-3xl border border-linha bg-white p-5">
          <FormFatura f={f} entidades={t.entidades} categorias={t.categorias} categoriaPorEntidade={categoriaPorEntidade} movimentos={opcoes} />
          <form action={apagarFatura} className="mt-4 border-t border-linha pt-4">
            <input type="hidden" name="id" value={f.id} />
            <BotaoConfirmar texto="Apagar fatura e ficheiro" pergunta="Apagar esta fatura e o ficheiro? Não se desfaz." />
          </form>
        </section>
      </div>
    </>
  );
}
