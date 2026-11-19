// Acessos ao Cockpit: criar a conta de um tester ou cliente (empresa + convite por email) e reenviar o link da password. Tudo se faz
// no Supabase do Cockpit, pela função gerir-acessos (cockpit-app/supabase/functions/gerir-acessos), com um segredo próprio. A chave
// de administrador do Cockpit nunca vem para a Torre.

export type EstadoAcesso = {
  utilizador: { convidado_em: string; ultimo_acesso: string | null } | null;
  empresa: { codigo: string; nome: string; suspensa: boolean } | null;
  empresas: { codigo: string; nome: string }[];
};

export function acessosConfigurados(): boolean {
  return Boolean(process.env.COCKPIT_ACESSOS_URL && process.env.COCKPIT_ACESSOS_TOKEN);
}

async function pedir<T>(corpo: Record<string, unknown>): Promise<{ dados?: T; erro?: string }> {
  if (!acessosConfigurados()) return { erro: "A ligação ao Cockpit não está configurada (COCKPIT_ACESSOS_URL e COCKPIT_ACESSOS_TOKEN)." };
  try {
    const r = await fetch(process.env.COCKPIT_ACESSOS_URL!, {
      method: "POST",
      headers: { "x-torre-token": process.env.COCKPIT_ACESSOS_TOKEN!, "content-type": "application/json" },
      body: JSON.stringify(corpo),
      cache: "no-store",
    });
    const j = (await r.json().catch(() => ({}))) as T & { erro?: string };
    if (!r.ok) return { erro: r.status === 401 ? "O segredo não bate com o do Cockpit." : j.erro ?? `O Cockpit respondeu ${r.status}.` };
    return { dados: j };
  } catch {
    return { erro: "Não foi possível ligar ao Cockpit." };
  }
}

export const estadoAcesso = (email: string) => pedir<EstadoAcesso>({ acao: "estado", email });

export const criarAcesso = (a: { email: string; nome: string; empresa: string; empresa_nome: string; responsavel: string; quem: string }) =>
  pedir<{ ok: true; empresa: { codigo: string; nome: string }; empresa_criada: boolean }>({ acao: "criar", ...a });

export const reenviarAcesso = (email: string, quem: string) => pedir<{ ok: true }>({ acao: "reenviar", email, quem });

/** "Inês Batista Imóveis" -> "ines-batista-imoveis": sugestão de código para a empresa no Cockpit. */
export function codigoDe(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
}
