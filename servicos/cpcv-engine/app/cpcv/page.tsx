import { sbUserServer } from "@/lib/supabase-server";
import Link from "next/link";
import PlotlyChart from "@/components/charts/PlotlyChart";
import ListaProcessos from "./ListaProcessos";
import GerarConvite, { type Convite } from "./GerarConvite";
import { temGestaoTotal } from "@/lib/cpcv-auth";
import { ESTADO_LABEL, tempoMedioConclusao, processosPorDia, type Processo } from "@/lib/cpcv-estatisticas";
import { carregarConvites } from "@/lib/cpcv-convites";
import { btnPrimary } from "./ui";

export default async function CpcvHomePage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const { estado: estadoInicial } = await searchParams;
  const supabase = await sbUserServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: perfil } = await supabase
    .from("profiles")
    .select("nome, role")
    .eq("id", user!.id)
    .single();

  const { data: processos } = await supabase
    .from("cpcv_processos")
    .select("id, criado_por, estado, imovel_morada, criado_em, atualizado_em, campos_em_falta")
    .order("criado_em", { ascending: false });

  const lista = (processos ?? []) as Processo[];

  // O admin herda tudo o que a gestora já tem sobre os processos - ver documento de
  // arquitectura em lib/cpcv-auth.ts. O nome da variável fica "isGestora" para não mexer
  // no resto do ficheiro, só o critério de acesso alarga.
  const isGestora = temGestaoTotal(perfil?.role);

  let nomesPorAgente: Record<string, string> = {};
  if (isGestora && lista.length > 0) {
    const ids = Array.from(new Set(lista.map((p) => p.criado_por)));
    const { data: perfis } = await supabase.from("profiles").select("id, nome").in("id", ids);
    nomesPorAgente = Object.fromEntries((perfis ?? []).map((p) => [p.id, p.nome]));
  }

  let convites: Convite[] = [];
  if (isGestora) {
    convites = await carregarConvites(supabase, {
      apenasCriadoPor: perfil?.role === "gestora" ? user!.id : undefined,
    });
  }

  const contagens = {
    em_preenchimento: lista.filter((p) => p.estado === "em_preenchimento").length,
    pronto_para_aprovacao: lista.filter((p) => p.estado === "pronto_para_aprovacao").length,
    aprovado: lista.filter((p) => p.estado === "aprovado").length,
    concluido: lista.filter((p) => p.estado === "concluido").length,
    cancelado: lista.filter((p) => p.estado === "cancelado").length,
  };

  return (
    <div className="space-y-6">
      {isGestora && (
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-xs text-[#94A3B8] hover:text-[#0F172A] transition"
        >
          ← Voltar ao dashboard principal
        </Link>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#0F172A]">
            {isGestora ? "Dashboard de CPCVs" : "Os meus CPCVs"}
          </h1>
          <p className="text-sm text-[#94A3B8] mt-1">
            {isGestora
              ? "Acompanhamento de todos os processos em curso."
              : "Processos que criaste."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isGestora && <GerarConvite papeisPermitidos={["agente"]} convites={convites} />}
          <Link href="/cpcv/novo" className={btnPrimary}>
            + Novo CPCV
          </Link>
        </div>
      </div>

      {isGestora && (
        <>
          <Link
            href="/cpcv?estado=pronto_para_aprovacao"
            className={`rounded-2xl border p-5 flex items-center justify-between transition-shadow ${
              contagens.pronto_para_aprovacao > 0
                ? "bg-[#E8F1FC] border-[#0059B3] hover:shadow-md"
                : "bg-white border-[#E2E8F0]"
            }`}
          >
            <div>
              <p className="text-xs font-semibold text-[#0059B3]">Por aprovar</p>
              <p className="text-3xl font-bold text-[#0F172A] mt-1">{contagens.pronto_para_aprovacao}</p>
            </div>
            {contagens.pronto_para_aprovacao > 0 && (
              <p className="text-xs text-[#0059B3] max-w-[50%] text-right">
                À espera da tua aprovação - ver os mais antigos primeiro →
              </p>
            )}
          </Link>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm hover:shadow-md transition-shadow p-5">
              <p className="text-xs text-[#94A3B8]">Total</p>
              <p className="text-2xl font-bold text-[#0F172A] mt-1">{lista.length}</p>
            </div>
            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm hover:shadow-md transition-shadow p-5">
              <p className="text-xs text-[#94A3B8]">Em preenchimento</p>
              <p className="text-2xl font-bold text-[#0F172A] mt-1">{contagens.em_preenchimento}</p>
            </div>
            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm hover:shadow-md transition-shadow p-5">
              <p className="text-xs text-[#94A3B8]">Aprovados</p>
              <p className="text-2xl font-bold text-[#0F172A] mt-1">{contagens.aprovado}</p>
            </div>
            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm hover:shadow-md transition-shadow p-5">
              <p className="text-xs text-[#94A3B8]">Concluídos</p>
              <p className="text-2xl font-bold text-[#0F172A] mt-1">{contagens.concluido}</p>
            </div>
            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm hover:shadow-md transition-shadow p-5">
              <p className="text-xs text-[#94A3B8]">Cancelados</p>
              <p className="text-2xl font-bold text-[#0F172A] mt-1">{contagens.cancelado}</p>
            </div>
            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm hover:shadow-md transition-shadow p-5">
              <p className="text-xs text-[#94A3B8]">Tempo médio até aprovar</p>
              <p className="text-2xl font-bold text-[#0F172A] mt-1">{tempoMedioConclusao(lista)}</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <PlotlyChart
              className="h-72 p-4"
              data={[
                {
                  type: "pie",
                  labels: [
                    ESTADO_LABEL.em_preenchimento,
                    ESTADO_LABEL.pronto_para_aprovacao,
                    ESTADO_LABEL.aprovado,
                    ESTADO_LABEL.concluido,
                    ESTADO_LABEL.cancelado,
                  ],
                  values: [
                    contagens.em_preenchimento,
                    contagens.pronto_para_aprovacao,
                    contagens.aprovado,
                    contagens.concluido,
                    contagens.cancelado,
                  ],
                  marker: { colors: ["#ff9f0a", "#0071e3", "#1fae5a", "#0a8a45", "#94a3b8"] },
                  hole: 0.55,
                  textinfo: "value+percent",
                },
              ]}
              layout={{ title: { text: "Processos por estado" }, height: 260 }}
            />
            <PlotlyChart
              className="h-72 p-4"
              data={[
                {
                  type: "bar",
                  x: processosPorDia(lista).dias,
                  y: processosPorDia(lista).contagens,
                  marker: { color: "#0071e3" },
                },
              ]}
              layout={{ title: { text: "CPCVs criados por dia" }, height: 260, showlegend: false }}
            />
          </div>
        </>
      )}

      <ListaProcessos
        lista={lista}
        isGestora={isGestora}
        nomesPorAgente={nomesPorAgente}
        filtroInicial={estadoInicial}
      />
    </div>
  );
}
