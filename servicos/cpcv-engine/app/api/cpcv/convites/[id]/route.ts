import { NextRequest, NextResponse } from "next/server";
import { sbUserServer } from "@/lib/supabase-server";
import { sbServer } from "@/lib/supabase";
import { temGestaoTotal } from "@/lib/cpcv-auth";

// Revogar um convite ainda não usado. Gestora só revoga os que ela própria criou (e que
// sejam de agente - por construção nunca deveria ter criado outro tipo, mas confirma-se
// aqui na mesma); admin revoga qualquer um.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await sbUserServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  }

  const { data: perfil } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!temGestaoTotal(perfil?.role)) {
    return NextResponse.json({ error: "Só a gestora ou o admin podem revogar convites." }, { status: 403 });
  }

  const sb = sbServer();
  const { data: convite } = await sb.from("cpcv_convites").select("criado_por, role, usado_por").eq("id", id).single();

  if (!convite) {
    return NextResponse.json({ error: "Convite não encontrado." }, { status: 404 });
  }

  if (convite.usado_por) {
    return NextResponse.json({ error: "Este convite já foi usado, não há nada para revogar." }, { status: 400 });
  }

  if (perfil?.role === "gestora" && (convite.criado_por !== user.id || convite.role !== "agente")) {
    return NextResponse.json({ error: "Só podes revogar convites de agente que tu própria geraste." }, { status: 403 });
  }

  const { error } = await sb.from("cpcv_convites").update({ revogado: true }).eq("id", id);

  if (error) {
    return NextResponse.json({ error: `Erro ao revogar: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
