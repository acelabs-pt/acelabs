import { NextRequest, NextResponse } from "next/server";
import { sbUserServer } from "@/lib/supabase-server";
import { temGestaoTotal } from "@/lib/cpcv-auth";

export async function POST(req: NextRequest) {
  const supabase = await sbUserServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  }

  const { data: perfil } = await supabase.from("profiles").select("role, nome").eq("id", user.id).single();
  if (!temGestaoTotal(perfil?.role)) {
    return NextResponse.json({ error: "Só a gestora de processos pode pedir alterações." }, { status: 403 });
  }

  const { processo_id, nota } = await req.json();

  if (!nota?.trim()) {
    return NextResponse.json({ error: "Escreve o que falta ou o que precisa de ser corrigido." }, { status: 400 });
  }

  const { data: processo } = await supabase
    .from("cpcv_processos")
    .select("campos_em_falta")
    .eq("id", processo_id)
    .single();

  if (!processo) {
    return NextResponse.json({ error: "Processo não encontrado." }, { status: 404 });
  }

  const camposAtuais: { campo: string; pergunta: string }[] = processo.campos_em_falta ?? [];
  const novosCampos = [...camposAtuais, { campo: "nota_gestora", pergunta: nota }];

  const { error: updateError } = await supabase
    .from("cpcv_processos")
    .update({
      campos_em_falta: novosCampos,
      estado: "em_preenchimento",
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", processo_id);

  if (updateError) {
    return NextResponse.json({ error: `Erro ao gravar o pedido: ${updateError.message}` }, { status: 500 });
  }

  const { error: mensagemError } = await supabase.from("cpcv_mensagens").insert({
    processo_id,
    autor: "gestora",
    texto: nota,
  });

  if (mensagemError) {
    return NextResponse.json({ error: `Erro ao gravar a mensagem: ${mensagemError.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
