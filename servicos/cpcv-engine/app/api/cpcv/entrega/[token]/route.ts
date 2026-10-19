import { NextRequest, NextResponse } from "next/server";
import { sbServer } from "@/lib/supabase";
import {
  validarToken,
  tipoValido,
  TAMANHO_MAXIMO_BYTES,
  MAX_FICHEIROS_POR_LINK,
} from "@/lib/cpcv-links-cliente";
import { extensaoSuportada, nomeFicheiroSeguro } from "@/lib/cpcv-ficheiros";

// Rota pública: o cliente (comprador ou vendedor) entrega UM ficheiro de cada vez. O token é a
// única credencial; não dá acesso a ler nada, só a acrescentar ficheiros ao processo, que ficam
// "pendentes" até o agente os rever.
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const sb = sbServer();

  const link = await validarToken(sb, token);
  if (!link) {
    return NextResponse.json({ error: "Este link já não é válido. Peça um novo ao seu agente." }, { status: 410 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("ficheiro");
  const tipo = String(form?.get("tipo") ?? "");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Ficheiro em falta." }, { status: 400 });
  }
  if (!tipoValido(link.papel, tipo)) {
    return NextResponse.json({ error: "Tipo de documento inválido." }, { status: 400 });
  }
  if (!extensaoSuportada(file.name)) {
    return NextResponse.json({ error: "Formato não suportado. Envie PDF, PNG ou JPG." }, { status: 400 });
  }
  if (file.size === 0 || file.size > TAMANHO_MAXIMO_BYTES) {
    return NextResponse.json({ error: "O ficheiro tem de ter menos de 4 MB." }, { status: 400 });
  }

  const { count } = await sb
    .from("cpcv_ficheiros")
    .select("id", { count: "exact", head: true })
    .eq("link_id", link.id);
  if ((count ?? 0) >= MAX_FICHEIROS_POR_LINK) {
    return NextResponse.json({ error: "Limite de ficheiros atingido para este link." }, { status: 429 });
  }

  const { data: processo } = await sb
    .from("cpcv_processos")
    .select("criado_por, estado")
    .eq("id", link.processo_id)
    .single();
  if (!processo || ["aprovado", "concluido", "cancelado"].includes(processo.estado)) {
    return NextResponse.json({ error: "Este processo já não aceita documentos." }, { status: 410 });
  }

  // Mesma convenção do resto da app: <dono>/<processo>/..., com subpasta portal para distinguir.
  const caminho = `${processo.criado_por}/${link.processo_id}/portal/${link.papel}/${crypto.randomUUID()}-${nomeFicheiroSeguro(file.name)}`;
  const { error: upErr } = await sb.storage
    .from("cpcv-documentos")
    .upload(caminho, Buffer.from(await file.arrayBuffer()), { contentType: file.type || undefined });
  if (upErr) {
    return NextResponse.json({ error: "Erro ao guardar o ficheiro. Tente outra vez." }, { status: 500 });
  }

  const { error: dbErr } = await sb.from("cpcv_ficheiros").insert({
    processo_id: link.processo_id,
    tipo,
    storage_path: caminho,
    nome_original: file.name,
    origem: "cliente",
    estado_revisao: "pendente",
    link_id: link.id,
  });
  if (dbErr) {
    await sb.storage.from("cpcv-documentos").remove([caminho]);
    return NextResponse.json({ error: "Erro ao registar o ficheiro. Tente outra vez." }, { status: 500 });
  }

  await sb.from("cpcv_links_cliente").update({ ultimo_uso_em: new Date().toISOString() }).eq("id", link.id);

  return NextResponse.json({ ok: true });
}
