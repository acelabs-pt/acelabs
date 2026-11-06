import Link from "next/link";
import { exigirSocio } from "@/lib/sessao";
import { carregar } from "@/lib/dados";
import { data, mesTitulo, hojeLisboa } from "@/lib/texto";
import { semFatura } from "@/lib/ligar";
import { nomeTipoDoc } from "@/lib/qr-fatura";
import CaixaFaturas from "@/components/CaixaFaturas";
import { Cartao, Etiqueta, Segmentos, Titulo, Vazio, campo, emMoeda } from "@/components/ui";
import type { Fatura } from "@/lib/tipos";

type Ver = "rever" | "todas" | "soltas";

export default async function Faturas({ searchParams }: { searchParams: { ver?: string; feito?: string } }) {
  const { s } = await exigirSocio();
  const t = await carregar(s);
  const porRever = t.faturas.filter((f) => f.estado === "rever");
  const soltas = t.faturas.filter((f) => f.estado !== "anulada" && !f.movimento_id);
  const ver: Ver = searchParams.ver === "todas" || searchParams.ver === "soltas" ? searchParams.ver : searchParams.ver === "rever" || porRever.length ? "rever" : "todas";
  const lista = (ver === "rever" ? porRever : ver === "soltas" ? soltas : t.faturas).slice().sort((a, b) => (b.data ?? b.criado_em).localeCompare(a.data ?? a.criado_em));
  const despesasSem = semFatura(t.movimentos, t.faturas, t.categorias);
  const categoria = new Map(t.categorias.map((c) => [c.id, c.nome]));

  // Agrupar por mês da fatura.
  const grupos = new Map<string, Fatura[]>();
  for (const f of lista) {
    const k = (f.data ?? f.criado_em).slice(0, 7);
    grupos.set(k, [...(grupos.get(k) ?? []), f]);
  }
  const meses = [...new Set([...t.faturas.map((f) => (f.data ?? f.criado_em).slice(0, 7)), ...t.movimentos.map((m) => m.data.slice(0, 7))])].sort().reverse();
  const mesAnterior = (() => {
    const [a, m] = hojeLisboa().split("-").map(Number);
    return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, "0")}`;
  })();

  return (
    <>
      <Titulo titulo="Faturas" texto="Recebidas e emitidas, ligadas aos movimentos do banco." />

      {searchParams.feito && (
        <p role="status" className="anim-entrada rounded-2xl bg-verde-suave px-4 py-3 text-base text-tinta">
          Não há mais faturas por rever.
        </p>
      )}

      <section id="caixa" className="scroll-mt-24">
        <CaixaFaturas />
      </section>

      <Segmentos
        atual={ver}
        opcoes={[
          { valor: "rever", texto: "Por rever", href: "/faturas?ver=rever", n: porRever.length },
          { valor: "soltas", texto: "Sem movimento", href: "/faturas?ver=soltas" },
          { valor: "todas", texto: "Todas", href: "/faturas?ver=todas" },
        ]}
      />

      {lista.length ? (
        [...grupos.entries()].map(([mes, fs]) => (
          <Cartao key={mes} titulo={mesTitulo(mes)} acao={<span className="text-sm text-secundario">{fs.length} {fs.length === 1 ? "fatura" : "faturas"}</span>}>
            <ul className="divide-y divide-linha">
              {fs.map((f) => (
                <li key={f.id}>
                  <Link href={`/faturas/${f.id}`} className="flex items-center gap-3 py-3 hover:bg-black/[0.02]">
                    <span className="numero hidden w-20 shrink-0 text-sm text-secundario sm:block">{f.data ? data(f.data) : "sem data"}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base text-tinta">{f.emitente_nome || f.ficheiro_nome || "Fatura sem nome"}</span>
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-secundario">
                        <span className="numero sm:hidden">{f.data ? data(f.data) : "sem data"}</span>
                        <span>{f.sentido === "emitida" ? "Emitida" : nomeTipoDoc(f.tipo_doc)}</span>
                        {f.categoria_id && <span>{categoria.get(f.categoria_id)}</span>}
                        {f.estado === "rever" && <Etiqueta cor="azul">Por rever</Etiqueta>}
                        {f.estado === "anulada" && <Etiqueta cor="cinza">Anulada</Etiqueta>}
                        {f.estado !== "anulada" && !f.movimento_id && <Etiqueta cor="ambar">Sem movimento</Etiqueta>}
                        {f.duvidas.length > 0 && f.estado === "rever" && <Etiqueta cor="ambar">{f.duvidas.length === 1 ? "1 dúvida" : `${f.duvidas.length} dúvidas`}</Etiqueta>}
                      </span>
                    </span>
                    <span className={`numero shrink-0 text-base font-semibold ${f.sentido === "emitida" ? "text-verde" : "text-tinta"}`}>{emMoeda(f.total, f.moeda)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Cartao>
        ))
      ) : (
        <Vazio texto={ver === "rever" ? "Nada por rever. Larga faturas na caixa de cima." : ver === "soltas" ? "Todas as faturas estão ligadas a um movimento." : "Ainda não há faturas."} />
      )}

      <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        <Cartao titulo="Despesas sem fatura" acao={<Link href="/movimentos?sem=fatura" className="text-sm font-semibold text-azul">Ver todas</Link>}>
          {despesasSem.length ? (
            <>
              <p className="mb-3 text-sm text-secundario">Pagamentos que ainda não têm fatura. Abre um e larga a fatura lá: fica ligada.</p>
              <ul className="divide-y divide-linha">
                {despesasSem.slice(0, 6).map((m) => (
                  <li key={m.id}>
                    <Link href={`/movimentos/${m.id}`} className="flex items-center gap-3 py-2.5 hover:bg-black/[0.02]">
                      <span className="numero w-20 shrink-0 text-sm text-secundario">{data(m.data)}</span>
                      <span className="min-w-0 flex-1 truncate text-base text-tinta">{m.descricao}</span>
                      <span className="numero shrink-0 text-base text-tinta">{emMoeda(m.valor, "EUR")}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-base text-secundario">Todas as despesas têm fatura.</p>
          )}
        </Cartao>

        <section id="pacote" className="scroll-mt-24">
          <Cartao titulo="Pacote do contabilista">
            <p className="mb-4 text-sm text-secundario">
              Um ZIP com as faturas do mês (PDF e fotografias, com nomes arrumados) e duas folhas: faturas e movimentos de todas as contas.
            </p>
            <form action="/faturas/pacote" method="get" className="flex flex-col gap-2 sm:flex-row">
              <select name="mes" defaultValue={meses.includes(mesAnterior) ? mesAnterior : meses[0]} className={`${campo} sm:flex-1`} aria-label="Mês">
                {meses.map((m) => (
                  <option key={m} value={m}>{mesTitulo(m)}</option>
                ))}
              </select>
              <button className="min-h-[44px] rounded-full bg-tinta px-5 text-base font-semibold text-white">Descarregar ZIP</button>
            </form>
          </Cartao>
        </section>
      </div>
    </>
  );
}
