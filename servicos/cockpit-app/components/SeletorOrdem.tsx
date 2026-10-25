"use client";

// "Ordenar: ..." compacto, para a linha da contagem das listas.
export default function SeletorOrdem<T extends string>({
  valor,
  onChange,
  opcoes,
}: {
  valor: T;
  onChange: (v: T) => void;
  opcoes: [T, string][];
}) {
  return (
    <label className="flex min-w-0 items-center gap-1.5 text-xs text-secundario">
      <span className="hidden sm:inline">Ordenar</span>
      <select
        value={valor}
        onChange={(e) => onChange(e.target.value as T)}
        aria-label="Ordenar a lista"
        className="min-w-0 max-w-[11rem] rounded-lg border border-black/10 bg-white py-1 pl-2 pr-1 text-xs font-medium text-tinta"
      >
        {opcoes.map(([v, r]) => (
          <option key={v} value={v}>
            {r}
          </option>
        ))}
      </select>
    </label>
  );
}
