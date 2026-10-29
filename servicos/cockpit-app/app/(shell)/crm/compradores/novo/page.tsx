"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import FormComprador, { comContacto, guardarZonas, paraComprador, paraContacto, valoresIniciais } from "@/components/crm/FormComprador";
import { escolherContacto, naApp } from "@/lib/nativo";
import { sbBrowser } from "@/lib/supabase-browser";
import { atualizarPorComprador } from "@/lib/oportunidades";

export default function NovoComprador() {
  const router = useRouter();
  const [aGuardar, setAGuardar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Dentro da app do iPhone: "Escolher do telemóvel" preenche o nome, o telemóvel e o email (remonta o formulário com esses valores).
  const [nativa, setNativa] = useState(false);
  const [inicial, setInicial] = useState(() => valoresIniciais());
  const [versao, setVersao] = useState(0);
  useEffect(() => setNativa(naApp()), []);

  return (
    <div className="space-y-4">
      <Link href="/crm/compradores" className="text-sm font-medium text-azul-escuro">
        &larr; Compradores
      </Link>
      <h2 className="text-xl font-semibold text-tinta">Novo comprador</h2>
      {erro && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}
      {nativa && (
        <button
          type="button"
          onClick={async () => {
            const c = await escolherContacto();
            if (c) {
              setInicial((v) => comContacto(v, c));
              setVersao((n) => n + 1);
            }
          }}
          className="min-h-[44px] rounded-full bg-azul-suave px-5 text-base font-semibold text-azul-escuro"
        >
          Escolher do telemóvel
        </button>
      )}
      <FormComprador
        key={versao}
        inicial={inicial}
        textoBotao="Criar comprador"
        aGuardar={aGuardar}
        onSubmit={async (v) => {
          setAGuardar(true);
          setErro(null);
          const sb = sbBrowser();
          const { data: contacto, error: e1 } = await sb.from("contactos").insert(paraContacto(v)).select("id").single();
          if (e1 || !contacto) {
            setErro("Não foi possível guardar o contacto.");
            setAGuardar(false);
            return;
          }
          const { data: comprador, error: e2 } = await sb
            .from("compradores")
            .insert({ contacto_id: contacto.id, ...paraComprador(v) })
            .select("id")
            .single();
          if (e2 || !comprador) {
            // evita deixar um contacto órfão se o comprador falhar
            await sb.from("contactos").delete().eq("id", contacto.id);
            setErro("Não foi possível guardar o comprador.");
            setAGuardar(false);
            return;
          }
          await guardarZonas(comprador.id, v);
          await atualizarPorComprador(comprador.id);
          router.push(`/crm/compradores/${comprador.id}`);
        }}
      />
    </div>
  );
}
