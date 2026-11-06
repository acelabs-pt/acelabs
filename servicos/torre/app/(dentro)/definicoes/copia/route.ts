import { exigirSocio } from "@/lib/sessao";
import { copiaDeTudo } from "@/lib/copia";
import { hojeLisboa } from "@/lib/texto";

// Descarrega uma cópia de todos os dados (JSON). Usa a sessão de quem pede: as regras de acesso aplicam-se.
export const dynamic = "force-dynamic";

export async function GET() {
  const { s } = await exigirSocio();
  const copia = await copiaDeTudo(s);
  return new Response(JSON.stringify(copia, null, 1), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="torre-copia-${hojeLisboa()}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
