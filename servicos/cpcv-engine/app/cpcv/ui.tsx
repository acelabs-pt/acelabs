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

// Paleta de acento por secção - usa as três cores da marca (ver OrbIA abaixo) para dar
// identidade visual própria a cada grupo de documentos (imóvel/proprietário/comprador em
// app/cpcv/novo e app/cpcv/[id]/DadosPartes.tsx), em vez de tudo cinzento/azul-neutro igual.
// As classes ficam escritas por extenso (não construídas por interpolação de string) porque o
// Tailwind só gera uma cor arbitrária `bg-[#...]` se a vir literalmente no código-fonte.
export type CorSecao = "azul" | "ambar" | "verde" | "neutro";

export const CORES_SECAO: Record<
  CorSecao,
  {
    hex: string;
    badgeBg: string;
    badgeText: string;
    topo: string;
    icone: string;
    link: string;
    anel: string;
    chipBg: string;
    chipTexto: string;
  }
> = {
  azul: {
    hex: "#0071E3",
    badgeBg: "bg-[#0071E3]",
    badgeText: "text-white",
    topo: "border-t-[#0071E3]",
    icone: "text-[#0071E3]",
    link: "text-[#0071E3] hover:text-[#0059B3]",
    anel: "focus:ring-[#0071E3]",
    chipBg: "bg-[#EFF6FF]",
    chipTexto: "text-[#0059B3]",
  },
  ambar: {
    hex: "#FF9F0A",
    badgeBg: "bg-[#FF9F0A]",
    badgeText: "text-white",
    topo: "border-t-[#FF9F0A]",
    icone: "text-[#CC7A00]",
    link: "text-[#CC7A00] hover:text-[#9A5B00]",
    anel: "focus:ring-[#FF9F0A]",
    chipBg: "bg-[#FFF4E5]",
    chipTexto: "text-[#9A5B00]",
  },
  verde: {
    hex: "#1FAE5A",
    badgeBg: "bg-[#1FAE5A]",
    badgeText: "text-white",
    topo: "border-t-[#1FAE5A]",
    icone: "text-[#15803D]",
    link: "text-[#1FAE5A] hover:text-[#15803D]",
    anel: "focus:ring-[#1FAE5A]",
    chipBg: "bg-[#ECFDF3]",
    chipTexto: "text-[#15803D]",
  },
  neutro: {
    hex: "#94A3B8",
    badgeBg: "bg-[#64748B]",
    badgeText: "text-white",
    topo: "border-t-[#E2E8F0]",
    icone: "text-[#64748B]",
    link: "text-[#2E6DB4] hover:text-[#0059B3]",
    anel: "focus:ring-[#2E6DB4]",
    chipBg: "bg-[#F1F5F9]",
    chipTexto: "text-[#475569]",
  },
};

// Cabeçalho de secção colorido (ícone + título + subtítulo opcional) - usado para as três
// categorias de documentos em app/cpcv/novo e no título de app/cpcv/[id]/DadosPartes.tsx.
export function CabecalhoSecao({
  cor,
  icone,
  titulo,
  subtitulo,
}: {
  cor: CorSecao;
  icone: React.ReactNode;
  titulo: string;
  subtitulo?: string;
}) {
  const c = CORES_SECAO[cor];
  return (
    <div className="flex items-center gap-2.5">
      <span className={`flex h-8 w-8 items-center justify-center rounded-full ${c.badgeBg} ${c.badgeText} shrink-0`}>
        {icone}
      </span>
      <div>
        <h3 className="text-sm font-semibold text-[#0F172A] leading-tight">{titulo}</h3>
        {subtitulo && <p className="text-[11px] text-[#94A3B8] leading-tight">{subtitulo}</p>}
      </div>
    </div>
  );
}

