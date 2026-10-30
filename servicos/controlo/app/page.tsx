import Link from "next/link";
import { lerClientes } from "@/lib/clientes";
import { exigirSessao } from "./acoes";

export const dynamic = "force-dynamic";

const PRODUTO = { cockpit: "Cockpit", cpcv: "CPCV com IA" } as const;

export default async function Clientes() {
  await exigirSessao();
  const todos = lerClientes();
  const partilhado = todos.find((c) => c.partilhado);
  const clientes = todos.filter((c) => !c.partilhado);
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-tinta">Clientes</h1>
          <p className="mt-1 text-base text-secundario">O CPCV tem um Supabase por cliente. Aqui geres quem lá entra.</p>
        </div>
        <Link href="/clientes/novo" className="inline-flex min-h-[44px] items-center rounded-full bg-azul px-5 text-base font-semibold text-white hover:bg-azul-escuro">
          Novo cliente
        </Link>
      </div>

      <Link href="/cockpit" className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-azul-suave p-5 transition hover:bg-azul-suave/70" data-teste="painel-cockpit">
        <div>
          <h2 className="text-lg font-semibold text-tinta">Painel do Cockpit</h2>
          <p className="text-sm text-secundario">
            {partilhado ? "Todas as empresas do projeto partilhado: utilizadores, estado, avisos e registo de ações." : "Ainda não registaste o projeto Cockpit partilhado. Começa por aqui."}
          </p>
        </div>
        <span className="text-base font-semibold text-azul">{partilhado ? "Abrir" : "Registar"}</span>
      </Link>

      {clientes.length === 0 ? (
        <div className="rounded-3xl border border-linha bg-white p-8 text-center">
          <p className="text-base text-secundario">Ainda não registaste nenhum cliente.</p>
          <Link href="/clientes/novo" className="mt-3 inline-block text-base font-semibold text-azul">Registar o primeiro</Link>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {clientes.map((c) => (
            <li key={c.id}>
              <Link href={`/clientes/${c.id}`} className="block rounded-3xl border border-linha bg-white p-5 transition hover:border-azul/40">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-lg font-semibold text-tinta">{c.nome}</h2>
                  <span className="rounded-full bg-azul-suave px-3 py-1 text-xs font-semibold text-azul-escuro">{PRODUTO[c.produto]}</span>
                </div>
                <p className="mt-2 break-all text-sm text-secundario">{c.supabase_url.replace("https://", "")}</p>
                <p className="mt-1 text-xs text-secundario">{c.modo === "funcao" ? "Administrado por função no cliente" : "Administrado com chave neste computador"}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
