"use client";

import { DISTRITOS, concelhosDe, freguesiasDe, incluirAtual } from "@/lib/localizacoes";

export type Localizacao = { distrito: string; concelho: string; freguesia: string };

// Distrito -> concelho -> freguesia em cascata. Mudar um nível limpa os de baixo.
// Se um valor antigo (escrito à mão) não existir na lista, mantém-se como opção para não se perder.
export default function SeletorLocalizacao({
  valor,
  onChange,
  className,
  comRotulos = false,
}: {
  valor: Localizacao;
  onChange: (v: Localizacao) => void;
  className: string;
  comRotulos?: boolean;
}) {
  const concelhos = incluirAtual(concelhosDe(valor.distrito), valor.concelho);
  const freguesias = incluirAtual(freguesiasDe(valor.distrito, valor.concelho), valor.freguesia);
  const distritos = incluirAtual(DISTRITOS, valor.distrito);

  const campos = [
    {
      nome: "Distrito",
      valor: valor.distrito,
      opcoes: distritos,
      desativado: false,
      mudar: (v: string) => onChange({ distrito: v, concelho: "", freguesia: "" }),
    },
    {
      nome: "Concelho",
      valor: valor.concelho,
      opcoes: concelhos,
      desativado: !valor.distrito,
      mudar: (v: string) => onChange({ ...valor, concelho: v, freguesia: "" }),
    },
    {
      nome: "Freguesia",
      valor: valor.freguesia,
      opcoes: freguesias,
      desativado: !valor.concelho,
      mudar: (v: string) => onChange({ ...valor, freguesia: v }),
    },
  ];

  return (
    <>
      {campos.map((c) => {
        const select = (
          <select
            key={c.nome}
            value={c.valor}
            disabled={c.desativado}
            onChange={(e) => c.mudar(e.target.value)}
            className={`${className} disabled:opacity-50`}
          >
            <option value="">{c.nome}</option>
            {c.opcoes.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        );
        return comRotulos ? (
          <label key={c.nome} className="block space-y-1">
            <span className="text-xs font-medium text-secundario">{c.nome}</span>
            {select}
          </label>
        ) : (
          select
        );
      })}
    </>
  );
}
