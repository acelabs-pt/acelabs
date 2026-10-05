import { sbUserServer } from "@/lib/supabase-server";
import type { Imovel } from "@/lib/types";

const ESTILO_ESTADO: Record<Imovel["estado"], { label: string; bg: string; texto: string }> = {
  disponivel: { label: "Disponível", bg: "bg-[#eaf3fd]", texto: "text-azul-escuro" },
  em_negociacao: { label: "Em negociação", bg: "bg-ambar-fundo", texto: "text-ambar-texto" },
  vendido: { label: "Vendido", bg: "bg-[#e8f7ee]", texto: "text-[#167a3e]" },
  retirado: { label: "Retirado", bg: "bg-[#f0f0f2]", texto: "text-secundario" },
};

export default async function ImoveisPage() {
  const supabase = await sbUserServer();
  const agora = new Date().toISOString();

  const { data: imoveis } = await supabase
    .from("imoveis")
    .select("*")
    .order("criado_em", { ascending: false });

  return (
    <main className="mx-auto max-w-2xl px-4 pb-4 pt-8">
      <h1 className="text-[28px] font-bold text-tinta">Imóveis</h1>

      <ul className="mt-5 flex flex-col gap-2.5">
        {((imoveis as Imovel[]) ?? []).map((im) => {
          const estilo = ESTILO_ESTADO[im.estado];
          const updateDevido = im.proximo_update_em ? im.proximo_update_em <= agora : false;

          return (
            <li key={im.id} className="rounded-2xl bg-white px-4 py-3.5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-tinta">
                    {im.tipologia ?? "Imóvel"}
                  </p>
                  <p className="text-xs text-secundario">
                    {im.zona ?? "zona n/d"}
                    {im.preco_listagem ? ` · ${formatarPreco(im.preco_listagem)}` : ""}
                  </p>
                </div>
                <span
                  className={`flex-none rounded-full px-2.5 py-1 text-[11px] font-semibold ${estilo.bg} ${estilo.texto}`}
                >
                  {estilo.label}
                </span>
              </div>
              {updateDevido && (
                <span className="mt-2 inline-block rounded-full bg-ambar-fundo px-2.5 py-1 text-[11px] font-semibold text-ambar-texto">
                  Update devido
                </span>
              )}
            </li>
          );
        })}

        {(!imoveis || imoveis.length === 0) && (
          <p className="text-sm text-secundario">Ainda sem imóveis registados.</p>
        )}
      </ul>
    </main>
  );
}

function formatarPreco(valor: number) {
  return new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 0 }).format(valor) + "€";
}
