import { FormLogin } from "@/components/Formularios";

export default function Login() {
  return (
    <div className="mx-auto max-w-sm space-y-6 pt-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-tinta">Entrar</h1>
        <p className="mt-1 text-base text-secundario">Controlo dos clientes da Ace Labs. Só para os sócios.</p>
      </div>
      <div className="rounded-3xl border border-linha bg-white p-5">
        <FormLogin />
      </div>
    </div>
  );
}
