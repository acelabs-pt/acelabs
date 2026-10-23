import Link from "next/link";
import Cartao from "@/components/dashboard/Cartao";
import { diaDeHoje } from "@/lib/angariacao";
import type { Dados } from "@/lib/painel";

// Uma linha por angariação ativa: onde vai o contrato (barra azul), quantas ações do plano estão feitas
// (barra verde por baixo) e se há ações em atraso. Primeiro as que terminam mais cedo.
export default function Carteira({ dados }: { dados: Dados }) {
  const linhas = dados.angariacoes
    .filter((a) => !a.vendido_em)
    .map((a) => {
      const dia = diaDeHoje(a.inicio);
      const r = dados.resumo[a.id];
      return { a, dia, restam: a.duracao_dias - dia + 1, total: r?.total ?? 0, feitas: r?.feitas ?? 0, emAtraso: r?.emAtraso ?? 0 };
    })
    .filter((l) => l.restam >= 0)
    .sort((x, y) => x.restam - y.restam);

  return (
    <Cartao titulo={`Angariações ativas (${linhas.length})`}>
      {linhas.length === 0 ? (
        <p className="text-sm text-secundario">Sem angariações ativas.</p>
      ) : (
        <ul className="space-y-3">
          {linhas.slice(0, 6).map(({ a, dia, restam, total, feitas, emAtraso }) => {
            const fracContrato = Math.max(0, Math.min(1, dia / a.duracao_dias));
            const fracFeitas = total > 0 ? feitas / total : 0;
            return (
              <li key={a.id}>
                <Link href={`/angariacoes/${a.id}`} className="block space-y-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium text-tinta">{a.titulo}</span>
                    <span className={`shrink-0 text-xs ${restam <= 30 ? "font-medium text-ambar-texto" : "text-secundario"}`}>
                      {dia < 1 ? "ainda não começou" : `${restam} dias para o fim`}
                    </span>
                  </div>
                  <div
                    className="space-y-0.5"
                    role="img"
                    aria-label={`Dia ${Math.max(dia, 0)} de ${a.duracao_dias}. ${feitas} de ${total} ações feitas.`}
                  >
                    <div className="h-1.5 overflow-hidden rounded-full bg-black/5">
                      <div className="h-full rounded-full bg-azul" style={{ width: `${fracContrato * 100}%` }} />
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-black/5">
                      <div className="h-full rounded-full bg-verde" style={{ width: `${fracFeitas * 100}%` }} />
                    </div>
                  </div>
                  <p className="flex flex-wrap gap-x-3 text-[11px] text-secundario">
                    <span>
                      <i className="mr-1 inline-block h-2 w-2 rounded-sm bg-azul" />
                      Dia {Math.max(dia, 0)} de {a.duracao_dias}
                    </span>
                    <span>
                      <i className="mr-1 inline-block h-2 w-2 rounded-sm bg-verde" />
                      {feitas} de {total} ações
                    </span>
                    {emAtraso > 0 && <span className="font-medium text-ambar-texto">{emAtraso} em atraso</span>}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {linhas.length > 6 && (
        <Link href="/angariacoes" className="block text-sm text-secundario underline">
          Ver todas
        </Link>
      )}
    </Cartao>
  );
}
