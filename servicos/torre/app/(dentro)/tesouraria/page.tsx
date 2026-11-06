import Link from "next/link";
import { exigirSocio } from "@/lib/sessao";
import { carregar } from "@/lib/dados";
import { contaDeSocios, saldoConta } from "@/lib/calculos";
import { euros } from "@/lib/dinheiro";
import { data, hojeLisboa } from "@/lib/texto";
import { autonomiaEmMeses, eventosFuturos, fixosMensais, mrr, pontoMaisBaixo, porReceber, preverCaixa, saidaMensalMedia, type OrigemEvento } from "@/lib/tesouraria";
import GraficoCaixa from "@/components/GraficoCaixa";
import { Cartao, Etiqueta, Numero, Segmentos, Titulo, Vazio, emMoeda } from "@/components/ui";

const ROTULO: Record<OrigemEvento, { texto: string; cor: "azul" | "verde" | "ambar" | "cinza" }> = {
  debito: { texto: "Débito direto", cor: "cinza" },
  contrato: { texto: "Contrato", cor: "verde" },
  a_receber: { texto: "Por receber", cor: "verde" },
  a_pagar: { texto: "Por pagar", cor: "ambar" },
};

export default async function Tesouraria({ searchParams }: { searchParams: { dias?: string } }) {
  const { s } = await exigirSocio();
  const t = await carregar(s);
  const hoje = hojeLisboa();
  const dias = [30, 60, 90].includes(Number(searchParams.dias)) ? Number(searchParams.dias) : 90;

  const daEmpresa = t.contas.filter((c) => c.ativa && !contaDeSocios(c));
  if (!daEmpresa.length)
    return (
      <>
        <Titulo titulo="Tesouraria" texto="O dinheiro da empresa nos próximos dias." />
        <Vazio texto="Ainda não há uma conta da empresa. Cria-a para ver a previsão." link="/definicoes?s=contas" rotuloLink="Criar as contas" />
      </>
    );

  const caixa = daEmpresa.reduce((x, c) => x + saldoConta(c, t.movimentos), 0);
  const eventos = eventosFuturos({ hoje, dias, subscricoes: t.subscricoes, contas: t.contas, faturas: t.faturas, contratos: t.contratos, entidades: t.entidades });
  const pontos = preverCaixa(caixa, eventos, hoje, dias);
  const baixo = pontoMaisBaixo(pontos);
  const fim = pontos[pontos.length - 1].saldo;
  const entradaMensal = mrr(t.contratos, hoje);
  const saidaMedia = saidaMensalMedia(t.movimentos, t.categorias, hoje, 3);
  const fixos = fixosMensais(t.subscricoes, t.contas);
  // Sem histórico de 3 meses, os débitos diretos dão uma primeira ideia da saída mensal.
  const saida = Math.max(saidaMedia, fixos);
  const autonomia = autonomiaEmMeses(caixa, saida, entradaMensal);
  const receber = porReceber(t.faturas, hoje);
  const porComecar = t.contratos.filter((c) => c.estado === "ativo" && c.inicio > hoje).length;

  let corrente = caixa;
  const linhas = eventos.slice(0, 40).map((e) => {
    corrente += e.valor;
    return { e, saldo: corrente };
  });
  const entra = eventos.filter((e) => e.valor > 0).reduce((x, e) => x + e.valor, 0);
  const sai = eventos.filter((e) => e.valor < 0).reduce((x, e) => x + e.valor, 0);

  return (
    <>
      <Titulo titulo="Tesouraria" texto="Quanto dinheiro a empresa vai ter, com o que já se sabe. É uma estimativa." />
      <Segmentos
        atual={String(dias)}
        opcoes={[30, 60, 90].map((d) => ({ valor: String(d), texto: `${d} dias`, href: `/tesouraria?dias=${d}` }))}
      />

      {baixo.saldo < 0 && (
        <p role="alert" className="rounded-2xl bg-ambar-fundo px-4 py-3 text-base text-ambar-texto">
          O caixa pode ficar negativo a {data(baixo.dia)} ({euros(baixo.saldo)}). Convém receber as faturas em atraso ou adiar o que for possível.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Numero legenda="Caixa hoje" valor={caixa} nota={`${daEmpresa.length} ${daEmpresa.length === 1 ? "conta" : "contas"} da empresa`} />
        <Numero legenda={`Em ${dias} dias`} valor={fim} sinal nota={`${euros(entra)} entra, ${euros(-sai)} sai`} />
        <Numero legenda="Ponto mais baixo" valor={baixo.saldo} sinal nota={baixo.dia === hoje ? "É hoje" : data(baixo.dia)} />
        <Numero
          legenda="Autonomia"
          valor={autonomia === null ? (saida > 0 ? "Sustentável" : "Sem dados") : `${autonomia.toLocaleString("pt-PT")} ${autonomia === 1 ? "mês" : "meses"}`}
          nota={saida > 0 ? `Sai cerca de ${euros(saida)} por mês${entradaMensal ? `, entra ${euros(entradaMensal)}` : ""}` : "Importa extratos ou regista débitos"}
        />
      </div>

      <Cartao titulo="Saldo previsto">
        <GraficoCaixa pontos={pontos} />
        <p className="mt-2 text-xs text-secundario">
          Parte do caixa de hoje e soma os débitos diretos da conta da empresa, as mensalidades dos contratos, as faturas por receber e por pagar (as vencidas contam já hoje). Não conta o que ainda não se conhece.
        </p>
      </Cartao>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] [&>*]:min-w-0">
        <Cartao titulo="O que vai acontecer" acao={<span className="text-sm text-secundario">{eventos.length} {eventos.length === 1 ? "previsão" : "previsões"}</span>}>
          {linhas.length ? (
            <ul className="divide-y divide-linha">
              {linhas.map(({ e, saldo }, i) => (
                <li key={i} className="flex items-center gap-3 py-2.5">
                  <span className="numero w-14 shrink-0 text-sm text-secundario">{data(e.data).slice(0, 5)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base text-tinta">{e.texto}</span>
                    <Etiqueta cor={ROTULO[e.origem].cor}>{ROTULO[e.origem].texto}</Etiqueta>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className={`numero block text-base font-semibold ${e.valor > 0 ? "text-verde" : "text-tinta"}`}>{euros(e.valor)}</span>
                    <span className={`numero block text-xs ${saldo < 0 ? "text-ambar-texto" : "text-secundario"}`}>fica {euros(saldo)}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-base text-secundario">Não há nada previsto. Regista os débitos diretos e os contratos para a previsão ganhar forma.</p>
          )}
          {eventos.length > linhas.length && <p className="mt-3 text-sm text-secundario">A mostrar as primeiras {linhas.length}.</p>}
        </Cartao>

        <div className="space-y-6">
          <Cartao titulo="Faturas por receber" acao={<Link href="/faturas?ver=soltas" className="text-sm font-semibold text-azul">Faturas</Link>}>
            {receber.length ? (
              <ul className="divide-y divide-linha">
                {receber.slice(0, 6).map(({ fatura: f, atraso }) => (
                  <li key={f.id}>
                    <Link href={`/faturas/${f.id}`} className="flex items-center gap-3 py-2.5 hover:bg-black/[0.02]">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-base text-tinta">{f.emitente_nome || f.numero || "Fatura"}</span>
                        <span className={`text-xs ${atraso > 0 ? "text-ambar-texto" : "text-secundario"}`}>
                          {atraso > 0 ? `${atraso} ${atraso === 1 ? "dia" : "dias"} em atraso` : atraso === 0 ? "vence hoje" : `vence em ${-atraso} dias`}
                        </span>
                      </span>
                      <span className="numero shrink-0 text-base font-semibold text-tinta">{emMoeda(f.moeda === "EUR" ? f.total : f.total_eur, "EUR")}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-base text-secundario">Nenhuma fatura emitida à espera de pagamento.</p>
            )}
          </Cartao>
          <Cartao titulo="Mensalidades" acao={<Link href="/contactos?ver=clientes" className="text-sm font-semibold text-azul">Clientes</Link>}>
            <p className="numero text-3xl font-bold tracking-tight text-tinta">{euros(entradaMensal)}</p>
            <p className="mt-1 text-sm text-secundario">
              {entradaMensal
                ? `Por mês, dos contratos ativos hoje.`
                : porComecar > 0
                  ? `${porComecar} ${porComecar === 1 ? "contrato começa" : "contratos começam"} mais tarde e já entra${porComecar === 1 ? "" : "m"} na previsão.`
                  : "Ainda sem contratos ativos. Regista-os na ficha de cada cliente."}
            </p>
          </Cartao>
        </div>
      </div>
    </>
  );
}
