import Link from "next/link";
import { exigirSocio } from "@/lib/sessao";
import { carregar } from "@/lib/dados";
import Importar from "@/components/Importar";
import { Titulo, Vazio } from "@/components/ui";

export default async function ImportarExtrato() {
  const { s } = await exigirSocio();
  const t = await carregar(s);
  return (
    <>
      <Titulo titulo="Importar extrato" texto="CSV exportado do banco. Linhas já importadas ficam de fora sozinhas, por isso podes voltar a carregar extratos que se sobrepõem.">
        <Link href="/movimentos" className="text-base font-semibold text-azul">Voltar</Link>
      </Titulo>
      {t.contas.length ? (
        <Importar contas={t.contas} regras={t.regras} categorias={t.categorias} />
      ) : (
        <Vazio texto="Primeiro cria a conta a que o extrato pertence." link="/definicoes" rotuloLink="Definições" />
      )}
    </>
  );
}
