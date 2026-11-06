import Link from "next/link";
import { exigirSocio } from "@/lib/sessao";
import { carregar } from "@/lib/dados";
import { custoMensal, detetarRecorrentes } from "@/lib/calculos";
import { estadoDebito, saidoEsteMes, type EstadoDebito } from "@/lib/debitos";
import { euros } from "@/lib/dinheiro";
import { data, hojeLisboa } from "@/lib/texto";
import { criarDeRecorrente, criarSubscricao, juntarListaInicial } from "../../acoes";
import { Formulario } from "@/components/Formulario";
import CamposSubscricao from "@/components/CamposSubscricao";
import { Cartao, Etiqueta, Numero, Titulo, botaoSecundario } from "@/components/ui";

const PERIODO = { mensal: "por mês", trimestral: "por trimestre", anual: "por ano" } as const;

/** O que se passa com o débito neste ciclo, numa linha. */
function EstadoLinha({ e }: { e: EstadoDebito }) {
  return (
    <>
      {e.estado === "pago" && e.ultimo && <span className="text-verde">Saiu a {data(e.ultimo.data)} ({euros(-e.ultimo.valor)})</span>}
      {e.estado === "em_falta" && <Etiqueta cor="ambar">Não apareceu o de {data(e.faltaDe)}</Etiqueta>}
      {e.estado !== "pago" && <span>Próximo: {data(e.proxima)}</span>}
      {e.estado === "pago" && <span>próximo: {data(e.proxima)}</span>}
      {e.estado === "sem_pagamentos" && <span className="text-xs">ainda sem pagamentos ligados</span>}
      {e.diferente && <Etiqueta cor="ambar">Valor diferente do previsto</Etiqueta>}
    </>
  );
}

