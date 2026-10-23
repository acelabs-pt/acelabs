import Nav from "@/components/Nav";
import AcoesRapidas from "@/components/AcoesRapidas";

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0 md:pl-56 print:pb-0 print:pl-0">
      <div className="mx-auto max-w-5xl p-4 md:p-8">{children}</div>
      <Nav />
      <AcoesRapidas />
    </div>
  );
}
