import { NextRequest, NextResponse } from "next/server";
import { sbUserServer } from "@/lib/supabase-server";
import { temGestaoTotal } from "@/lib/cpcv-auth";

// Volta um processo aprovado a "em preenchimento" para a gestora poder editar os formulários
// (que ficam bloqueados depois de aprovado) e regerar o CPCV - por exemplo para um processo
// aprovado antes de o modelo mudar, que não tem as respostas novas. Ao contrário de
// /api/cpcv/pedir-alteracoes, não acrescenta nenhuma pergunta pendente nem mensagem à agente.
export async function POST(req: NextRequest) {
  const supabase = await sbUserServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  }

  const { data: perfil } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!temGestaoTotal(perfil?.role)) {
    return NextResponse.json({ error: "Só a gestora de processos pode reabrir um processo." }, { status: 403 });
  }

  const { processo_id } = await req.json();

  const { data: processo } = await supabase.from("cpcv_processos").select("estado").eq("id", processo_id).single();
  if (!processo) {
    return NextResponse.json({ error: "Processo não encontrado." }, { status: 404 });
  }
  if (processo.estado !== "aprovado") {
    return NextResponse.json({ error: "Só um processo aprovado pode ser reaberto." }, { status: 400 });
  }

  const { error } = await supabase
    .from("cpcv_processos")
    .update({ estado: "em_preenchimento", atualizado_em: new Date().toISOString() })
    .eq("id", processo_id);

  if (error) {
    return NextResponse.json({ error: `Erro ao reabrir o processo: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
