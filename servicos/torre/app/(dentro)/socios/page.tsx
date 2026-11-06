import Link from "next/link";
import { exigirSocio } from "@/lib/sessao";
import { carregar } from "@/lib/dados";
import { despesasPorOrigem, saldosSocios } from "@/lib/calculos";
import { euros } from "@/lib/dinheiro";
import { data, hojeLisboa } from "@/lib/texto";
import { apagarSocioMovimento, criarSocioMovimento } from "../../acoes";
import { Formulario } from "@/components/Formulario";
import BotaoConfirmar from "@/components/BotaoConfirmar";
import { Cartao, Titulo, Valor, campo, rotulo } from "@/components/ui";

const TIPO = { capital: "Entrada de capital", suprimento: "Suprimento (empréstimo à empresa)", reembolso: "Reembolso ao sócio" } as const;

export default async function Socios() {
  const { s } = await exigirSocio();
  const t = await carregar(s);
  const hoje = hojeLisboa();
  const ano = hoje.slice(0, 4);
  const saldos = saldosSocios(t.socios, t.contas, t.movimentos, t.sociosMov);
  const origem = despesasPorOrigem(t.movimentos, t.contas, t.socios, t.categorias, `${ano}-01-01`, `${ano}-12-31`);
  const nome = new Map(t.socios.map((x) => [x.id, x.nome]));
  const conta = new Map(t.contas.map((c) => [c.id, c.nome]));
  const adiantados = t.movimentos.filter((m) => m.reembolsavel).slice(0, 50);

  return (
    <>
      <Titulo titulo="Sócios" texto="Quanto cada um adiantou, emprestou e já recebeu de volta." />

      <div className="grid gap-3 sm:grid-cols-2 [&>*]:min-w-0">
        {saldos.map((x) => (
          <Cartao key={x.socio.id} titulo={x.socio.nome}>
            <p className="text-sm text-secundario">A empresa deve-lhe</p>
            <p className="numero text-3xl font-bold tracking-tight text-tinta">{euros(x.devido)}</p>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <dt className="text-secundario">Despesas adiantadas</dt>
              <dd className="numero text-right text-tinta">{euros(x.adiantado)}</dd>
              <dt className="text-secundario">Suprimentos</dt>
              <dd className="numero text-right text-tinta">{euros(x.suprimentos)}</dd>
              <dt className="text-secundario">Já devolvido</dt>
              <dd className="numero text-right text-tinta">{euros(-x.reembolsos)}</dd>
              <dt className="text-secundario">Capital (não é dívida)</dt>
              <dd className="numero text-right text-tinta">{euros(x.capital)}</dd>
            </dl>
            <Link href={`/movimentos?socio=${x.socio.id}`} className="mt-3 inline-block text-sm font-semibold text-azul">Movimentos do {x.socio.nome}</Link>
            {/* Esconde-se em vez de sair da página: ao registar, a dívida passa a zero e o aviso de "Registado" ainda tem de aparecer. */}
            {(
              <details className={x.devido > 0 ? "mt-4 rounded-2xl bg-azul-suave p-4" : "hidden"}>
                <summary className="cursor-pointer text-sm font-semibold text-azul-escuro">Registar devolução ao {x.socio.nome}</summary>
                <div className="mt-3">
                  <Formulario acao={criarSocioMovimento} botao="Registar devolução">
                    <input type="hidden" name="socio_id" value={x.socio.id} />
                    <input type="hidden" name="tipo" value="reembolso" />
                    <div className="grid gap-3 sm:grid-cols-2 [&>*]:min-w-0">
                      <div>
                        <label htmlFor={`dv-valor-${x.socio.id}`} className={rotulo}>Valor (EUR)</label>
                        <input id={`dv-valor-${x.socio.id}`} name="valor" inputMode="decimal" required defaultValue={(x.devido / 100).toFixed(2).replace(".", ",")} className={`${campo} numero`} />
                      </div>
                      <div>
                        <label htmlFor={`dv-data-${x.socio.id}`} className={rotulo}>Data</label>
                        <input id={`dv-data-${x.socio.id}`} name="data" type="date" required defaultValue={hoje} className={campo} />
                      </div>
                      <div className="sm:col-span-2">
                        <label htmlFor={`dv-conta-${x.socio.id}`} className={rotulo}>Saiu da conta</label>
                        <select id={`dv-conta-${x.socio.id}`} name="conta_id" defaultValue={t.contas.find((c) => c.tipo === "empresa")?.id ?? ""} className={campo}>
                          <option value="">Nenhuma</option>
                          {t.contas.filter((c) => c.tipo === "empresa").map((c) => (
                            <option key={c.id} value={c.id}>{c.nome}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <p className="text-xs text-secundario">Vem preenchido com o que está em dívida. A transferência no extrato deve ficar na categoria &quot;Reembolso a sócio&quot;, para não contar como custo.</p>
                  </Formulario>
                </div>
              </details>
            )}
          </Cartao>
        ))}
      </div>

      <Cartao titulo={`Despesas de ${ano} por origem do dinheiro`}>
        {origem.length ? (
          <ul className="divide-y divide-linha">
            {origem.map((o) => (
              <li key={o.chave} className="flex items-center justify-between gap-3 py-2.5">
                <span className="text-base text-tinta">
                  {o.rotulo} <span className="text-sm text-secundario">({o.movimentos})</span>
                </span>
                <span className="numero text-base font-semibold text-tinta">{euros(o.total)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-base text-secundario">Ainda sem despesas este ano.</p>
        )}
      </Cartao>

      <Cartao titulo="Capital, suprimentos e reembolsos">
        {t.sociosMov.length ? (
          <ul className="mb-5 divide-y divide-linha">
            {t.sociosMov.map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-2.5">
                <span className="numero w-20 shrink-0 text-sm text-secundario">{data(m.data)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base text-tinta">
                    {TIPO[m.tipo]}, {nome.get(m.socio_id)}
                  </span>
                  {(m.conta_id || m.notas) && <span className="block truncate text-sm text-secundario">{[m.conta_id && conta.get(m.conta_id), m.notas].filter(Boolean).join(". ")}</span>}
                </span>
                <span className="numero text-base font-semibold text-tinta">{euros(m.valor)}</span>
                <form action={apagarSocioMovimento}>
                  <input type="hidden" name="id" value={m.id} />
                  <BotaoConfirmar texto="Apagar" pergunta="Apagar este registo?" className="rounded-full px-3 py-2 text-sm font-semibold text-ambar-texto hover:bg-ambar-fundo" />
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-5 text-base text-secundario">Ainda nada registado.</p>
        )}
        <details>
          <summary className="cursor-pointer text-base font-semibold text-azul">Registar</summary>
          <div className="mt-4">
            <Formulario acao={criarSocioMovimento} botao="Registar">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="socio_id" className={rotulo}>Sócio</label>
                  <select id="socio_id" name="socio_id" required className={campo}>
                    {t.socios.map((x) => (
                      <option key={x.id} value={x.id}>{x.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="tipo" className={rotulo}>O quê</label>
                  <select id="tipo" name="tipo" className={campo}>
                    {Object.entries(TIPO).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="data" className={rotulo}>Data</label>
                  <input id="data" name="data" type="date" defaultValue={hoje} required className={campo} />
                </div>
                <div>
                  <label htmlFor="valor" className={rotulo}>Valor (EUR)</label>
                  <input id="valor" name="valor" inputMode="decimal" required placeholder="0,00" className={`${campo} numero`} />
                </div>
                <div>
                  <label htmlFor="conta_id" className={rotulo}>Conta da empresa (opcional)</label>
                  <select id="conta_id" name="conta_id" defaultValue="" className={campo}>
                    <option value="">Nenhuma</option>
                    {t.contas.filter((c) => c.tipo === "empresa").map((c) => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="notas" className={rotulo}>Notas</label>
                  <input id="notas" name="notas" className={campo} />
                </div>
              </div>
              <p className="text-sm text-secundario">
                Se o dinheiro passou pela conta da empresa, o movimento do extrato deve ficar na categoria interna correspondente (Entrada de capital, Suprimentos ou Reembolso a sócio), para não contar como custo.
              </p>
            </Formulario>
          </div>
        </details>
      </Cartao>

      <Cartao titulo="Despesas pagas com dinheiro dos sócios (últimas 50)">
        {adiantados.length ? (
          <ul className="divide-y divide-linha">
            {adiantados.map((m) => (
              <li key={m.id}>
                <Link href={`/movimentos/${m.id}`} className="flex items-center gap-3 py-2.5 hover:bg-black/[0.02]">
                  <span className="numero w-20 shrink-0 text-sm text-secundario">{data(m.data)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base text-tinta">{m.descricao}</span>
                    <span className="text-xs text-secundario">{conta.get(m.conta_id)}</span>
                  </span>
                  <Valor c={m.valor} className="text-base" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-base text-secundario">Nenhuma ainda.</p>
        )}
      </Cartao>
    </>
  );
}
