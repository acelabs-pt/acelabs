"use client";

import {
  ACOES_PADRAO,
  NOME_FOLLOW_UP,
  blocoAtual,
  blocoDeDia,
  dataDoDia,
  nBlocos,
  type Acao,
  type Angariacao,
} from "@/lib/angariacao";

const FASES = ["1ª fase", "2ª fase", "3ª fase"];

// Ordem das linhas: follow ups (bandeiras), ações do desenho pela ordem do desenho, depois as do agente.
function nomesDasLinhas(acoes: Acao[]): string[] {
  const presentes = new Set(acoes.map((a) => a.nome));
  const doDesenho = ACOES_PADRAO.map((a) => a.nome).filter((n) => presentes.has(n));
  const extras = [...presentes].filter((n) => n !== NOME_FOLLOW_UP && !doDesenho.includes(n));
  return [...(presentes.has(NOME_FOLLOW_UP) ? [NOME_FOLLOW_UP] : []), ...doDesenho, ...extras];
}

function Bandeira({ feita }: { feita: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className={feita ? "text-white" : "text-red-600"}>
      <path d="M5 3v18h2v-7h11l-2-4 2-4H7V3z" />
    </svg>
  );
}

export default function Grelha({
  ang,
  acoes,
  editar,
  onAbrir,
  onVazia,
}: {
  ang: Angariacao;
  acoes: Acao[];
  editar: boolean;
  onAbrir: (a: Acao) => void;
  onVazia: (nome: string, bloco: number) => void;
}) {
  const n = nBlocos(ang.duracao_dias);
  const atual = blocoAtual(ang.inicio, ang.duracao_dias);
  const hoje = new Date();
  const linhas = nomesDasLinhas(acoes);
  const blocos = Array.from({ length: n }, (_, i) => i + 1);
  const blocoVendido = ang.vendido_em
    ? Math.min(n, Math.max(1, Math.ceil(((new Date(ang.vendido_em + "T00:00:00").getTime() - new Date(ang.inicio + "T00:00:00").getTime()) / 86400000 + 1) / 10)))
    : null;

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
      <table className="border-separate border-spacing-x-0.5 border-spacing-y-1 text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-background" />
            {Array.from({ length: n / 6 }, (_, i) => (
              <th key={i} colSpan={6} className="rounded-lg bg-ambar-fundo px-2 py-1 text-center font-semibold text-ambar-texto">
                {FASES[i]}
              </th>
            ))}
          </tr>
          <tr>
            <th className="sticky left-0 z-10 bg-background" />
            {Array.from({ length: n / 3 }, (_, i) => (
              <th key={i} colSpan={3} className="rounded-lg bg-black/5 px-2 py-1 text-center font-medium text-secundario">
                {(i + 1) * 30} dias
              </th>
            ))}
          </tr>
          <tr>
            <th className="sticky left-0 z-10 bg-background" />
            {blocos.map((b) => (
              <th key={b} className={`h-5 min-w-9 rounded text-[10px] font-medium ${b === atual ? "bg-azul text-white" : "text-secundario"}`}>
                {b === blocoVendido ? "Vendido" : b * 10}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((nome) => (
            <tr key={nome}>
              <th className="sticky left-0 z-10 max-w-32 bg-background pr-2 text-left text-[11px] font-semibold leading-tight text-tinta">
                {nome}
              </th>
              {blocos.map((b) => {
                const a = acoes.find((x) => x.nome === nome && blocoDeDia(x.dia) === b);
                if (!a) {
                  return (
                    <td key={b} className="p-0">
                      {editar ? (
                        <button
                          onClick={() => onVazia(nome, b)}
                          aria-label={`Adicionar ${nome} ao bloco ${b}`}
                          className="h-9 w-9 rounded-lg border border-dashed border-black/20 text-secundario"
                        >
                          +
                        </button>
                      ) : (
                        <div className="h-9 w-9" />
                      )}
                    </td>
                  );
                }
                const fimBloco = dataDoDia(ang.inicio, b * 10);
                const atrasada = !a.feita && fimBloco < hoje;
                return (
                  <td key={b} className="p-0">
                    <button
                      onClick={() => onAbrir(a)}
                      aria-label={`${a.nome}, bloco ${b}${a.feita ? ", feita" : ""}`}
                      className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                        a.feita
                          ? "bg-verde text-white"
                          : atrasada
                          ? "bg-ambar-fundo ring-1 ring-ambar"
                          : a.follow_up
                          ? "bg-red-50"
                          : "bg-verde/10"
                      }`}
                    >
                      {a.follow_up ? (
                        <Bandeira feita={a.feita} />
                      ) : a.feita ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                          <path d="M5 12l4 4 10-10" />
                        </svg>
                      ) : (
                        <span className="block h-3 w-3 rounded-full border border-verde/60 bg-white" />
                      )}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
