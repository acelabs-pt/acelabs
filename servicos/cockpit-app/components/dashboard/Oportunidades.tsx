"use client";

import { useCallback, useEffect, useState } from "react";
import Cartao from "@/components/dashboard/Cartao";
import ListaCorrespondencias from "@/components/oportunidades/ListaCorrespondencias";
import { carregarNovas, responder, type Correspondencia } from "@/lib/oportunidades";

// Compradores que combinam com uma angariação (ou proprietário por angariar), por rever.
// Não mostra nada enquanto não houver alertas.
export default function Oportunidades() {
  const [itens, setItens] = useState<Correspondencia[]>([]);
  const [tudo, setTudo] = useState(false);

  const carregar = useCallback(async () => {
    setItens(await carregarNovas());
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  if (itens.length === 0) return null;
  const mostradas = tudo ? itens : itens.slice(0, 3);

  return (
    <Cartao titulo={`Oportunidades (${itens.length} por rever)`}>
      <ListaCorrespondencias
        itens={mostradas}
        mostrar="ambos"
        onResponder={async (c, estado) => {
          await responder(c.id, estado);
          await carregar();
        }}
      />
      {itens.length > 3 && (
        <button onClick={() => setTudo((t) => !t)} className="text-sm text-secundario underline">
          {tudo ? "Mostrar menos" : `Ver todas (${itens.length})`}
        </button>
      )}
    </Cartao>
  );
}
