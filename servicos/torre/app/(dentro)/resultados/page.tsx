import { exigirSocio } from "@/lib/sessao";
import { carregar } from "@/lib/dados";
import { euros } from "@/lib/dinheiro";
import { calcularResultados, ivaPorTrimestre, ultimosMeses } from "@/lib/resultados";
import { hojeLisboa, mesCurto } from "@/lib/texto";
import { Cartao, Numero, Segmentos, Titulo } from "@/components/ui";

const soma = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);

export default async function Resultados({ searchParams }: { searchParams: { ano?: string } }) {
  const { s } = await exigirSocio();
  const t = await carregar(s);
  const hoje = hojeLisboa();
  const anos = [...new Set([hoje.slice(0, 4), ...t.movimentos.map((m) => m.data.slice(0, 4))])].sort().reverse();
  const ano = searchParams.ano && anos.includes(searchParams.ano) ? searchParams.ano : "12m";
  const meses = ano === "12m" ? ultimosMeses(hoje.slice(0, 7), 12) : ultimosMeses(`${ano}-12`, 12);
  const r = calcularResultados(t.movimentos, t.faturas, t.categorias, meses);
  const total = soma(r.resultado);
  const iva = ivaPorTrimestre(r);
  const custos = r.grupos.filter((g) => g.tipo === "custo" && g.total > 0);
  const maiorCusto = Math.max(1, ...custos.map((g) => g.total));
  const semCategoria = soma(r.porClassificar);
  const comDados = meses.filter((m) => r.proveitos[m] || r.custos[m]);

  return (
    <>
      <Titulo titulo="Resultados" texto="Proveitos e custos pelos movimentos do banco. Com fatura conta o valor sem IVA." />
      <Segmentos atual={ano} opcoes={[{ valor: "12m", texto: "Últimos 12 meses", href: "/resultados" }, ...anos.slice(0, 3).map((a) => ({ valor: a, texto: a, href: `/resultados?ano=${a}` }))]} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Numero legenda="Resultado" valor={total} sinal nota={comDados.length ? `${comDados.length} ${comDados.length === 1 ? "mês" : "meses"} com movimentos` : "Ainda sem movimentos classificados"} />
        <Numero legenda="Proveitos" valor={soma(r.proveitos)} />
        <Numero legenda="Custos" valor={soma(r.custos)} />
        <Numero legenda="IVA a recuperar" valor={soma(r.ivaDedutivel) - soma(r.ivaLiquidado)} nota="Estimativa pelas faturas ligadas" />
      </div>

      {semCategoria !== 0 && (
        <p className="rounded-2xl bg-ambar-fundo px-4 py-3 text-sm text-ambar-texto">
          {euros(semCategoria)} em movimentos por classificar ficaram de fora. <a href="/movimentos?sem=categoria" className="font-semibold underline">Classificar</a>
        </p>
      )}

      <Cartao titulo="Mês a mês">
        <div className="-mx-5 overflow-x-auto px-5">
          <table className="numero w-full min-w-[760px] text-sm">
            <thead>
              <tr className="text-secundario">
                <th className="sticky left-0 bg-white py-2 pr-3 text-left font-medium">Grupo</th>
                {meses.map((m) => (
                  <th key={m} className="px-2 py-2 text-right font-medium">{mesCurto(m)}</th>
                ))}
                <th className="py-2 pl-3 text-right font-semibold text-tinta">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-linha">
              {r.grupos.map((g, i) => (
                <tr key={g.chave} className={i > 0 && r.grupos[i - 1].tipo !== g.tipo ? "border-t-2 border-black/10" : ""}>
                  <td className="sticky left-0 bg-white py-2 pr-3 text-tinta">{g.nome}</td>
                  {meses.map((m) => (
                    <td key={m} className={`px-2 py-2 text-right ${g.porMes[m] ? (g.tipo === "proveito" ? "text-verde" : "text-tinta") : "text-black/20"}`}>
                      {g.porMes[m] ? (g.porMes[m] / 100).toLocaleString("pt-PT", { maximumFractionDigits: 0 }) : "0"}
                    </td>
                  ))}
                  <td className="py-2 pl-3 text-right font-semibold text-tinta">{euros(g.tipo === "custo" ? -g.total : g.total)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-black/10 font-semibold">
                <td className="sticky left-0 bg-white py-2.5 pr-3 text-tinta">Resultado</td>
                {meses.map((m) => (
                  <td key={m} className={`px-2 py-2.5 text-right ${r.resultado[m] < 0 ? "text-ambar-texto" : r.resultado[m] > 0 ? "text-verde" : "text-black/20"}`}>
                    {(r.resultado[m] / 100).toLocaleString("pt-PT", { maximumFractionDigits: 0 })}
                  </td>
                ))}
                <td className={`py-2.5 pl-3 text-right ${total < 0 ? "text-ambar-texto" : "text-tinta"}`}>{euros(total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-secundario">Valores mensais em euros, arredondados. Custos sem sinal; o total de cada linha com sinal.</p>
      </Cartao>

      {iva.length > 0 && (
        <Cartao titulo="IVA por trimestre" acao={<span className="text-xs text-secundario">estimativa pelas faturas ligadas ao banco</span>}>
          <ul className="divide-y divide-linha">
            {iva.map((l) => (
              <li key={l.trimestre} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3">
                <span className="text-base font-medium text-tinta">{l.trimestre}</span>
                <span className="numero text-sm text-secundario">{euros(l.liquidado)} cobrado, {euros(l.dedutivel)} pago</span>
                <span className={`numero text-base font-semibold ${l.saldo > 0 ? "text-ambar-texto" : "text-verde"}`}>
                  {l.saldo > 0 ? `${euros(l.saldo)} a entregar` : l.saldo < 0 ? `${euros(-l.saldo)} a recuperar` : "Sem diferença"}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-secundario">Só conta faturas já ligadas a um movimento do banco. A declaração periódica é com o contabilista.</p>
        </Cartao>
      )}

      <Cartao titulo="Para onde vai o dinheiro">
        {custos.length ? (
          <ul className="space-y-3">
            {custos.map((g) => (
              <li key={g.chave}>
                <div className="flex items-baseline justify-between gap-3 text-base">
                  <span className="text-tinta">{g.nome}</span>
                  <span className="numero font-semibold text-tinta">{euros(g.total)}</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-black/5">
                  <div className="h-2 rounded-full bg-azul" style={{ width: `${Math.max(2, (g.total / maiorCusto) * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-base text-secundario">Ainda sem custos classificados neste período.</p>
        )}
      </Cartao>
    </>
  );
}
