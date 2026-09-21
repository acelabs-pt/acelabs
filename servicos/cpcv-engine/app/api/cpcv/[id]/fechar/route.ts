import { NextRequest, NextResponse } from "next/server";
import { sbUserServer } from "@/lib/supabase-server";

const ESTADOS_TERMINAIS = ["concluido", "cancelado"];

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await sbUserServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  }

  const { data: perfil } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (perfil?.role !== "gestora") {
    return NextResponse.json({ error: "Só a gestora de processos pode fechar um processo." }, { status: 403 });
  }

  const { acao, motivo } = await req.json();
  if (acao !== "concluir" && acao !== "cancelar") {
    return NextResponse.json({ error: "Acção inválida." }, { status: 400 });
  }

  const { data: processo } = await supabase
    .from("cpcv_processos")
    .select("estado")
    .eq("id", id)
    .single();

  if (!processo) {
    return NextResponse.json({ error: "Processo não encontrado." }, { status: 404 });
  }

  if (ESTADOS_TERMINAIS.includes(processo.estado)) {
    return NextResponse.json({ error: "Este processo já está fechado." }, { status: 400 });
  }

  // "Concluído" (escritura realizada) só faz sentido depois de o CPCV ter sido gerado -
  // é a prova documental do que foi prometido. "Cancelado" pode acontecer em qualquer
  // altura antes disso (o negócio pode cair mesmo antes de haver documento nenhum).
  if (acao === "concluir" && processo.estado !== "aprovado") {
    return NextResponse.json(
      { error: "Só é possível marcar como concluído depois de o CPCV estar aprovado e gerado." },
      { status: 400 }
    );
  }

  const novoEstado = acao === "concluir" ? "concluido" : "cancelado";
  const mensagem =
    acao === "concluir"
      ? "Processo marcado como concluído - escritura realizada."
      : `Processo cancelado.${motivo?.trim() ? ` Motivo: ${motivo.trim()}` : ""}`;

  const { error: updateError } = await supabase
    .from("cpcv_processos")
    .update({
      estado: novoEstado,
      motivo_cancelamento: acao === "cancelar" ? motivo?.trim() || null : null,
      fechado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: `Erro ao fechar o processo: ${updateError.message}` }, { status: 500 });
  }

  await supabase.from("cpcv_mensagens").insert({
    processo_id: id,
    autor: "gestora",
    texto: mensagem,
  });

  return NextResponse.json({ ok: true, estado: novoEstado });
}
