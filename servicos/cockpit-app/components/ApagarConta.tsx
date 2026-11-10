"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sbBrowser } from "@/lib/supabase-browser";
import { apagarDia } from "@/lib/semRede";

// "Apagar a minha conta", escondida atrás de "Mais opções" e só com a palavra APAGAR escrita: não pode acontecer sem querer.
export default function ApagarConta() {
  const router = useRouter();
  const [palavra, setPalavra] = useState("");
  const [aApagar, setAApagar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function apagar() {
    setErro(null);
    setAApagar(true);
    const { error } = await sbBrowser().rpc("apagar_minha_conta");
    if (error) {
      setAApagar(false);
      setErro(
        error.message.includes("ultimo_membro")
          ? "És o único utilizador desta empresa. Fala com a Ace Labs para encerrar o Cockpit."
          : "Não foi possível apagar a conta. Tenta outra vez ou fala com a Ace Labs."
      );
      return;
    }
    apagarDia();
    await sbBrowser().auth.signOut().catch(() => {});
    router.push("/login");
    router.refresh();
  }

  return (
    <details className="rounded-3xl border border-linha bg-white p-5">
      <summary className="min-h-[44px] cursor-pointer py-2 text-sm font-medium text-secundario">Mais opções</summary>
      <div className="mt-3 space-y-3">
        <h2 className="text-sm font-semibold text-tinta">Apagar a minha conta</h2>
        <p className="text-sm text-secundario">
          Apaga o teu acesso e os telemóveis ligados às notificações. Os contactos, compradores e angariações ficam na tua empresa; para
          os apagar usa a ficha de cada contacto ou fala com a Ace Labs. Não se pode desfazer.
        </p>
        <label htmlFor="apagar-palavra" className="block text-sm font-medium text-tinta">
          Para confirmar, escreve APAGAR
        </label>
        <input
          id="apagar-palavra"
          value={palavra}
          onChange={(e) => setPalavra(e.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
          className="w-full rounded-2xl border border-linha bg-white px-4 py-3 text-base"
        />
        <button
          onClick={apagar}
          disabled={aApagar || palavra.trim().toUpperCase() !== "APAGAR"}
          className="w-full rounded-full bg-red-600 py-3 text-sm font-semibold text-white disabled:opacity-40"
        >
          {aApagar ? "A apagar..." : "Apagar a minha conta"}
        </button>
        {erro && (
          <p role="alert" className="text-sm text-red-600">
            {erro}
          </p>
        )}
      </div>
    </details>
  );
}
