import Link from "next/link";
import Cartao from "@/components/dashboard/Cartao";
import { diasAte } from "@/lib/datas";
import type { Dados } from "@/lib/painel";
import { comissaoPrevista, pipeline } from "@/lib/painel";

const eur = (n: number) => `${Math.round(n).toLocaleString("pt-PT")} €`;
// Um só azul, do mais escuro (mais perto) ao mais claro (mais longe).
const CORES_FAIXA = ["#0059b3", "#0071e3", "#74b3f0", "#c2dcf7"];

export default function Pipeline({ dados }: { dados: Dados }) {
  const p = pipeline(dados);
  const prev = comissaoPrevista(dados);
  const Numero = ({ n, rot, sub }: { n: number; rot: string; sub: string }) => (
    <Link href="/crm/compradores" className="rounded-xl bg-black/[0.04] p-3">
      <p className="text-2xl font-semibold text-tinta">{n}</p>
      <p className="text-xs font-medium text-tinta">{rot}</p>
      <p className="text-[11px] text-secundario">{sub}</p>
    </Link>
  );
  return (
    <Cartao titulo="Dinheiro em caminho">
      <div>
        <p className="text-xs text-secundario">Comissões por receber (CPCV e escrituras)</p>
        <p className="text-2xl font-bold tracking-tight text-tinta">{eur(prev.total)}</p>
        {prev.total > 0 ? (
          <>
            <div className="mt-2 flex h-3 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={`Comissões previstas: ${prev.faixas.map((f) => `${f.rot} ${eur(f.valor)}`).join(", ")}`}>
              {prev.faixas.map((f, i) =>
                f.valor > 0 ? <span key={f.rot} className="block h-full" style={{ width: `${(f.valor / prev.total) * 100}%`, backgroundColor: CORES_FAIXA[i] }} /> : null
              )}
            </div>
            <ul className="mt-2 space-y-1">
              {prev.faixas.map((f, i) => (
                <li key={f.rot} className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex items-center gap-2 text-secundario">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: CORES_FAIXA[i] }} />
                    {f.rot}
                  </span>
                  <span className="font-medium text-tinta">{f.valor > 0 ? eur(f.valor) : "-"}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm text-secundario">Ainda não há comissões previstas. Põe o valor da comissão nos compradores com CPCV.</p>
        )}
        {prev.semValor > 0 && (
          <p className="mt-1 text-[11px] text-ambar-texto">
            {prev.semValor} {prev.semValor === 1 ? "negócio" : "negócios"} com CPCV sem valor de comissão.
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Numero
          n={p.nPropostas}
          rot="Propostas em curso"
          sub={`${p.compradoresEmPropostas} ${p.compradoresEmPropostas === 1 ? "comprador à espera" : "compradores à espera"} de CPCV`}
        />
        <Numero n={p.cpcvFechados} rot="CPCV fechados" sub="à espera de escritura" />
      </div>
      <div>
        <p className="mb-1.5 text-xs font-semibold text-secundario">
          Escrituras pendentes ({p.escrituras.length}){p.escriturasAgendadas > 0 ? ` · ${p.escriturasAgendadas} ${p.escriturasAgendadas === 1 ? "agendada" : "agendadas"}` : ""}
        </p>
        {p.escrituras.length === 0 ? (
          <p className="text-sm text-secundario">Nenhuma escritura pendente.</p>
        ) : (
          <ul className="space-y-1.5">
            {p.escrituras.slice(0, 5).map((c) => {
              const dias = c.escritura_prazo ? diasAte(c.escritura_prazo) : null;
              return (
                <li key={c.id}>
                  <Link href={`/crm/compradores/${c.id}`} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate text-tinta">{c.contactos.nome}</span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                        dias === null ? "bg-black/5 text-secundario" : dias < 0 ? "bg-red-50 text-red-700" : dias <= 15 ? "bg-ambar-fundo text-ambar-texto" : "bg-black/5 text-secundario"
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
