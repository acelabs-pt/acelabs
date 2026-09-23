"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { btnDanger, btnSecondary } from "../ui";

export type Utilizador = {
  id: string;
  nome: string;
  email: string;
  role: "agente" | "gestora" | "admin";
  criado_em: string;
  activo: boolean;
};

const ROLE_LABEL: Record<Utilizador["role"], string> = {
  agente: "Agente",
  gestora: "Gestora",
  admin: "Admin",
};

export default function GestaoUtilizadores({ utilizadores }: { utilizadores: Utilizador[] }) {
  const router = useRouter();
  const [aProcessar, setAProcessar] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState<{ id: string; accao: "role" | "activo"; valor: string | boolean } | null>(
    null
  );
  const [erro, setErro] = useState("");

  async function aplicar() {
    if (!confirmar) return;
    setAProcessar(confirmar.id);
    setErro("");
    try {
      const res = await fetch(`/api/cpcv/admin/utilizadores/${confirmar.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(confirmar.accao === "role" ? { role: confirmar.valor } : { activo: confirmar.valor }),
      });
      const body = await res.json();
      if (!res.ok) {
        setErro(body.error ?? "Erro ao aplicar a alteração.");
        return;
      }
      setConfirmar(null);
      router.refresh();
    } catch {
      setErro("Erro de ligação. Tenta outra vez.");
    } finally {
      setAProcessar(null);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-5">
      <h2 className="text-sm font-semibold text-[#0F172A] mb-3">Utilizadores</h2>
      {erro && <p className="text-xs text-red-500 mb-2">{erro}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-[#94A3B8] border-b border-[#F1F5F9]">
              <th className="py-2 pr-3 font-medium">Nome</th>
              <th className="py-2 pr-3 font-medium">Email</th>
              <th className="py-2 pr-3 font-medium">Papel</th>
              <th className="py-2 pr-3 font-medium">Estado</th>
              <th className="py-2 pr-3 font-medium text-right">Acções</th>
            </tr>
          </thead>
          <tbody>
            {utilizadores.map((u) => (
              <tr key={u.id} className="border-b border-[#F1F5F9] last:border-0">
                <td className="py-2 pr-3 font-medium text-[#0F172A]">{u.nome}</td>
                <td className="py-2 pr-3 text-[#475569]">{u.email}</td>
                <td className="py-2 pr-3">
                  <select
                    value={confirmar?.id === u.id && confirmar.accao === "role" ? (confirmar.valor as string) : u.role}
                    onChange={(e) => setConfirmar({ id: u.id, accao: "role", valor: e.target.value })}
                    className="border border-[#E2E8F0] rounded-lg px-2 py-1 text-xs"
                  >
                    <option value="agente">Agente</option>
                    <option value="gestora">Gestora</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td className="py-2 pr-3">
                  <span
                    className={`px-2 py-0.5 rounded-full font-medium ${
                      u.activo ? "bg-[#EAF7EF] text-[#1FAE5A]" : "bg-[#F1F5F9] text-[#64748B]"
                    }`}
                  >
                    {u.activo ? "Activo" : "Desactivado"}
                  </span>
                </td>
                <td className="py-2 pr-3 text-right">
                  <button
                    onClick={() => setConfirmar({ id: u.id, accao: "activo", valor: !u.activo })}
                    className={u.activo ? btnDanger : btnSecondary}
                  >
                    {u.activo ? "Desactivar" : "Reactivar"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {confirmar && (
        <div className="mt-4 border border-[#E2E8F0] rounded-xl p-4 bg-[#F8FAFC] flex items-center justify-between gap-3">
          <p className="text-xs text-[#475569]">
            {confirmar.accao === "role"
              ? `Confirmas mudar o papel deste utilizador para "${ROLE_LABEL[confirmar.valor as Utilizador["role"]]}"?`
              : confirmar.valor
                ? "Confirmas reactivar o acesso deste utilizador?"
                : "Confirmas desactivar o acesso deste utilizador? Deixa de conseguir entrar de imediato."}
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setConfirmar(null)} className={btnSecondary}>
              Cancelar
            </button>
            <button onClick={aplicar} disabled={aProcessar !== null} className={btnDanger}>
              Confirmar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
