import { sbServer } from "@/lib/supabase";
import { validarToken, DOCUMENTOS_PEDIDOS } from "@/lib/cpcv-links-cliente";
import EntregaForm from "./EntregaForm";

export const dynamic = "force-dynamic";

// Página pública de entrega de documentos (sem login). Só mostra o mínimo: a morada do imóvel
// e o papel da pessoa. Nunca mostra dados de outras partes nem ficheiros já entregues.
export default async function EntregaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const sb = sbServer();
  const link = await validarToken(sb, token);

  if (!link) {
    return (
      <main className="min-h-screen bg-[#F4F3EF] flex items-center justify-center px-4">
        <div className="max-w-md bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-6 text-center">
          <h1 className="text-lg font-bold text-[#0F172A] mb-2">Este link já não é válido</h1>
          <p className="text-sm text-[#475569]">
            O link expirou ou foi cancelado. Peça um novo ao seu agente imobiliário.
          </p>
        </div>
      </main>
    );
  }

  const { data: processo } = await sb
    .from("cpcv_processos")
    .select("imovel_morada")
    .eq("id", link.processo_id)
    .single();

  return (
    <main className="min-h-screen bg-[#F4F3EF] px-4 py-8">
      <div className="max-w-xl mx-auto space-y-5">
        <div>
          <h1 className="text-xl font-bold text-[#0F172A]">Entrega de documentos</h1>
          <p className="text-sm text-[#475569] mt-1">
            {processo?.imovel_morada ? `Imóvel: ${processo.imovel_morada}. ` : ""}
            Documentos do {link.papel === "vendedor" ? "vendedor" : "comprador"}. Aceitamos PDF, PNG e JPG, até
            4 MB por ficheiro.
          </p>
        </div>
        <EntregaForm token={token} documentos={DOCUMENTOS_PEDIDOS[link.papel]} />
        <p className="text-[11px] text-[#94A3B8]">
          Os documentos são enviados apenas ao seu agente imobiliário e usados só para preparar o
          contrato-promessa de compra e venda. Para pedir a eliminação dos seus dados, fale com o seu agente.
        </p>
      </div>
    </main>
  );
}