export default async function Debitos() {
  const { s } = await exigirSocio();
  const t = await carregar(s);
  const hoje = hojeLisboa();
  const ativas = t.subscricoes.filter((x) => x.ativa);
  const porMes = ativas.reduce((a, x) => a + custoMensal(x), 0);
  const sugestoes = detetarRecorrentes(t.movimentos);
  const nomeConta = new Map(t.contas.map((c) => [c.id, c.nome]));
  const estados = new Map(t.subscricoes.map((x) => [x.id, estadoDebito(x, t.movimentos, hoje)]));
  const emFalta = ativas.filter((x) => estados.get(x.id)!.estado === "em_falta").length;
  const saiu = saidoEsteMes(t.movimentos, hoje);

  // Agrupados pela conta de onde saem, para responder a "de onde está a sair cada débito".
  const grupos = new Map<string, typeof t.subscricoes>();
  for (const x of t.subscricoes) {
    const k = x.ativa ? (x.conta_id ?? "") : "cancelados";
    grupos.set(k, [...(grupos.get(k) ?? []), x]);
  }
  const ordem = [...t.contas.map((c) => c.id), "", "cancelados"].filter((k) => grupos.has(k));
  const titulo = (k: string) => (k === "cancelados" ? "Cancelados" : k === "" ? "Conta por definir" : `A sair de ${nomeConta.get(k)}`);

  return (
    <>
      <Titulo titulo="Débitos diretos" texto="Subscrições e pagamentos que se repetem, e de que conta saem." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Numero legenda="Por mês" valor={porMes} nota={`${ativas.length} ${ativas.length === 1 ? "ativo" : "ativos"}${ativas.some((x) => x.valor_previsto === null) ? ", alguns por confirmar" : ""}`} />
        <Numero legenda="Por ano" valor={porMes * 12} />
        <Numero legenda="Já saiu este mês" valor={saiu} nota="Pelos movimentos ligados" />
        <Numero legenda="Em falta" valor={String(emFalta)} nota={emFalta ? "Pagamentos que não apareceram" : "Nada em falta"} />
      </div>

      {ativas.some((x) => estados.get(x.id)!.estado === "sem_pagamentos") && t.movimentos.length > 0 && (
        <p className="rounded-2xl bg-azul-suave px-4 py-3 text-sm text-tinta">
          Para a Torre saber se um débito já saiu, liga o pagamento: abre o movimento no banco, escolhe o débito direto e escreve uma frase em
          &quot;Aplicar sempre&quot;. Os seguintes ligam-se sozinhos.
        </p>
      )}

      {!t.subscricoes.length && (
        <Cartao titulo="Começar com o que já usamos">
          <p className="mb-3 text-base text-secundario">Vercel, Supabase, Anthropic, Google Workspace, Resend, domínio, Apple Developer e Firebase. Os valores ficam por confirmar.</p>
          <form action={juntarListaInicial}>
            <button className={botaoSecundario}>Juntar esta lista</button>
          </form>
        </Cartao>
      )}

      {sugestoes.length > 0 && (
        <Cartao titulo="Pagamentos que se repetem">
          <p className="mb-3 text-sm text-secundario">Encontrados nos extratos e ainda sem débito direto associado.</p>
          <ul className="divide-y divide-linha">
            {sugestoes.slice(0, 10).map((r) => (
              <li key={r.chave} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-base text-tinta">{r.exemplo}</p>
                  <p className="text-sm text-secundario">
                    {r.ocorrencias} vezes, último a {data(r.ultimo)}, {nomeConta.get(r.conta_id)}
                  </p>
                </div>
                <form action={criarDeRecorrente} className="flex items-center gap-3">
                  <input type="hidden" name="chave" value={r.chave} />
                  <input type="hidden" name="nome" value={r.chave.replace(/\b\w/g, (l) => l.toUpperCase())} />
                  <input type="hidden" name="conta_id" value={r.conta_id} />
                  <input type="hidden" name="valor" value={r.valorMedio} />
                  <input type="hidden" name="periodicidade" value={r.periodicidade} />
                  <input type="hidden" name="ultimo" value={r.ultimo} />
                  <span className="numero text-base font-semibold text-tinta">
                    {euros(r.valorMedio)} {PERIODO[r.periodicidade]}
                  </span>
                  <button className="min-h-[40px] rounded-full bg-azul-suave px-4 text-sm font-semibold text-azul-escuro hover:bg-azul-suave/70">Criar débito</button>
                </form>
              </li>
            ))}
          </ul>
        </Cartao>
      )}

      {ordem.map((k) => (
        <Cartao key={k} titulo={titulo(k)}>
          <ul className="divide-y divide-linha">
            {grupos.get(k)!.map((x) => (
              <li key={x.id}>
                <Link href={`/debitos/${x.id}`} className="flex items-center justify-between gap-3 py-3 hover:bg-black/[0.02]">
                  <span className="min-w-0">
                    <span className="block truncate text-base text-tinta">{x.nome}</span>
                    <span className="flex flex-wrap items-center gap-2 text-sm text-secundario">
                      {x.ativa ? <EstadoLinha e={estados.get(x.id)!} /> : "Cancelado"}
                      {x.moeda !== "EUR" && <Etiqueta cor="cinza">{x.moeda}</Etiqueta>}
                      {!x.debito_direto && <Etiqueta cor="cinza">à mão</Etiqueta>}
                    </span>
                  </span>
                  <span className="numero shrink-0 text-right text-base font-semibold text-tinta">
                    {x.valor_previsto === null ? <Etiqueta cor="ambar">Valor por confirmar</Etiqueta> : `${euros(x.valor_previsto)} ${PERIODO[x.periodicidade]}`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Cartao>
      ))}

      <details className="rounded-3xl border border-linha bg-white p-5">
        <summary className="cursor-pointer text-lg font-semibold text-tinta">Novo débito</summary>
        <div className="mt-4">
          <Formulario acao={criarSubscricao} botao="Guardar débito">
            <CamposSubscricao t={t} hoje={hoje} />
          </Formulario>
        </div>
      </details>
    </>
  );
}
