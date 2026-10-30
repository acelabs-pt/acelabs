import Link from "next/link";
import { contasSoltasDe, empresasDe, projetoPartilhado } from "@/lib/acoes";
import { alertasDe, COR_ESTADO, data, ROTULO_ESTADO } from "@/lib/painel";
import type { EmpresaResumo } from "../../supabase/functions/_shared/nucleo";
import { exigirSessao } from "@/app/acoes";
import { FormNovaEmpresa } from "@/components/Formularios";

export const dynamic = "force-dynamic";

export default async function Painel() {
  await exigirSessao();
  const projeto = projetoPartilhado();
  if (!projeto) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight text-tinta">Painel do Cockpit</h1>
        <div className="rounded-3xl border border-linha bg-white p-8">
          <p className="text-base text-tinta">Ainda não registaste o projeto Cockpit partilhado.</p>
          <p className="mt-1 text-base text-secundario">Em Novo cliente, escolhe Cockpit e marca a caixa do projeto partilhado.</p>
          <Link href="/clientes/novo" className="mt-4 inline-flex min-h-[44px] items-center rounded-full bg-azul px-5 text-base font-semibold text-white hover:bg-azul-escuro">Registar o projeto</Link>
        </div>
      </div>
    );
  }

  let empresas: EmpresaResumo[] = [];
  let soltas: Awaited<ReturnType<typeof contasSoltasDe>> = [];
  let erro: string | null = null;
  try {
    [empresas, soltas] = await Promise.all([empresasDe(projeto), contasSoltasDe(projeto)]);
  } catch (e) {
    erro = e instanceof Error ? e.message : "Não foi possível falar com o Supabase.";
  }

  const ativas = empresas.filter((e) => e.estado === "piloto" || e.estado === "ativa");
  const utilizadores = empresas.reduce((n, e) => n + e.utilizadores, 0);
  const convites = empresas.reduce((n, e) => n + e.convites_por_aceitar, 0);
  const comAlertas = ativas.filter((e) => alertasDe(e).length > 0).length;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-tinta">Painel do Cockpit</h1>
          <p className="mt-1 text-base text-secundario">Todas as empresas do projeto partilhado, num só sítio.</p>
        </div>
        <Link href="/auditoria" className="inline-flex min-h-[44px] items-center rounded-full border border-linha px-5 text-base font-semibold text-tinta hover:bg-black/5">Registo de ações</Link>
      </div>

      {erro && <p role="alert" className="rounded-2xl bg-ambar-fundo px-4 py-3 text-base text-ambar-texto">{erro}</p>}

      {!erro && (
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-teste="totais">
          <Total rotulo="Empresas ativas" valor={ativas.length} />
          <Total rotulo="Utilizadores" valor={utilizadores} />
          <Total rotulo="Convites por aceitar" valor={convites} />
          <Total rotulo="Empresas com avisos" valor={comAlertas} />
        </dl>
      )}

      {!erro && (
        <section className="space-y-3" aria-labelledby="empresas">
          <h2 id="empresas" className="text-xl font-semibold text-tinta">Empresas ({empresas.length})</h2>
          {empresas.length === 0 ? (
            <p className="rounded-3xl border border-linha bg-white p-6 text-base text-secundario">Ainda não há empresas. Cria a primeira em baixo.</p>
          ) : (
            <ul className="space-y-3">
              {empresas.map((e) => {
                const avisos = alertasDe(e);
                return (
                  <li key={e.id} data-empresa={e.codigo}>
                    <Link href={`/cockpit/${e.codigo}`} className="block rounded-3xl border border-linha bg-white p-5 transition hover:border-azul/40">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold text-tinta">{e.nome}</h3>
                          <p className="text-sm text-secundario">
                            {e.codigo}
                            {e.responsavel ? ` · acompanha ${e.responsavel}` : ""} · desde {data(e.inicio)}
                          </p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${COR_ESTADO[e.estado]}`}>{ROTULO_ESTADO[e.estado]}</span>
                      </div>
                      <p className="mt-3 text-sm text-tinta">
                        {e.utilizadores} {e.utilizadores === 1 ? "utilizador" : "utilizadores"} · último acesso {data(e.ultimo_acesso)} · {e.aparelhos} {e.aparelhos === 1 ? "telemóvel" : "telemóveis"} com notificações
                      </p>
                      <p className="mt-1 text-sm text-secundario">
                        {e.compradores} compradores · {e.proprietarios} proprietários · {e.angariacoes} angariações · {e.atividade_7d} novos registos nos últimos 7 dias
                      </p>
                      {avisos.length > 0 && (
                        <ul className="mt-3 space-y-1">
                          {avisos.map((a) => (
                            <li key={a} className="flex items-start gap-2 text-sm text-ambar-texto">
                              <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-ambar" />
                              {a}
                            </li>
                          ))}
                        </ul>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {soltas.length > 0 && (
        <section className="space-y-3" aria-labelledby="soltas">
          <h2 id="soltas" className="text-xl font-semibold text-tinta">Contas sem empresa ({soltas.length})</h2>
          <p className="text-sm text-secundario">Entram mas não veem dados, porque não estão na lista de nenhuma empresa. Apaga-as no Supabase (Authentication) ou convida-as de novo pela empresa certa.</p>
          <ul className="divide-y divide-linha rounded-3xl border border-linha bg-white">
            {soltas.map((u) => (
              <li key={u.id} className="px-5 py-3 text-base text-tinta">
                {u.email} <span className="text-sm text-secundario">· criada {data(u.criado_em)} · último acesso {data(u.ultimo_acesso)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!erro && (
        <section className="space-y-3" aria-labelledby="nova">
          <h2 id="nova" className="text-xl font-semibold text-tinta">Nova empresa</h2>
          <div className="max-w-3xl rounded-3xl border border-linha bg-white p-5">
            <FormNovaEmpresa />
          </div>
        </section>
      )}
    </div>
  );
}

function Total({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className="rounded-3xl border border-linha bg-white p-4">
      <dt className="text-sm text-secundario">{rotulo}</dt>
      <dd className="mt-1 text-3xl font-bold tracking-tight text-tinta">{valor}</dd>
    </div>
  );
}
