import Link from "next/link";
import Cartao from "@/components/dashboard/Cartao";
import { diasAte } from "@/lib/datas";
import type { Dados } from "@/lib/painel";
import { pipeline } from "@/lib/painel";

export default function Pipeline({ dados }: { dados: Dados }) {
  const p = pipeline(dados);
  const Numero = ({ n, rot, sub }: { n: number; rot: string; sub: string }) => (
    <Link href="/crm/compradores" className="rounded-xl bg-black/[0.04] p-3">
      <p className="text-2xl font-semibold text-tinta">{n}</p>
      <p className="text-xs font-medium text-tinta">{rot}</p>
      <p className="text-[11px] text-secundario">{sub}</p>
    </Link>
  );
  return (
    <Cartao titulo="Pipeline">
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
