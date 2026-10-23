"use client";

import { useArrastarParaFechar } from "@/components/gestos/useGestos";
import { inicioDoDia, isoDataLocal, somarDias } from "@/lib/datas";

// Escolher para que dia passar uma tarefa. Devolve só o dia; quem chama mantém a hora.
export default function AdiarFolha({
  titulo,
  onEscolher,
  onFechar,
}: {
  titulo: string;
  onEscolher: (dia: Date) => void;
  onFechar: () => void;
}) {
  const arrasto = useArrastarParaFechar(onFechar);
  const hoje = inicioDoDia(new Date());
  const amanha = somarDias(hoje, 1);
  const diasAteSegunda = ((8 - hoje.getDay()) % 7) || 7;
  const segunda = somarDias(hoje, diasAteSegunda);
  const opcoes: [string, Date][] = [
    ["Amanhã", amanha],
    [`Segunda-feira, ${segunda.getDate()}/${segunda.getMonth() + 1}`, segunda],
    ["Daqui a 1 semana", somarDias(hoje, 7)],
  ];
  const botao = "w-full rounded-2xl bg-black/[0.04] py-3.5 text-base font-medium text-tinta";
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 md:items-center" onClick={onFechar}>
      <div
        {...arrasto.painel}
        className="w-full max-w-md space-y-3 rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Adiar tarefa"
      >
        <div {...arrasto.pega} className="-mt-2 flex justify-center py-2 md:hidden">
          <span className="h-1.5 w-10 rounded-full bg-black/15" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-tinta">Adiar para quando?</h3>
          <p className="truncate text-sm text-secundario">{titulo}</p>
        </div>
        {opcoes.map(([rot, d]) => (
          <button key={rot} onClick={() => onEscolher(d)} className={botao}>
            {rot}
          </button>
        ))}
        <label className="block text-xs font-medium text-secundario">
          Outro dia
          <input
            type="date"
            min={isoDataLocal(amanha)}
            onChange={(e) => e.target.value && onEscolher(new Date(e.target.value + "T00:00:00"))}
            className="mt-1 w-full rounded-2xl border border-linha bg-white px-4 py-3 text-base text-tinta"
          />
        </label>
      </div>
    </div>
  );
}
