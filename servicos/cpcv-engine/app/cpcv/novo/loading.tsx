export default function Loading() {
  return (
    <div className="max-w-xl mx-auto space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-6 w-40 bg-[#E2E8F0] rounded-lg" />
        <div className="h-4 w-full bg-[#E2E8F0] rounded-lg" />
      </div>
      <div className="h-96 bg-white rounded-2xl border border-[#E2E8F0]" />
    </div>
  );
}
