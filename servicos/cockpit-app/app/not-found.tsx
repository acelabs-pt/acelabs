import Link from "next/link";

export default function NaoEncontrada() {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-5xl font-extrabold leading-[1.02] tracking-tight text-tinta">Esta página não existe.</h1>
        <p className="mt-4 text-base text-secundario">O endereço pode estar errado, ou a ficha foi apagada.</p>
        <Link href="/dashboard" className="mt-8 block rounded-full bg-tinta py-3.5 text-center text-base font-semibold text-white hover:bg-black">
          Voltar ao dashboard
        </Link>
      </div>
    </main>
  );
}
