import { acessosConfigurados, codigoDe, estadoAcesso } from "@/lib/cockpitAcessos";
import { criarAcessoCockpit, reenviarAcessoCockpit } from "@/app/acoes";
import { Formulario } from "@/components/Formulario";
import { Cartao, Etiqueta, campo, rotulo } from "@/components/ui";
import type { Tester } from "@/lib/tipos";

const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-PT", { timeZone: "Europe/Lisbon", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

/**
 * A alavanca do Cockpit na ficha do tester: sem conta, cria a empresa e envia o convite; com conta, mostra a empresa, se já entrou,
 * e deixa reenviar o link para escolher a password.
 */
export default async function AcessoCockpit({ tester, socio }: { tester: Tester; socio: string }) {
  if (!tester.email) {
    return (
      <Cartao titulo="Acesso ao Cockpit">
        <p className="text-base text-secundario">Põe o email do tester em Dados e feedback e guarda. É para esse email que vai o convite.</p>
      </Cartao>
    );
  }
  if (!acessosConfigurados()) {
    return (
      <Cartao titulo="Acesso ao Cockpit">
        <p className="text-base text-secundario">Ainda não está ligado ao Cockpit. Ver o LEIAME, secção Acessos ao Cockpit.</p>
      </Cartao>
    );
  }

  const { dados, erro } = await estadoAcesso(tester.email);
  if (erro || !dados) {
    return (
      <Cartao titulo="Acesso ao Cockpit">
        <p role="alert" className="rounded-xl bg-ambar-fundo px-4 py-3 text-sm text-ambar-texto">{erro}</p>
      </Cartao>
    );
  }

  // Já tem conta: estado e reenviar o link.
  if (dados.utilizador) {
    const u = dados.utilizador;
    return (
      <Cartao
        titulo="Acesso ao Cockpit"
        acao={u.ultimo_acesso ? <Etiqueta cor="verde">Já entrou</Etiqueta> : <Etiqueta cor="ambar">Ainda não entrou</Etiqueta>}
      >
        <dl className="mb-4 grid gap-x-6 gap-y-2 text-base sm:grid-cols-[auto_1fr]">
          <dt className="text-secundario">Email</dt>
          <dd className="min-w-0 break-words text-tinta">{tester.email}</dd>
          <dt className="text-secundario">Empresa</dt>
          <dd className="text-tinta">
            {dados.empresa ? `${dados.empresa.nome} (${dados.empresa.codigo})` : "Sem empresa: não vê dados. Fala com o Pedro."}
            {dados.empresa?.suspensa ? " - suspensa" : ""}
          </dd>
          <dt className="text-secundario">Convite</dt>
          <dd className="text-tinta">{quando(u.convidado_em)}</dd>
          <dt className="text-secundario">Último acesso</dt>
          <dd className="text-tinta">{u.ultimo_acesso ? quando(u.ultimo_acesso) : "Ainda não escolheu a password"}</dd>
        </dl>
        <Formulario acao={reenviarAcessoCockpit} botao="Reenviar link da password" limpar={false} className="space-y-3">
          <input type="hidden" name="id" value={tester.id} />
          <p className="text-sm text-secundario">
            Para quando o convite expirou ou esqueceu a password: recebe um email que abre &ldquo;Escolhe a tua password&rdquo;. O link só funciona uma vez.
          </p>
        </Formulario>
      </Cartao>
    );
  }

  // Ainda sem conta: criar.
  const base = tester.agencia || tester.nome;
  const meu = ["pedro", "miguel"].find((n) => socio.toLowerCase().startsWith(n)) ?? "";
  return (
    <Cartao titulo="Acesso ao Cockpit" acao={<Etiqueta cor="cinza">Sem conta</Etiqueta>}>
      <Formulario acao={criarAcessoCockpit} botao="Criar conta e enviar convite" limpar={false}>
        <input type="hidden" name="id" value={tester.id} />
        <p className="text-base text-secundario">
          Cria a conta de <b className="text-tinta">{tester.nome}</b> no Cockpit e envia o convite para <b className="text-tinta">{tester.email}</b>. Abre o link
          uma só vez e escolhe a password. Cada pessoa só vê os dados da sua empresa.
        </p>
        {dados.empresas.length > 0 && (
          <div>
            <label htmlFor="ac-existente" className={rotulo}>Empresa</label>
            <select id="ac-existente" name="empresa_existente" defaultValue="" className={campo}>
              <option value="">Empresa nova (preencher abaixo)</option>
              {dados.empresas.map((e) => (
                <option key={e.codigo} value={e.codigo}>Juntar a {e.nome} ({e.codigo})</option>
              ))}
            </select>
            <p className="mt-1 text-sm text-secundario">Um colega de uma agência que já está no Cockpit entra na empresa dela e vê os mesmos clientes.</p>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
          <div>
            <label htmlFor="ac-nome" className={rotulo}>Nome da empresa nova</label>
            <input id="ac-nome" name="empresa_nome" defaultValue={base} className={campo} />
          </div>
          <div>
            <label htmlFor="ac-codigo" className={rotulo}>Código</label>
            <input id="ac-codigo" name="empresa_codigo" defaultValue={codigoDe(base)} className={campo} />
          </div>
          <div>
            <label htmlFor="ac-resp" className={rotulo}>Quem acompanha</label>
            <select id="ac-resp" name="responsavel" defaultValue={meu} className={campo}>
              <option value="pedro">Pedro</option>
              <option value="miguel">Miguel</option>
              <option value="">Ninguém por agora</option>
            </select>
          </div>
        </div>
      </Formulario>
    </Cartao>
  );
}
