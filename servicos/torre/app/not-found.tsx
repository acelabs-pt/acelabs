import Link from "next/link";

export default function NaoEncontrado() {
  return (
    <main className="mx-auto max-w-sm space-y-4 px-5 pt-16">
      <h1 className="text-3xl font-bold tracking-tight text-tinta">Não encontrado</h1>
      <p className="text-base text-secundario">Esta página não existe ou o registo foi apagado.</p>
      <Link href="/" className="inline-block text-base font-semibold text-azul">Voltar ao Início</Link>
    </main>
  );
}
