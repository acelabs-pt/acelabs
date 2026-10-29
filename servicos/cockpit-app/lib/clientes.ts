// Escolha do cliente em tempo de execução. Um só deploy (cockpit.acelabs.pt) serve vários clientes, cada um com o seu
// Supabase. A lista vem da variável COCKPIT_CLIENTES (JSON) e o cliente escolhido fica no cookie `cockpit-cliente`.
//
//   COCKPIT_CLIENTES=[{"codigo":"alvorada","nome":"Alvorada Imóveis","url":"https://xxx.supabase.co","anon":"<chave anon>"}]
//
// Só leva a chave pública (anon), que já está no browser hoje. Nunca a service_role.
// Sem a variável, a app funciona como antes: um cliente fixo em NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY.
// Este ficheiro corre no servidor, no middleware (edge) e é importado por componentes: sem dependências.

export const COOKIE_CLIENTE = "cockpit-cliente";

export type ConfigSb = { url: string; anon: string };
export type ClienteLista = ConfigSb & { codigo: string; nome: string };

export function normalizarCodigo(c: string | null | undefined): string {
  return (c ?? "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
}

/** Lista de clientes configurada, ou [] no modo de cliente único. Entradas inválidas são ignoradas. */
export function listaClientes(): ClienteLista[] {
  const bruto = process.env.COCKPIT_CLIENTES;
  if (!bruto) return [];
  try {
    const a = JSON.parse(bruto);
    if (!Array.isArray(a)) return [];
    return a
      .map((c) => ({ codigo: normalizarCodigo(c?.codigo), nome: String(c?.nome ?? ""), url: String(c?.url ?? ""), anon: String(c?.anon ?? "") }))
      .filter((c) => c.codigo && /^https:\/\//.test(c.url) && c.anon);
  } catch {
    return [];
  }
}

export function modoVariosClientes(): boolean {
  return listaClientes().length > 0;
}

export function clientePorCodigo(codigo: string | null | undefined): ClienteLista | null {
  const c = normalizarCodigo(codigo);
  return c ? (listaClientes().find((x) => x.codigo === c) ?? null) : null;
}

/**
 * Configuração do Supabase para o pedido. `codigoCookie` é o valor do cookie. No modo de cliente único ignora-o e usa
 * as variáveis fixas. No modo de vários clientes devolve null se não houver cliente válido escolhido.
 */
export function configSb(codigoCookie: string | null | undefined): ConfigSb | null {
  if (!modoVariosClientes()) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    return url && anon ? { url, anon } : null;
  }
  const c = clientePorCodigo(codigoCookie);
  return c ? { url: c.url, anon: c.anon } : null;
}
