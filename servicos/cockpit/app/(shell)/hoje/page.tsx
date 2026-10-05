import Link from "next/link";
import { sbUserServer } from "@/lib/supabase-server";
import { diasDesde, rotuloEstado } from "@/lib/estado-relacao";
import type { Contacto, Imovel } from "@/lib/types";

// Ecrã de abertura ("Hoje", não "Dashboard" - ver especificacao-produto.md,
// secção 4). Junta num só lugar o que ataca diretamente os pain points nº4
// e nº6: contactos sem seguimento há dias, e proprietários com update
// devido. RLS por organizacao_id filtra os dados automaticamente, não é
// preciso filtrar por organização aqui.
export default async function HojePage() {
  const supabase = await sbUserServer();

  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) {
    return (
      <main className="p-6">
        <p className="text-secundario">Sessão expirada. Vai a /login.</p>
      </main>
    );
  }

  const agora = new Date().toISOString();

  const { data: contactosPendentes } = await supabase
    .from("contactos")
    .select("*")
    .lte("proxima_accao_em", agora)
    .order("proxima_accao_em", { ascending: true })
    .limit(20);

  const { data: imoveisComUpdateDevido } = await supabase
    .from("imoveis")
    .select("*")
    .lte("proximo_update_em", agora)
    .order("proximo_update_em", { ascending: true })
    .limit(20);

  return (
    <main className="mx-auto max-w-2xl space-y-8 px-4 pb-4 pt-8">
      <h1 className="text-[28px] font-bold text-tinta">Hoje</h1>

      <section>
        <h2 className="mb-3 text-[15px] font-semibold text-tinta">Seguimentos pendentes</h2>
        <ListaContactos contactos={(contactosPendentes as Contacto[]) ?? []} agora={agora} />
      </section>

      <section>
        <h2 className="mb-3 text-[15px] font-semibold text-tinta">Updates devidos a proprietários</h2>
        <ListaImoveis imoveis={(imoveisComUpdateDevido as Imovel[]) ?? []} agora={agora} />
      </section>
    </main>
  );
}

function ListaContactos({ contactos, agora }: { contactos: Contacto[]; agora: string }) {
  if (contactos.length === 0) {
    return <p className="text-sm text-secundario">Sem seguimentos pendentes. Bom trabalho.</p>;
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {contactos.map((c) => (
        <li key={c.id}>
          <Link
            href={`/contactos/${c.id}`}
            className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3.5 shadow-sm"
          >
            <div className="min-w-0">
              <p className="truncate font-semibold text-tinta">{c.nome}</p>
              <p className="text-xs text-secundario">{rotuloEstado(c.estado_relacao)}</p>
            </div>
            <span className="flex-none rounded-full bg-ambar-fundo px-2.5 py-1.5 text-xs font-semibold text-ambar-texto">
              {diasDesde(c.ultimo_contacto_em, agora)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ListaImoveis({ imoveis, agora }: { imoveis: Imovel[]; agora: string }) {
  if (imoveis.length === 0) {
    return <p className="text-sm text-secundario">Sem updates devidos.</p>;
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {imoveis.map((im) => (
        <li
          key={im.id}
          className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3.5 shadow-sm"
        >
          <div className="min-w-0">
            <p className="truncate font-semibold text-tinta">
              {im.tipologia ?? "Imóvel"} - {im.zona ?? "zona n/d"}
            </p>
            <p className="text-xs text-secundario">Cadência: {im.cadencia_update_dias} dias</p>
          </div>
          <span className="flex-none rounded-full bg-ambar-fundo px-2.5 py-1.5 text-xs font-semibold text-ambar-texto">
            Update devido
          </span>
        </li>
      ))}
    </ul>
  );
}
