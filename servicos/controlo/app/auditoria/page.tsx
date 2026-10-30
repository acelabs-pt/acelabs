import Link from "next/link";
import { auditoriaDe, projetoPartilhado } from "@/lib/acoes";
import type { EntradaAuditoria } from "../../supabase/functions/_shared/nucleo";
import { exigirSessao } from "@/app/acoes";
import ListaAuditoria from "@/components/ListaAuditoria";

export const dynamic = "force-dynamic";

export default async function Auditoria({ searchParams }: { searchParams: { empresa?: string } }) {
  await exigirSessao();
  const projeto = projetoPartilhado();
  const empresa = /^[a-z0-9-]{2,40}$/.test(searchParams.empresa ?? "") ? searchParams.empresa : undefined;
  let entradas: EntradaAuditoria[] = [];
  let erro: string | null = null;
  if (projeto) {
    try {
      entradas = await auditoriaDe(projeto, empresa, 200);
    } catch (e) {
      erro = e instanceof Error ? e.message : "Não foi possível ler o registo.";
    }
  }
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link href={empresa ? `/cockpit/${empresa}` : "/cockpit"} className="text-sm font-medium text-azul">{empresa ? "Empresa" : "Painel"}</Link>
        <h1 className="text-3xl font-bold tracking-tight text-tinta">Registo de ações</h1>
        <p className="text-base text-secundario">
          {empresa ? `Só da empresa ${empresa}. ` : ""}Quem fez o quê, do mais recente para o mais antigo (até 200).
          {empresa && <> <Link href="/auditoria" className="font-medium text-azul">Ver todas as empresas</Link></>}
        </p>
      </div>
      {!projeto && <p className="text-base text-secundario">Ainda não registaste o projeto Cockpit partilhado.</p>}
      {erro && <p role="alert" className="rounded-2xl bg-ambar-fundo px-4 py-3 text-base text-ambar-texto">{erro}</p>}
      {projeto && !erro && <ListaAuditoria entradas={entradas} />}
    </div>
  );
}
