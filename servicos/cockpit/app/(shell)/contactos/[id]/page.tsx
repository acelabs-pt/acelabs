import Link from "next/link";
import { notFound } from "next/navigation";
import { sbUserServer } from "@/lib/supabase-server";
import { estiloEstado, rotuloEstado } from "@/lib/estado-relacao";
import type { Atividade, Contacto } from "@/lib/types";
import RegistoVisita from "./RegistoVisita";

export default async function ContactoDetalhePage({ params }: { params: { id: string } }) {
  const supabase = await sbUserServer();

  const { data: contacto } = await supabase
    .from("contactos")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!contacto) {
    notFound();
  }

  const { data: atividades } = await supabase
    .from("atividades")
    .select("*")
    .eq("contacto_id", params.id)
    .order("criado_em", { ascending: false })
    .limit(20);

  const c = contacto as Contacto;
  const estilo = estiloEstado(c.estado_relacao);
  const telefoneLimpo = c.telefone?.replace(/[^0-9+]/g, "");

  return (
    <main className="mx-auto max-w-2xl px-4 pb-4 pt-6">
      <div className="flex items-center gap-2">
        <Link
          href="/contactos"
          aria-label="Voltar a Contactos"
          className="flex h-9 w-9 items-center justify-center rounded-full text-tinta"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <span className="text-[13px] text-secundario">Contactos</span>
      </div>

      <div className="mt-3">
        <h1 className="text-2xl font-bold text-tinta">{c.nome}</h1>
        <span
          className={`mt-2 inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${estilo.bg} ${estilo.texto}`}
        >
          {rotuloEstado(c.estado_relacao)}
        </span>
      </div>

      {(telefoneLimpo || c.email) && (
        <div className="mt-4 flex gap-2.5">
          {telefoneLimpo && (
            <a
              href={`tel:${telefoneLimpo}`}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-azul py-3.5 text-sm font-semibold text-white"
            >
              Ligar
            </a>
          )}
          {telefoneLimpo && (
            <a
              href={`https://wa.me/${telefoneLimpo.replace("+", "")}`}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#e8f7ee] py-3.5 text-sm font-semibold text-[#167a3e]"
            >
              WhatsApp
            </a>
          )}
        </div>
      )}

      <section className="mt-6">
        <h2 className="mb-2.5 text-[15px] font-semibold text-tinta">Registar visita</h2>
        <RegistoVisita contactoId={c.id} />
      </section>

      <section className="mt-6">
        <h2 className="mb-2.5 text-[15px] font-semibold text-tinta">Atividade</h2>
        <ul className="flex flex-col gap-2.5">
          {((atividades as Atividade[]) ?? []).map((a) => (
            <li key={a.id} className="rounded-2xl bg-white px-4 py-3 shadow-sm">
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wide text-azul">{a.tipo}</span>
                <span className="text-[11px] text-secundario">{formatarQuando(a.criado_em)}</span>
              </div>
              <p className="mt-1 text-sm text-tinta">{a.descricao}</p>
            </li>
          ))}

          {(!atividades || atividades.length === 0) && (
            <p className="text-sm text-secundario">Sem atividade registada ainda.</p>
          )}
        </ul>
      </section>
    </main>
  );
}

function formatarQuando(criadoEm: string) {
  const dias = Math.floor((Date.now() - new Date(criadoEm).getTime()) / (1000 * 60 * 60 * 24));
  if (dias <= 0) return "hoje";
  if (dias === 1) return "há 1 dia";
  return `há ${dias} dias`;
}
