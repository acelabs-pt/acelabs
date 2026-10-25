// Barra de progresso face a um objetivo. A cor vai do vermelho (0%) ao verde (100%) passando pelo
// amarelo, a mesma escala da barra de motivação. A meio, a cor fica um pouco mais clara e mais quente
// (amarelo dourado) para não ler como castanho nem como amarelo vivo.
export function corDoProgresso(fracao: number): string {
  const f = Math.min(1, Math.max(0, fracao));
  const meio = Math.sin(Math.PI * f); // 0 nas pontas, 1 a meio
  return `hsl(${f * 120 - 10 * meio} ${70 + 5 * meio}% ${42 + 8 * meio}%)`;
}

// Versão mais escura da mesma cor, para texto pequeno sobre fundo branco.
export function corTextoDoProgresso(fracao: number): string {
  const f = Math.min(1, Math.max(0, fracao));
  return `hsl(${f * 120} 75% 32%)`;
}

export default function BarraProgresso({
  valor,
  objetivo,
  className = "mt-1 h-2",
}: {
  valor: number;
  objetivo: number;
  className?: string;
}) {
  const fracao = objetivo > 0 ? valor / objetivo : 0;
  return (
    <div className={`overflow-hidden rounded-full bg-black/5 ${className}`}>
      <div
        className="h-full rounded-full"
        style={{ width: `${Math.min(100, fracao * 100)}%`, backgroundColor: corDoProgresso(fracao) }}
      />
    </div>
  );
}
