import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirSocio } from "@/lib/sessao";
import { carregar } from "@/lib/dados";
import { euros } from "@/lib/dinheiro";
import { data, hojeLisboa } from "@/lib/texto";
import { resumirEntidades } from "@/lib/entidades";
import { nomeTipoDoc } from "@/lib/qr-fatura";
import { ROTULO_PRODUTO } from "@/lib/tipos";
import { apagarContrato, apagarEntidade, criarContrato, guardarContrato, guardarEntidade } from "../../../acoes";
import { Formulario } from "@/components/Formulario";
import BotaoConfirmar from "@/components/BotaoConfirmar";
import CamposContrato from "@/components/CamposContrato";
import { Cartao, Etiqueta, Numero, Titulo, Valor, campo, emMoeda, rotulo } from "@/components/ui";

const ESTADO: Record<string, { texto: string; cor: "azul" | "verde" | "ambar" | "cinza" }> = {
  proposta: { texto: "Proposta", cor: "azul" },
  ativo: { texto: "Ativo", cor: "verde" },
  pausado: { texto: "Pausado", cor: "ambar" },
  terminado: { texto: "Terminado", cor: "cinza" },
};

export default async function Contacto({ params }: { params: { id: string } }) {
  const { s } = await exigirSocio();
  const t = await carregar(s);
  const hoje = hojeLisboa();
  const e = t.entidades.find((x) => x.id === params.id);
  if (!e) notFound();
  const r = resumirEntidades([e], t.movimentos, t.faturas, t.contratos, hoje)[0];
  const cliente = e.tipo === "cliente" || e.tipo === "ambos";
  const fornecedor = e.tipo === "fornecedor" || e.tipo === "ambos";
  const faturas = t.faturas.filter((f) => f.entidade_id === e.id).sort((a, b) => (b.data ?? b.criado_em).localeCompare(a.data ?? a.criado_em));
  const movimentos = t.movimentos.filter((m) => m.entidade_id === e.id).sort((a, b) => b.data.localeCompare(a.data));
  const conta = new Map(t.contas.map((c) => [c.id, c.nome]));
  const contratos = [...r.contratos].sort((a, b) => b.inicio.localeCompare(a.inicio));

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/contactos?ver=${cliente ? "clientes" : "fornecedores"}`} className="text-sm font-semibold text-azul">Clientes e fornecedores</Link>
      </div>
      <Titulo titulo={e.nome} texto={[cliente && fornecedor ? "Cliente e fornecedor" : cliente ? "Cliente" : "Fornecedor", e.nif && `NIF ${e.nif}`, e.email].filter(Boolean).join(", ")} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cliente && <Numero legenda="Mensalidade" valor={r.mrr} nota={r.mrr ? "Contratos ativos hoje" : "Sem contrato ativo"} />}
        {(cliente || r.recebido > 0) && <Numero legenda={`Recebido em ${hoje.slice(0, 4)}`} valor={r.recebidoAno} nota={`${euros(r.recebido)} no total`} />}
        {(fornecedor || r.pago > 0) && <Numero legenda={`Pago em ${hoje.slice(0, 4)}`} valor={r.pagoAno} nota={`${euros(r.pago)} no total`} />}
        <Numero legenda="Em aberto" valor={r.emAberto} nota={r.nEmAberto ? `${r.nEmAberto} ${r.nEmAberto === 1 ? "fatura" : "faturas"} sem pagamento no banco` : "Tudo pago"} sinal />
      </div>

      {cliente && (
        <Cartao titulo="Contratos">
          {contratos.length > 0 && (
            <ul className="mb-4 divide-y divide-linha">
              {contratos.map((c) => (
                <li key={c.id} className="py-3">
                  <details>
                    <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
                      <span className="flex min-w-0 flex-wrap items-center gap-2 text-base text-tinta">
                        {ROTULO_PRODUTO[c.produto]}
                        {c.nome && c.nome !== ROTULO_PRODUTO[c.produto] && <span className="text-secundario">{c.nome}</span>}
                        <Etiqueta cor={ESTADO[c.estado].cor}>{ESTADO[c.estado].texto}</Etiqueta>
                      </span>
                      <span className="numero text-sm text-secundario">
                        {c.mensalidade ? `${euros(c.mensalidade)} por mês` : ""}
                        {c.mensalidade && c.setup ? ", " : ""}
                        {c.setup ? `${euros(c.setup)} de arranque` : ""} · {data(c.inicio)}
                        {c.fim ? ` a ${data(c.fim)}` : ""}
                      </span>
                    </summary>
                    <div className="mt-4 space-y-4">
                      <Formulario acao={guardarContrato} botao="Guardar contrato" limpar={false}>
                        <CamposContrato entidadeId={e.id} c={c} />
                      </Formulario>
                      <form action={apagarContrato}>
                        <input type="hidden" name="id" value={c.id} />
                        <BotaoConfirmar texto="Apagar contrato" pergunta="Apagar este contrato? A previsão de caixa deixa de o contar." />
                      </form>
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          )}
          <details open={contratos.length === 0}>
            <summary className="cursor-pointer text-base font-semibold text-azul">Novo contrato</summary>
            <div className="mt-4">
              <Formulario acao={criarContrato} botao="Guardar contrato">
                <CamposContrato entidadeId={e.id} />
              </Formulario>
            </div>
          </details>
        </Cartao>
      )}

      <div className="grid gap-6 xl:grid-cols-2 [&>*]:min-w-0">
        <Cartao titulo="Faturas" acao={<span className="text-sm text-secundario">{faturas.length}</span>}>
          {faturas.length ? (
            <ul className="divide-y divide-linha">
              {faturas.slice(0, 12).map((f) => (
                <li key={f.id}>
                  <Link href={`/faturas/${f.id}`} className="flex items-center gap-3 py-2.5 hover:bg-black/[0.02]">
                    <span className="numero w-20 shrink-0 text-sm text-secundario">{f.data ? data(f.data) : "sem data"}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base text-tinta">{nomeTipoDoc(f.tipo_doc)}{f.numero ? ` ${f.numero}` : ""}</span>
                      <span className="flex gap-2 text-xs">
                        {f.estado === "rever" && <Etiqueta cor="azul">Por rever</Etiqueta>}
                        {f.estado !== "anulada" && !f.movimento_id && <Etiqueta cor="ambar">Sem pagamento</Etiqueta>}
                      </span>
                    </span>
                    <span className="numero shrink-0 text-base font-semibold text-tinta">{emMoeda(f.total, f.moeda)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-base text-secundario">Ainda sem faturas.</p>
          )}
        </Cartao>

        <Cartao titulo="Movimentos" acao={movimentos.length > 8 ? <Link href={`/movimentos?entidade=${e.id}`} className="text-sm font-semibold text-azul">Ver todos ({movimentos.length})</Link> : <span className="text-sm text-secundario">{movimentos.length}</span>}>
          {movimentos.length ? (
            <ul className="divide-y divide-linha">
              {movimentos.slice(0, 8).map((m) => (
                <li key={m.id}>
                  <Link href={`/movimentos/${m.id}`} className="flex items-center gap-3 py-2.5 hover:bg-black/[0.02]">
                    <span className="numero w-20 shrink-0 text-sm text-secundario">{data(m.data)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base text-tinta">{m.descricao}</span>
                      <span className="text-xs text-secundario">{(m.conta_id ? conta.get(m.conta_id) : "Sem conta")}</span>
                    </span>
                    <Valor c={m.valor} className="shrink-0 text-base" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-base text-secundario">Ainda sem movimentos ligados. Quando classificares um movimento com este nome, aparece aqui.</p>
          )}
        </Cartao>
      </div>

      <Cartao titulo="Dados">
        <details>
          <summary className="cursor-pointer text-base font-semibold text-azul">Editar</summary>
          <div className="mt-4 space-y-4">
            <Formulario acao={guardarEntidade} botao="Guardar" limpar={false}>
              <input type="hidden" name="id" value={e.id} />
              <div className="grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
                <div>
                  <label htmlFor="d-nome" className={rotulo}>Nome</label>
                  <input id="d-nome" name="nome" required defaultValue={e.nome} className={campo} />
                </div>
                <div>
                  <label htmlFor="d-tipo" className={rotulo}>É</label>
                  <select id="d-tipo" name="tipo" defaultValue={e.tipo} className={campo}>
                    <option value="cliente">Cliente</option>
                    <option value="fornecedor">Fornecedor</option>
                    <option value="ambos">Os dois</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="d-nif" className={rotulo}>NIF</label>
                  <input id="d-nif" name="nif" inputMode="numeric" maxLength={9} defaultValue={e.nif ?? ""} className={`${campo} numero`} />
                </div>
                <div>
                  <label htmlFor="d-email" className={rotulo}>Email</label>
                  <input id="d-email" name="email" type="email" defaultValue={e.email ?? ""} className={campo} />
                </div>
              </div>
            </Formulario>
            <form action={apagarEntidade}>
              <input type="hidden" name="id" value={e.id} />
              <BotaoConfirmar texto="Apagar" pergunta="Apagar? Os movimentos e faturas ligados ficam, sem este nome. Não se apaga se tiver contratos." />
            </form>
          </div>
        </details>
      </Cartao>
    </>
  );
}
