import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { sbUserServer } from "@/lib/supabase-server";
import LogoutButton from "./LogoutButton";

export default async function CpcvLayout({ children }: { children: React.ReactNode }) {
  const supabase = await sbUserServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Sem sessão: /cpcv/login e /cpcv/registo tratam do seu próprio layout de
  // ecrã inteiro - não meter cabeçalho por cima.
  if (!user) {
    return <>{children}</>;
  }

  // Já com sessão activa: não faz sentido mostrar o formulário de login/registo
  // por baixo do cabeçalho - manda logo para o dashboard.
  const pathname = (await headers()).get("x-pathname") ?? "";
  if (pathname.startsWith("/cpcv/login") || pathname.startsWith("/cpcv/registo")) {
    redirect("/cpcv");
  }

  const { data: perfil } = await supabase
    .from("profiles")
    .select("nome, role")
    .eq("id", user.id)
    .single();

  return (
    <div className="min-h-screen bg-[#F4F3EF]">
      <header className="h-14 flex items-center justify-between px-6 bg-[#0F172A] text-white">
        <span className="font-bold text-sm tracking-wide">CPCV com IA</span>
        <div className="flex items-center gap-4 text-xs">
          {perfil && (
            <span className="text-white/70">
              {perfil.nome} · {perfil.role === "gestora" ? "Gestora de processos" : "Agente imobiliário"}
            </span>
          )}
          <LogoutButton />
        </div>
      </header>
      <main className="p-6 max-w-5xl mx-auto">{children}</main>
      <footer className="py-6 text-center text-[10px] text-[#94A3B8]">Powered by Ace Labs</footer>
    </div>
  );
}
