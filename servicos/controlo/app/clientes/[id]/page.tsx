import Link from "next/link";
import { notFound } from "next/navigation";
import { obterCliente } from "@/lib/clientes";
import { estadoDe, utilizadoresDe } from "@/lib/acoes";
import { PAPEIS, type Utilizador, type Verificacao } from "../../../supabase/functions/_shared/nucleo";
import { apagarCliente, exigirSessao, removerUtilizador, suspenderUtilizador } from "@/app/acoes";
import { FormConvidar } from "@/components/Formularios";
import BotaoConfirmar from "@/components/BotaoConfirmar";

export const dynamic = "force-dynamic";

const PRODUTO = { cockpit: "Cockpit", cpcv: "CPCV com IA" } as const;

function data(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" }) : "nunca";
}

export default async function Cliente({ params }: { params: { id: string } }) {
  await exigirSessao();
  const c = obterCliente(params.id);
  if (!c) notFound();

  let utilizadores: Utilizador[] = [];
  let estado: Verificacao[] = [];
  let erro: string | null = null;
  try {
    [utilizadores, estado] = await Promise.all([utilizadoresDe(c), estadoDe(c)]);
  } catch (e) {
    erro = e instanceof Error ? e.message : "Não foi possível falar com o Supabase deste cliente.";
  }
  const pendentes = estado.filter((v) => !v.ok);

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Link href="/" className="text-sm font-medium text-azul">Clientes</Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-tinta">{c.nome}</h1>
          <span className="rounded-full bg-azul-suave px-3 py-1 text-xs font-semibold text-azul-escuro">{PRODUTO[c.produto]}</span>
        </div>
        <p className="break-all text-sm text-secundario">{c.supabase_url}{c.app_url ? ` · app: ${c.app_url}` : ""}</p>
      </div>

      {erro && <p role="alert" className="rounded-2xl bg-ambar-fundo px-4 py-3 text-base text-ambar-texto">{erro}</p>}

      <section className="space-y-3" aria-labelledby="estado">
        <h2 id="estado" className="text-xl font-semibold text-tinta">Estado da instalação</h2>
        {estado.length === 0 && !erro ? (
          <p className="text-base text-secundario">Sem dados.</p>
        ) : (
          <ul className="divide-y divide-linha rounded-3xl border border-linha bg-white">
            {estado.map((v, i) => (
              <li key={i} className="flex items-start gap-3 px-5 py-3">
                <span aria-hidden className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${v.ok ? "bg-verde" : "bg-ambar"}`} />
                <div>
                  <p className="text-base text-tinta">{v.texto}<span className="sr-only">{v.ok ? ": em ordem" : ": por resolver"}</span></p>
                  {!v.ok && v.conselho && <p className="text-sm text-ambar-texto">{v.conselho}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
        {estado.length > 0 && (
          <p className="text-sm text-secundario">{pendentes.length === 0 ? "Tudo em ordem." : `${pendentes.length} por resolver antes de entregar a um cliente.`}</p>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="utilizadores">
        <h2 id="utilizadores" className="text-xl font-semibold text-tinta">Utilizadores ({utilizadores.length})</h2>
        {utilizadores.length === 0 ? (
          <p className="text-base text-secundario">Ainda ninguém tem acesso.</p>
        ) : (
          <ul className="divide-y divide-linha rounded-3xl border border-linha bg-white">
            {utilizadores.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4" data-utilizador={u.email}>
                <div className="min-w-0">
                  <p className="truncate text-base font-medium text-tinta">{u.nome ? `${u.nome} · ` : ""}{u.email}</p>
                  <p className="text-sm text-secundario">
                    {u.papel ?? "sem papel"} · criado {data(u.criado_em)} · último acesso {data(u.ultimo_acesso)}
                    {u.suspenso ? " · suspenso" : ""}{u.semAcesso ? " · fora da lista de membros" : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <form action={suspenderUtilizador}>
                    <input type="hidden" name="cliente" value={c.id} />
                    <input type="hidden" name="id" value={u.id} />
                    <input type="hidden" name="suspender" value={u.suspenso ? "0" : "1"} />
                    <button className="min-h-[40px] rounded-full border border-linha px-4 text-sm font-semibold text-tinta hover:bg-black/5">{u.suspenso ? "Reativar" : "Suspender"}</button>
                  </form>
                  <form action={removerUtilizador}>
                    <input type="hidden" name="cliente" value={c.id} />
                    <input type="hidden" name="id" value={u.id} />
                    <BotaoConfirmar texto="Apagar" pergunta={`Apagar a conta de ${u.email}? Não se pode desfazer.`} className="min-h-[40px] rounded-full border border-linha px-4 text-sm font-semibold text-ambar-texto hover:bg-ambar-fundo" />
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="novo">
        <h2 id="novo" className="text-xl font-semibold text-tinta">Novo utilizador</h2>
        <div className="max-w-xl rounded-3xl border border-linha bg-white p-5">
          <FormConvidar id={c.id} produto={c.produto} papeis={PAPEIS[c.produto]} />
        </div>
      </section>

      <section className="space-y-3 border-t border-linha pt-6">
        <h2 className="text-base font-semibold text-tinta">Retirar da lista</h2>
        <p className="text-sm text-secundario">Só tira o cliente desta lista. Não apaga o Supabase dele nem os utilizadores.</p>
        <form action={apagarCliente}>
          <input type="hidden" name="id" value={c.id} />
          <BotaoConfirmar texto={`Retirar ${c.nome} da lista`} pergunta={`Retirar ${c.nome} da lista? O Supabase e os utilizadores dele ficam como estão.`} className="min-h-[40px] rounded-full border border-linha px-4 text-sm font-semibold text-ambar-texto hover:bg-ambar-fundo" />
        </form>
      </section>
    </div>
  );
}
