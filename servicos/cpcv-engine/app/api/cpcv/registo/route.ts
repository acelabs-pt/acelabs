import { NextRequest, NextResponse } from "next/server";
import { sbServer } from "@/lib/supabase";

// Cria a conta com a service role (auth.admin.createUser) porque ainda não existe sessão
// nenhuma nesta altura. O papel nunca é escolhido livremente aqui - vem sempre do código:
// ou é o código de bootstrap (CPCV_INVITE_ADMIN, estático, só para criar o primeiro admin
// ou outro mais tarde por quem tiver acesso às env vars), ou é uma linha de cpcv_convites
// gerada dentro da app por uma gestora (só para agente) ou por um admin (agente/gestora).
// Antes disto existiam CPCV_INVITE_AGENTE/CPCV_INVITE_GESTORA, dois segredos fixos e
// partilhados que deixavam qualquer pessoa escolher o próprio papel - substituídos por
// completo por esta tabela (ver migration_fase6.sql).
export async function POST(req: NextRequest) {
  const { nome, email, password, codigo } = await req.json();

  if (!nome || !email || !password || !codigo) {
    return NextResponse.json({ error: "Preenche todos os campos." }, { status: 400 });
  }

  const sb = sbServer();

  let role: "agente" | "gestora" | "admin";
  let convite: { id: string } | null = null;

  if (process.env.CPCV_INVITE_ADMIN && codigo === process.env.CPCV_INVITE_ADMIN) {
    role = "admin";
  } else {
    const agora = new Date().toISOString();
    const { data: conviteEncontrado } = await sb
      .from("cpcv_convites")
      .select("id, role")
      .eq("codigo", codigo)
      .eq("revogado", false)
      .is("usado_por", null)
      .or(`expira_em.is.null,expira_em.gt.${agora}`)
      .maybeSingle();

    if (!conviteEncontrado) {
      return NextResponse.json(
        { error: "Código de convite inválido, expirado ou já usado." },
        { status: 401 }
      );
    }

    role = conviteEncontrado.role as "agente" | "gestora";
    convite = { id: conviteEncontrado.id };
  }

  const { data, error } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error || !data.user) {
    return NextResponse.json(
      { error: error?.message ?? "Não foi possível criar a conta." },
      { status: 400 }
    );
  }

  const { error: profileError } = await sb
    .from("profiles")
    .insert({ id: data.user.id, nome, role });

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  if (convite) {
    await sb
      .from("cpcv_convites")
      .update({ usado_por: data.user.id, usado_em: new Date().toISOString() })
      .eq("id", convite.id);
  }

  return NextResponse.json({ ok: true });
}
