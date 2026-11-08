// Aspeto da app: claro, escuro ou automático (segue o modo do telemóvel ou do computador).
// A escolha fica guardada neste aparelho (localStorage, para aplicar antes de a página aparecer) e na conta (user_metadata.tema,
// para acompanhar o agente noutros aparelhos). O CSS lê o atributo data-tema="escuro" no <html> (ver app/globals.css).
export type Tema = "claro" | "escuro" | "auto";

export const CHAVE_TEMA = "cockpit-tema";

export const TEMAS: { id: Tema; rotulo: string }[] = [
  { id: "claro", rotulo: "Claro" },
  { id: "escuro", rotulo: "Escuro" },
  { id: "auto", rotulo: "Automático" },
];

export function temaGuardado(): Tema {
  try {
    const v = localStorage.getItem(CHAVE_TEMA);
    return v === "escuro" || v === "auto" ? v : "claro";
  } catch {
    return "claro";
  }
}

export function aplicarTema(tema: Tema): void {
  const escuro = tema === "escuro" || (tema === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.setAttribute("data-tema", escuro ? "escuro" : "claro");
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", escuro ? "#0b0f17" : "#0071e3");
  try {
    localStorage.setItem(CHAVE_TEMA, tema);
  } catch {}
}
