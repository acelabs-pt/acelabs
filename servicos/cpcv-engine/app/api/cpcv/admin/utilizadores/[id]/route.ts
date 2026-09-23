import { NextRequest, NextResponse } from "next/server";
import { sbUserServer } from "@/lib/supabase-server";
import { sbServer } from "@/lib/supabase";

// Mudar o papel de alguém e/ou cortar-lhe o acesso - só admin. "activo: false" usa
// auth.admin.updateUserById com ban_duration (bloqueia o login sem apagar a conta nem os
// processos que essa pessoa já criou); "role" grava directamente em profiles.
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
  if (perfil?.role !== "admin") {
    return NextResponse.json({ error: "Só o admin pode gerir utilizadores." }, { status: 403 });
  }

  if (id === user.id) {
    return NextResponse.json({ error: "Não podes alterar o teu próprio acesso por aqui." }, { status: 400 });
  }

  const { role, activo } = await req.json();
  const sb = sbServer();

  if (role !== undefined) {
    if (role !== "agente" && role !== "gestora" && role !== "admin") {
      return NextResponse.json({ error: "Papel inválido." }, { status: 400 });
    }
    const { error } = await sb.from("profiles").update({ role }).eq("id", id);
    if (error) {
      return NextResponse.json({ error: `Erro ao mudar o papel: ${error.message}` }, { status: 500 });
    }
  }

  if (activo !== undefined) {
    const { error } = await sb.auth.admin.updateUserById(id, {
      ban_duration: activo ? "none" : "876000h", // ~100 anos - "para sempre" na prática, reversível
    });
    if (error) {
      return NextResponse.json({ error: `Erro ao mudar o acesso: ${error.message}` }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
