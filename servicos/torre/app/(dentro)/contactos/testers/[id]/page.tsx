import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirSocio } from "@/lib/sessao";
import { data } from "@/lib/texto";
import { ROTULO_TESTER, type Tester } from "@/lib/tipos";
import { apagarTester, converterTester, guardarTester } from "../../../../acoes";
import { Formulario } from "@/components/Formulario";
import BotaoConfirmar from "@/components/BotaoConfirmar";
import { Cartao, Etiqueta, Titulo, campo, rotulo } from "@/components/ui";

export default async function Tester({ params }: { params: { id: string } }) {
  const { s } = await exigirSocio();
  const { data: linha } = await s.from("testers").select("*").eq("id", params.id).maybeSingle();
  if (!linha) notFound();
  const x = linha as Tester;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/contactos?ver=testers" className="text-sm font-semibold text-azul">Testers</Link>
      </div>
      <Titulo titulo={x.nome} texto={[x.agencia, `testa de ${data(x.inicio)} a ${data(x.fim)}`].filter(Boolean).join(", ")}>
        <Etiqueta cor={ROTULO_TESTER[x.estado].cor}>{ROTULO_TESTER[x.estado].texto}</Etiqueta>
      </Titulo>

      <Cartao titulo="Dados e feedback">
        <Formulario acao={guardarTester} botao="Guardar" limpar={false}>
          <input type="hidden" name="id" value={x.id} />
          <div className="grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
            <div>
              <label htmlFor="t-nome" className={rotulo}>Nome</label>
              <input id="t-nome" name="nome" required defaultValue={x.nome} className={campo} />
            </div>
            <div>
              <label htmlFor="t-agencia" className={rotulo}>Agência</label>
              <input id="t-agencia" name="agencia" defaultValue={x.agencia ?? ""} className={campo} />
            </div>
            <div>
              <label htmlFor="t-email" className={rotulo}>Email</label>
              <input id="t-email" name="email" type="email" defaultValue={x.email ?? ""} className={campo} />
            </div>
            <div>
              <label htmlFor="t-tel" className={rotulo}>Contacto</label>
              <input id="t-tel" name="telemovel" inputMode="tel" defaultValue={x.telemovel ?? ""} className={campo} />
            </div>
            <div>
              <label htmlFor="t-estado" className={rotulo}>Estado</label>
              <select id="t-estado" name="estado" defaultValue={x.estado} className={campo}>
                {Object.entries(ROTULO_TESTER).map(([k, v]) => (
                  <option key={k} value={k}>{v.texto}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="t-inicio" className={rotulo}>Começou</label>
                <input id="t-inicio" name="inicio" type="date" defaultValue={x.inicio} className={campo} />
              </div>
              <div>
                <label htmlFor="t-fim" className={rotulo}>Testa até</label>
                <input id="t-fim" name="fim" type="date" defaultValue={x.fim} className={campo} />
              </div>
            </div>
            <div className="flex flex-col justify-end gap-2 sm:col-span-2">
              <label className="flex items-center gap-2 text-base text-tinta"><input type="checkbox" name="tabela_enviada" defaultChecked={x.tabela_enviada} className="h-5 w-5" /> Já enviou a tabela de clientes</label>
              <label className="flex items-center gap-2 text-base text-tinta"><input type="checkbox" name="dados_importados" defaultChecked={x.dados_importados} className="h-5 w-5" /> Os dados já foram importados</label>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="t-feedback" className={rotulo}>Feedback e notas</label>
              <textarea id="t-feedback" name="feedback" rows={5} defaultValue={x.feedback ?? ""} className={campo} placeholder="O que gostou, o que falta, o que correu mal..." />
            </div>
          </div>
        </Formulario>
      </Cartao>

      <Cartao titulo="Passar a cliente">
        {x.entidade_id ? (
          <p className="text-base text-secundario">
            Já é cliente. <Link href={`/contactos/${x.entidade_id}`} className="font-semibold text-azul">Abrir a ficha</Link>
          </p>
        ) : (
          <form action={converterTester} className="space-y-3">
            <p className="text-base text-secundario">Cria a ficha de cliente ({x.agencia || x.nome}) e leva-te lá para registares o contrato do Cockpit.</p>
            <input type="hidden" name="id" value={x.id} />
            <button type="submit" className="inline-flex min-h-[44px] items-center rounded-full bg-azul px-5 text-base font-semibold text-white hover:bg-azul-escuro">Passar a cliente</button>
          </form>
        )}
      </Cartao>

      <form action={apagarTester}>
        <input type="hidden" name="id" value={x.id} />
        <BotaoConfirmar texto="Apagar tester" pergunta="Apagar este tester e o feedback dele?" />
      </form>
    </>
  );
}
