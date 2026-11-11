import Link from "next/link";
import { exigirSocio } from "@/lib/sessao";
import { carregar } from "@/lib/dados";
import { euros } from "@/lib/dinheiro";
import { data, hojeLisboa } from "@/lib/texto";
import { resumirEntidades } from "@/lib/entidades";
import { criarEntidade, criarTester } from "../../acoes";
import { ROTULO_TESTER, type Tester } from "@/lib/tipos";
import { Formulario } from "@/components/Formulario";
import { Cartao, Etiqueta, Numero, Segmentos, Titulo, Vazio, campo, rotulo } from "@/components/ui";

type Ver = "clientes" | "testers";

const diasAte = (fim: string, hoje: string) => Math.round((Date.parse(fim) - Date.parse(hoje)) / 86400000);

export default async function Contactos({ searchParams }: { searchParams: { ver?: string; novo?: string } }) {
  const { s } = await exigirSocio();
  const t = await carregar(s);
  const hoje = hojeLisboa();
  const resumos = resumirEntidades(t.entidades, t.movimentos, t.faturas, t.contratos, hoje);
  const ver: Ver = searchParams.ver === "testers" ? "testers" : "clientes";
  const eCliente = (r: (typeof resumos)[number]) => r.entidade.tipo === "cliente" || r.entidade.tipo === "ambos";
  const clientes = resumos.filter(eCliente);
  const lista = clientes.slice().sort((a, b) => b.mrr - a.mrr || b.recebidoAno - a.recebidoAno || a.entidade.nome.localeCompare(b.entidade.nome, "pt"));

  // Testers: tabela à parte. Se o SQL ainda não correu, a página avisa em vez de partir.
  const { data: dadosTesters, error: erroTesters } = await s.from("testers").select("*").order("fim").order("nome");
  const testers = (dadosTesters ?? []) as Tester[];
  const ativos = testers.filter((x) => x.estado === "convidado" || x.estado === "a_testar" || x.estado === "a_avaliar");

  const soma = (rs: typeof resumos, f: (r: (typeof resumos)[number]) => number) => rs.reduce((x, r) => x + f(r), 0);

  return (
    <>
      <Titulo titulo="Clientes" texto="Quem adquire o Cockpit e quem o está a testar até ao fim do ano.">
        <Link href={`/contactos?ver=${ver}&novo=1#novo`} className="inline-flex min-h-[44px] items-center rounded-full bg-azul px-5 text-base font-semibold text-white hover:bg-azul-escuro">{ver === "testers" ? "Novo tester" : "Novo cliente"}</Link>
      </Titulo>

      <Segmentos
        atual={ver}
        opcoes={[
          { valor: "clientes", texto: "Clientes", href: "/contactos?ver=clientes", n: clientes.length },
          { valor: "testers", texto: "Testers", href: "/contactos?ver=testers", n: ativos.length },
        ]}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {ver === "testers" ? (
          <>
            <Numero legenda="Testers ativos" valor={String(ativos.length)} nota={`${testers.filter((x) => x.estado === "a_testar").length} a testar`} />
            <Numero legenda="A avaliar" valor={String(testers.filter((x) => x.estado === "a_avaliar").length)} nota="Já experimentaram, falta decidir" />
            <Numero legenda="Passaram a cliente" valor={String(testers.filter((x) => x.estado === "convertido").length)} />
            <Numero legenda="Teste termina" valor={ativos.length ? data(ativos.reduce((m, x) => (x.fim < m ? x.fim : m), ativos[0].fim)) : "-"} nota="O mais próximo" />
          </>
        ) : (
          <>
            <Numero legenda="Mensalidades (MRR)" valor={soma(clientes, (r) => r.mrr)} nota="Contratos ativos hoje" />
            <Numero legenda={`Recebido em ${hoje.slice(0, 4)}`} valor={soma(clientes, (r) => r.recebidoAno)} />
            <Numero legenda="Faturas por receber" valor={soma(clientes, (r) => r.emAberto)} nota={`${soma(clientes, (r) => r.nEmAberto)} sem pagamento no banco`} />
            <Numero legenda="Clientes" valor={String(clientes.length)} nota={`${clientes.filter((r) => r.mrr > 0).length} com mensalidade`} />
          </>
        )}
      </div>

      {searchParams.novo && (
        <section id="novo" className="scroll-mt-24 rounded-3xl border border-linha bg-white p-5" aria-label={ver === "testers" ? "Novo tester" : "Novo cliente"}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-tinta">{ver === "testers" ? "Novo tester" : "Novo cliente"}</h2>
            <Link href={`/contactos?ver=${ver}`} className="text-sm font-semibold text-secundario hover:text-tinta">Fechar</Link>
          </div>
          {ver === "testers" ? (
            <Formulario acao={criarTester} botao="Guardar tester">
              <div className="grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
                <div>
                  <label htmlFor="t-nome" className={rotulo}>Nome</label>
                  <input id="t-nome" name="nome" required className={campo} />
                </div>
                <div>
                  <label htmlFor="t-agencia" className={rotulo}>Agência</label>
                  <input id="t-agencia" name="agencia" className={campo} />
                </div>
                <div>
                  <label htmlFor="t-email" className={rotulo}>Email</label>
                  <input id="t-email" name="email" type="email" className={campo} />
                </div>
                <div>
                  <label htmlFor="t-tel" className={rotulo}>Contacto</label>
                  <input id="t-tel" name="telemovel" inputMode="tel" className={campo} />
                </div>
                <div>
                  <label htmlFor="t-estado" className={rotulo}>Estado</label>
                  <select id="t-estado" name="estado" defaultValue="a_testar" className={campo}>
                    {Object.entries(ROTULO_TESTER).map(([k, v]) => (
                      <option key={k} value={k}>{v.texto}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="t-fim" className={rotulo}>Testa até</label>
                  <input id="t-fim" name="fim" type="date" defaultValue="2026-12-31" className={campo} />
                </div>
                <div className="flex flex-col justify-end gap-2 sm:col-span-2">
                  <label className="flex items-center gap-2 text-base text-tinta"><input type="checkbox" name="tabela_enviada" className="h-5 w-5" /> Já enviou a tabela de clientes</label>
                  <label className="flex items-center gap-2 text-base text-tinta"><input type="checkbox" name="dados_importados" className="h-5 w-5" /> Os dados já foram importados</label>
                </div>
              </div>
            </Formulario>
          ) : (
            <Formulario acao={criarEntidade} botao="Guardar">
              <input type="hidden" name="tipo" value="cliente" />
              <div className="grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
                <div>
                  <label htmlFor="e-nome" className={rotulo}>Nome</label>
                  <input id="e-nome" name="nome" required className={campo} />
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
          )}
        </section>
      )}

      {ver === "testers" ? (
        erroTesters ? (
          <Vazio texto="A tabela dos testers ainda não existe. Corre o ficheiro supabase/migration_testers.sql no Supabase da Torre." />
        ) : testers.length ? (
          <Cartao>
            <ul className="divide-y divide-linha">
              {testers.map((x) => {
                const dias = diasAte(x.fim, hoje);
                const aberto = x.estado === "convidado" || x.estado === "a_testar" || x.estado === "a_avaliar";
                return (
                  <li key={x.id}>
                    <Link href={`/contactos/testers/${x.id}`} className="flex items-center gap-3 py-3 hover:bg-black/[0.02]">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-base font-medium text-tinta">{x.nome}{x.agencia ? ` · ${x.agencia}` : ""}</span>
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-secundario">
                          <Etiqueta cor={ROTULO_TESTER[x.estado].cor}>{ROTULO_TESTER[x.estado].texto}</Etiqueta>
                          {x.tabela_enviada ? <Etiqueta cor="verde">Tabela enviada</Etiqueta> : <Etiqueta cor="ambar">Falta a tabela</Etiqueta>}
                          {x.dados_importados ? <Etiqueta cor="verde">Dados importados</Etiqueta> : x.tabela_enviada ? <Etiqueta cor="ambar">Por importar</Etiqueta> : null}
                          {x.email && <span>{x.email}</span>}
                          {x.feedback && <span>com feedback</span>}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="numero block text-base font-semibold text-tinta">{aberto ? (dias < 0 ? "terminou" : dias === 0 ? "termina hoje" : `${dias} dias`) : "-"}</span>
                        <span className="block text-xs text-secundario">{aberto ? `até ${data(x.fim)}` : ""}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Cartao>
        ) : (
          <Vazio texto="Ainda não há testers. Regista quem está a experimentar o Cockpit até ao fim do ano." link="/contactos?ver=testers&novo=1#novo" rotuloLink="Novo tester" />
        )
      ) : lista.length ? (
        <Cartao>
          <ul className="divide-y divide-linha">
            {lista.map((r) => {
              const cockpit = r.contratos.filter((c) => c.produto === "cockpit");
              return (
                <li key={r.entidade.id}>
                  <Link href={`/contactos/${r.entidade.id}`} className="flex items-center gap-3 py-3 hover:bg-black/[0.02]">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-medium text-tinta">{r.entidade.nome}</span>
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-secundario">
                        {r.entidade.nif && <span className="numero">NIF {r.entidade.nif}</span>}
                        {cockpit.map((c) => (
                          <Etiqueta key={c.id} cor={c.estado === "ativo" ? "verde" : c.estado === "proposta" ? "azul" : c.estado === "pausado" ? "ambar" : "cinza"}>
                            Cockpit: {c.estado === "ativo" ? "ativo" : c.estado === "proposta" ? "proposta" : c.estado === "pausado" ? "pausado" : "terminado"}
                          </Etiqueta>
                        ))}
                        {r.mrr > 0 && <Etiqueta cor="verde">{euros(r.mrr)} por mês</Etiqueta>}
                        {r.contratos.length > 0 && r.mrr === 0 && cockpit.length === 0 && <Etiqueta cor="cinza">{r.contratos.length} {r.contratos.length === 1 ? "contrato" : "contratos"}</Etiqueta>}
                        {r.nEmAberto > 0 && <Etiqueta cor="ambar">{r.nEmAberto} {r.nEmAberto === 1 ? "fatura em aberto" : "faturas em aberto"}</Etiqueta>}
                        {r.ultima && <span>última atividade {data(r.ultima)}</span>}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="numero block text-base font-semibold text-tinta">{euros(r.recebidoAno)}</span>
                      <span className="block text-xs text-secundario">recebido este ano</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Cartao>
      ) : (
        <Vazio texto="Ainda não há clientes. Cria o primeiro para registar o contrato do Cockpit e ver as mensalidades." link="/contactos?ver=clientes&novo=1#novo" rotuloLink="Novo cliente" />
      )}
    </>
  );
}
