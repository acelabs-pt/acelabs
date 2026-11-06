import Link from "next/link";
import { exigirSocio } from "@/lib/sessao";
import { carregar } from "@/lib/dados";
import { euros } from "@/lib/dinheiro";
import { data, hojeLisboa, mesTitulo } from "@/lib/texto";
import { filtrarMovimentos } from "@/lib/filtros";
import { semFatura } from "@/lib/ligar";
import { criarMovimento } from "../../acoes";
import { Formulario } from "@/components/Formulario";
import CamposMovimento from "@/components/CamposMovimento";
import CategoriaRapida from "@/components/CategoriaRapida";
import { Cartao, Etiqueta, Segmentos, Titulo, Valor, Vazio, botaoPrimario, botaoSecundario, campo } from "@/components/ui";

type Filtros = { conta?: string; mes?: string; categoria?: string; socio?: string; sem?: string; entidade?: string; q?: string; n?: string; novo?: string };

const PASSO = 100;

export default async function Movimentos({ searchParams }: { searchParams: Filtros }) {
  const { s } = await exigirSocio();
  const t = await carregar(s);
  const hoje = hojeLisboa();
  const { novo, n, ...f } = searchParams;
  const faltaFatura = new Set(semFatura(t.movimentos, t.faturas, t.categorias).map((m) => m.id));
  const comFatura = new Set(t.faturas.map((x) => x.movimento_id).filter(Boolean) as string[]);
  const lista = filtrarMovimentos(t.movimentos, f, faltaFatura);
  const limite = Math.max(PASSO, Number(n) || PASSO);
  const mostrar = lista.slice(0, limite);
  const total = lista.reduce((x, m) => x + m.valor, 0);
  const conta = new Map(t.contas.map((c) => [c.id, c.nome]));
  const socio = new Map(t.socios.map((x) => [x.id, x.nome]));
  const meses = [...new Set(t.movimentos.map((m) => m.data.slice(0, 7)))].sort().reverse();
  const entidadeFiltro = f.entidade ? t.entidades.find((e) => e.id === f.entidade) : null;
  const porClassificar = t.movimentos.filter((m) => !m.categoria_id).length;
  const outrosFiltros = ["conta", "mes", "categoria", "socio", "entidade"].filter((k) => f[k as keyof typeof f]).length;
  const filtrado = outrosFiltros > 0 || Boolean(f.q) || Boolean(f.sem);

  // Os endereços dos separadores mantêm a pesquisa e os filtros.
  const href = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...f, ...extra })) if (v) p.set(k, v);
    const q = p.toString();
    return `/movimentos${q ? `?${q}` : ""}`;
  };
  const atual = f.sem === "categoria" || f.sem === "fatura" ? f.sem : "todos";

  // Agrupar por mês, como um extrato.
  const grupos = new Map<string, typeof mostrar>();
  for (const m of mostrar) {
    const k = m.data.slice(0, 7);
    grupos.set(k, [...(grupos.get(k) ?? []), m]);
  }

  return (
    <>
      <Titulo titulo="Movimentos" texto={entidadeFiltro ? `Só ${entidadeFiltro.nome}.` : "Tudo o que entra e sai, de todas as contas."}>
        <Link href="/movimentos/importar" className={botaoPrimario}>Importar extrato</Link>
        <Link href="/movimentos?novo=1#lancar" className={botaoSecundario}>Lançar à mão</Link>
        <a href={`/movimentos/exportar${href({}).replace("/movimentos", "")}`} download className={botaoSecundario}>Exportar</a>
      </Titulo>

      <Segmentos
        atual={atual}
        opcoes={[
          { valor: "todos", texto: "Todos", href: href({ sem: undefined, n: undefined }) },
          { valor: "categoria", texto: "Por classificar", href: href({ sem: "categoria", n: undefined }), n: porClassificar },
          { valor: "fatura", texto: "Sem fatura", href: href({ sem: "fatura", n: undefined }), n: faltaFatura.size },
        ]}
      />

      <form method="get" className="space-y-3">
        {f.sem && <input type="hidden" name="sem" value={f.sem} />}
        {f.entidade && <input type="hidden" name="entidade" value={f.entidade} />}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <svg className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-secundario" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input type="search" name="q" defaultValue={f.q ?? ""} placeholder="Pesquisar descrição ou valor" aria-label="Pesquisar movimentos" className={`${campo} pl-10`} />
          </div>
          <button className="min-h-[44px] rounded-full bg-tinta px-5 text-base font-semibold text-white">Pesquisar</button>
        </div>
        <details className="rounded-3xl border border-linha bg-white" open={outrosFiltros > 0}>
          <summary className="flex cursor-pointer items-center justify-between gap-3 px-5 py-3 text-base font-semibold text-tinta">
            <span>
              Filtros {outrosFiltros > 0 && <span className="numero ml-1 rounded-full bg-azul px-2 text-xs leading-5 text-white">{outrosFiltros}</span>}
            </span>
            <span className="text-sm font-normal text-secundario">conta, mês, categoria, sócio</span>
          </summary>
          <div className="grid gap-3 border-t border-linha p-5 sm:grid-cols-2 lg:grid-cols-4 [&>*]:min-w-0">
            <select name="conta" defaultValue={f.conta ?? ""} className={campo} aria-label="Conta">
              <option value="">Todas as contas</option>
              {t.contas.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
            <select name="mes" defaultValue={f.mes ?? ""} className={campo} aria-label="Mês">
              <option value="">Todos os meses</option>
              {meses.map((m) => (
                <option key={m} value={m}>{mesTitulo(m)}</option>
              ))}
            </select>
            <select name="categoria" defaultValue={f.categoria ?? ""} className={campo} aria-label="Categoria">
              <option value="">Todas as categorias</option>
              {t.categorias.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
            <select name="socio" defaultValue={f.socio ?? ""} className={campo} aria-label="Sócio">
              <option value="">Todos os sócios</option>
              {t.socios.map((x) => (
                <option key={x.id} value={x.id}>{x.nome}</option>
              ))}
            </select>
            <div className="sm:col-span-2 lg:col-span-4">
              <button className="min-h-[44px] rounded-full bg-azul px-6 text-base font-semibold text-white hover:bg-azul-escuro">Aplicar filtros</button>
            </div>
          </div>
        </details>
        {filtrado && (
          <p className="flex flex-wrap items-center gap-x-3 text-sm text-secundario">
            <span>{lista.length} {lista.length === 1 ? "movimento" : "movimentos"}</span>
            <span className="numero font-semibold text-tinta">{euros(total)}</span>
            <Link href="/movimentos" className="font-semibold text-azul">Limpar tudo</Link>
          </p>
        )}
      </form>

      {/* O formulário só aparece quando se pede (botão "Lançar à mão") ou quando ainda não há nada. */}
      {(novo || (!t.movimentos.length && t.contas.length > 0)) && (
        <section id="lancar" className="scroll-mt-24 rounded-3xl border border-linha bg-white p-5" aria-label="Lançar à mão">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-tinta">Lançar à mão</h2>
            {novo && <Link href="/movimentos" className="text-sm font-semibold text-secundario hover:text-tinta">Fechar</Link>}
          </div>
          {t.contas.length ? (
            <Formulario acao={criarMovimento} botao="Guardar movimento">
              <CamposMovimento t={t} hoje={hoje} />
            </Formulario>
          ) : (
            <Vazio texto="Primeiro cria as contas." link="/definicoes?s=contas" rotuloLink="Criar as contas" />
          )}
        </section>
      )}

      {mostrar.length === 0 ? (
        <Vazio
          texto={
            f.sem === "categoria"
              ? "Tudo classificado."
              : f.sem === "fatura"
                ? "Todas as despesas têm fatura."
                : filtrado
                  ? "Nenhum movimento com esta pesquisa."
                  : "Ainda não há movimentos."
          }
          link={!filtrado ? "/movimentos/importar" : undefined}
          rotuloLink={!filtrado ? "Importar um extrato" : undefined}
        />
      ) : (
        [...grupos.entries()].map(([mes, ms]) => (
          <Cartao key={mes} titulo={mesTitulo(mes)} acao={<span className="numero text-sm font-semibold text-secundario">{euros(ms.reduce((x, m) => x + m.valor, 0))}</span>}>
            <ul className="divide-y divide-linha">
              {ms.map((m) => (
                // Telemóvel: descrição e valor em cima, categoria por baixo, na largura toda. Ecrã largo: tudo numa linha.
                <li key={m.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 py-3 sm:flex sm:items-center">
                  <Link href={`/movimentos/${m.id}`} className="col-start-1 row-start-1 flex min-w-0 items-start gap-3 rounded-xl hover:bg-black/[0.02] sm:flex-1">
                    <span className="numero hidden w-20 shrink-0 pt-0.5 text-sm text-secundario sm:block">{data(m.data)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base text-tinta">{m.descricao}</span>
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-secundario">
                        <span className="numero sm:hidden">{data(m.data)}</span>
                        <span>{conta.get(m.conta_id)}</span>
                        {m.socio_id && <span>{socio.get(m.socio_id)}</span>}
                        {m.reembolsavel && <Etiqueta cor="azul">A devolver</Etiqueta>}
                        {faltaFatura.has(m.id) && <Etiqueta cor="cinza">Sem fatura</Etiqueta>}
                        {comFatura.has(m.id) && <span className="text-verde">Com fatura</span>}
                      </span>
                    </span>
                  </Link>
                  <Valor c={m.valor} className="col-start-2 row-start-1 pt-0.5 text-base sm:order-3 sm:pt-0" />
                  <div className="col-span-2 row-start-2 sm:order-2 sm:w-44 sm:shrink-0">
                    <CategoriaRapida id={m.id} categoriaId={m.categoria_id} categorias={t.categorias} />
                  </div>
                </li>
              ))}
            </ul>
          </Cartao>
        ))
      )}

      {lista.length > mostrar.length && (
        <div className="text-center">
          <Link href={href({ n: String(limite + PASSO) })} className={botaoSecundario} scroll={false}>
            Mostrar mais {Math.min(PASSO, lista.length - mostrar.length)} ({lista.length - mostrar.length} por ver)
          </Link>
        </div>
      )}
    </>
  );
}
