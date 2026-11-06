import Link from "next/link";
import { cookies } from "next/headers";
import { Formulario } from "@/components/Formulario";
import { campo, rotulo } from "@/components/ui";
import { TAMANHO_PIN } from "@/lib/pin";
import { sb } from "@/lib/supabase";
import { enviarCodigoPin, redefinirPin } from "../acoes";

export const dynamic = "force-dynamic";

const pinCampo = `${campo} numero text-center text-2xl tracking-[0.6em]`;

/** "pedro@acelabs.pt" -> "p****@acelabs.pt" (mostra para onde foi o código sem expor o email inteiro). */
function esconder(email: string): string {
  const [nome, dominio] = email.split("@");
  return `${nome.charAt(0)}${"*".repeat(Math.max(3, nome.length - 1))}@${dominio}`;
}

export default async function Redefinir({ searchParams }: { searchParams: { quem?: string; enviado?: string } }) {
  const s = sb();
  const { data } = await s.rpc("socios_para_entrar");
  const socios = (data ?? []) as { id: string; nome: string }[];
  const quem = searchParams.quem ?? cookies().get("torre_quem")?.value ?? "";
  const socio = socios.find((x) => x.id === quem);
  const enviado = Boolean(searchParams.enviado && socio);
  const { data: email } = enviado ? await s.rpc("email_do_socio", { p_id: socio!.id }) : { data: null };

  return (
    <main className="mx-auto max-w-sm space-y-6 px-5 pt-16">
      <div>
        <p className="text-xl font-bold tracking-tight text-tinta">
          Torre<span className="text-azul">.</span>
        </p>
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-tinta">Redefinir PIN</h1>
        <p className="mt-1 text-base text-secundario">
          {enviado ? `Enviámos um código para ${email ? esconder(String(email)) : "o teu email"}. Vale 15 minutos.` : "Enviamos um código para o teu email da Ace Labs."}
        </p>
      </div>

      <div className="rounded-3xl border border-linha bg-white p-5">
        {enviado ? (
          <Formulario key="codigo" acao={redefinirPin} botao="Guardar PIN e entrar" limpar={false}>
            <input type="hidden" name="quem" value={socio!.id} />
            <div>
              <label htmlFor="codigo" className={rotulo}>Código do email</label>
              <input id="codigo" name="codigo" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,12}" maxLength={12} required autoFocus className={`${campo} numero tracking-widest`} />
            </div>
            <div>
              <label htmlFor="nova" className={rotulo}>PIN novo ({TAMANHO_PIN} algarismos)</label>
              <input id="nova" name="nova" type="password" inputMode="numeric" autoComplete="new-password" pattern={`\\d{${TAMANHO_PIN}}`} maxLength={TAMANHO_PIN} required className={pinCampo} />
            </div>
            <div>
              <label htmlFor="repetir" className={rotulo}>Repetir</label>
              <input id="repetir" name="repetir" type="password" inputMode="numeric" autoComplete="new-password" pattern={`\\d{${TAMANHO_PIN}}`} maxLength={TAMANHO_PIN} required className={pinCampo} />
            </div>
          </Formulario>
        ) : (
          <Formulario key="enviar" acao={enviarCodigoPin} botao="Enviar código" limpar={false}>
            <div>
              <label htmlFor="quem" className={rotulo}>Quem és</label>
              <select id="quem" name="quem" required defaultValue={socio ? socio.id : ""} className={campo}>
                <option value="" disabled>Escolher</option>
                {socios.map((x) => (
                  <option key={x.id} value={x.id}>{x.nome}</option>
                ))}
              </select>
            </div>
          </Formulario>
        )}
      </div>

      <p className="flex justify-between text-sm">
        <Link href="/entrar" className="font-semibold text-azul">Voltar a entrar</Link>
        {enviado && <Link href="/redefinir" className="text-secundario">Não chegou? Pedir outro</Link>}
      </p>
    </main>
  );
}
