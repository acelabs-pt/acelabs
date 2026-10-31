"use client";

// Botão de um formulário que pede confirmação antes de avançar (apagar uma conta não se desfaz).
export default function BotaoConfirmar({ texto, pergunta, className }: { texto: string; pergunta: string; className?: string }) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(pergunta)) e.preventDefault();
      }}
    >
      {texto}
    </button>
  );
}
