import { NextRequest, NextResponse } from "next/server";
import { sbServer } from "@/lib/supabase";

// Padrão usado no projecto original: um único endpoint de escrita, despachado
// por um campo "action" em vez de um endpoint por operação. Simplifica ter
// tudo num sítio, mas o ficheiro cresce - no original chegou a ter ~270 linhas
// com muitas acções. Adicionar uma operação = adicionar um ramo "if".
//
// O padrão mais útil que aqui não está representado (por ser específico do
// negócio do cliente): sempre que uma linha "de detalhe" é gravada, recalcular
// e gravar os totais mensais agregados numa tabela separada, para os gráficos
// não terem de agregar em cada leitura. Ver README.md, secção "Padrões a repetir".

export async function POST(req: NextRequest) {
  const body = await req.json();
  const sb = sbServer();
  const { action } = body;

  try {
    if (action === "save_cliente") {
      const { id, nome, estado, data_entrada } = body;
      const payload = { nome, estado, data_entrada: data_entrada || null };
      if (id) {
        await sb.from("clientes").update(payload).eq("id", id);
      } else {
        await sb.from("clientes").insert(payload);
      }
      return NextResponse.json({ ok: true });
    }

    if (action === "delete_cliente") {
      await sb.from("clientes").delete().eq("id", body.id);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
