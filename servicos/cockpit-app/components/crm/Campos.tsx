"use client";

// Campos de formulário partilhados no CRM (compradores e proprietários).
const BASE = "w-full rounded-xl border border-black/10 bg-white px-3 py-3 text-base";

export function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-secundario">{label}</span>
      {children}
    </label>
  );
}

export function Texto({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <Campo label={label}>
      <input
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={BASE}
        // o browser aceita "ana@exemplo" sem domínio; o importador não, por isso exigir o ponto aqui também
        {...(type === "email" ? { pattern: "[^\\s@]+@[^\\s@]+\\.[^\\s@]+", title: "Email completo, por exemplo ana@exemplo.pt", autoComplete: "email" } : {})}
      />
    </Campo>
  );
}

export function Escolha({
  label,
  value,
  onChange,
  opcoes,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  opcoes: string[];
}) {
  return (
    <Campo label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={BASE}>
        <option value="">-</option>
        {opcoes.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </Campo>
  );
}

const PREFIXOS_TEL = ["+351", "+34", "+33", "+44", "+49", "+41", "+55", "+1"];

// Telemóvel com prefixo separado do número (como no desenho: "campo prefixo + nr telefone").
export function CampoTelemovel({
  prefixo,
  numero,
  onPrefixo,
  onNumero,
}: {
  prefixo: string;
  numero: string;
  onPrefixo: (v: string) => void;
  onNumero: (v: string) => void;
}) {
  return (
    <Campo label="Telemóvel">
      <div className="flex gap-2">
        <select
          value={prefixo}
          onChange={(e) => onPrefixo(e.target.value)}
          className="rounded-xl border border-black/10 bg-white px-2 py-3 text-base"
        >
          {PREFIXOS_TEL.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <input
          type="tel"
          inputMode="tel"
          value={numero}
          onChange={(e) => onNumero(e.target.value)}
          className="min-w-0 flex-1 rounded-xl border border-black/10 px-3 py-3 text-base"
        />
      </div>
    </Campo>
  );
}
