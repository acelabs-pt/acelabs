"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useArrastarParaFechar } from "@/components/gestos/useGestos";
import NovoItem, { type NovoValores } from "@/components/calendario/NovoItem";
import { useToast } from "@/components/Toast";
import { sbBrowser } from "@/lib/supabase-browser";
import { inicioDoDia } from "@/lib/datas";

const ACOES = [
  {
    href: "/crm/compradores/novo",
    rotulo: "Novo comprador",
    sub: "Um contacto que quer comprar",
  },
  {
    href: "/crm/proprietarios/novo",
    rotulo: "Novo proprietário",
    sub: "Um imóvel por angariar",
  },
  // A tarefa cria-se aqui mesmo, sem sair da página (antes ia para o calendário e a janela fechava-se sozinha no iPhone).
  { href: "", rotulo: "Nova tarefa", sub: "Algo para não esquecer" },
  {
    href: "/angariacoes?novo=1",
    rotulo: "Nova angariação",
    sub: "Um contrato assinado",
  },
  {
    href: "/importar",
    rotulo: "Importar lista",
    sub: "Do Excel ou do Google Sheets",
  },
];

// Botão "+" fixo, sempre à mão: as quatro coisas que mais se criam no terreno.
export default function AcoesRapidas() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const { avisar } = useToast();
  const [aberto, setAberto] = useState(false);
  const [novaTarefa, setNovaTarefa] = useState(false);
  const arrasto = useArrastarParaFechar(() => setAberto(false));

  async function criarTarefa(v: NovoValores) {
    const { error } = await sbBrowser().from("tarefas").insert(v);
    if (error)
      return avisar("Não foi possível criar a tarefa. Tenta outra vez.");
    setNovaTarefa(false);
    avisar(v.tipo === "evento" ? "Marcação criada." : "Tarefa criada.", {
      rotulo: "Ver no calendário",
      onAcao: () => router.push("/calendario"),
    });
  }
  // Nos formulários o botão atrapalha (tapa o botão de guardar).
  // No calendário já há um "+" próprio, que cria no dia escolhido: dois botões "+" confundiam.
  if (
    pathname.endsWith("/novo") ||
    pathname.startsWith("/importar") ||
    pathname.startsWith("/calendario")
  )
    return null;

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        aria-label="Criar novo"
        className="print:hidden fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-4 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-tinta text-3xl leading-none text-white shadow-lg shadow-black/20 hover:bg-black md:bottom-6 md:right-6"
      >
        +
      </button>
      {aberto && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 md:items-center"
          onClick={() => setAberto(false)}
        >
          <div
            {...arrasto.painel}
            className="w-full max-w-md space-y-2 rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Criar novo"
          >
            <div
              {...arrasto.pega}
              className="-mt-2 flex justify-center py-2 md:hidden"
              aria-hidden="true"
            >
              <span className="h-1.5 w-10 rounded-full bg-black/15" />
            </div>
            <h3 className="pb-1 text-lg font-semibold text-tinta">Criar</h3>
            {ACOES.map((a) =>
              !a.href ? (
                <button
                  key={a.rotulo}
                  type="button"
                  onClick={() => {
                    setAberto(false);
                    setNovaTarefa(true);
                  }}
                  className="block w-full rounded-2xl bg-black/[0.04] px-4 py-3.5 text-left hover:bg-azul-suave"
                >
                  <p className="text-base font-semibold text-tinta">
                    {a.rotulo}
                  </p>
                  <p className="text-xs text-secundario">{a.sub}</p>
                </button>
              ) : (
                <Link
                  key={a.href}
                  href={a.href}
                  onClick={() => setAberto(false)}
                  className="block rounded-2xl bg-black/[0.04] px-4 py-3.5 hover:bg-azul-suave"
                >
                  <p className="text-base font-semibold text-tinta">
                    {a.rotulo}
                  </p>
                  <p className="text-xs text-secundario">{a.sub}</p>
                </Link>
              ),
            )}
          </div>
        </div>
      )}
      {novaTarefa && (
        <NovoItem
          inicial={inicioDoDia(new Date())}
          tipoInicial="tarefa"
          onFechar={() => setNovaTarefa(false)}
          onCriar={criarTarefa}
        />
      )}
    </>
  );
}
