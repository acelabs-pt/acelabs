import Link from "next/link";
import { sbUserServer } from "@/lib/supabase-server";
import { diasDesde, estiloEstado, rotuloEstado } from "@/lib/estado-relacao";
import type { Contacto } from "@/lib/types";

export default async function ContactosPage() {
  const supabase = await sbUserServer();
  const agora = new Date().toISOString();

  const { data: contactos } = await supabase
    .from("contactos")
    .select("*")
    .order("nome", { ascending: true });

  return (
    <main className="mx-auto max-w-2xl px-4 pb-4 pt-8">
      <h1 className="text-[28px] font-bold text-tinta">Contactos</h1>

      <ul className="mt-5 flex flex-col gap-2.5">
        {((contactos as Contacto[]) ?? []).map((c) => {
          const estilo = estiloEstado(c.estado_relacao);
          return (
            <li key={c.id}>
              <Link
                href={`/contactos/${c.id}`}
                className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3.5 shadow-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-tinta">{c.nome}</p>
                  <span
                    className={`mt-1 inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold ${estilo.bg} ${estilo.texto}`}
                  >
                    {rotuloEstado(c.estado_relacao)}
                  </span>
                </div>
                <span className="flex-none text-right text-[11px] text-secundario">
                  {diasDesde(c.ultimo_contacto_em, agora)}
                </span>
              </Link>
            </li>
          );
        })}

        {(!contactos || contactos.length === 0) && (
          <p className="text-sm text-secundario">Ainda sem contactos registados.</p>
        )}
      </ul>
    </main>
  );
}
