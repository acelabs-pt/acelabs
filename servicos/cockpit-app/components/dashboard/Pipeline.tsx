import Link from "next/link";
import Cartao from "@/components/dashboard/Cartao";
import { diasAte } from "@/lib/datas";
import type { Dados } from "@/lib/painel";
import { comissaoPrevista, pipeline } from "@/lib/painel";
import { eur } from "@/lib/graficos";

// Um só azul, do mais escuro (mais perto) ao mais claro (mais longe).
const CORES_FAIXA = ["#0059b3", "#0071e3", "#6aaeef", "#bcd9f6"];

export default function Pipeline({ dados }: { dados: Dados }) {
  const p = pipeline(dados);
  const prev = comissaoPrevista(dados);
  const Numero = ({ n, rot, sub }: { n: number; rot: string; sub: string }) => (
    <Link href="/crm/compradores" className="rounded-2xl bg-black/[0.035] p-4 hover:bg-azul-suave">
      <p className="text-3xl font-bold tracking-tight text-tinta">{n}</p>
      <p className="mt-0.5 text-sm font-medium text-tinta">{rot}</p>
      <p className="text-xs text-secundario">{sub}</p>
    </Link>
  );
  return (
    <Cartao titulo="Dinheiro em caminho">
      <div>
        <p className="text-sm text-secundario">Comissões por receber (CPCV e escrituras)</p>
        <p className="mt-1 text-4xl font-bold tracking-tight text-tinta">{eur(prev.total)}</p>
        {prev.total > 0 ? (
          <>
            <div
              className="mt-4 flex h-4 gap-1"
              role="img"
              aria-label={`Comissões previstas: ${prev.faixas.map((f) => `${f.rot} ${eur(f.valor)}`).join(", ")}`}
            >
              {prev.faixas.map((f, i) =>
                f.valor > 0 ? (
                  <span
                    key={f.rot}
                    className="anim-barra block h-full rounded-full"
                    style={{ width: `${(f.valor / prev.total) * 100}%`, backgroundColor: CORES_FAIXA[i], animationDelay: `${i * 90}ms` }}
                  />
                ) : null
              )}
            </div>
            <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
              {prev.faixas.map((f, i) => (
                <li key={f.rot} className="min-w-0">
                  <p className="flex items-center gap-2 text-xs text-secundario">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: CORES_FAIXA[i] }} />
                    <span className="truncate">{f.rot}</span>
                  </p>
                  <p className="mt-0.5 text-lg font-semibold tracking-tight text-tinta">{f.valor > 0 ? eur(f.valor) : "-"}</p>
                  {f.n > 0 && <p className="text-xs text-secundario">{f.n} {f.n === 1 ? "negócio" : "negócios"}</p>}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-2 text-sm text-secundario">Ainda não há comissões previstas. Põe o valor da comissão nos compradores com CPCV.</p>
        )}
        {prev.semValor > 0 && (
          <p className="mt-3 rounded-xl bg-ambar-fundo px-3 py-2 text-xs text-ambar-texto">
            {prev.semValor} {prev.semValor === 1 ? "negócio" : "negócios"} com CPCV sem valor de comissão.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Numero
          n={p.nPropostas}
          rot="Propostas em curso"
          sub={`${p.compradoresEmPropostas} ${p.compradoresEmPropostas === 1 ? "comprador à espera" : "compradores à espera"} de CPCV`}
        />
        <Numero n={p.cpcvFechados} rot="CPCV fechados" sub="à espera de escritura" />
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-secundario">
          Escrituras pendentes ({p.escrituras.length}){p.escriturasAgendadas > 0 ? ` · ${p.escriturasAgendadas} ${p.escriturasAgendadas === 1 ? "agendada" : "agendadas"}` : ""}
        </p>
        {p.escrituras.length === 0 ? (
          <p className="text-sm text-secundario">Nenhuma escritura pendente.</p>
        ) : (
          <ul className="space-y-1">
            {p.escrituras.slice(0, 5).map((c) => {
              const dias = c.escritura_prazo ? diasAte(c.escritura_prazo) : null;
              return (
                <li key={c.id}>
                  <Link href={`/crm/compradores/${c.id}`} className="flex items-center justify-between gap-2 rounded-xl px-2 py-2 text-sm hover:bg-black/[0.03]">
                    <span className="truncate text-tinta">{c.contactos.nome}</span>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                        dias === null ? "bg-black/5 text-secundario" : dias < 0 ? "bg-red-50 text-red-700" : dias <= 15 ? "bg-ambar-fundo text-ambar-texto" : "bg-verde-suave text-verde"
                      }`}
                    >
                      {dias === null ? "sem prazo" : dias < 0 ? `${-dias} dias de atraso` : dias === 0 ? "hoje" : `${dias} dias`}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Cartao>
  );
}
