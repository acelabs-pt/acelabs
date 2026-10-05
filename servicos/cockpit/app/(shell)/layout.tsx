import TabBar from "@/components/TabBar";

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background pb-20">
      {children}
      <TabBar />
    </div>
  );
}
