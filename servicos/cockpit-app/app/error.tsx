"use client";

import Link from "next/link";

// Aparece quando algo falha ao desenhar uma página. Não mostra detalhes técnicos ao utilizador.
export default function Erro({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-5xl font-extrabold leading-[1.02] tracking-tight text-tinta">Algo correu mal.</h1>
        <p className="mt-4 text-base text-secundario">Tenta outra vez. Se continuar a falhar, volta ao dashboard e avisa-nos.</p>
        <div className="mt-8 space-y-3">
          <button onClick={reset} className="w-full rounded-full bg-tinta py-3.5 text-base font-semibold text-white hover:bg-black">
            Tentar outra vez
          </button>
          <Link href="/dashboard" className="block rounded-full border border-linha bg-white py-3.5 text-center text-base font-semibold text-tinta">
            Voltar ao dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
