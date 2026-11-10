import Link from "next/link";
import { exigirSocio } from "@/lib/sessao";
import { euros } from "@/lib/dinheiro";
import { data } from "@/lib/texto";
import { agruparAcessos, filtrarAcessos, precisaAtencao, type Acesso } from "@/lib/acessos";
import { apagarAcesso, criarAcesso, guardarAcesso } from "../../acoes";
import { Formulario } from "@/components/Formulario";
import BotaoConfirmar from "@/components/BotaoConfirmar";
import CamposAcesso from "@/components/CamposAcesso";
import { Cartao, Etiqueta, Numero, Segmentos, Titulo, Vazio, botaoSecundario, campo } from "@/components/ui";

const ESTADOS = [
  { valor: "todos", texto: "Todos" },
  { valor: "atencao", texto: "Pedem atenção" },
  { valor: "ativo", texto: "Ativos" },
  { valor: "por criar", texto: "Por criar" },
  { valor: "a cancelar", texto: "A cancelar" },
];

export default async function Acessos({ searchParams }: { searchParams: { q?: string; estado?: string; novo?: string } }) {
  const { s } = await exigirSocio();
  const [{ data: linhas, error }, { data: socios }] = await Promise.all([
    s.from("acessos").select("*").order("servico"),
    s.from("socios").select("nome").eq("ativo", true).order("nome"),
  ]);

  const titulo = (
    <Titulo titulo="Acessos" texto="Os serviços e contas da Ace Labs e onde está guardada cada credencial. Nunca as passwords nem as chaves.">
      <Link href="/acessos?novo=1#novo" className="inline-flex min-h-[44px] items-center rounded-full bg-azul px-5 text-base font-semibold text-white hover:bg-azul-escuro">Novo</Link>
    </Titulo>
  );

  if (error) {
    return (
      <>
        {titulo}
        <Vazio texto="A tabela dos acessos ainda não existe nesta base de dados. Corre npm run schema em servicos/torre (ver o LEIAME)." />
      </>
    );
  }

  const todos = (linhas ?? []) as Acesso[];
  const donos = [...(socios ?? []).map((x) => x.nome as string), "Os dois", "Empresa"];
  const q = (searchParams.q ?? "").trim();
  const estado = ESTADOS.some((e) => e.valor === searchParams.estado) ? searchParams.estado! : "todos";
  const lista = filtrarAcessos(todos, q, estado);
  const grupos = agruparAcessos(lista);
  const ativos = todos.filter((a) => a.estado === "ativo");
  const sem2fa = ativos.filter((a) => a.dois_fatores !== "sim");
  const porCriar = todos.filter((a) => a.estado === "por criar");
  const custo = ativos.reduce((x, a) => x + (a.custo_mensal ?? 0), 0);
  const link = (e: string) => `/acessos?estado=${encodeURIComponent(e)}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  return (
    <>
      {titulo}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Numero legenda="Serviços ativos" valor={String(ativos.length)} nota={`${todos.length} no registo`} />
        <Numero legenda="Sem 2FA confirmado" valor={String(sem2fa.length)} nota="Ativos sem verificação em dois passos" href={link("atencao")} />
        <Numero legenda="Por criar" valor={String(porCriar.length)} href={link("por criar")} />
        <Numero legenda="Custo por mês" valor={custo} nota="Dos ativos com custo indicado" />
      </div>

      <Segmentos atual={estado} opcoes={ESTADOS.map((e) => ({ valor: e.valor, texto: e.texto, href: link(e.valor), n: e.valor === "atencao" ? sem2fa.length + porCriar.length : undefined }))} />

      <form method="get" action="/acessos" className="flex gap-2" role="search">
        <input type="hidden" name="estado" value={estado} />
        <label htmlFor="acessos-q" className="sr-only">Pesquisar acessos</label>
        <input id="acessos-q" name="q" defaultValue={q} placeholder="Pesquisar serviço, conta, dono ou onde está" className={campo} />
        <button type="submit" className={botaoSecundario}>Pesquisar</button>
        {q && (
          <Link href={`/acessos?estado=${encodeURIComponent(estado)}`} className={botaoSecundario}>Limpar</Link>
        )}
      </form>

      {searchParams.novo && (
        <section id="novo" className="scroll-mt-24 rounded-3xl border border-linha bg-white p-5" aria-label="Novo acesso">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-tinta">Novo acesso</h2>
            <Link href="/acessos" className="text-sm font-semibold text-secundario hover:text-tinta">Fechar</Link>
          </div>
          <Formulario acao={criarAcesso} botao="Guardar">
            <CamposAcesso donos={donos} prefixo="novo" />
          </Formulario>
        </section>
      )}

      {grupos.length ? (
        grupos.map((g) => (
          <Cartao key={g.categoria} titulo={g.categoria} acao={<span className="text-sm text-secundario">{g.itens.length}</span>}>
            <ul className="divide-y divide-linha">
              {g.itens.map((a) => (
                <ItemAcesso key={a.id} a={a} donos={donos} />
              ))}
            </ul>
          </Cartao>
        ))
      ) : (
        <Vazio
          texto={todos.length ? "Nenhum acesso com estes filtros." : "Ainda não há acessos registados. Cria o primeiro ou importa a lista inicial com npm run acessos."}
          link={todos.length ? "/acessos" : "/acessos?novo=1#novo"}
          rotuloLink={todos.length ? "Ver todos" : "Criar"}
        />
      )}
    </>
  );
}

function ItemAcesso({ a, donos }: { a: Acesso; donos: string[] }) {
  const atencao = precisaAtencao(a);
  return (
    <li className="py-3">
      <details>
        <summary className="flex cursor-pointer items-center gap-3">
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="truncate text-base font-medium text-tinta">{a.servico}</span>
              {atencao === "por criar" && <Etiqueta cor="azul">Por criar</Etiqueta>}
              {atencao === "sem 2FA" && <Etiqueta cor="ambar">{a.dois_fatores === "não" ? "Sem 2FA" : "2FA por confirmar"}</Etiqueta>}
              {a.estado === "a cancelar" && <Etiqueta cor="cinza">A cancelar</Etiqueta>}
            </span>
            <span className="block truncate text-xs text-secundario">{[a.conta, a.dono].filter(Boolean).join(" · ") || "Sem conta indicada"}</span>
          </span>
          {a.custo_mensal ? <span className="numero shrink-0 text-sm text-secundario">{euros(a.custo_mensal)}/mês</span> : null}
        </summary>
        <div className="mt-3 space-y-3 text-sm">
          <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[max-content_1fr]">
            {a.para_que && (
              <>
                <dt className="text-secundario">Para que serve</dt>
                <dd className="text-tinta">{a.para_que}</dd>
              </>
            )}
            {a.url && (
              <>
                <dt className="text-secundario">Endereço</dt>
                <dd className="min-w-0 break-all">
                  <a href={a.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-azul">{a.url}</a>
                </dd>
              </>
            )}
            <dt className="text-secundario">Onde está a credencial</dt>
            <dd className="break-words text-tinta">{a.onde_esta || "Por indicar"}</dd>
            <dt className="text-secundario">2FA</dt>
            <dd className="text-tinta">{a.dois_fatores === "sim" ? "Sim" : a.dois_fatores === "não" ? "Não" : "Não sei"}</dd>
            {a.renovacao && (
              <>
                <dt className="text-secundario">Renovação</dt>
                <dd className="numero text-tinta">{data(a.renovacao)}</dd>
              </>
            )}
            {a.notas && (
              <>
                <dt className="text-secundario">Notas</dt>
                <dd className="whitespace-pre-line text-tinta">{a.notas}</dd>
              </>
            )}
          </dl>
          <details>
            <summary className="cursor-pointer text-base font-semibold text-azul">Editar</summary>
            <div className="mt-4 space-y-4">
              <Formulario acao={guardarAcesso} botao="Guardar" limpar={false}>
                <CamposAcesso a={a} donos={donos} prefixo={`a-${a.id}`} />
              </Formulario>
              <form action={apagarAcesso}>
                <input type="hidden" name="id" value={a.id} />
                <BotaoConfirmar texto="Apagar" pergunta={`Apagar "${a.servico}" do registo de acessos? Isto não mexe na conta do serviço.`} />
              </form>
            </div>
          </details>
        </div>
      </details>
    </li>
  );
}
