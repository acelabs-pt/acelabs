import Link from "next/link";
import { notFound } from "next/navigation";
import { auditoriaDe, daEmpresa, empresasDe, estadoDe, projetoPartilhado, utilizadoresDe } from "@/lib/acoes";
import { alertasDe, COR_ESTADO, data, ROTULO_ESTADO } from "@/lib/painel";
import { ESTADOS_EMPRESA, type EmpresaResumo, type EntradaAuditoria, type Utilizador, type Verificacao } from "../../../supabase/functions/_shared/nucleo";
import { exigirSessao, mudarEstadoEmpresa, removerNaEmpresa, suspenderNaEmpresa } from "@/app/acoes";
import { FormApagarEmpresa, FormConvidar, FormDadosEmpresa } from "@/components/Formularios";
import BotaoConfirmar from "@/components/BotaoConfirmar";
import ListaAuditoria from "@/components/ListaAuditoria";

export const dynamic = "force-dynamic";

export default async function Empresa({ params }: { params: { codigo: string } }) {
  await exigirSessao();
  const projeto = projetoPartilhado();
  if (!projeto) notFound();

  let empresa: EmpresaResumo | undefined;
  let utilizadores: Utilizador[] = [];
  let estado: Verificacao[] = [];
  let registo: EntradaAuditoria[] = [];
  let erro: string | null = null;
  try {
    const todas = await empresasDe(projeto);
    empresa = todas.find((e) => e.codigo === params.codigo);
    if (empresa) {
      const vista = daEmpresa(projeto, empresa.codigo, empresa.nome);
      [utilizadores, estado, registo] = await Promise.all([utilizadoresDe(vista), estadoDe(vista), auditoriaDe(projeto, empresa.codigo, 20)]);
    }
  } catch (e) {
    erro = e instanceof Error ? e.message : "Não foi possível falar com o Supabase.";
  }
  if (!erro && !empresa) notFound();
  if (!empresa) {
    return (
      <div className="space-y-3">
        <Link href="/cockpit" className="text-sm font-medium text-azul">Painel</Link>
        <p role="alert" className="rounded-2xl bg-ambar-fundo px-4 py-3 text-base text-ambar-texto">{erro}</p>
      </div>
    );
  }

  const avisos = alertasDe(empresa);
  const pendentes = estado.filter((v) => !v.ok);
  const marcos = [
    { texto: "Empresa criada", feito: true },
    { texto: "Pelo menos um utilizador convidado", feito: empresa.utilizadores > 0 },
    { texto: "Convites aceites", feito: empresa.utilizadores > 0 && empresa.convites_por_aceitar === 0 },
    { texto: "Alguém já entrou", feito: !!empresa.ultimo_acesso },
    { texto: "Notificações ativas num telemóvel", feito: empresa.aparelhos > 0 },
    { texto: "Primeiro comprador criado", feito: empresa.compradores > 0 },
    { texto: "Primeira angariação criada", feito: empresa.angariacoes > 0 },
  ];
  const feitos = marcos.filter((m) => m.feito).length;

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Link href="/cockpit" className="text-sm font-medium text-azul">Painel</Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-tinta">{empresa.nome}</h1>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${COR_ESTADO[empresa.estado]}`}>{ROTULO_ESTADO[empresa.estado]}</span>
        </div>
        <p className="text-sm text-secundario">
          {empresa.codigo}
          {empresa.responsavel ? ` · acompanha ${empresa.responsavel}` : ""} · desde {data(empresa.inicio)}
        </p>
      </div>

      {erro && <p role="alert" className="rounded-2xl bg-ambar-fundo px-4 py-3 text-base text-ambar-texto">{erro}</p>}

      {avisos.length > 0 && (
        <ul className="space-y-1 rounded-3xl bg-ambar-fundo px-5 py-4" data-teste="avisos">
          {avisos.map((a) => (
            <li key={a} className="text-base text-ambar-texto">{a}</li>
          ))}
        </ul>
      )}

      <section className="space-y-3" aria-labelledby="arranque">
        <h2 id="arranque" className="text-xl font-semibold text-tinta">Arranque ({feitos} de {marcos.length})</h2>
        <ul className="divide-y divide-linha rounded-3xl border border-linha bg-white">
          {marcos.map((m) => (
            <li key={m.texto} className="flex items-center gap-3 px-5 py-3">
              <span aria-hidden className={`h-2.5 w-2.5 shrink-0 rounded-full ${m.feito ? "bg-verde" : "bg-black/15"}`} />
              <p className="text-base text-tinta">{m.texto}<span className="sr-only">{m.feito ? ": feito" : ": por fazer"}</span></p>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3" aria-labelledby="uso">
        <h2 id="uso" className="text-xl font-semibold text-tinta">Uso</h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Compradores", empresa.compradores],
            ["Proprietários", empresa.proprietarios],
            ["Angariações", empresa.angariacoes],
            ["Tarefas", empresa.tarefas],
            ["Novos registos em 7 dias", empresa.atividade_7d],
            ["Telemóveis com notificações", empresa.aparelhos],
            ["Último acesso", data(empresa.ultimo_acesso)],
            ["Utilizadores", empresa.utilizadores],
          ].map(([r, v]) => (
            <div key={String(r)} className="rounded-3xl border border-linha bg-white p-4">
              <dt className="text-sm text-secundario">{r}</dt>
              <dd className="mt-1 text-2xl font-bold tracking-tight text-tinta">{v}</dd>
            </div>
          ))}
        </dl>
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
                  <p className="truncate text-base font-medium text-tinta">{u.email}</p>
                  <p className="text-sm text-secundario">
                    criado {data(u.criado_em)} · {u.ultimo_acesso ? `último acesso ${data(u.ultimo_acesso)}` : "convite por aceitar"}
                    {u.suspenso ? " · suspenso" : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <form action={suspenderNaEmpresa}>
                    <input type="hidden" name="codigo" value={empresa.codigo} />
                    <input type="hidden" name="id" value={u.id} />
                    <input type="hidden" name="suspender" value={u.suspenso ? "0" : "1"} />
                    <button className="min-h-[40px] rounded-full border border-linha px-4 text-sm font-semibold text-tinta hover:bg-black/5">{u.suspenso ? "Reativar" : "Suspender"}</button>
                  </form>
                  <form action={removerNaEmpresa}>
                    <input type="hidden" name="codigo" value={empresa.codigo} />
                    <input type="hidden" name="id" value={u.id} />
                    <BotaoConfirmar texto="Apagar" pergunta={`Apagar a conta de ${u.email}? Não se pode desfazer.`} className="min-h-[40px] rounded-full border border-linha px-4 text-sm font-semibold text-ambar-texto hover:bg-ambar-fundo" />
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="max-w-xl rounded-3xl border border-linha bg-white p-5">
          <h3 className="mb-3 text-base font-semibold text-tinta">Novo utilizador</h3>
          <FormConvidar id={projeto.id} produto="cockpit" papeis={["membro"]} empresa={empresa.codigo} />
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="dados">
        <h2 id="dados" className="text-xl font-semibold text-tinta">Dados da empresa</h2>
        <div className="max-w-3xl rounded-3xl border border-linha bg-white p-5">
          <FormDadosEmpresa
            codigo={empresa.codigo}
            dados={{
              nome: empresa.nome,
              contacto_nome: empresa.contacto_nome ?? "",
              contacto_email: empresa.contacto_email ?? "",
              responsavel: empresa.responsavel ?? "",
              notas: empresa.notas ?? "",
              inicio: empresa.inicio,
            }}
          />
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="estado-empresa">
        <h2 id="estado-empresa" className="text-xl font-semibold text-tinta">Estado da empresa</h2>
        <p className="text-sm text-secundario">Suspensa e terminada cortam o acesso (os utilizadores deixam de ver dados, nada se apaga). Ativa e piloto devolvem-no.</p>
        <div className="flex flex-wrap gap-2">
          {ESTADOS_EMPRESA.map((e) => (
            <form key={e} action={mudarEstadoEmpresa}>
              <input type="hidden" name="codigo" value={empresa.codigo} />
              <input type="hidden" name="estado" value={e} />
              <button
                disabled={empresa.estado === e}
                className={`min-h-[40px] rounded-full border px-4 text-sm font-semibold ${empresa.estado === e ? "border-azul bg-azul-suave text-azul-escuro" : "border-linha text-tinta hover:bg-black/5"}`}
                aria-pressed={empresa.estado === e}
              >
                {ROTULO_ESTADO[e]}
              </button>
            </form>
          ))}
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="instalacao">
        <h2 id="instalacao" className="text-xl font-semibold text-tinta">Estado da instalação</h2>
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
        {estado.length > 0 && <p className="text-sm text-secundario">{pendentes.length === 0 ? "Tudo em ordem." : `${pendentes.length} por resolver.`}</p>}
      </section>

      <section className="space-y-3" aria-labelledby="registo">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="registo" className="text-xl font-semibold text-tinta">Últimas ações</h2>
          <Link href={`/auditoria?empresa=${empresa.codigo}`} className="text-sm font-medium text-azul">Ver tudo</Link>
        </div>
        <ListaAuditoria entradas={registo} />
      </section>

      <section className="space-y-3 border-t border-linha pt-6">
        <h2 className="text-base font-semibold text-tinta">Zona de perigo</h2>
        <p className="text-sm text-secundario">Apaga a empresa, todos os dados dela e as contas dos utilizadores. Não se pode desfazer. Antes, descarrega uma cópia dos dados se o cliente a pedir.</p>
        <div className="max-w-xl rounded-3xl border border-linha bg-white p-5">
          <FormApagarEmpresa codigo={empresa.codigo} />
        </div>
      </section>
    </div>
  );
}
