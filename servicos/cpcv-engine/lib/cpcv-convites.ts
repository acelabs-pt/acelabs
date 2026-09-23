import type { Convite } from "@/app/cpcv/GerarConvite";

// Partilhado por app/cpcv/page.tsx (gestora - só os convites que ela criou) e
// app/cpcv/admin/page.tsx (admin - todos), para não duplicar o mesmo join com profiles
// duas vezes. `supabase` é o cliente ligado à sessão (sbUserServer()) - a RLS de
// cpcv_convites já filtra o que cada papel pode ver.
export async function carregarConvites(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  opcoes: { apenasCriadoPor?: string; limite?: number } = {}
): Promise<Convite[]> {
  let query = supabase
    .from("cpcv_convites")
    .select("id, codigo, role, criado_em, usado_em, usado_por, expira_em, revogado, criado_por")
    .order("criado_em", { ascending: false })
    .limit(opcoes.limite ?? 20);

  if (opcoes.apenasCriadoPor) query = query.eq("criado_por", opcoes.apenasCriadoPor);

  const { data: linhas } = await query;
  const usadoPorIds = Array.from(
    new Set((linhas ?? []).map((c: { usado_por: string | null }) => c.usado_por).filter((id: string | null): id is string => !!id))
  );

  const { data: perfisUsados } =
    usadoPorIds.length > 0
      ? await supabase.from("profiles").select("id, nome").in("id", usadoPorIds)
      : { data: [] };
  const nomesPorUsado = Object.fromEntries((perfisUsados ?? []).map((p: { id: string; nome: string }) => [p.id, p.nome]));

  return (linhas ?? []).map((c: {
    id: string;
    codigo: string;
    role: "agente" | "gestora";
    criado_em: string;
    usado_em: string | null;
    usado_por: string | null;
    expira_em: string | null;
    revogado: boolean;
  }) => ({
    id: c.id,
    codigo: c.codigo,
    role: c.role,
    criado_em: c.criado_em,
    usado_em: c.usado_em,
    usado_por_nome: c.usado_por ? nomesPorUsado[c.usado_por] ?? null : null,
    expira_em: c.expira_em,
    revogado: c.revogado,
  }));
}
