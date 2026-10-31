export default function Cartao({
  titulo,
  acao,
  children,
  id,
}: {
  id?: string;
  titulo: string;
  acao?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-4 space-y-3 rounded-3xl border border-linha bg-white p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-tinta">{titulo}</h2>
        {acao}
      </div>
      {children}
    </section>
  );
}
