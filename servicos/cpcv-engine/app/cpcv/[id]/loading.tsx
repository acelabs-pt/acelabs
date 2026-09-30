export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-4 w-28 bg-[#E2E8F0] rounded" />

      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-6 w-56 bg-[#E2E8F0] rounded-lg" />
          <div className="h-4 w-40 bg-[#E2E8F0] rounded-lg" />
        </div>
        <div className="h-10 w-36 bg-[#E2E8F0] rounded-xl" />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="h-32 bg-white rounded-2xl border border-[#E2E8F0]" />
        <div className="h-32 bg-white rounded-2xl border border-[#E2E8F0]" />
      </div>

      <div className="h-40 bg-white rounded-2xl border border-[#E2E8F0]" />
      <div className="h-80 bg-white rounded-2xl border border-[#E2E8F0]" />
    </div>
  );
}
