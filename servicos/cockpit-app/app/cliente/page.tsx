import { redirect } from "next/navigation";
import { modoVariosClientes } from "@/lib/clientes";
import FormCliente from "./FormCliente";

// Primeiro arranque (e "mudar de cliente"): a pessoa escreve o código que recebeu da Ace Labs.
// Num deploy de cliente único não há nada a escolher.
export default function PaginaCliente() {
  if (!modoVariosClientes()) redirect("/login");
  return (
    <main className="flex min-h-[100dvh] items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <p className="flex items-center gap-2 text-sm font-medium text-secundario">
          <i className="h-2 w-2 rounded-full bg-verde shadow-[0_0_0_4px_rgba(31,174,90,0.16)]" />
          Ace Labs
        </p>
        <h1 className="mt-3 text-5xl font-extrabold leading-[1.02] tracking-tight text-tinta">Bem-vindo ao Cockpit.</h1>
        <p className="mt-4 text-base text-secundario">Escreve o código da tua empresa, que recebeste da Ace Labs.</p>
        <FormCliente />
      </div>
    </main>
  );
}
