"use client";

// Botão de um formulário que pede confirmação antes de avançar (apagar não se desfaz).
export default function BotaoConfirmar({ texto, pergunta, className }: { texto: string; pergunta: string; className?: string }) {
  return (
    <button
      type="submit"
      className={className ?? "min-h-[44px] rounded-full px-4 text-sm font-semibold text-ambar-texto hover:bg-ambar-fundo"}
      onClick={(e) => {
        if (!window.confirm(pergunta)) e.preventDefault();
      }}
    >
      {texto}
    </button>
  );
}
