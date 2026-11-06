import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirSocio } from "@/lib/sessao";
import { carregar } from "@/lib/dados";
import { chaveDescricao } from "@/lib/calculos";
import { nomeCombina } from "@/lib/ligar";
import { data, hojeLisboa } from "@/lib/texto";
import { apagarMovimento, guardarMovimento } from "../../../acoes";
import { ligarFatura } from "../../../acoes-faturas";
import { Formulario } from "@/components/Formulario";
import CamposMovimento from "@/components/CamposMovimento";
import CaixaFaturas from "@/components/CaixaFaturas";
import BotaoConfirmar from "@/components/BotaoConfirmar";
import { Cartao, Etiqueta, Titulo, Valor, campo, emMoeda, rotulo } from "@/components/ui";

export default async function Movimento({ params }: { params: { id: string } }) {
  const { s } = await exigirSocio();
  const t = await carregar(s);
  const m = t.movimentos.find((x) => x.id === params.id);
  if (!m) notFound();

  const fatura = t.faturas.find((f) => f.movimento_id === m.id);
  // Faturas ainda soltas que podem ser deste movimento (mesmo valor ou mesmo fornecedor, datas perto).
  const candidatas = fatura
    ? []
    : t.faturas
        .filter((f) => !f.movimento_id && f.estado !== "anulada" && (m.valor < 0 ? f.sentido === "recebida" : f.sentido === "emitida"))
        .map((f) => {
          const alvo = f.moeda === "EUR" ? f.total : f.total_eur;
          const valor = alvo !== null && Math.abs(Math.abs(m.valor) - Math.abs(alvo)) <= Math.max(2, Math.abs(alvo) * 0.02);
          const nome = (f.entidade_id && f.entidade_id === m.entidade_id) || nomeCombina(f.emitente_nome, m.descricao);
          const perto = f.data ? Math.abs(Date.parse(m.data) - Date.parse(f.data)) / 86_400_000 <= 45 : true;
          return { f, pontos: (valor ? 2 : 0) + (nome ? 1 : 0), perto };
        })
        .filter((x) => x.pontos > 0 && x.perto)
        .sort((a, b) => b.pontos - a.pontos)
        .slice(0, 4);
  const conta = t.contas.find((c) => c.id === m.conta_id);

  return (
    <>
      <Titulo titulo={m.descricao} texto={`${data(m.data)}, ${conta?.nome ?? ""}. ${m.origem === "extrato" ? "Veio de um extrato importado." : "Lançado à mão."}`}>
        <Link href="/movimentos" className="text-base font-semibold text-azul">Movimentos</Link>
      </Titulo>
      <p className="numero -mt-2 text-3xl font-bold tracking-tight"><Valor c={m.valor} /></p>

      <Cartao titulo="Fatura">
        {fatura ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href={`/faturas/${fatura.id}`} className="min-w-0 flex-1">
              <span className="block truncate text-base font-medium text-tinta">{fatura.emitente_nome || fatura.ficheiro_nome}</span>
              <span className="flex flex-wrap gap-2 text-sm text-secundario">
                {fatura.numero && <span>{fatura.numero}</span>}
                {fatura.data && <span>{data(fatura.data)}</span>}
                <span className="numero">{emMoeda(fatura.total, fatura.moeda)}</span>
                {fatura.estado === "rever" ? <Etiqueta cor="azul">Por rever</Etiqueta> : <Etiqueta cor="verde">Confirmada</Etiqueta>}
              </span>
            </Link>
            <form action={ligarFatura}>
              <input type="hidden" name="fatura_id" value={fatura.id} />
              <input type="hidden" name="movimento_id" value="" />
              <button className="min-h-[40px] rounded-full px-4 text-sm font-semibold text-secundario hover:bg-black/5">Desligar</button>
            </form>
          </div>
        ) : (
          <div className="space-y-4">
            {candidatas.length > 0 && (
              <div>
                <p className="mb-2 text-sm text-secundario">Faturas já na Torre que podem ser deste pagamento:</p>
                <ul className="space-y-2">
                  {candidatas.map(({ f }) => (
                    <li key={f.id} className="flex items-center gap-3 rounded-2xl border border-linha px-4 py-3">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-base text-tinta">{f.emitente_nome || f.ficheiro_nome}</span>
                        <span className="text-sm text-secundario">{[f.numero, f.data ? data(f.data) : null].filter(Boolean).join(", ")}</span>
                      </span>
                      <span className="numero shrink-0 text-base text-tinta">{emMoeda(f.total, f.moeda)}</span>
                      <form action={ligarFatura}>
                        <input type="hidden" name="fatura_id" value={f.id} />
                        <input type="hidden" name="movimento_id" value={m.id} />
                        <button className="min-h-[40px] rounded-full bg-azul px-4 text-sm font-semibold text-white hover:bg-azul-escuro">Ligar</button>
                      </form>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <CaixaFaturas movimentoId={m.id} compacta />
          </div>
        )}
      </Cartao>

      <Cartao titulo="Detalhes">
        <Formulario acao={guardarMovimento} botao="Guardar" limpar={false}>
          <input type="hidden" name="id" value={m.id} />
          <CamposMovimento t={t} m={m} hoje={hojeLisboa()} />
          <div className="rounded-2xl bg-azul-suave p-4">
            <label htmlFor="regra" className={rotulo}>Aplicar sempre (opcional)</label>
            <input id="regra" name="regra" placeholder={chaveDescricao(m.descricao)} className={campo} />
            <p className="mt-1 text-sm text-secundario">
              Escreve uma frase da descrição (por exemplo &quot;{chaveDescricao(m.descricao) || "vercel"}&quot;). Os movimentos por classificar com essa frase, e os que forem importados daqui para a frente, ficam com a mesma categoria, fornecedor e débito.
            </p>
          </div>
        </Formulario>
      </Cartao>
      <form action={apagarMovimento}>
        <input type="hidden" name="id" value={m.id} />
        <BotaoConfirmar texto="Apagar movimento" pergunta="Apagar este movimento? Não se desfaz." />
      </form>
    </>
  );
}
