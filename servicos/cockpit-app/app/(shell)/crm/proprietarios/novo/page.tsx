"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { atualizarPorProprietario } from "@/lib/oportunidades";
import FormProprietario, { paraContactoProp, paraProprietario, valoresIniciaisProp } from "@/components/crm/FormProprietario";
import { sbBrowser } from "@/lib/supabase-browser";

export default function NovoProprietario() {
  const router = useRouter();
  const [aGuardar, setAGuardar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <Link href="/crm/proprietarios" className="text-sm text-azul">
        &larr; Proprietários
      </Link>
      <h2 className="text-xl font-semibold text-tinta">Novo proprietário</h2>
      {erro && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}
      <FormProprietario
        inicial={valoresIniciaisProp()}
        textoBotao="Criar proprietário"
        aGuardar={aGuardar}
        onSubmit={async (v) => {
          setAGuardar(true);
          setErro(null);
          const sb = sbBrowser();
          const { data: contacto, error: e1 } = await sb.from("contactos").insert(paraContactoProp(v)).select("id").single();
          if (e1 || !contacto) {
            setErro("Não foi possível guardar o contacto.");
            setAGuardar(false);
            return;
          }
          const { data: prop, error: e2 } = await sb
            .from("proprietarios")
            .insert({ contacto_id: contacto.id, ...paraProprietario(v) })
            .select("id")
            .single();
          if (e2 || !prop) {
            await sb.from("contactos").delete().eq("id", contacto.id);
            setErro("Não foi possível guardar o proprietário.");
            setAGuardar(false);
            return;
          }
          await atualizarPorProprietario(prop.id);
          router.push(`/crm/proprietarios/${prop.id}`);
        }}
      />
    </div>
  );
}
