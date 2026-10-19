import { NextRequest, NextResponse } from "next/server";
import { sbUserServer } from "@/lib/supabase-server";
import { sbServer } from "@/lib/supabase";
import { gerarToken, hashToken, VALIDADE_LINK_DIAS } from "@/lib/cpcv-links-cliente";

// Gera um link de entrega de documentos para uma parte (comprador ou vendedor). O token só é
// devolvido nesta resposta; na base de dados fica apenas o hash.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await sbUserServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });

  const { papel } = await req.json().catch(() => ({}));
  if (papel !== "comprador" && papel !== "vendedor") {
    return NextResponse.json({ error: "Parte inválida." }, { status: 400 });
  }

  // A RLS decide se o utilizador vê o processo (dono, gestora ou admin).
  const { data: processo } = await supabase
    .from("cpcv_processos")
    .select("id, estado, tipo_contrato")
    .eq("id", id)
    .single();
  if (!processo) return NextResponse.json({ error: "Processo não encontrado." }, { status: 404 });

  if (["aprovado", "concluido", "cancelado"].includes(processo.estado)) {
    return NextResponse.json({ error: "Este processo já não aceita documentos." }, { status: 400 });
  }
  if (papel === "vendedor" && processo.tipo_contrato === "comprador_nosso_angariacao_externa") {
    return NextResponse.json(
      { error: "Neste tipo de contrato não se recolhem documentos do vendedor." },
      { status: 400 }
    );
  }

  const token = gerarToken();
  const expiraEm = new Date(Date.now() + VALIDADE_LINK_DIAS * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await sbServer().from("cpcv_links_cliente").insert({
    processo_id: id,
    papel,
    token_hash: hashToken(token),
    expira_em: expiraEm,
    criado_por: user.id,
  });
  if (error) {
    return NextResponse.json({ error: `Erro ao gerar o link: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    link: `${req.nextUrl.origin}/cpcv/entrega/${token}`,
    expira_em: expiraEm,
  });
}

// Revoga um link (deixa de aceitar entregas).
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await sbUserServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });

  const { linkId } = await req.json().catch(() => ({}));
  if (!linkId) return NextResponse.json({ error: "Link em falta." }, { status: 400 });

  // Com a sessão do utilizador: a policy links_cliente_update garante o acesso ao processo.
  const { data, error } = await supabase
    .from("cpcv_links_cliente")
    .update({ revogado: true })
    .eq("id", linkId)
    .eq("processo_id", id)
    .select("id");
  if (error || !data?.length) {
    return NextResponse.json({ error: "Não foi possível revogar o link." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
