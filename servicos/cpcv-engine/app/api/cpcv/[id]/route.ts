import { NextRequest, NextResponse } from "next/server";
import { sbUserServer } from "@/lib/supabase-server";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await sbUserServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  }

  const { data: processo } = await supabase
    .from("cpcv_processos")
    .select("id, criado_por, estado")
    .eq("id", id)
    .single();

  if (!processo) {
    return NextResponse.json({ error: "Processo não encontrado." }, { status: 404 });
  }

  // Um processo aprovado/concluído já tem um CPCV real gerado - eliminar apagaria essa
  // referência definitivamente. O caminho correcto para esses estados é "Cancelar
  // processo" (POST /api/cpcv/[id]/fechar), que preserva o registo. Verificação no
  // servidor porque o botão "Eliminar" já está escondido para estes estados no
  // frontend, mas isso não impede um pedido directo à API.
  if (processo.estado === "aprovado" || processo.estado === "concluido") {
    return NextResponse.json(
      { error: "Este processo já tem um CPCV aprovado - usa \"Cancelar processo\" em vez de eliminar." },
      { status: 400 }
    );
  }

  // Limpar os ficheiros no Storage primeiro - não estão ligados por foreign key,
  // por isso apagar o processo não os apaga sozinho.
  const { data: ficheiros } = await supabase.storage
    .from("cpcv-documentos")
    .list(`${processo.criado_por}/${id}`);

  if (ficheiros && ficheiros.length > 0) {
    const caminhos = ficheiros.map((f) => `${processo.criado_por}/${id}/${f.name}`);
    await supabase.storage.from("cpcv-documentos").remove(caminhos);
  }

  // Apaga o processo - partes/ficheiros/mensagens saem sozinhos por "on delete cascade".
  const { error } = await supabase.from("cpcv_processos").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: `Erro ao eliminar: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
