import { sbUserServer } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import Link from "next/link";
import ChatForm from "./ChatForm";
import { GerarButton, PedirAlteracoes, DownloadLinks, RascunhoLinks } from "./GerarDocumento";
import AdicionarInformacao from "./AdicionarInformacao";
import CondicoesNegocio from "./CondicoesNegocio";
import FecharProcesso from "./FecharProcesso";

const ESTADO_LABEL: Record<string, string> = {
  em_preenchimento: "Em preenchimento",
  pronto_para_aprovacao: "Pronto para aprovação",
  aprovado: "Aprovado",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

// Depois de aprovado, concluído ou cancelado, o processo já não se edita - só se
// fecha (concluir/cancelar) a partir de "aprovado", ou se consulta a partir daí.
const ESTADOS_BLOQUEADOS = ["aprovado", "concluido", "cancelado"];

const TIPO_CONTRATO_LABEL: Record<string, string> = {
  angariacao_nossa_comprador_nosso: "Angariação nossa - comprador nosso",
  angariacao_nossa_comprador_externo: "Angariação nossa - comprador de outra agência",
  comprador_nosso_angariacao_externa: "Comprador nosso - angariação de outra agência",
};

const AUTOR_ESTILO: Record<string, string> = {
  ia: "bg-[#F1F5F9] text-[#0F172A]",
  gestora: "bg-[#FFF4E5] text-[#9A5B00] ml-auto",
  agente: "bg-[#0F172A] text-white ml-auto",
};

const AUTOR_LABEL: Record<string, string> = {
  ia: "IA",
  gestora: "Gestora",
  agente: "Agente",
};

export default async function ProcessoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await sbUserServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: perfil } = await supabase.from("profiles").select("role").eq("id", user!.id).single();
  const isGestora = perfil?.role === "gestora";

  const { data: processo } = await supabase
    .from("cpcv_processos")
    .select("*")
    .eq("id", id)
    .single();

  if (!processo) notFound();

  const [{ data: partes }, { data: ficheiros }, { data: mensagens }] = await Promise.all([
    supabase.from("cpcv_partes").select("*").eq("processo_id", id),
    supabase.from("cpcv_ficheiros").select("*").eq("processo_id", id),
    supabase.from("cpcv_mensagens").select("*").eq("processo_id", id).order("criado_em"),
  ]);

  const temCamposEmFalta = (processo.campos_em_falta ?? []).length > 0;
  const prontoParaAprovacao = processo.estado === "pronto_para_aprovacao";

  return (
    <div className="space-y-6">
      <Link
        href="/cpcv"
        className="inline-flex items-center gap-1 text-xs text-[#94A3B8] hover:text-[#0F172A] transition"
      >
        ← Voltar à listagem
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#0F172A]">
            {processo.imovel_morada || "Novo processo CPCV"}
          </h1>
          <p className="text-sm text-[#94A3B8] mt-1">
            Estado: <span className="font-semibold">{ESTADO_LABEL[processo.estado] ?? processo.estado}</span>
            {" · "}
            {TIPO_CONTRATO_LABEL[processo.tipo_contrato] ?? processo.tipo_contrato}
          </p>
        </div>
        {isGestora && <RascunhoLinks processoId={processo.id} />}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-5">
          <h2 className="text-sm font-semibold text-[#0F172A] mb-3">Partes ({partes?.length ?? 0})</h2>
          {(partes ?? []).length === 0 && <p className="text-xs text-[#94A3B8]">Nenhuma ainda.</p>}
          <ul className="space-y-2">
            {(partes ?? []).map((p) => (
              <li key={p.id} className="text-xs border-b border-[#F1F5F9] pb-2 last:border-0">
                <span className="font-semibold">{p.papel === "vendedor" ? "Vendedor" : "Comprador"}:</span>{" "}
                {p.nome} {p.nif && `· NIF ${p.nif}`}
                {p.tipo_pessoa === "coletiva" && (
                  <span className="block text-[#94A3B8] mt-0.5">
                    Pessoa colectiva
                    {p.representante_nome && ` · Repr.: ${p.representante_nome}`}
                    {p.certidao_permanente && ` · Certidão permanente: ${p.certidao_permanente}`}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-5">
          <h2 className="text-sm font-semibold text-[#0F172A] mb-3">Documentos ({ficheiros?.length ?? 0})</h2>
          {(ficheiros ?? []).length === 0 && <p className="text-xs text-[#94A3B8]">Nenhum ainda.</p>}
          <ul className="space-y-1">
            {(ficheiros ?? []).map((f) => (
              <li key={f.id} className="text-xs">
                {f.nome_original} <span className="text-[#94A3B8]">({f.tipo})</span>
              </li>
            ))}
          </ul>
          {!ESTADOS_BLOQUEADOS.includes(processo.estado) && (
            <AdicionarInformacao
              processoId={processo.id}
              donoId={processo.criado_por}
              linkAtual={processo.link_imovel}
            />
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-5">
        <h2 className="text-sm font-semibold text-[#0F172A] mb-3">Imóvel e negócio</h2>
        <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
          {[
            ["Morada", processo.imovel_morada],
            ["Freguesia", processo.imovel_freguesia],
            ["Concelho", processo.imovel_concelho],
            ["Tipologia", processo.imovel_tipologia],
            ["Artigo matricial", processo.imovel_artigo_matricial],
            ["Preço total", processo.preco_total ? `${processo.preco_total} €` : null],
            ["Sinal", processo.valor_sinal ? `${processo.valor_sinal} €` : null],
            ["Prazo escritura", processo.prazo_escritura],
          ].map(([label, value]) => (
            <div key={label as string}>
              <dt className="text-[#94A3B8]">{label}</dt>
              <dd className="font-medium text-[#0F172A]">{(value as string) || "-"}</dd>
            </div>
          ))}
          {processo.link_imovel && (
            <div className="sm:col-span-2">
              <dt className="text-[#94A3B8]">Link do imóvel</dt>
              <dd className="font-medium text-[#2E6DB4] truncate">
                <a href={processo.link_imovel} target="_blank" rel="noopener noreferrer">
                  {processo.link_imovel}
                </a>
              </dd>
            </div>
          )}
        </dl>
      </div>

      {!ESTADOS_BLOQUEADOS.includes(processo.estado) && <CondicoesNegocio processo={processo} />}

      <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-5">
        <h2 className="text-sm font-semibold text-[#0F172A] mb-3">Conversa</h2>
        <div className="space-y-3">
          {(mensagens ?? []).map((m) => (
            <div key={m.id} className="max-w-[80%]" style={m.autor !== "ia" ? { marginLeft: "auto" } : undefined}>
              <p
                className={`text-[10px] font-semibold mb-1 ${
                  m.autor === "ia" ? "text-[#94A3B8]" : "text-right text-[#94A3B8]"
                }`}
              >
                {AUTOR_LABEL[m.autor] ?? m.autor}
              </p>
              <div
                className={`text-sm rounded-xl px-4 py-2 whitespace-pre-wrap ${AUTOR_ESTILO[m.autor] ?? "bg-[#F1F5F9]"}`}
              >
                {m.texto}
              </div>
            </div>
          ))}
          {(mensagens ?? []).length === 0 && (
            <p className="text-xs text-[#94A3B8]">Sem mensagens ainda.</p>
          )}
        </div>
        <ChatForm
          processoId={processo.id}
          temPerguntaPendente={temCamposEmFalta}
          estado={processo.estado}
          isGestora={isGestora}
        />
        {isGestora && prontoParaAprovacao && (
          <div className="mt-4 flex flex-wrap items-start justify-end gap-2">
            <PedirAlteracoes processoId={processo.id} />
            <GerarButton processoId={processo.id} temCamposEmFalta={temCamposEmFalta} />
          </div>
        )}
        {processo.pdf_path && (
          <div className="mt-4 flex items-center justify-end gap-3">
            {processo.drive_folder_url && (
              <a
                href={processo.drive_folder_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#2E6DB4] font-medium hover:text-[#0059B3] hover:underline underline-offset-2"
              >
                Ver pasta no Google Drive
              </a>
            )}
            <DownloadLinks processoId={processo.id} />
          </div>
        )}
        {isGestora && (
          <div className="mt-4">
            <FecharProcesso processoId={processo.id} estado={processo.estado} />
          </div>
        )}
      </div>
    </div>
  );
}
