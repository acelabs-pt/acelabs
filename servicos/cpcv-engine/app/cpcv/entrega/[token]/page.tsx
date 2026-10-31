import { sbServer } from "@/lib/supabase";
import Link from "next/link";
import { validarToken, DOCUMENTOS_PEDIDOS, ETIQUETAS_EN } from "@/lib/cpcv-links-cliente";
import EntregaForm from "./EntregaForm";

export const dynamic = "force-dynamic";

// Página pública de entrega de documentos (sem login). Só mostra o mínimo: a morada do imóvel
// e o papel da pessoa. Nunca mostra dados de outras partes nem ficheiros já entregues.
export default async function EntregaPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { token } = await params;
  const { lang } = await searchParams;
  const en = lang === "en";
  const sb = sbServer();
  const link = await validarToken(sb, token);

  if (!link) {
    return (
      <main className="min-h-screen bg-[#F4F3EF] flex items-center justify-center px-4">
        <div className="max-w-md bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-6 text-center">
          <h1 className="text-lg font-bold text-[#0F172A] mb-2">{en ? "This link is no longer valid" : "Este link já não é válido"}</h1>
          <p className="text-sm text-[#475569]">
            {en ? "The link has expired or was cancelled. Please ask your real estate agent for a new one." : "O link expirou ou foi cancelado. Peça um novo ao seu agente imobiliário."}
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
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-[#0F172A]">{en ? "Document upload" : "Entrega de documentos"}</h1>
            <p className="text-sm text-[#475569] mt-1">
              {en
                ? `${processo?.imovel_morada ? `Property: ${processo.imovel_morada}. ` : ""}Documents of the ${link.papel === "vendedor" ? "seller" : "buyer"}. We accept PDF, PNG and JPG, up to 4 MB per file.`
                : `${processo?.imovel_morada ? `Imóvel: ${processo.imovel_morada}. ` : ""}Documentos do ${link.papel === "vendedor" ? "vendedor" : "comprador"}. Aceitamos PDF, PNG e JPG, até 4 MB por ficheiro.`}
            </p>
          </div>
          <Link href={en ? `/cpcv/entrega/${token}` : `/cpcv/entrega/${token}?lang=en`} className="shrink-0 text-xs font-semibold text-[#0071e3] hover:underline">
            {en ? "Português" : "English"}
          </Link>
        </div>
        <EntregaForm
          token={token}
          lang={en ? "en" : "pt"}
          documentos={DOCUMENTOS_PEDIDOS[link.papel].map((d) => ({ value: d.value, label: en ? (ETIQUETAS_EN[d.value] ?? d.label) : d.label }))}
        />
        <p className="text-[11px] text-[#94A3B8]">
          {en
            ? "Your documents are sent only to your real estate agent and used only to prepare the purchase and sale promissory contract. To request deletion of your data, please contact your agent."
            : "Os documentos são enviados apenas ao seu agente imobiliário e usados só para preparar o contrato-promessa de compra e venda. Para pedir a eliminação dos seus dados, fale com o seu agente."}
        </p>
      </div>
    </main>
  );
}
