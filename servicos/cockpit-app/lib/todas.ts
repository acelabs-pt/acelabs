// O Supabase (PostgREST) devolve no máximo 1000 linhas por pedido, sem dar erro.
// Com ~59 ações e outras tantas tarefas por angariação, isso chega com poucas
// angariações e os totais ficavam cortados em silêncio. Esta função pede em lotes
// até vir um lote incompleto. A consulta tem de ter uma ordem estável (ex: .order("id")).
const LOTE = 1000;

export async function todas<T>(
  consulta: (de: number, ate: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>
): Promise<{ data: T[]; error: unknown }> {
  const out: T[] = [];
  for (let de = 0; ; de += LOTE) {
    const { data, error } = await consulta(de, de + LOTE - 1);
    if (error) return { data: out, error };
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < LOTE) return { data: out, error: null };
  }
}
