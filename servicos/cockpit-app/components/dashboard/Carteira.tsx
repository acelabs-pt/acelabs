import Link from "next/link";
import Cartao from "@/components/dashboard/Cartao";
import { diaDeHoje } from "@/lib/angariacao";
import type { Dados } from "@/lib/painel";

// Uma linha por angariação ativa: onde vai o contrato (azul, com um ponto no "hoje"), quanto do plano de ações
// está feito (verde) e se há ações em atraso. Primeiro as que terminam mais cedo.
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
        <ul className="space-y-5">
          {linhas.slice(0, 6).map(({ a, dia, restam, total, feitas, emAtraso }, i) => {
            const fracContrato = Math.max(0, Math.min(1, dia / a.duracao_dias));
            const fracFeitas = total > 0 ? feitas / total : 0;
            const curto = restam <= 30;
            return (
              <li key={a.id}>
                <Link href={`/angariacoes/${a.id}`} className="block space-y-2 rounded-2xl hover:bg-black/[0.02]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-tinta">{a.titulo}</span>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                        curto ? "bg-ambar-fundo text-ambar-texto" : "bg-black/[0.05] text-secundario"
                      }`}
                    >
                      {dia < 1 ? "ainda não começou" : `${restam} dias`}
                    </span>
                  </div>

                  <div role="img" aria-label={`Dia ${Math.max(dia, 0)} de ${a.duracao_dias}. ${feitas} de ${total} ações feitas.`} className="space-y-1.5">
                    <div className="relative h-2.5 rounded-full bg-black/[0.05]">
                      <div className="anim-barra h-full rounded-full bg-azul" style={{ width: `${fracContrato * 100}%`, animationDelay: `${i * 70}ms` }} />
                      {dia >= 1 && (
                        <span
                          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-azul shadow-sm"
                          style={{ left: `${fracContrato * 100}%` }}
                        />
                      )}
                    </div>
                    <div className="h-1.5 rounded-full bg-black/[0.05]">
                      <div className="anim-barra h-full rounded-full bg-verde" style={{ width: `${fracFeitas * 100}%`, animationDelay: `${i * 70 + 100}ms` }} />
                    </div>
                  </div>

                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-secundario">
                    <span>
                      Dia <b className="text-tinta">{Math.max(dia, 0)}</b> de {a.duracao_dias}
                    </span>
                    <span>
                      <b className="text-tinta">{total > 0 ? Math.round(fracFeitas * 100) : 0}%</b> do plano ({feitas} de {total})
                    </span>
                    {emAtraso > 0 && <span className="rounded-full bg-ambar-fundo px-2 py-0.5 font-semibold text-ambar-texto">{emAtraso} em atraso</span>}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {linhas.length > 6 && (
        <Link href="/angariacoes" className="block text-sm font-medium text-azul">
          Ver todas
        </Link>
      )}
    </Cartao>
  );
}
