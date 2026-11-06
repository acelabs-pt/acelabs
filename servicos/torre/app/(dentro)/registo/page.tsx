import { exigirSocio } from "@/lib/sessao";
import { dataHora } from "@/lib/texto";
import type { EntradaAuditoria } from "@/lib/tipos";
import { Cartao, Titulo } from "@/components/ui";

const TABELA: Record<string, string> = {
  contas: "a conta",
  categorias: "a categoria",
  entidades: "o fornecedor ou cliente",
  subscricoes: "o débito direto",
  importacoes: "a importação de extrato",
  movimentos: "o movimento",
  regras: "a regra",
  socios_movimentos: "o registo de sócio",
};
const OPERACAO: Record<string, string> = { insert: "criou", update: "mudou", delete: "apagou" };

export default async function Registo() {
  const { s } = await exigirSocio();
  const { data } = await s.from("auditoria").select("*").order("quando", { ascending: false }).limit(300);
  const lista = (data ?? []) as EntradaAuditoria[];
  return (
    <>
      <Titulo titulo="Registo" texto="Quem fez o quê, e quando. As últimas 300 ações." />
      <Cartao>
        {lista.length ? (
          <ul className="divide-y divide-linha">
            {lista.map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5">
                <span className="min-w-0 text-base text-tinta">
                  <span className="font-semibold">{e.quem}</span> {OPERACAO[e.operacao] ?? e.operacao} {TABELA[e.tabela] ?? e.tabela}
                  {e.resumo ? <span className="text-secundario">: {e.resumo}</span> : null}
                </span>
                <span className="numero text-sm text-secundario">{dataHora(e.quando)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-base text-secundario">Ainda sem ações.</p>
        )}
      </Cartao>
    </>
  );
}
