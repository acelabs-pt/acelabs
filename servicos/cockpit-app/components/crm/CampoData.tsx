"use client";

import { useEffect, useState } from "react";

// Campo de data que só grava quando a data está completa (ou quando é limpa ao sair do campo).
// Sem isto, escrever a data à mão gravava valores incompletos e o campo era reposto a vazio.
export default function CampoData({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: string | null;
  onCommit: (v: string | null) => void;
}) {
  const [local, setLocal] = useState(value ?? "");

  useEffect(() => {
    setLocal(value ?? "");
  }, [value]);

  // ano >= 2000 evita gravar "0002-10-13" a meio de escrever o ano
  const completa = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && Number(v.slice(0, 4)) >= 2000;

  return (
    <label className="block text-xs text-secundario">
      {label}
      <input
        type="date"
        value={local}
        onChange={(e) => {
          setLocal(e.target.value);
          if (completa(e.target.value) && e.target.value !== (value ?? "")) onCommit(e.target.value);
        }}
        onBlur={() => {
          if (local === "" && value) onCommit(null);
        }}
        className="mt-1 block w-full rounded-xl border border-black/10 px-3 py-2.5 text-base text-tinta"
      />
    </label>
  );
}
