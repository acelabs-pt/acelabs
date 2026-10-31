import Link from "next/link";
import { FormNovoCliente } from "@/components/Formularios";
import { exigirSessao } from "@/app/acoes";

export default async function NovoCliente() {
  await exigirSessao();
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Link href="/" className="text-sm font-medium text-azul">Clientes</Link>
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-tinta">Novo cliente</h1>
        <p className="mt-1 text-base text-secundario">Primeiro cria o projeto no Supabase (Irlanda) e corre os SQL. Depois regista-o aqui com o endereço e a chave anon. Nunca coles aqui a chave de administrador.</p>
      </div>
      <div className="rounded-3xl border border-linha bg-white p-5">
        <FormNovoCliente />
      </div>
    </div>
  );
}
