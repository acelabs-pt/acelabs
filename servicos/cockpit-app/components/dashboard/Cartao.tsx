// Cartão do Dashboard: cabeçalho próprio (ícone, título e, à direita, uma ação) separado do corpo por uma linha.
// "plano" tira a superfície (para blocos que vivam dentro de outro cartão).
export default function Cartao({
  titulo,
  acao,
  icone,
  tom = "azul",
  plano = false,
  children,
}: {
  titulo: string;
  acao?: React.ReactNode;
  icone?: React.ReactNode;
  tom?: "azul" | "ambar";
  plano?: boolean;
  children: React.ReactNode;
}) {
  if (plano) {
    return (
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-tinta">{titulo}</h2>
          {acao}
        </div>
        {children}
      </section>
    );
  }
  return (
    <section className="min-w-0 overflow-hidden rounded-[20px] border border-linha bg-white shadow-[0_2px_14px_rgba(20,50,100,0.06)]">
      <header className="flex items-center gap-3 border-b border-linha px-4 py-3.5 sm:px-5">
        {icone && (
          <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-[10px] ${tom === "ambar" ? "bg-ambar-fundo text-ambar-texto" : "bg-azul-suave text-azul"}`}>{icone}</span>
        )}
        <h2 className="min-w-0 flex-1 text-base font-bold text-tinta">{titulo}</h2>
        {acao}
      </header>
      <div className="space-y-3 p-4 sm:p-5">{children}</div>
    </section>
  );
}
