"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { sbBrowser } from "@/lib/supabase-browser";
import { concluirTarefasDaFase } from "@/lib/proprietario";

type Dono = {
  id: string;
  estado: string;
  tipo_imovel: string | null;
  tipologia: string | null;
  distrito: string | null;
  concelho: string | null;
  freguesia: string | null;
  valor: number | null;
  contactos: { nome: string };
};

// Angariação sem proprietário: associa um proprietário que já está na plataforma (a qualificação vem da ficha dele).
export default function AssociarProprietario({ angariacaoId, onAssociado }: { angariacaoId: string; onAssociado: () => void }) {
  const [donos, setDonos] = useState<Dono[]>([]);
  const [donoId, setDonoId] = useState("");
  const [aGuardar, setAGuardar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    sbBrowser()
      .from("proprietarios")
      .select("id, estado, tipo_imovel, tipologia, distrito, concelho, freguesia, valor, contactos(nome)")
      .neq("estado", "perdido")
      .then(({ data }) =>
        setDonos(((data ?? []) as unknown as Dono[]).sort((a, b) => a.contactos.nome.localeCompare(b.contactos.nome)))
      );
  }, []);

  const dono = donos.find((d) => d.id === donoId);
  const qualificacao = dono
    ? [dono.tipo_imovel, dono.tipologia, dono.freguesia || dono.concelho || dono.distrito, dono.valor != null ? `${dono.valor.toLocaleString("pt-PT")} EUR` : null]
        .filter(Boolean)
        .join(" · ")
    : "";

  async function associar() {
    if (!dono) return;
    setAGuardar(true);
    setErro(null);
    const sb = sbBrowser();
    const { error } = await sb.from("angariacoes").update({ proprietario_id: dono.id }).eq("id", angariacaoId);
    if (error) {
      setAGuardar(false);
      return setErro("Não foi possível associar o proprietário.");
    }
    if (dono.estado !== "angariado") {
      await sb.from("proprietarios").update({ estado: "angariado", estado_desde: new Date().toISOString() }).eq("id", dono.id);
      await concluirTarefasDaFase(dono.id, "angariado");
    }
    setAGuardar(false);
    onAssociado();
  }

  return (
    <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-tinta">Proprietário</h2>
      <p className="text-xs text-secundario">
        Esta angariação ainda não tem proprietário. Sem ele, não há qualificação do imóvel nem alertas de compradores compatíveis.
      </p>
      {erro && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
      <select
        value={donoId}
        onChange={(e) => setDonoId(e.target.value)}
        className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm"
      >
        <option value="">Escolhe o proprietário</option>
        {donos.map((d) => (
          <option key={d.id} value={d.id}>
            {d.contactos.nome}
          </option>
        ))}
      </select>
      {dono && (
        <p className="text-xs text-secundario">
          Qualificação: {qualificacao || "ainda por preencher"}.{" "}
          <Link href={`/crm/proprietarios/${dono.id}`} className="text-azul underline">
            Editar na ficha
          </Link>
        </p>
      )}
      <button
        onClick={associar}
        disabled={!dono || aGuardar}
        className="w-full rounded-xl bg-azul py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {aGuardar ? "A guardar..." : "Associar proprietário"}
      </button>
      <Link href="/crm/proprietarios/novo" className="block text-center text-sm text-azul underline">
        Criar um novo proprietário
      </Link>
    </section>
  );
}
