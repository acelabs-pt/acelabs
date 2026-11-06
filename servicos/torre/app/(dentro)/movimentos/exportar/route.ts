import { exigirSocio } from "@/lib/sessao";
import { carregar } from "@/lib/dados";
import { semFatura } from "@/lib/ligar";
import { euroCsv, filtrarMovimentos, folhaCsv, type FiltrosMovimentos } from "@/lib/filtros";
import { hojeLisboa } from "@/lib/texto";

// Os movimentos que estão no ecrã (com os mesmos filtros e pesquisa), numa folha que abre no Excel.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { s } = await exigirSocio();
  const t = await carregar(s);
  const p = new URL(req.url).searchParams;
  const f: FiltrosMovimentos = Object.fromEntries(["conta", "mes", "categoria", "socio", "sem", "entidade", "q"].map((k) => [k, p.get(k) ?? undefined]));
  const faltaFatura = new Set(semFatura(t.movimentos, t.faturas, t.categorias).map((m) => m.id));
  const lista = filtrarMovimentos(t.movimentos, f, faltaFatura);
  const conta = new Map(t.contas.map((c) => [c.id, c.nome]));
  const categoria = new Map(t.categorias.map((c) => [c.id, c.nome]));
  const entidade = new Map(t.entidades.map((e) => [e.id, e.nome]));
  const socio = new Map(t.socios.map((x) => [x.id, x.nome]));
  const fatura = new Map(t.faturas.filter((x) => x.movimento_id).map((x) => [x.movimento_id!, x]));
  const corpo = folhaCsv(
    ["Data", "Conta", "Descrição", "Valor", "Categoria", "Fornecedor ou cliente", "Sócio", "A devolver ao sócio", "Fatura", "Notas"],
    lista.map((m) => {
      const fa = fatura.get(m.id);
      return [
        m.data,
        conta.get(m.conta_id),
        m.descricao,
        euroCsv(m.valor),
        m.categoria_id ? categoria.get(m.categoria_id) : "Por classificar",
        m.entidade_id ? entidade.get(m.entidade_id) : "",
        m.socio_id ? socio.get(m.socio_id) : "",
        m.reembolsavel ? "Sim" : "",
        fa ? [fa.emitente_nome, fa.numero].filter(Boolean).join(" ") : faltaFatura.has(m.id) ? "Sem fatura" : "",
        m.notas,
      ];
    }),
  );
  return new Response(corpo, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="acelabs-movimentos-${f.mes ?? hojeLisboa()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
