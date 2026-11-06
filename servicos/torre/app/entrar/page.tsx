import Link from "next/link";
import { cookies } from "next/headers";
import { Formulario } from "@/components/Formulario";
import { campo, rotulo } from "@/components/ui";
import { TAMANHO_PIN } from "@/lib/pin";
import { sb } from "@/lib/supabase";
import { entrar } from "../acoes";

export const dynamic = "force-dynamic";

export default async function Entrar({ searchParams }: { searchParams: { "sem-acesso"?: string } }) {
  // Só os nomes dos sócios ativos (função da base de dados, sem emails).
  const { data } = await sb().rpc("socios_para_entrar");
  const socios = (data ?? []) as { id: string; nome: string }[];
  const ultimo = cookies().get("torre_quem")?.value;
  const escolhido = socios.some((x) => x.id === ultimo) ? ultimo : "";

  return (
    <main className="mx-auto max-w-sm space-y-6 px-5 pt-16">
      <div>
        <p className="text-xl font-bold tracking-tight text-tinta">
          Torre<span className="text-azul">.</span>
        </p>
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-tinta">Entrar</h1>
        <p className="mt-1 text-base text-secundario">Gestão interna da Ace Labs. Só para os sócios.</p>
      </div>
      {searchParams["sem-acesso"] && <p className="rounded-xl bg-ambar-fundo px-4 py-3 text-sm text-ambar-texto">Esta conta não tem acesso à Torre.</p>}
      <div className="rounded-3xl border border-linha bg-white p-5">
        <Formulario acao={entrar} botao="Entrar" limpar={false}>
          <div>
            <label htmlFor="quem" className={rotulo}>Quem és</label>
            <select id="quem" name="quem" required defaultValue={escolhido} className={campo}>
              <option value="" disabled>Escolher</option>
              {socios.map((x) => (
                <option key={x.id} value={x.id}>{x.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="pin" className={rotulo}>PIN</label>
            <input
              id="pin"
              name="pin"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              pattern={`\\d{${TAMANHO_PIN}}`}
              maxLength={TAMANHO_PIN}
              minLength={TAMANHO_PIN}
              required
              autoFocus={Boolean(escolhido)}
              placeholder={"•".repeat(TAMANHO_PIN)}
              className={`${campo} numero text-center text-2xl tracking-[0.6em] placeholder:tracking-[0.6em] placeholder:text-black/20`}
            />
            <p className="mt-1 text-sm text-secundario">{TAMANHO_PIN} algarismos.</p>
          </div>
        </Formulario>
      </div>
      <p className="text-center text-sm">
        <Link href="/redefinir" className="font-semibold text-azul">Esqueci-me do PIN</Link>
      </p>
    </main>
  );
}
