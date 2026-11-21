"use client";

import { useEffect, useState } from "react";
import { linkWhatsapp } from "@/lib/whatsapp";

/**
 * "Ligar" num telemóvel abre a chamada. Num computador não há telefone (o Windows perguntava que aplicação usar):
 * aí o botão copia o número.
 */
export function BotaoLigar({ tel, className = "", rotulo = "Ligar" }: { tel: string; className?: string; rotulo?: string }) {
  const [semTelefone, setSemTelefone] = useState(false);
  const [copiado, setCopiado] = useState(false);
  useEffect(() => {
    setSemTelefone(!window.matchMedia("(pointer: coarse)").matches);
  }, []);

  if (!semTelefone) {
    return (
      <a href={`tel:${tel}`} className={className}>
        {rotulo}
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={() =>
        navigator.clipboard
          .writeText(tel)
          .then(() => {
            setCopiado(true);
            setTimeout(() => setCopiado(false), 2500);
          })
          .catch(() => window.prompt("Número:", tel))
      }
      className={className}
      title={tel}
    >
      {copiado ? "Número copiado" : "Copiar número"}
    </button>
  );
}

/** Ligar, WhatsApp e Email, sempre à vista no topo da ficha. */
export default function BotoesContacto({ tel, email }: { tel: string | null; email?: string | null }) {
  if (!tel && !email) return null;
  const botao = "flex-1 rounded-full py-3 text-center text-base font-semibold";
  return (
    <div className="flex gap-2">
      {tel && <BotaoLigar tel={tel} className={`${botao} bg-azul text-white`} />}
      {tel && (
        <a href={linkWhatsapp(tel)} target="_blank" rel="noreferrer" className={`${botao} bg-verde text-tinta`}>
          WhatsApp
        </a>
      )}
      {email && (
        <a href={`mailto:${email}`} className={`${botao} bg-black/5 text-tinta`}>
          Email
        </a>
      )}
    </div>
  );
}
