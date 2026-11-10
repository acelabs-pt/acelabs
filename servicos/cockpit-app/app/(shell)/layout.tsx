import ConteudoShell from "@/components/ConteudoShell";
import Nav from "@/components/Nav";
import AcoesRapidas from "@/components/AcoesRapidas";
import ReportarProblema from "@/components/ReportarProblema";
import SincronizarTema from "@/components/SincronizarTema";
import { ToastProvider } from "@/components/Toast";

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background pb-20 print:bg-white md:pb-0 md:pl-56 print:pb-0 print:pl-0">
      <ToastProvider>
        <ConteudoShell>{children}</ConteudoShell>
      </ToastProvider>
      <SincronizarTema />
      <Nav />
      <AcoesRapidas />
      <ReportarProblema />
    </div>
  );
}
