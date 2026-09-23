import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { sbUserServer } from "@/lib/supabase-server";
import LogoutButton from "./LogoutButton";

const ROLE_LABEL: Record<string, string> = {
  gestora: "Gestora de processos",
  admin: "Administrador",
};

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
      <header className="min-h-14 flex items-center justify-between gap-3 px-4 sm:px-6 py-2 bg-[#0F172A] text-white">
        <span className="flex items-baseline gap-1.5 shrink-0">
          <span className="font-bold text-sm tracking-wide">cpcv_engine</span>
          <span className="hidden sm:inline text-[10px] text-white/40">Powered by Ace Labs</span>
        </span>
        <div className="flex items-center gap-2 sm:gap-4 text-xs min-w-0">
          {perfil && (
            <span className="text-white/70 truncate">
              {perfil.nome}
              <span className="hidden sm:inline">
                {" "}
                · {ROLE_LABEL[perfil.role] ?? "Agente imobiliário"}
              </span>
            </span>
          )}
          {perfil?.role === "admin" && (
            <Link href="/cpcv/admin" className="text-white/70 hover:text-white transition-colors">
              Administração
            </Link>
          )}
          <LogoutButton />
        </div>
      </header>
      <main className="p-6 max-w-5xl mx-auto">{children}</main>
      <footer className="py-6 text-center text-[10px] text-[#94A3B8]">Powered by Ace Labs</footer>
    </div>
  );
}
