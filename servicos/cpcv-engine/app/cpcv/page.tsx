import { sbUserServer } from "@/lib/supabase-server";
import Link from "next/link";
import PlotlyChart from "@/components/charts/PlotlyChart";
import ListaProcessos from "./ListaProcessos";
import { btnPrimary } from "./ui";

const ESTADO_LABEL: Record<string, string> = {
  em_preenchimento: "Em preenchimento",
  pronto_para_aprovacao: "Pronto para aprovação",
  aprovado: "Aprovado",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

type Processo = {
  id: string;
  criado_por: string;
  estado: string;
  imovel_morada: string | null;
  criado_em: string;
  atualizado_em: string;
};

function tempoMedioConclusao(processos: Processo[]): string {
  // Aproximação: usa atualizado_em, que também muda se o processo for depois fechado
  // (concluído/cancelado) - nesses casos o "tempo até aprovar" fica sobrestimado.
  const concluidos = processos.filter((p) => p.estado === "aprovado" || p.estado === "concluido");
  if (concluidos.length === 0) return "-";

  const totalMs = concluidos.reduce((soma, p) => {
    const inicio = new Date(p.criado_em).getTime();
    const fim = new Date(p.atualizado_em).getTime();
    return soma + Math.max(0, fim - inicio);
  }, 0);

  const mediaMs = totalMs / concluidos.length;
  const mediaMin = mediaMs / 1000 / 60;

  if (mediaMin < 60) return `${Math.round(mediaMin)} min`;
  const mediaHoras = mediaMin / 60;
  if (mediaHoras < 24) return `${mediaHoras.toFixed(1)} h`;
  return `${(mediaHoras / 24).toFixed(1)} dias`;
}

function processosPorDia(processos: Processo[]): { dias: string[]; contagens: number[] } {
  const porDia = new Map<string, number>();
  for (const p of processos) {
    const dia = new Date(p.criado_em).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" });
    porDia.set(dia, (porDia.get(dia) ?? 0) + 1);
  }
  const diasOrdenados = Array.from(porDia.keys()).sort((a, b) => {
    const [da, ma] = a.split("/").map(Number);
    const [db, mb] = b.split("/").map(Number);
    return ma === mb ? da - db : ma - mb;
  });
  return { dias: diasOrdenados, contagens: diasOrdenados.map((d) => porDia.get(d) ?? 0) };
}

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
    .select("id, criado_por, estado, imovel_morada, criado_em, atualizado_em")
    .order("criado_em", { ascending: false });

  const lista = (processos ?? []) as Processo[];

  const isGestora = perfil?.role === "gestora";

  let nomesPorAgente: Record<string, string> = {};
  if (isGestora && lista.length > 0) {
    const ids = Array.from(new Set(lista.map((p) => p.criado_por)));
    const { data: perfis } = await supabase.from("profiles").select("id, nome").in("id", ids);
    nomesPorAgente = Object.fromEntries((perfis ?? []).map((p) => [p.id, p.nome]));
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
        <Link href="/cpcv/novo" className={btnPrimary}>
          + Novo CPCV
        </Link>
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
