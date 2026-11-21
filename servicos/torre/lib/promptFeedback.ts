import type { Reporte } from "@/lib/feedback";

const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-PT", { timeZone: "Europe/Lisbon", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

// Zona da app a partir da página onde o reporte foi feito.
export function zona(pagina: string | null): string {
  const p = pagina ?? "";
  if (p.startsWith("/calendario")) return "Calendário";
  if (p.startsWith("/crm/compradores")) return "Compradores";
  if (p.startsWith("/crm/proprietarios")) return "Proprietários";
  if (p.startsWith("/angariacoes")) return "Angariações";
  if (p.startsWith("/dashboard")) return "Dashboard";
  if (p.startsWith("/conta")) return "Conta";
  if (p.startsWith("/importar")) return "Importar";
  return "Outra";
}

/** Texto para colar no Claude Code: os reportes por resolver e o que fazer com cada um. */
export function promptParaClaude(nome: string, agencia: string | null, email: string, rs: Reporte[]): string {
  const linhas = rs.map((r, i) =>
    [
      `${i + 1}. [${r.id}] ${quando(r.criado_em)} · ${r.tipo === "erro" ? "erro" : "sugestão"} · ${zona(r.pagina)} (${r.pagina ?? "sem página"}) · estado ${r.estado}` +
        ` · captura: ${r.captura ? "sim" : "não"} · áudio: ${r.audio ? "sim" : "não"}`,
      r.texto ? `   "${r.texto.trim().replace(/\s+/g, " ")}"` : "   (sem texto)",
    ].join("\n")
  );
  return [
    `Reportes do Cockpit de ${nome}${agencia ? ` (${agencia})` : ""}, email ${email}: ${rs.length} por resolver.`,
    "",
    "Começa por me dar, em poucas linhas, um resumo do que esta pessoa está a pedir (temas, o que é bug e o que é sugestão).",
    "Depois trata os reportes um a um:",
    "1. Lê cada reporte e vê a captura: vêm da função ler-feedback (ver servicos/torre/lib/feedback.ts, segredo em servicos/torre/.env.local); filtra por este email. Se houver áudio, diz-me que não o consegues ouvir e usa o texto. Apaga as capturas depois de as veres (podem ter dados de clientes).",
    "2. Encaixa cada um em servicos/cockpit-app/PLANO-FEEDBACK.md: junta-o a um ponto que já exista ou cria um novo (B bug, R melhoria rápida, F funcionalidade). Responde-me numa linha por reporte: o que é, o ponto do plano e o que vais fazer.",
    "3. Corrige pela ordem do plano (bugs primeiro). Testa no browser com uma conta de teste temporária e dados inventados no projeto partilhado, e apaga tudo no fim. Marca o ponto como feito no plano.",
    "4. Se algum ponto pedir uma decisão minha, pergunta antes de o fazer e segue para o próximo.",
    "5. No fim: pede-me autorização para commit, push e deploy do Cockpit; depois marca os reportes como resolvidos (ou vistos, se ficarem para depois) na Torre; faz o relatório antes e depois (página ao lado e PDF em business-center/cockpit-beta/feedback/), com capturas das duas versões e dados inventados; e dá-me uma mensagem curta, pronta a mandar ao tester, com o que mudou.",
    "",
    "Reportes por resolver:",
    ...linhas,
  ].join("\n");
}

