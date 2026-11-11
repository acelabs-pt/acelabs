// Feedback que os testers deixam no Cockpit ("Reportar um problema": texto, captura, áudio). Vive no Supabase do Cockpit; a Torre
// lê-o através da função ler-feedback (cockpit-app/supabase/functions/ler-feedback), com um segredo partilhado. A chave de
// administrador do Cockpit nunca vem para a Torre.

export type Reporte = {
  id: string;
  criado_em: string;
  tipo: "erro" | "sugestao";
  texto: string | null;
  pagina: string | null;
  estado: "novo" | "visto" | "resolvido";
  versao: string | null;
  aparelho: Record<string, unknown> | null;
  empresa: string | null;
  email: string | null;
  captura: string | null;
  audio: string | null;
};

export function feedbackConfigurado(): boolean {
  return Boolean(process.env.COCKPIT_FEEDBACK_URL && process.env.COCKPIT_FEEDBACK_TOKEN);
}

export async function lerFeedback(): Promise<{ reportes: Reporte[]; erro?: string }> {
  if (!feedbackConfigurado()) return { reportes: [], erro: "sem-configuracao" };
  try {
    const r = await fetch(process.env.COCKPIT_FEEDBACK_URL!, { headers: { "x-torre-token": process.env.COCKPIT_FEEDBACK_TOKEN! }, cache: "no-store" });
    if (!r.ok) return { reportes: [], erro: r.status === 401 ? "O segredo não bate com o do Cockpit." : `A função respondeu ${r.status}.` };
    const j = (await r.json()) as { feedback?: Reporte[] };
    return { reportes: j.feedback ?? [] };
  } catch {
    return { reportes: [], erro: "Não foi possível ligar ao Cockpit." };
  }
}

export async function marcarFeedback(id: string, estado: Reporte["estado"]): Promise<boolean> {
  if (!feedbackConfigurado()) return false;
  try {
    const r = await fetch(process.env.COCKPIT_FEEDBACK_URL!, {
      method: "POST",
      headers: { "x-torre-token": process.env.COCKPIT_FEEDBACK_TOKEN!, "content-type": "application/json" },
      body: JSON.stringify({ id, estado }),
    });
    return r.ok;
  } catch {
    return false;
  }
}
