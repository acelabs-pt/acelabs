"use client";

import { useState, useTransition } from "react";
import { registarFeedbackVisita, type Feedback } from "./actions";

const OPCOES: { valor: Feedback; label: string }[] = [
  { valor: "gostou", label: "Gostou" },
  { valor: "talvez", label: "Talvez" },
  { valor: "nao", label: "Não gostou" },
];

export default function RegistoVisita({ contactoId }: { contactoId: string }) {
  const [escolhido, setEscolhido] = useState<Feedback | null>(null);
  const [guardado, setGuardado] = useState(false);
  const [, startTransition] = useTransition();

  function escolher(valor: Feedback) {
    setEscolhido(valor);
    setGuardado(false);
    startTransition(async () => {
      await registarFeedbackVisita(contactoId, valor);
      setGuardado(true);
    });
  }

  return (
    <div>
      <div className="flex gap-2">
        {OPCOES.map((opcao) => {
          const ativo = escolhido === opcao.valor;
          return (
            <button
              key={opcao.valor}
              type="button"
              onClick={() => escolher(opcao.valor)}
              className={`flex-1 rounded-2xl py-3 text-[13px] font-semibold ${
                ativo
                  ? "border border-azul bg-[#eaf3fd] text-azul-escuro"
                  : "border border-black/10 bg-white text-tinta"
              }`}
            >
              {opcao.label}
            </button>
          );
        })}
      </div>
      {guardado && (
        <p className="mt-2.5 text-xs font-semibold text-[#167a3e]">
          Registado na atividade do contacto
        </p>
      )}
    </div>
  );
}
