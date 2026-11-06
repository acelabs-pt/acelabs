import { Formulario } from "@/components/Formulario";
import { campo, rotulo } from "@/components/ui";
import { TAMANHO_PIN } from "@/lib/pin";
import { mudarPin, sair } from "@/app/acoes";

const pinCampo = `${campo} numero text-center text-2xl tracking-[0.6em]`;

/** Primeira entrada com o PIN temporário: tem de escolher o seu antes de ver o que quer que seja. */
export default function EscolherPin({ nome }: { nome: string }) {
  return (
    <main className="mx-auto max-w-sm space-y-6 px-5 pt-16">
      <div>
        <p className="text-xl font-bold tracking-tight text-tinta">
          Torre<span className="text-azul">.</span>
        </p>
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-tinta">Bem-vindo, {nome}</h1>
        <p className="mt-1 text-base text-secundario">Escolhe o PIN que quiseres. É com ele que entras da próxima vez.</p>
      </div>
      <div className="rounded-3xl border border-linha bg-white p-5">
        <Formulario acao={mudarPin} botao="Guardar PIN e entrar" limpar={false}>
          <div>
            <label htmlFor="nova" className={rotulo}>O teu PIN ({TAMANHO_PIN} algarismos)</label>
            <input id="nova" name="nova" type="password" inputMode="numeric" autoComplete="new-password" pattern={`\\d{${TAMANHO_PIN}}`} maxLength={TAMANHO_PIN} required autoFocus className={pinCampo} />
          </div>
          <div>
            <label htmlFor="repetir" className={rotulo}>Repetir</label>
            <input id="repetir" name="repetir" type="password" inputMode="numeric" autoComplete="new-password" pattern={`\\d{${TAMANHO_PIN}}`} maxLength={TAMANHO_PIN} required className={pinCampo} />
          </div>
          <p className="text-sm text-secundario">Sem algarismos todos iguais nem seguidos (como 123456).</p>
        </Formulario>
      </div>
      <form action={sair} className="text-center">
        <button className="text-sm font-semibold text-secundario hover:text-tinta">Sair</button>
      </form>
    </main>
  );
}