export const IconesSecao = {
  predio: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M5 21V5.5a1 1 0 011-1h6.5a1 1 0 011 1V21M5 21h13M5 21H3M18 21h2M12.5 21V10.5a1 1 0 011-1H18a1 1 0 011 1V21M8 8h1.5M8 11.5h1.5M8 15h1.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  chave: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <circle cx="8" cy="15.5" r="3.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M10.3 13.2 17 6.5M14.5 9l2 2M17.5 6l2 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  carrinho: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M3.5 4.5h2l2.4 11.2a1.5 1.5 0 001.47 1.2h7.6a1.5 1.5 0 001.47-1.18L20 8.5H6.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="10" cy="20" r="1.3" fill="currentColor" />
      <circle cx="17" cy="20" r="1.3" fill="currentColor" />
    </svg>
  ),
  caixa: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M4 7.5 12 4l8 3.5-8 3.5-8-3.5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M4 7.5V16l8 3.5V11M20 7.5V16l-8 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  ),
};

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// Texto com um brilho em gradiente a percorrer da esquerda para a direita, em loop - o
// padrão que produtos de IA actuais (ChatGPT, Vercel AI SDK, ElevenLabs UI) usam para
// sinalizar "a processar" em vez de "parado à espera", em vez de um spinner genérico. Usar
// só nos momentos em que se está mesmo à espera da IA (extracção, resposta no chat,
// geração do documento), nunca em acções mecânicas (guardar, autenticar). `tom="escuro"`
// para texto branco em cima de fundo escuro/de cor (btnPrimary, btnAccent); `tom="claro"`
// para o resto (bolha da IA, botões de fundo branco).
export function TextoShimmer({
  children,
  tom = "claro",
  className = "",
}: {
  children: React.ReactNode;
  tom?: "claro" | "escuro";
  className?: string;
}) {
  const gradiente =
    tom === "escuro"
      ? "linear-gradient(90deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.55) 40%, #fff 50%, rgba(255,255,255,0.55) 60%, rgba(255,255,255,0.55) 100%)"
      : "linear-gradient(90deg, #94A3B8 0%, #94A3B8 40%, #0071e3 50%, #94A3B8 60%, #94A3B8 100%)";

  return (
    <span
      className={`bg-clip-text text-transparent bg-[length:250%_100%] animate-shimmer ${className}`}
      style={{ backgroundImage: gradiente }}
    >
      {children}
    </span>
  );
}

// Estado vazio com um pouco de peso visual (ícone + texto), em vez de uma linha de texto
// cinzento sozinha - um "sem nada ainda" só de texto é dos sinais mais óbvios de interface
// por acabar. Usar sempre com um dos ícones de IconesVazio abaixo.
export function EstadoVazio({ icon, texto }: { icon: React.ReactNode; texto: string }) {
  return (
    <div className="flex items-center gap-2.5 py-1.5 text-xs text-[#94A3B8]">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F1F5F9] text-[#CBD5E1] shrink-0">
        {icon}
      </span>
      {texto}
    </div>
  );
}

export const IconesVazio = {
  pessoa: (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
      <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  documento: (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
      <path d="M7 3.5h7l3.5 3.5V20a.5.5 0 01-.5.5H7a.5.5 0 01-.5-.5V4a.5.5 0 01.5-.5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9.5 13h5M9.5 16.3h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  bandeja: (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
      <path
        d="M4 12.5h4.2l1.3 2.3h4.9l1.3-2.3H20M5.5 6.5h13l1.5 6.5v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6l1.5-6.5z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  ),
};

// Pequeno "orbe" em gradiente cónico (azul/verde/âmbar da marca) a rodar devagar, com um
// halo desfocado a pulsar por trás - o mesmo tipo de gradiente animado usado em galerias
// como godly.design para dar uma sensação de "IA viva", sem precisar de WebGL/Three.js, só
// CSS (conic-gradient + blur + duas animações do Tailwind definidas em tailwind.config.ts).
export function OrbIA({ className = "" }: { className?: string }) {
  const gradienteMarca = "conic-gradient(from 0deg, #0071e3, #1fae5a, #ff9f0a, #0071e3)";
  return (
    <span className={`relative inline-flex h-4 w-4 items-center justify-center shrink-0 ${className}`} aria-hidden="true">
      <span className="absolute inset-0 rounded-full blur-[5px] animate-pulsar-glow" style={{ background: gradienteMarca }} />
      <span className="relative h-2.5 w-2.5 rounded-full animate-spin-lento" style={{ background: gradienteMarca }} />
    </span>
  );
}
