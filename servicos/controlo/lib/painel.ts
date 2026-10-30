import type { EmpresaResumo, EstadoEmpresa } from "../supabase/functions/_shared/nucleo";

// Lógica de apresentação do Painel (sem rede): rótulos dos estados e os alertas de cada empresa.

export const ROTULO_ESTADO: Record<EstadoEmpresa, string> = {
  piloto: "Piloto",
  ativa: "Ativa",
  suspensa: "Suspensa",
  terminada: "Terminada",
};

export const COR_ESTADO: Record<EstadoEmpresa, string> = {
  piloto: "bg-azul-suave text-azul-escuro",
  ativa: "bg-verde-suave text-tinta",
  suspensa: "bg-ambar-fundo text-ambar-texto",
  terminada: "bg-black/5 text-secundario",
};

const DIA = 86_400_000;

export function diasDesde(iso: string | null, agora = Date.now()): number | null {
  return iso ? Math.floor((agora - new Date(iso).getTime()) / DIA) : null;
}

/**
 * O que merece atenção numa empresa, em linguagem simples. Só avalia empresas em piloto ou ativas: uma empresa suspensa ou
 * terminada não tem de ter atividade.
 */
export function alertasDe(e: EmpresaResumo, agora = Date.now()): string[] {
  if (e.estado === "suspensa" || e.estado === "terminada") return [];
  const a: string[] = [];
  const desdeInicio = diasDesde(e.inicio, agora) ?? 0;
  if (e.utilizadores === 0) {
    a.push("Ainda ninguém tem acesso: convida o primeiro utilizador.");
    return a;
  }
  if (e.convites_por_aceitar > 0 && desdeInicio >= 3) {
    a.push(e.convites_por_aceitar === 1 ? "1 convite por aceitar há mais de 3 dias." : `${e.convites_por_aceitar} convites por aceitar há mais de 3 dias.`);
  }
  const semEntrar = diasDesde(e.ultimo_acesso, agora);
  if (e.ultimo_acesso && semEntrar !== null && semEntrar >= 7) a.push(`Ninguém entra há ${semEntrar} dias.`);
  if (!e.ultimo_acesso && desdeInicio >= 3) a.push("Ninguém entrou ainda.");
  if (e.aparelhos === 0 && e.ultimo_acesso) a.push("Nenhum telemóvel com notificações.");
  return a;
}

export function data(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" }) : "nunca";
}

export function dataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const ACOES: Record<string, string> = {
  "empresa.criar": "Criou a empresa",
  "empresa.atualizar": "Atualizou os dados da empresa",
  "empresa.estado": "Mudou o estado da empresa",
  "empresa.apagar": "Apagou a empresa",
  "utilizador.criar": "Criou o utilizador",
  "utilizador.suspender": "Suspendeu o utilizador",
  "utilizador.reativar": "Reativou o utilizador",
  "utilizador.remover": "Apagou o utilizador",
};

/** Uma frase para o registo de ações, por exemplo "Criou o utilizador ana@x.pt". */
export function frase(acao: string, detalhe: Record<string, unknown>): string {
  const base = ACOES[acao] ?? acao;
  const extra = typeof detalhe.email === "string" ? ` ${detalhe.email}` : typeof detalhe.estado === "string" ? ` (${detalhe.estado})` : typeof detalhe.nome === "string" ? ` ${detalhe.nome}` : "";
  return base + extra;
}
