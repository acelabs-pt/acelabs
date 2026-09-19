// Classes de botão partilhadas por toda a secção /cpcv - mantém consistência visual
// (hover, foco, estado disabled, micro-interacção ao clicar) em vez de cada botão
// definir o seu próprio estilo ad-hoc.

const base =
  "inline-flex items-center justify-center gap-1.5 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";

// Acção principal neutra (Enviar, Guardar, Enviar à agente).
export const btnPrimary = `${base} rounded-xl bg-[#0F172A] text-white text-sm font-semibold px-4 py-2.5 shadow-sm hover:bg-[#1E293B] hover:shadow-md active:scale-[0.97] focus-visible:ring-[#0F172A]/30`;

// A acção mais importante do ecrã (Aprovar e gerar CPCV, Entrar, Criar conta).
export const btnAccent = `${base} rounded-xl bg-[#0071e3] text-white text-sm font-semibold px-4 py-2.5 shadow-sm hover:bg-[#0059b3] hover:shadow-md active:scale-[0.97] focus-visible:ring-[#0071e3]/40`;

// Acção secundária, contorno neutro (Pedir alterações, Gerar em branco).
export const btnSecondary = `${base} rounded-xl border border-[#E2E8F0] bg-white text-[#475569] text-sm font-medium px-4 py-2.5 hover:bg-[#F8FAFC] hover:border-[#CBD5E1] active:scale-[0.97] focus-visible:ring-[#0F172A]/20`;

// Acção secundária com destaque de marca (Descarregar PDF/Word).
export const btnAccentOutline = `${base} rounded-xl border border-[#0071e3] bg-white text-[#0071e3] text-sm font-semibold px-4 py-2.5 hover:bg-[#EFF6FF] active:scale-[0.97] focus-visible:ring-[#0071e3]/30`;

// Texto simples, sem fundo (Cancelar, Sair).
export const btnGhost = `${base} text-sm font-medium text-[#94A3B8] hover:text-[#475569] hover:bg-[#F8FAFC] rounded-lg px-3 py-2 focus-visible:ring-[#0F172A]/20`;

// Acção destrutiva discreta (Eliminar numa linha de tabela).
export const btnDanger = `${base} text-xs font-medium text-red-500 hover:text-white hover:bg-red-500 rounded-lg px-2.5 py-1 focus-visible:ring-red-500/30 disabled:hover:bg-transparent disabled:hover:text-red-500`;

// Link de texto dentro de tabelas/listas (Abrir).
export const btnLink =
  "text-[#2E6DB4] font-medium hover:text-[#0059B3] hover:underline underline-offset-2 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E6DB4]/30 rounded";

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
