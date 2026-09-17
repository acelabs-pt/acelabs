import { NextRequest, NextResponse } from "next/server";
import { sbServer } from "@/lib/supabase";

// Cria a conta com a service role (auth.admin.createUser) porque ainda não
// existe sessão nenhuma nesta altura - o código de convite é o que substitui
// aqui um verdadeiro fluxo de convite por email.
export async function POST(req: NextRequest) {
  const { nome, email, password, role, codigo } = await req.json();

  if (!nome || !email || !password || (role !== "agente" && role !== "gestora")) {
    return NextResponse.json({ error: "Preenche todos os campos." }, { status: 400 });
  }

  const codigoEsperado =
    role === "agente" ? process.env.CPCV_INVITE_AGENTE : process.env.CPCV_INVITE_GESTORA;

  if (!codigoEsperado || codigo !== codigoEsperado) {
    return NextResponse.json({ error: "Código de convite inválido." }, { status: 401 });
  }

  const sb = sbServer();

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

  return NextResponse.json({ ok: true });
}
