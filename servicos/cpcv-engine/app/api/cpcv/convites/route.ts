import { NextRequest, NextResponse } from "next/server";
import { sbUserServer } from "@/lib/supabase-server";
import { sbServer } from "@/lib/supabase";
import { temGestaoTotal } from "@/lib/cpcv-auth";

// Código curto e legível para partilhar por WhatsApp/email, não um UUID inteiro.
function gerarCodigo(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
}

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
    return NextResponse.json({ error: "Só a gestora ou o admin podem gerar convites." }, { status: 403 });
  }

  const { role: roleQuerido } = await req.json();

  // Nunca confiar no papel pedido pelo cliente: a gestora só gera convites de agente,
  // mesmo que tente pedir "gestora" directamente à API.
  let role: "agente" | "gestora";
  if (perfil?.role === "admin") {
    if (roleQuerido !== "agente" && roleQuerido !== "gestora") {
      return NextResponse.json({ error: "Papel inválido." }, { status: 400 });
    }
    role = roleQuerido;
  } else {
    role = "agente";
  }

  const sb = sbServer();
  const codigo = gerarCodigo();

  const { error } = await sb.from("cpcv_convites").insert({
    codigo,
    role,
    criado_por: user.id,
  });

  if (error) {
    return NextResponse.json({ error: `Erro ao gerar o convite: ${error.message}` }, { status: 500 });
  }

  const link = `${req.nextUrl.origin}/cpcv/registo?codigo=${codigo}`;

  return NextResponse.json({ ok: true, codigo, link });
}
