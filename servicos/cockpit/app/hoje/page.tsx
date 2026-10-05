import { sbUserServer } from "@/lib/supabase-server";
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
    <main className="mx-auto max-w-2xl space-y-8 p-6">
      <h1 className="text-2xl font-semibold text-tinta">Hoje</h1>

      <section>
        <h2 className="mb-2 text-lg font-medium text-tinta">Seguimentos pendentes</h2>
        <ListaContactos contactos={(contactosPendentes as Contacto[]) ?? []} agora={agora} />
      </section>

      <section>
        <h2 className="mb-2 text-lg font-medium text-tinta">Updates devidos a proprietários</h2>
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
    <ul className="space-y-2">
      {contactos.map((c) => (
        <li
          key={c.id}
          className="flex items-center justify-between rounded-lg border border-black/10 bg-white px-4 py-3"
        >
          <div>
            <p className="font-medium text-tinta">{c.nome}</p>
            <p className="text-xs text-secundario">{rotuloEstado(c.estado_relacao)}</p>
          </div>
          <span className="rounded-full bg-ambar-fundo px-2 py-1 text-xs font-medium text-ambar-texto">
            {diasDesde(c.ultimo_contacto_em, agora)}
          </span>
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
    <ul className="space-y-2">
      {imoveis.map((im) => (
        <li
          key={im.id}
          className="flex items-center justify-between rounded-lg border border-black/10 bg-white px-4 py-3"
        >
          <div>
            <p className="font-medium text-tinta">{im.tipologia ?? "Imóvel"} - {im.zona ?? "zona n/d"}</p>
            <p className="text-xs text-secundario">Cadência: {im.cadencia_update_dias} dias</p>
          </div>
          <span className="rounded-full bg-ambar-fundo px-2 py-1 text-xs font-medium text-ambar-texto">
            Update devido
          </span>
        </li>
      ))}
    </ul>
  );
}

function rotuloEstado(estado: Contacto["estado_relacao"]) {
  const rotulos: Record<Contacto["estado_relacao"], string> = {
    lead_frio: "Lead frio",
    lead_morno: "Lead morno",
    lead_quente: "Lead quente",
    cliente_comprador: "Cliente comprador",
    cliente_proprietario: "Cliente proprietário",
  };
  return rotulos[estado];
}

function diasDesde(data: string | null, agora: string) {
  if (!data) return "Sem contacto registado";
  const dias = Math.floor(
    (new Date(agora).getTime() - new Date(data).getTime()) / (1000 * 60 * 60 * 24)
  );
  return `Sem contacto há ${dias} dia${dias === 1 ? "" : "s"}`;
}
