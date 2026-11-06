import { exigirSocio } from "@/lib/sessao";
import { TAMANHO_PIN } from "@/lib/pin";
import { mudarPin } from "../../acoes";
import { Formulario } from "@/components/Formulario";
import { Cartao, Titulo, campo, rotulo } from "@/components/ui";

const pinCampo = `${campo} numero max-w-[14rem] text-center text-2xl tracking-[0.6em]`;

export default async function MudarPin() {
  const { socio } = await exigirSocio();
  return (
    <>
      <Titulo titulo="Mudar PIN" texto={`Conta de ${socio.nome} (${socio.email ?? "sem email"}).`} />
      <Cartao titulo="Novo PIN">
        <Formulario acao={mudarPin} botao="Mudar PIN">
          <div>
            <label htmlFor="nova" className={rotulo}>Novo PIN ({TAMANHO_PIN} algarismos)</label>
            <input id="nova" name="nova" type="password" inputMode="numeric" autoComplete="new-password" pattern={`\\d{${TAMANHO_PIN}}`} maxLength={TAMANHO_PIN} required className={pinCampo} />
          </div>
          <div>
            <label htmlFor="repetir" className={rotulo}>Repetir</label>
            <input id="repetir" name="repetir" type="password" inputMode="numeric" autoComplete="new-password" pattern={`\\d{${TAMANHO_PIN}}`} maxLength={TAMANHO_PIN} required className={pinCampo} />
          </div>
          <p className="text-sm text-secundario">Sem algarismos todos iguais nem seguidos (como 123456).</p>
        </Formulario>
      </Cartao>
    </>
  );
}
