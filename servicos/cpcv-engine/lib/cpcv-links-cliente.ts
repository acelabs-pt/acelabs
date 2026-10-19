import { createHash, randomBytes } from "crypto";

// Validade por omissao de um link de entrega, em dias.
export const VALIDADE_LINK_DIAS = 14;

// Limites do upload publico. O corpo vai por multipart para a nossa funcao, por isso
// ficam abaixo do limite de ~4.5MB da Vercel por pedido (um ficheiro de cada vez).
export const TAMANHO_MAXIMO_BYTES = 4 * 1024 * 1024;
export const MAX_FICHEIROS_POR_LINK = 30;

export function gerarToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Documentos que se pedem a cada parte. O `tipo` gravado em cpcv_ficheiros segue o prefixo ja
// usado pelo resto da aplicacao (identificacao_comprador, identificacao_vendedor), para as rotas
// de extracao continuarem a reconhecer o ficheiro depois de aceite.
export const DOCUMENTOS_PEDIDOS: Record<"comprador" | "vendedor", { value: string; label: string }[]> = {
  comprador: [
    { value: "identificacao_comprador", label: "Cartão de Cidadão (frente e verso)" },
    { value: "comprovativo_morada_comprador", label: "Comprovativo de morada" },
    { value: "outro_comprador", label: "Outro documento" },
  ],
  vendedor: [
    { value: "identificacao_vendedor", label: "Cartão de Cidadão (frente e verso)" },
    { value: "caderneta_predial", label: "Caderneta predial" },
    { value: "certidao_predial", label: "Certidão predial" },
    { value: "certificado_energetico", label: "Certificado energético" },
    { value: "outro_vendedor", label: "Outro documento" },
  ],
};

export function tipoValido(papel: "comprador" | "vendedor", tipo: string): boolean {
  return DOCUMENTOS_PEDIDOS[papel].some((d) => d.value === tipo);
}

export type LinkValido = {
  id: string;
  processo_id: string;
  papel: "comprador" | "vendedor";
  criado_por: string | null;
};

// Devolve o link se o token existe, nao foi revogado e nao expirou; senao null.
// `sb` e o cliente de servico (sbServer()).
export async function validarToken(
  sb: ReturnType<typeof import("./supabase").sbServer>,
  token: string
): Promise<LinkValido | null> {
  if (!token || token.length < 20 || token.length > 100) return null;
  const { data } = await sb
    .from("cpcv_links_cliente")
    .select("id, processo_id, papel, criado_por, expira_em, revogado")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (!data || data.revogado || new Date(data.expira_em).getTime() < Date.now()) return null;
  return {
    id: data.id,
    processo_id: data.processo_id,
    papel: data.papel,
    criado_por: data.criado_por,
  };
}
