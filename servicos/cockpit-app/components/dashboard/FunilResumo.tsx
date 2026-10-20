import Link from "next/link";
import Cartao from "@/components/dashboard/Cartao";
import { FUNIL } from "@/lib/comprador";
import { FUNIL_PROP } from "@/lib/proprietario";
import type { Dados } from "@/lib/painel";

function Linhas({ itens, href }: { itens: { rot: string; n: number }[]; href: string }) {
  const max = Math.max(1, ...itens.map((i) => i.n));
  return (
    <Link href={href} className="block space-y-1.5">
      {itens.map((i) => (
        <div key={i.rot} className="flex items-center gap-2 text-xs">
          <span className="w-36 shrink-0 truncate text-secundario">{i.rot}</span>
          <span className="h-2 flex-1 overflow-hidden rounded-full bg-black/5">
            <span className="block h-full rounded-full bg-azul" style={{ width: `${(i.n / max) * 100}%` }} />
          </span>
          <span className="w-5 text-right font-medium text-tinta">{i.n}</span>
        </div>
      ))}
    </Link>
  );
}

export default function FunilResumo({ dados }: { dados: Dados }) {
  return (
    <Cartao titulo="Funis em resumo">
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-tinta">Compradores</h3>
          <Linhas href="/crm/compradores" itens={FUNIL.map((f) => ({ rot: f.label, n: dados.compradores.filter((c) => c.estado === f.id).length }))} />
        </div>
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-tinta">Proprietários</h3>
          <Linhas href="/crm/proprietarios" itens={FUNIL_PROP.map((f) => ({ rot: f.label, n: dados.proprietarios.filter((p) => p.estado === f.id).length }))} />
        </div>
      </div>
    </Cartao>
  );
}
