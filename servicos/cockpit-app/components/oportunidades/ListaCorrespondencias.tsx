"use client";

import Link from "next/link";
import SwipeLinha from "@/components/gestos/SwipeLinha";
import { registarEnvio, whatsappParaComprador, type Correspondencia } from "@/lib/oportunidades";

// Lista de alertas de correspondência. "imovel" mostra o imóvel (ficha do comprador),
// "comprador" mostra quem pode comprar (ficha da angariação ou do proprietário), "ambos" mostra os dois (dashboard).
export default function ListaCorrespondencias({
  itens,
  mostrar,
  onResponder,
}: {
  itens: Correspondencia[];
  mostrar: "imovel" | "comprador" | "ambos";
  onResponder: (c: Correspondencia, estado: "faz_sentido" | "descartada") => void;
}) {
  return (
    <ul className="space-y-2">
      {itens.map((c) => {
        const imovelNome = c.angariacoes?.titulo ?? c.proprietarios?.contactos.nome ?? "Imóvel";
        const imovelHref = c.angariacao_id ? `/angariacoes/${c.angariacao_id}` : `/crm/proprietarios/${c.proprietario_id}`;
        const compradorNome = c.compradores?.contactos.nome ?? "Comprador";
        const compradorHref = `/crm/compradores/${c.comprador_id}`;
        return (
          <li key={c.id}>
            <SwipeLinha
              direita={c.estado === "faz_sentido" ? undefined : { rotulo: "Faz sentido", classe: "bg-verde text-tinta", onAcao: () => onResponder(c, "faz_sentido") }}
              esquerda={{ rotulo: "Descartar", classe: "bg-secundario text-white", onAcao: () => onResponder(c, "descartada") }}
            >
            <div className="space-y-2 rounded-2xl bg-azul-suave p-3">
            <p className="text-sm text-tinta">
              {mostrar !== "imovel" && (
                <Link href={compradorHref} className="font-semibold">
                  {compradorNome}
                </Link>
              )}
              {mostrar === "ambos" && <span className="text-secundario"> procura algo como </span>}
              {mostrar !== "comprador" && (
                <Link href={imovelHref} className="font-semibold">
                  {imovelNome}
                  {!c.angariacao_id && <span className="font-normal text-secundario"> (proprietário por angariar)</span>}
                </Link>
              )}
            </p>
            {c.estado === "faz_sentido" ? (
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-full bg-verde-suave px-2.5 py-1 text-xs font-medium text-tinta">Confirmada</span>
                <button onClick={() => onResponder(c, "descartada")} className="text-xs text-secundario underline">
                  Descartar
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
              <div className="flex gap-2">
                {whatsappParaComprador(c) ? (
                  <button
                    onClick={async () => {
                      // abrir já, no próprio toque (senão o browser bloqueia a janela), e registar a seguir
                      window.open(whatsappParaComprador(c)!, "_blank", "noopener");
                      await registarEnvio(c);
                      onResponder(c, "faz_sentido");
                    }}
                    className="flex-1 rounded-full bg-verde py-2 text-sm font-semibold text-tinta"
                  >
                    Enviar por WhatsApp
                  </button>
                ) : (
                  <button
                    onClick={() => onResponder(c, "faz_sentido")}
                    className="flex-1 rounded-full bg-tinta py-2 text-sm font-semibold text-white"
                  >
                    Faz sentido
                  </button>
                )}
                <button
                  onClick={() => onResponder(c, "descartada")}
                  className="flex-1 rounded-full bg-white py-2 text-sm font-medium text-tinta"
                >
                  Descartar
                </button>
              </div>
              {whatsappParaComprador(c) && (
                <button onClick={() => onResponder(c, "faz_sentido")} className="w-full text-center text-xs text-secundario underline">
                  Faz sentido, envio depois
                </button>
              )}
              </div>
            )}
            </div>
            </SwipeLinha>
          </li>
        );
      })}
    </ul>
  );
}
