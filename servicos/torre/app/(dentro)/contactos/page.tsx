import Link from "next/link";
import { exigirSocio } from "@/lib/sessao";
import { carregar } from "@/lib/dados";
import { euros } from "@/lib/dinheiro";
import { data, hojeLisboa } from "@/lib/texto";
import { resumirEntidades } from "@/lib/entidades";
import { criarEntidade } from "../../acoes";
import { Formulario } from "@/components/Formulario";
import { Cartao, Etiqueta, Numero, Segmentos, Titulo, Vazio, campo, rotulo } from "@/components/ui";

type Ver = "clientes" | "fornecedores" | "todos";

export default async function Contactos({ searchParams }: { searchParams: { ver?: string; novo?: string } }) {
  const { s } = await exigirSocio();
  const t = await carregar(s);
  const hoje = hojeLisboa();
  const resumos = resumirEntidades(t.entidades, t.movimentos, t.faturas, t.contratos, hoje);
  const ver: Ver = searchParams.ver === "fornecedores" || searchParams.ver === "todos" ? searchParams.ver : "clientes";
  const eCliente = (r: (typeof resumos)[number]) => r.entidade.tipo === "cliente" || r.entidade.tipo === "ambos";
  const eFornecedor = (r: (typeof resumos)[number]) => r.entidade.tipo === "fornecedor" || r.entidade.tipo === "ambos";
  const clientes = resumos.filter(eCliente);
  const fornecedores = resumos.filter(eFornecedor);
  const lista = (ver === "clientes" ? clientes : ver === "fornecedores" ? fornecedores : resumos).slice().sort((a, b) => (ver === "clientes" ? b.mrr - a.mrr || b.recebidoAno - a.recebidoAno : b.pagoAno - a.pagoAno || b.pago - a.pago) || a.entidade.nome.localeCompare(b.entidade.nome, "pt"));

  const soma = (rs: typeof resumos, f: (r: (typeof resumos)[number]) => number) => rs.reduce((x, r) => x + f(r), 0);

  return (
    <>
      <Titulo titulo="Clientes e fornecedores" texto="Quanto se recebeu e se pagou a cada um, faturas em aberto e contratos.">
        <Link href="/contactos?novo=1#novo" className="inline-flex min-h-[44px] items-center rounded-full bg-azul px-5 text-base font-semibold text-white hover:bg-azul-escuro">Novo</Link>
      </Titulo>

      <Segmentos
        atual={ver}
        opcoes={[
          { valor: "clientes", texto: "Clientes", href: "/contactos?ver=clientes", n: clientes.length },
          { valor: "fornecedores", texto: "Fornecedores", href: "/contactos?ver=fornecedores", n: fornecedores.length },
          { valor: "todos", texto: "Todos", href: "/contactos?ver=todos" },
        ]}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {ver === "fornecedores" ? (
          <>
            <Numero legenda={`Pago em ${hoje.slice(0, 4)}`} valor={soma(fornecedores, (r) => r.pagoAno)} />
            <Numero legenda="Pago, no total" valor={soma(fornecedores, (r) => r.pago)} />
            <Numero legenda="Faturas por pagar" valor={soma(fornecedores, (r) => r.emAberto)} nota={`${soma(fornecedores, (r) => r.nEmAberto)} sem pagamento no banco`} />
            <Numero legenda="Fornecedores" valor={String(fornecedores.length)} />
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
        <section id="novo" className="scroll-mt-24 rounded-3xl border border-linha bg-white p-5" aria-label="Novo cliente ou fornecedor">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-tinta">Novo</h2>
            <Link href="/contactos" className="text-sm font-semibold text-secundario hover:text-tinta">Fechar</Link>
          </div>
          <Formulario acao={criarEntidade} botao="Guardar">
            <div className="grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
              <div>
                <label htmlFor="e-nome" className={rotulo}>Nome</label>
                <input id="e-nome" name="nome" required className={campo} />
              </div>
              <div>
                <label htmlFor="e-tipo" className={rotulo}>É</label>
                <select id="e-tipo" name="tipo" defaultValue={ver === "fornecedores" ? "fornecedor" : "cliente"} className={campo}>
                  <option value="cliente">Cliente</option>
                  <option value="fornecedor">Fornecedor</option>
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
        </section>
      )}

      {lista.length ? (
        <Cartao>
          <ul className="divide-y divide-linha">
            {lista.map((r) => {
              const cli = eCliente(r);
              const forn = eFornecedor(r);
              const principal = ver === "fornecedores" || (ver === "todos" && !cli) ? r.pagoAno : r.recebidoAno;
              const rotuloValor = ver === "fornecedores" || (ver === "todos" && !cli) ? "pago este ano" : "recebido este ano";
              return (
                <li key={r.entidade.id}>
                  <Link href={`/contactos/${r.entidade.id}`} className="flex items-center gap-3 py-3 hover:bg-black/[0.02]">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-medium text-tinta">{r.entidade.nome}</span>
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-secundario">
                        {r.entidade.nif && <span className="numero">NIF {r.entidade.nif}</span>}
                        {ver === "todos" && <span>{cli && forn ? "Cliente e fornecedor" : cli ? "Cliente" : "Fornecedor"}</span>}
                        {r.mrr > 0 && <Etiqueta cor="verde">{euros(r.mrr)} por mês</Etiqueta>}
                        {r.contratos.length > 0 && r.mrr === 0 && <Etiqueta cor="cinza">{r.contratos.length} {r.contratos.length === 1 ? "contrato" : "contratos"}</Etiqueta>}
                        {r.nEmAberto > 0 && <Etiqueta cor="ambar">{r.nEmAberto} {r.nEmAberto === 1 ? "fatura em aberto" : "faturas em aberto"}</Etiqueta>}
                        {r.ultima && <span>última atividade {data(r.ultima)}</span>}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="numero block text-base font-semibold text-tinta">{euros(principal)}</span>
                      <span className="block text-xs text-secundario">{rotuloValor}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Cartao>
      ) : (
        <Vazio
          texto={ver === "clientes" ? "Ainda não há clientes. Cria o primeiro para registar o contrato e ver as mensalidades." : ver === "fornecedores" ? "Os fornecedores aparecem aqui quando carregares faturas ou os criares." : "Ainda não há ninguém."}
          link="/contactos?novo=1#novo"
          rotuloLink="Criar"
        />
      )}
    </>
  );
}
