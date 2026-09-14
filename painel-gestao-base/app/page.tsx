export default function Home() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-bold text-[#0F172A]">Painel de Gestão</h1>
        <p className="text-sm text-[#94A3B8] mt-1">Substituir por um resumo das secções do cliente</p>
      </div>
      <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-12 text-center">
        <p className="text-sm font-semibold text-[#0F172A]">Página inicial de exemplo</p>
        <p className="text-xs text-[#94A3B8] mt-1 max-w-xs mx-auto">
          Ver components/AppLayout.tsx para o padrão de navegação usado nas secções.
        </p>
      </div>
    </div>
  );
}
