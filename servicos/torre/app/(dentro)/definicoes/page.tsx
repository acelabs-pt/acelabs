import { exigirSocio } from "@/lib/sessao";
import { carregar, ROTULO_TIPO_CATEGORIA, ROTULO_TIPO_CONTA } from "@/lib/dados";
import { euros } from "@/lib/dinheiro";
import type { Conta, Socio } from "@/lib/tipos";
import Link from "next/link";
import { alternarCategoria, apagarRegra, criarCategoria, criarConta, criarEntidade, criarRegra, guardarConta } from "../../acoes";
import { Formulario } from "@/components/Formulario";
import BotaoConfirmar from "@/components/BotaoConfirmar";
import { Cartao, Etiqueta, Titulo, campo, rotulo } from "@/components/ui";

function CamposConta({ c, socios }: { c?: Conta; socios: Socio[] }) {
  const id = c?.id ?? "nova";
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {c && <input type="hidden" name="id" value={c.id} />}
      <div>
        <label htmlFor={`nome-${id}`} className={rotulo}>Nome</label>
        <input id={`nome-${id}`} name="nome" required defaultValue={c?.nome} placeholder="Millennium empresa, Conjunta CGD..." className={campo} />
      </div>
      <div>
        <label htmlFor={`tipo-${id}`} className={rotulo}>Tipo</label>
        <select id={`tipo-${id}`} name="tipo" defaultValue={c?.tipo ?? "empresa"} className={campo}>
          {Object.entries(ROTULO_TIPO_CONTA).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`titular-${id}`} className={rotulo}>Titular (conta pessoal ou cartão pessoal)</label>
        <select id={`titular-${id}`} name="titular" defaultValue={c?.titular ?? ""} className={campo}>
          <option value="">Empresa ou conjunta</option>
          {socios.map((s) => (
            <option key={s.id} value={s.id}>{s.nome}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={`banco-${id}`} className={rotulo}>Banco</label>
          <input id={`banco-${id}`} name="banco" defaultValue={c?.banco ?? ""} className={campo} />
        </div>
        <div>
          <label htmlFor={`ultimos4-${id}`} className={rotulo}>Últimos 4</label>
          <input id={`ultimos4-${id}`} name="ultimos4" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} defaultValue={c?.ultimos4 ?? ""} className={`${campo} numero`} />
        </div>
      </div>
      <div>
        <label htmlFor={`saldo-${id}`} className={rotulo}>Saldo antes do primeiro movimento registado (EUR)</label>
        <input id={`saldo-${id}`} name="saldo_inicial" inputMode="decimal" defaultValue={c ? (c.saldo_inicial / 100).toFixed(2).replace(".", ",") : "0,00"} className={`${campo} numero`} />
      </div>
      {c && (
        <div>
          <label htmlFor={`ativa-${id}`} className={rotulo}>Estado</label>
          <select id={`ativa-${id}`} name="ativa" defaultValue={c.ativa ? "sim" : "nao"} className={campo}>
            <option value="sim">Em uso</option>
            <option value="nao">Fechada</option>
          </select>
        </div>
      )}
    </div>
  );
}

const SECOES = ["contas", "regras", "categorias", "fornecedores", "conta"] as const;
type Secao = (typeof SECOES)[number];

export default async function Definicoes({ searchParams }: { searchParams: { s?: string } }) {
  const { s, socio } = await exigirSocio();
  const t = await carregar(s);
  const nomeSocio = new Map(t.socios.map((x) => [x.id, x.nome]));
  const nomeCat = new Map(t.categorias.map((c) => [c.id, c.nome]));
  const nomeEnt = new Map(t.entidades.map((e) => [e.id, e.nome]));
  const nomeSub = new Map(t.subscricoes.map((x) => [x.id, x.nome]));
  const sec: Secao = (SECOES as readonly string[]).includes(searchParams.s ?? "") ? (searchParams.s as Secao) : "contas";
  const menu: { valor: Secao; texto: string; n?: number }[] = [
    { valor: "contas", texto: "Contas", n: t.contas.length },
    { valor: "regras", texto: "Regras", n: t.regras.length },
    { valor: "categorias", texto: "Categorias", n: t.categorias.filter((c) => c.ativa).length },
    { valor: "fornecedores", texto: "Fornecedores e clientes", n: t.entidades.length },
    { valor: "conta", texto: "A minha conta" },
  ];

  return (
    <>
      <Titulo titulo="Definições" texto="Contas, regras de classificação, categorias, fornecedores e a tua conta." />

      <div className="grid items-start gap-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <nav aria-label="Secções das definições" className="flex gap-1 overflow-x-auto rounded-2xl bg-black/5 p-1 lg:sticky lg:top-6 lg:flex-col lg:bg-transparent lg:p-0">
          {menu.map((m) => (
            <Link
              key={m.valor}
              href={`/definicoes?s=${m.valor}`}
              aria-current={m.valor === sec ? "page" : undefined}
              className={`flex min-h-[40px] items-center justify-between gap-3 whitespace-nowrap rounded-xl px-4 text-sm font-semibold lg:rounded-2xl lg:py-2.5 ${
                m.valor === sec ? "bg-white text-tinta shadow-sm lg:bg-azul-suave lg:text-azul lg:shadow-none" : "text-secundario hover:text-tinta lg:hover:bg-black/5"
              }`}
            >
              {m.texto}
              {m.n !== undefined && <span className="numero hidden text-xs font-medium text-secundario lg:inline">{m.n}</span>}
            </Link>
          ))}
        </nav>
        <div className="min-w-0 space-y-6">

      {sec === "contas" && (
      <Cartao titulo="Contas">
        <p className="mb-3 text-sm text-secundario">
          Conta da empresa: o dinheiro é da Ace Labs. Conjunta, pessoais e cartões pessoais: as despesas da Ace Labs pagas daqui ficam para a empresa devolver (a conjunta divide em partes iguais).
        </p>
        {t.contas.length > 0 && (
          <ul className="mb-4 divide-y divide-linha">
            {t.contas.map((c) => (
              <li key={c.id} className="py-3">
                <details>
                  <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
                    <span className="text-base text-tinta">
                      {c.nome} {!c.ativa && <Etiqueta cor="cinza">Fechada</Etiqueta>}
                    </span>
                    <span className="text-sm text-secundario">
                      {ROTULO_TIPO_CONTA[c.tipo]}
                      {c.titular ? `, ${nomeSocio.get(c.titular)}` : ""}
                      {c.ultimos4 ? `, ...${c.ultimos4}` : ""}
                      {c.saldo_inicial ? `, saldo inicial ${euros(c.saldo_inicial)}` : ""}
                    </span>
                  </summary>
                  <div className="mt-4">
                    <Formulario acao={guardarConta} botao="Guardar conta" limpar={false}>
                      <CamposConta c={c} socios={t.socios} />
                    </Formulario>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
        <details open={!t.contas.length}>
          <summary className="cursor-pointer text-base font-semibold text-azul">Nova conta</summary>
          <div className="mt-4">
            <Formulario acao={criarConta} botao="Criar conta">
              <CamposConta socios={t.socios} />
            </Formulario>
          </div>
        </details>
      </Cartao>
      )}

      {sec === "regras" && (
      <Cartao titulo="Regras de classificação">
        <p className="mb-3 text-sm text-secundario">Se a descrição de um movimento tiver esta frase, fica logo com esta categoria, fornecedor ou débito. A frase mais comprida ganha.</p>
        {t.regras.length > 0 && (
          <ul className="mb-4 divide-y divide-linha">
            {t.regras.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="text-base text-tinta">
                  &quot;{r.texto}&quot;
                  <span className="text-sm text-secundario">
                    {" "}
                    {[r.categoria_id && nomeCat.get(r.categoria_id), r.entidade_id && nomeEnt.get(r.entidade_id), r.subscricao_id && nomeSub.get(r.subscricao_id)].filter(Boolean).join(", ")}
                  </span>
                </span>
                <form action={apagarRegra}>
                  <input type="hidden" name="id" value={r.id} />
                  <BotaoConfirmar texto="Apagar" pergunta="Apagar esta regra? Os movimentos já classificados não mudam." className="rounded-full px-3 py-2 text-sm font-semibold text-ambar-texto hover:bg-ambar-fundo" />
                </form>
              </li>
            ))}
          </ul>
        )}
        <details>
          <summary className="cursor-pointer text-base font-semibold text-azul">Nova regra</summary>
          <div className="mt-4">
            <Formulario acao={criarRegra} botao="Guardar regra">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="texto" className={rotulo}>Frase na descrição do banco</label>
                  <input id="texto" name="texto" required placeholder="vercel" className={campo} />
                </div>
                <div>
                  <label htmlFor="r-categoria" className={rotulo}>Categoria</label>
                  <select id="r-categoria" name="categoria_id" className={campo}>
                    <option value="">Nenhuma</option>
                    {t.categorias.filter((c) => c.ativa).map((c) => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="r-subscricao" className={rotulo}>Débito direto</label>
                  <select id="r-subscricao" name="subscricao_id" className={campo}>
                    <option value="">Nenhum</option>
                    {t.subscricoes.map((x) => (
                      <option key={x.id} value={x.id}>{x.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="r-entidade" className={rotulo}>Fornecedor ou cliente</label>
                  <select id="r-entidade" name="entidade_id" className={campo}>
                    <option value="">Nenhum</option>
                    {t.entidades.map((e) => (
                      <option key={e.id} value={e.id}>{e.nome}</option>
                    ))}
                  </select>
                </div>
              </div>
            </Formulario>
          </div>
        </details>
      </Cartao>
      )}

      {sec === "categorias" && (
      <Cartao titulo="Categorias">
        <div className="space-y-5">
          {(["custo", "proveito", "interno"] as const).map((tipo) => (
            <div key={tipo}>
              <h3 className="mb-2 text-sm font-semibold text-secundario">{ROTULO_TIPO_CATEGORIA[tipo]}</h3>
              <ul className="flex flex-wrap gap-2">
                {t.categorias
                  .filter((c) => c.tipo === tipo)
                  .map((c) => (
                    <li key={c.id}>
                      <form action={alternarCategoria}>
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="ativa" value={c.ativa ? "nao" : "sim"} />
                        <button
                          title={c.ativa ? `${c.grupo}. Carregar para esconder.` : "Escondida. Carregar para voltar a usar."}
                          className={`min-h-[36px] rounded-full px-3 text-sm ${c.ativa ? "bg-azul-suave text-azul-escuro" : "bg-black/5 text-secundario line-through"}`}
                        >
                          {c.nome}
                        </button>
                      </form>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
        <details className="mt-5">
          <summary className="cursor-pointer text-base font-semibold text-azul">Nova categoria</summary>
          <div className="mt-4">
            <Formulario acao={criarCategoria} botao="Criar categoria">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="c-nome" className={rotulo}>Nome</label>
                  <input id="c-nome" name="nome" required className={campo} />
                </div>
                <div>
                  <label htmlFor="c-tipo" className={rotulo}>Tipo</label>
                  <select id="c-tipo" name="tipo" className={campo}>
                    <option value="custo">Custo</option>
                    <option value="proveito">Proveito</option>
                    <option value="interno">Interno (fora do resultado)</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="c-grupo" className={rotulo}>Grupo no resultado</label>
                  <input id="c-grupo" name="grupo" list="grupos" className={campo} />
                  <datalist id="grupos">
                    {[...new Set(t.categorias.map((c) => c.grupo))].map((g) => (
                      <option key={g} value={g} />
                    ))}
                  </datalist>
                </div>
              </div>
            </Formulario>
          </div>
        </details>
      </Cartao>
      )}

      {sec === "fornecedores" && (
      <Cartao titulo="Fornecedores e clientes" acao={<Link href="/contactos" className="text-sm font-semibold text-azul">Abrir a página completa</Link>}>
        <p className="mb-3 text-sm text-secundario">Os totais, as faturas e os contratos de cada um estão em Clientes e fornecedores.</p>
        {t.entidades.length > 0 && (
          <ul className="mb-4 divide-y divide-linha">
            {t.entidades.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <Link href={`/contactos/${e.id}`} className="text-base text-tinta hover:text-azul">{e.nome}</Link>
                <span className="text-sm text-secundario">{[e.nif && `NIF ${e.nif}`, e.email, e.tipo].filter(Boolean).join(", ")}</span>
              </li>
            ))}
          </ul>
        )}
        <details>
          <summary className="cursor-pointer text-base font-semibold text-azul">Novo</summary>
          <div className="mt-4">
            <Formulario acao={criarEntidade} botao="Guardar">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="e-nome" className={rotulo}>Nome</label>
                  <input id="e-nome" name="nome" required className={campo} />
                </div>
                <div>
                  <label htmlFor="e-tipo" className={rotulo}>Tipo</label>
                  <select id="e-tipo" name="tipo" className={campo}>
                    <option value="fornecedor">Fornecedor</option>
                    <option value="cliente">Cliente</option>
                    <option value="ambos">Os dois</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="e-nif" className={rotulo}>NIF</label>
                  <input id="e-nif" name="nif" inputMode="numeric" maxLength={9} className={`${campo} numero`} />
                </div>
                <div>
                  <label htmlFor="e-email" className={rotulo}>Email</label>
                  <input id="e-email" name="email" type="email" className={campo} />
                </div>
              </div>
            </Formulario>
          </div>
        </details>
      </Cartao>
      )}

      {sec === "conta" && (
      <>
      <div className="grid gap-6 xl:grid-cols-2">
        <Cartao titulo="Sócios com acesso">
          <ul className="divide-y divide-linha">
            {t.socios.map((x) => (
              <li key={x.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="text-base text-tinta">{x.nome}</span>
                <span className="text-sm text-secundario">{x.email}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-secundario">Contas novas criam-se no computador, com <code className="font-mono">npm run socio</code> (ver LEIAME).</p>
        </Cartao>

        <Cartao titulo={`O teu PIN, ${socio.nome}`}>
          <p className="mb-4 text-sm text-secundario">Também está no menu, em baixo.</p>
          <Link href="/pin" className="inline-flex min-h-[44px] items-center rounded-full bg-azul px-6 text-base font-semibold text-white hover:bg-azul-escuro">
            Mudar PIN
          </Link>
        </Cartao>
      </div>

      <Cartao titulo="Cópia de segurança">
        <p className="mb-4 text-sm text-secundario">
          A base de dados da Torre está no plano grátis do Supabase, que não guarda cópias. Descarrega uma cópia de tudo (contas, movimentos, débitos, sócios, regras e registo) pelo menos uma vez por semana e guarda-a fora do computador.
        </p>
        <a href="/definicoes/copia" download className="inline-flex min-h-[44px] items-center rounded-full bg-azul px-6 text-base font-semibold text-white hover:bg-azul-escuro">
          Descarregar cópia de tudo
        </a>
      </Cartao>
      </>
      )}

        </div>
      </div>
    </>
  );
}
