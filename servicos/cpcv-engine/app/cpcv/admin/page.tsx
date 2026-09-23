import { sbUserServer } from "@/lib/supabase-server";
import { sbServer } from "@/lib/supabase";
import { redirect } from "next/navigation";
import Link from "next/link";
import PlotlyChart from "@/components/charts/PlotlyChart";
import GerarConvite from "../GerarConvite";
import GestaoUtilizadores, { type Utilizador } from "./GestaoUtilizadores";
import { carregarConvites } from "@/lib/cpcv-convites";
import {
  ESTADO_LABEL,
  tempoMedioConclusao,
  processosPorDia,
  resumoPorGestora,
  type Processo,
} from "@/lib/cpcv-estatisticas";

export default async function AdminPage() {
  const supabase = await sbUserServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: perfil } = await supabase.from("profiles").select("role").eq("id", user!.id).single();
  if (perfil?.role !== "admin") redirect("/cpcv");

  const { data: processos } = await supabase
    .from("cpcv_processos")
    .select("id, criado_por, estado, imovel_morada, criado_em, atualizado_em, campos_em_falta, aprovado_por")
    .order("criado_em", { ascending: false });

  const lista = (processos ?? []) as Processo[];

  const contagens = {
    em_preenchimento: lista.filter((p) => p.estado === "em_preenchimento").length,
    pronto_para_aprovacao: lista.filter((p) => p.estado === "pronto_para_aprovacao").length,
    aprovado: lista.filter((p) => p.estado === "aprovado").length,
    concluido: lista.filter((p) => p.estado === "concluido").length,
    cancelado: lista.filter((p) => p.estado === "cancelado").length,
  };

  const { data: perfisGestao } = await supabase
    .from("profiles")
    .select("id, nome")
    .in("role", ["gestora", "admin"]);

  const { porGestora, semGestoraAtribuida } = resumoPorGestora(lista, perfisGestao ?? []);

  const { data: todosPerfis } = await supabase.from("profiles").select("id, nome, role, criado_em");

  // Email e estado da conta (activa/desactivada) vivem em auth.users, não em profiles -
  // só acessível com a service role (auth.admin.listUsers()).
  const sb = sbServer();
  const { data: listaAuth } = await sb.auth.admin.listUsers({ perPage: 200 });
  const authPorId = Object.fromEntries((listaAuth?.users ?? []).map((u) => [u.id, u]));

  const utilizadores: Utilizador[] = (todosPerfis ?? []).map((p) => ({
    id: p.id,
    nome: p.nome,
    email: authPorId[p.id]?.email ?? "-",
    role: p.role,
    criado_em: p.criado_em,
    activo: !authPorId[p.id]?.banned_until,
  }));

  const convites = await carregarConvites(supabase, { limite: 30 });

  return (
    <div className="space-y-6">
      <Link
        href="/cpcv"
        className="inline-flex items-center gap-1 text-xs text-[#94A3B8] hover:text-[#0F172A] transition"
      >
        ← Voltar ao dashboard
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#0F172A]">Administração</h1>
          <p className="text-sm text-[#94A3B8] mt-1">Utilizadores, convites e desempenho da equipa.</p>
        </div>
        <GerarConvite papeisPermitidos={["agente", "gestora"]} convites={convites} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-5">
          <p className="text-xs text-[#94A3B8]">Total</p>
          <p className="text-2xl font-bold text-[#0F172A] mt-1">{lista.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-5">
          <p className="text-xs text-[#94A3B8]">Em preenchimento</p>
          <p className="text-2xl font-bold text-[#0F172A] mt-1">{contagens.em_preenchimento}</p>
        </div>
        <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-5">
          <p className="text-xs text-[#94A3B8]">Aprovados</p>
          <p className="text-2xl font-bold text-[#0F172A] mt-1">{contagens.aprovado}</p>
        </div>
        <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-5">
          <p className="text-xs text-[#94A3B8]">Concluídos</p>
          <p className="text-2xl font-bold text-[#0F172A] mt-1">{contagens.concluido}</p>
        </div>
        <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-5">
          <p className="text-xs text-[#94A3B8]">Cancelados</p>
          <p className="text-2xl font-bold text-[#0F172A] mt-1">{contagens.cancelado}</p>
        </div>
        <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-5">
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

      <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-5">
        <h2 className="text-sm font-semibold text-[#0F172A] mb-1">Resumo por gestora</h2>
        <p className="text-xs text-[#94A3B8] mb-3">
          Só o que os dados sustentam: quantos cada gestora/admin aprovou e a velocidade a que
          o fez - não há uma &quot;fila atribuída&quot; por pessoa antes da aprovação.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[#94A3B8] border-b border-[#F1F5F9]">
                <th className="py-2 pr-3 font-medium">Nome</th>
                <th className="py-2 pr-3 font-medium">Aprovados</th>
                <th className="py-2 pr-3 font-medium">Concluídos</th>
                <th className="py-2 pr-3 font-medium">Tempo médio até aprovar</th>
              </tr>
            </thead>
            <tbody>
              {porGestora.map((g) => (
                <tr key={g.id} className="border-b border-[#F1F5F9] last:border-0">
                  <td className="py-2 pr-3 font-medium text-[#0F172A]">{g.nome}</td>
                  <td className="py-2 pr-3">{g.aprovados}</td>
                  <td className="py-2 pr-3">{g.concluidos}</td>
                  <td className="py-2 pr-3">{g.tempoMedio}</td>
                </tr>
              ))}
              {semGestoraAtribuida > 0 && (
                <tr>
                  <td className="py-2 pr-3 text-[#94A3B8] italic">Sem gestora atribuída</td>
                  <td className="py-2 pr-3 text-[#94A3B8]">{semGestoraAtribuida}</td>
                  <td className="py-2 pr-3 text-[#94A3B8]">-</td>
                  <td className="py-2 pr-3 text-[#94A3B8]">-</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <GestaoUtilizadores utilizadores={utilizadores} />
    </div>
  );
}
