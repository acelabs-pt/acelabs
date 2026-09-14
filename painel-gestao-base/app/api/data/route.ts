import { NextResponse } from "next/server";
import { sbServer } from "@/lib/supabase";

// Padrão: ler todas as tabelas de que a app precisa de uma vez, em paralelo,
// e devolver sem cache. O cliente filtra em memória a partir daqui.
// Substituir os nomes das tabelas pelos reais do projecto.

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const sb = sbServer();

  const [clientes, atividade] = await Promise.all([
    sb.from("clientes").select("*"),
    sb.from("atividade_mensal").select("*"),
  ]);

  return NextResponse.json(
    {
      clientes: clientes.data ?? [],
      atividade: atividade.data ?? [],
    },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
  );
}
