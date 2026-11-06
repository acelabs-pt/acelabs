import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirSocio } from "@/lib/sessao";
import { carregar } from "@/lib/dados";
import { proximaCobranca } from "@/lib/calculos";
import { data, hojeLisboa } from "@/lib/texto";
import { apagarSubscricao, guardarSubscricao } from "../../../acoes";
import { Formulario } from "@/components/Formulario";
import CamposSubscricao from "@/components/CamposSubscricao";
import BotaoConfirmar from "@/components/BotaoConfirmar";
import { Cartao, Titulo, Valor } from "@/components/ui";

export default async function Debito({ params }: { params: { id: string } }) {
  const { s } = await exigirSocio();
  const t = await carregar(s);
  const x = t.subscricoes.find((y) => y.id === params.id);
  if (!x) notFound();
  const hoje = hojeLisboa();
  const pagos = t.movimentos.filter((m) => m.subscricao_id === x.id);
  const conta = new Map(t.contas.map((c) => [c.id, c.nome]));

  return (
    <>
      <Titulo titulo={x.nome} texto={x.ativa ? `Próxima cobrança a ${data(proximaCobranca(x, hoje))}.` : "Cancelado."}>
        <Link href="/debitos" className="text-base font-semibold text-azul">Voltar</Link>
      </Titulo>
      <Cartao>
        <Formulario acao={guardarSubscricao} botao="Guardar" limpar={false}>
          <input type="hidden" name="id" value={x.id} />
          <CamposSubscricao t={t} x={x} hoje={hoje} />
        </Formulario>
      </Cartao>
      <Cartao titulo={`Pagamentos ligados (${pagos.length})`}>
        {pagos.length ? (
          <ul className="divide-y divide-linha">
            {pagos.map((m) => (
              <li key={m.id}>
                <Link href={`/movimentos/${m.id}`} className="flex items-center gap-3 py-2.5 hover:bg-black/[0.02]">
                  <span className="numero w-20 shrink-0 text-sm text-secundario">{data(m.data)}</span>
                  <span className="min-w-0 flex-1 truncate text-base text-tinta">{m.descricao}</span>
                  <span className="hidden text-sm text-secundario sm:inline">{conta.get(m.conta_id)}</span>
                  <Valor c={m.valor} className="text-base" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-base text-secundario">Ainda nenhum. Ligam-se sozinhos ao importar extratos se houver uma regra com o nome que aparece no banco (em Definições), ou à mão em cada movimento.</p>
        )}
      </Cartao>
      <form action={apagarSubscricao}>
        <input type="hidden" name="id" value={x.id} />
        <BotaoConfirmar texto="Apagar débito" pergunta="Apagar este débito? Os movimentos ficam, só deixam de estar ligados." />
      </form>
    </>
  );
}
