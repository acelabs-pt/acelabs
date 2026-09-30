// Next.js mostra isto de imediato durante a navegação, enquanto a página (Server Component)
// ainda está a buscar dados - sem isto a troca de página deixava um instante em branco.
export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="h-6 w-48 bg-[#E2E8F0] rounded-lg" />
          <div className="h-4 w-64 bg-[#E2E8F0] rounded-lg" />
        </div>
        <div className="h-10 w-32 bg-[#E2E8F0] rounded-xl" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 bg-white rounded-2xl border border-[#E2E8F0]" />
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="h-72 bg-white rounded-2xl border border-[#E2E8F0]" />
        <div className="h-72 bg-white rounded-2xl border border-[#E2E8F0]" />
      </div>

      <div className="h-64 bg-white rounded-2xl border border-[#E2E8F0]" />
    </div>
  );
}
