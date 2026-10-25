import ConteudoShell from "@/components/ConteudoShell";
import Nav from "@/components/Nav";

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0 md:pl-56 print:pb-0 print:pl-0">
      <ConteudoShell>{children}</ConteudoShell>
      <Nav />
    </div>
  );
}
