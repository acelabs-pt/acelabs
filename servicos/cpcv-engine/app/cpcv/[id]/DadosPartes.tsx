"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sbBrowser } from "@/lib/supabase-browser";
import {
  ParteDraft,
  nifValido,
  parteDraftDeLinha,
  parteDraftParaLinha,
  parteDraftVazia,
  parteDraftVazio,
} from "@/lib/cpcv-partes-form";
import ParteCampos from "../ParteCampos";
import { btnPrimary, CabecalhoSecao, CORES_SECAO, IconesSecao, Spinner } from "../ui";

type LinhaParteDB = {
  id: string;
  papel: string;
  tipo_pessoa: string | null;
  nome: string | null;
  estado_civil: string | null;
  regime_bens: string | null;
  nacionalidade: string | null;
  naturalidade: string | null;
  nif: string | null;
  morada: string | null;
  documento_tipo: string | null;
  documento_numero: string | null;
  documento_validade: string | null;
  representante_nome: string | null;
  representante_cargo: string | null;
  certidao_permanente: string | null;
};

// Dados de vendedor/comprador já não vêm da IA (ver app/api/cpcv/extrair e lib/cpcv-partes-form.ts)
// - este componente é o único sítio onde se editam depois de o processo criado. A lista inicial
// de ids (capturada uma vez) permite distinguir "linha removida" de "linha nova" ao guardar.
export default function DadosPartes({
  processoId,
  tipoContrato,
  partesIniciais,
}: {
  processoId: string;
  tipoContrato: string;
  partesIniciais: LinhaParteDB[];
}) {
  const router = useRouter();
  const angariacaoExterna = tipoContrato === "comprador_nosso_angariacao_externa";

  const [idsOriginais] = useState(() => partesIniciais.map((p) => p.id));
  const [vendedores, setVendedores] = useState<ParteDraft[]>(() => {
    const existentes = partesIniciais.filter((p) => p.papel === "vendedor").map(parteDraftDeLinha);
    return existentes.length > 0 ? existentes : [parteDraftVazia()];
  });
  const [compradores, setCompradores] = useState<ParteDraft[]>(() => {
    const existentes = partesIniciais.filter((p) => p.papel === "comprador").map(parteDraftDeLinha);
    return existentes.length > 0 ? existentes : [parteDraftVazia()];
  });

  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [erro, setErro] = useState("");

  function nifsInvalidos(): string[] {
    const todas = [...(!angariacaoExterna ? vendedores : []), ...compradores];
    return todas.filter((d) => d.nif.trim() && !nifValido(d.nif)).map((d) => d.nome || "(sem nome)");
  }

  async function guardar() {
    const invalidos = nifsInvalidos();
    if (invalidos.length > 0) {
      setErro(`NIF inválido para: ${invalidos.join(", ")}`);
      return;
    }

    setGuardando(true);
    setErro("");
    setGuardado(false);

    const supabase = sbBrowser();
    const grupos: { lista: ParteDraft[]; papel: "vendedor" | "comprador" }[] = [
      ...(!angariacaoExterna ? [{ lista: vendedores, papel: "vendedor" as const }] : []),
      { lista: compradores, papel: "comprador" as const },
    ];

    const idsValidos = grupos.flatMap(({ lista }) =>
      lista.filter((d) => !parteDraftVazio(d) && d.id).map((d) => d.id as string)
    );
    const idsParaApagar = idsOriginais.filter((id) => !idsValidos.includes(id));

    if (idsParaApagar.length > 0) {
      const { error } = await supabase.from("cpcv_partes").delete().in("id", idsParaApagar);
      if (error) {
        setErro(error.message);
        setGuardando(false);
        return;
      }
    }

    for (const { lista, papel } of grupos) {
      for (const d of lista) {
        if (parteDraftVazio(d)) continue;
        const linha = parteDraftParaLinha(papel, d, processoId);
        const { error } = d.id
          ? await supabase.from("cpcv_partes").update(linha).eq("id", d.id)
          : await supabase.from("cpcv_partes").insert(linha);
        if (error) {
          setErro(error.message);
          setGuardando(false);
          return;
        }
      }
    }

    setGuardando(false);
    setGuardado(true);
    router.refresh();
    setTimeout(() => setGuardado(false), 2500);
  }

  return (
    <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-5 space-y-4">
      <h2 className="text-sm font-semibold text-[#0F172A]">Partes</h2>

      <div className="grid lg:grid-cols-2 gap-5">
        {!angariacaoExterna && (
          <div className={`rounded-xl border border-[#E2E8F0] border-t-4 ${CORES_SECAO.ambar.topo} p-4 space-y-3`}>
            <CabecalhoSecao cor="ambar" icone={IconesSecao.chave} titulo="Vendedor" />
            {vendedores.map((v, i) => (
              <ParteCampos
                key={i}
                titulo={`Vendedor ${i + 1}`}
                draft={v}
                cor="ambar"
                onChange={(next) => setVendedores((prev) => prev.map((d, idx) => (idx === i ? next : d)))}
                onRemover={vendedores.length > 1 ? () => setVendedores((prev) => prev.filter((_, idx) => idx !== i)) : undefined}
              />
            ))}
            <button
              type="button"
              onClick={() => setVendedores((prev) => [...prev, parteDraftVazia()])}
              className={`text-xs font-semibold hover:underline ${CORES_SECAO.ambar.link}`}
            >
              + Adicionar vendedor
            </button>
          </div>
        )}

        <div className={`rounded-xl border border-[#E2E8F0] border-t-4 ${CORES_SECAO.verde.topo} p-4 space-y-3`}>
          <CabecalhoSecao cor="verde" icone={IconesSecao.carrinho} titulo="Comprador" />
          {compradores.map((c, i) => (
            <ParteCampos
              key={i}
              titulo={`Comprador ${i + 1}`}
              draft={c}
              cor="verde"
              onChange={(next) => setCompradores((prev) => prev.map((d, idx) => (idx === i ? next : d)))}
              onRemover={compradores.length > 1 ? () => setCompradores((prev) => prev.filter((_, idx) => idx !== i)) : undefined}
            />
          ))}
          <button
            type="button"
            onClick={() => setCompradores((prev) => [...prev, parteDraftVazia()])}
            className={`text-xs font-semibold hover:underline ${CORES_SECAO.verde.link}`}
          >
            + Adicionar comprador
          </button>
        </div>
      </div>

      {erro && <p className="text-xs text-red-500">{erro}</p>}

      <div className="flex items-center justify-end gap-3">
        {guardado && <p className="text-xs font-medium text-[#1FAE5A]">Guardado.</p>}
        <button onClick={guardar} disabled={guardando} className={btnPrimary}>
          {guardando && <Spinner className="h-3.5 w-3.5" />}
          {guardando ? "A guardar..." : "Guardar"}
        </button>
      </div>
    </div>
  );
}
