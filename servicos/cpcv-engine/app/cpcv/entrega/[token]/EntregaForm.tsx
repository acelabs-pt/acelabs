"use client";

import { useRef, useState } from "react";

type Doc = { value: string; label: string };
type Estado = "a_enviar" | "ok" | "erro";
type Item = { id: number; nome: string; estado: Estado; msg?: string };

export default function EntregaForm({ token, documentos }: { token: string; documentos: Doc[] }) {
  const [tipo, setTipo] = useState(documentos[0]?.value ?? "");
  const [itens, setItens] = useState<Item[]>([]);
  const [arrastar, setArrastar] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const contador = useRef(0);

  function atualizar(id: number, parcial: Partial<Item>) {
    setItens((l) => l.map((i) => (i.id === id ? { ...i, ...parcial } : i)));
  }

  async function enviar(files: File[]) {
    for (const file of files) {
      const id = ++contador.current;
      setItens((l) => [...l, { id, nome: file.name, estado: "a_enviar" }]);
      try {
        const fd = new FormData();
        fd.append("ficheiro", file);
        fd.append("tipo", tipo);
        const res = await fetch(`/api/cpcv/entrega/${token}`, { method: "POST", body: fd });
        const body = await res.json().catch(() => ({}));
        if (res.ok) atualizar(id, { estado: "ok" });
        else atualizar(id, { estado: "erro", msg: body.error ?? "Erro ao enviar." });
      } catch {
        atualizar(id, { estado: "erro", msg: "Sem ligação. Tente outra vez." });
      }
    }
  }

  function aoEscolher(lista: FileList | null) {
    const files = Array.from(lista ?? []);
    if (files.length) void enviar(files);
  }

  return (
    <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-5 space-y-4">
      <div>
        <label htmlFor="tipo-doc" className="block text-xs font-semibold text-[#0F172A] mb-1">
          Que documento vai enviar?
        </label>
        <select
          id="tipo-doc"
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          className="w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-2.5 text-sm"
        >
          {documentos.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setArrastar(true);
        }}
        onDragLeave={() => setArrastar(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastar(false);
          aoEscolher(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        className={`cursor-pointer rounded-2xl border-2 border-dashed px-4 py-10 text-center transition ${
          arrastar ? "border-[#0071e3] bg-[#EFF6FF]" : "border-[#CBD5E1] bg-[#F8FAFC] hover:bg-[#F1F5F9]"
        }`}
      >
        <p className="text-sm font-semibold text-[#0F172A]">Largue os ficheiros aqui</p>
        <p className="text-xs text-[#94A3B8] mt-1">ou toque para escolher do telemóvel ou computador</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
          className="hidden"
          onChange={(e) => {
            aoEscolher(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {itens.length > 0 && (
        <ul className="space-y-1.5" aria-live="polite">
          {itens.map((i) => (
            <li key={i.id} className="text-xs flex items-start justify-between gap-3">
              <span className="truncate">{i.nome}</span>
              <span
                className={
                  i.estado === "ok"
                    ? "text-[#1fae5a] font-semibold shrink-0"
                    : i.estado === "erro"
                      ? "text-red-500 shrink-0"
                      : "text-[#94A3B8] shrink-0"
                }
              >
                {i.estado === "ok" ? "Enviado" : i.estado === "erro" ? i.msg : "A enviar..."}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
