"use client";

import { useRef, useState } from "react";
import {
  DOCUMENTO_TIPO_OPCOES,
  ESTADO_CIVIL_OPCOES,
  ParteDraft,
  composeMoradaPessoa,
  composeNaturalidade,
  nifValido,
} from "@/lib/cpcv-partes-form";
import { analisarComUploadTemporario, extensaoSuportada } from "@/lib/cpcv-ficheiros";
import { sbBrowser } from "@/lib/supabase-browser";
import { CORES_SECAO, CorSecao, grupoClass, Spinner, subTituloClass } from "./ui";

// Resultado de /api/cpcv/extrair-pessoa - só sugestões para o formulário em memória, nunca
// gravado directamente (ver o comentário no topo dessa rota sobre porquê).
type ExtracaoPessoa = {
  tipo_pessoa?: "singular" | "coletiva" | null;
  nome?: string | null;
  nif?: string | null;
  morada_rua?: string | null;
  morada_numero?: string | null;
  morada_codigo_postal?: string | null;
  morada_localidade?: string | null;
  nacionalidade?: string | null;
  naturalidade_concelho?: string | null;
  naturalidade_freguesia?: string | null;
  documento_tipo?: string | null;
  documento_numero?: string | null;
  documento_validade?: string | null;
  representante_nome?: string | null;
  representante_cargo?: string | null;
  certidao_permanente?: string | null;
};

const labelClass = "block text-[11px] text-[#64748B] font-medium mb-1";

// Bloco de campos de uma única parte (vendedor ou comprador), reutilizado em
// app/cpcv/novo/page.tsx (antes de o processo existir) e em app/cpcv/[id]/DadosPartes.tsx
// (depois de criado) - para os dois sítios nunca divergirem nos campos pedidos. A cor segue a
// secção onde o bloco vive (âmbar para vendedor/proprietário, verde para comprador - ver
// CORES_SECAO em ui.tsx) para dar identidade visual própria a cada papel, em vez de tudo igual.
export default function ParteCampos({
  titulo,
  draft,
  cor,
  onChange,
  onRemover,
  comUploadFicheiro,
  estruturado,
}: {
  titulo: string;
  draft: ParteDraft;
  cor: CorSecao;
  onChange: (next: ParteDraft) => void;
  onRemover?: () => void;
  comUploadFicheiro?: boolean;
  // Morada/naturalidade em vários campos (rua, código postal, número.../freguesia, concelho)
  // em vez de um único campo de texto - só em /cpcv/novo, onde a pessoa ainda não existe na
  // BD. Numa parte já gravada (DadosPartes.tsx) não há como decompor de forma fiável uma
  // morada/naturalidade livre já guardada, por isso aí continuam a ser um único campo.
  estruturado?: boolean;
}) {
  const c = CORES_SECAO[cor];
  const campoClass = `w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm bg-white transition-colors focus:outline-none focus:ring-2 ${c.anel}`;

  const [aAnalisar, setAAnalisar] = useState(false);
  const [erroAnalise, setErroAnalise] = useState("");
  // A leitura automática já errou a ordem do nome, a validade e inventou naturalidade a partir
  // de um apelido (casos reais, Outubro 2026) - fica um aviso persistente (nunca desaparece
  // sozinho) sempre que algum campo tiver vindo da IA, para o agente confirmar com o documento
  // antes de gravar. Não distingue campo a campo porque a leitura pode estar errada em
  // qualquer um deles, não só nos que já falharam antes.
  const [lidoPorIA, setLidoPorIA] = useState(false);
  const [avisosLeitura, setAvisosLeitura] = useState<string[]>([]);
  // O que a IA escreveu em cada campo da última vez. Um campo só é substituído por uma nova leitura
  // se estiver vazio ou ainda tiver exactamente o valor da leitura anterior (ninguém o editou à mão)
  // - assim um documento melhor corrige um erro da IA, sem nunca apagar o que o agente corrigiu.
  const ultimaLeitura = useRef<Record<string, string>>({});

  function set<K extends keyof ParteDraft>(chave: K, valor: ParteDraft[K]) {
    onChange({ ...draft, [chave]: valor });
  }

  // Preenche só os campos ainda vazios - nunca substitui o que o agente já tenha corrigido
  // à mão. Isto só actualiza o rascunho em memória: a gravação em cpcv_partes continua a
  // acontecer da forma habitual (um único insert/update no submit), nunca a partir daqui.
  function aplicarExtracao(draftAntes: ParteDraft, extraido: ExtracaoPessoa) {
    const str = (v: string | null | undefined) => (typeof v === "string" && v.trim() ? v.trim() : "");
    const next = { ...draftAntes };
    // Devolve o valor a gravar no campo e regista-o como "escrito pela IA".
    const pick = (campo: string, atual: string, novo: string) => {
      if (!novo) return atual;
      if (!atual.trim() || atual === ultimaLeitura.current[campo]) {
        ultimaLeitura.current[campo] = novo;
        return novo;
      }
      return atual;
    };

    next.nome = pick("nome", next.nome, str(extraido.nome));
    if (next.nome !== draftAntes.nome && (extraido.tipo_pessoa === "singular" || extraido.tipo_pessoa === "coletiva")) {
      next.tipoPessoa = extraido.tipo_pessoa;
    }
    next.nif = pick("nif", next.nif, str(extraido.nif));

    const moradaExtraida = composeMoradaPessoa(
      str(extraido.morada_rua),
      str(extraido.morada_numero),
      "",
      str(extraido.morada_codigo_postal),
      str(extraido.morada_localidade),
      "",
      ""
    );
    next.morada = pick("morada", next.morada, moradaExtraida);
    if (next.morada !== draftAntes.morada) {
      if (estruturado) {
        next.moradaRua = str(extraido.morada_rua);
        next.moradaNumero = str(extraido.morada_numero);
        next.moradaCodigoPostal = str(extraido.morada_codigo_postal);
        next.moradaLocalidade = str(extraido.morada_localidade);
      }
    }

    next.nacionalidade = pick("nacionalidade", next.nacionalidade, str(extraido.nacionalidade));

    const naturalidadeExtraida = composeNaturalidade(str(extraido.naturalidade_freguesia), str(extraido.naturalidade_concelho));
    next.naturalidade = pick("naturalidade", next.naturalidade, naturalidadeExtraida);
    if (next.naturalidade !== draftAntes.naturalidade) {
      if (estruturado) {
        next.naturalidadeFreguesia = str(extraido.naturalidade_freguesia);
        next.naturalidadeConcelho = str(extraido.naturalidade_concelho);
      }
    }

    // O dropdown de tipo de documento já vem com "Cartão de Cidadão" por defeito (nunca vazio),
    // por isso só faz sentido a IA ajustá-lo enquanto o agente ainda não tiver começado a
    // preencher o número à mão - a partir daí presume-se que o tipo já foi confirmado.
    next.documentoNumero = pick("documentoNumero", next.documentoNumero, str(extraido.documento_numero));
    if (next.documentoNumero !== draftAntes.documentoNumero && DOCUMENTO_TIPO_OPCOES.includes(str(extraido.documento_tipo))) {
      next.documentoTipo = str(extraido.documento_tipo);
    }
    next.documentoValidade = pick("documentoValidade", next.documentoValidade, str(extraido.documento_validade));
    next.representanteNome = pick("representanteNome", next.representanteNome, str(extraido.representante_nome));
    next.representanteCargo = pick("representanteCargo", next.representanteCargo, str(extraido.representante_cargo));
    next.certidaoPermanente = pick("certidaoPermanente", next.certidaoPermanente, str(extraido.certidao_permanente));

    if (Object.keys(next).some((chave) => next[chave as keyof ParteDraft] !== draftAntes[chave as keyof ParteDraft])) {
      setLidoPorIA(true);
    }
    onChange(next);
  }

  async function analisarDocumentos(ficheirosNovos: File[], draftAntes: ParteDraft) {
    const suportados = ficheirosNovos.filter((f) => extensaoSuportada(f.name));
    if (suportados.length === 0) return;

    setAAnalisar(true);
    setErroAnalise("");
    try {
      const supabase = sbBrowser();
      const { extraido, avisos } = await analisarComUploadTemporario<{ extraido: ExtracaoPessoa; avisos?: string[] }>(
        supabase,
        suportados,
        "/api/cpcv/extrair-pessoa"
      );
      setAvisosLeitura(avisos ?? []);
      aplicarExtracao(draftAntes, extraido ?? {});
    } catch (e) {
      setErroAnalise(e instanceof Error ? e.message : "Erro ao analisar o documento.");
    } finally {
      setAAnalisar(false);
    }
  }

  function setMorada<
    K extends "moradaRua" | "moradaNumero" | "moradaAndar" | "moradaCodigoPostal" | "moradaLocalidade" | "moradaFreguesia" | "moradaConcelho"
  >(chave: K, valor: string) {
    const next = { ...draft, [chave]: valor };
    onChange({
      ...next,
      morada: composeMoradaPessoa(
        next.moradaRua,
        next.moradaNumero,
        next.moradaAndar,
        next.moradaCodigoPostal,
        next.moradaLocalidade,
        next.moradaFreguesia,
        next.moradaConcelho
      ),
    });
  }

  function setNaturalidade<K extends "naturalidadeFreguesia" | "naturalidadeConcelho">(chave: K, valor: string) {
    const next = { ...draft, [chave]: valor };
    onChange({ ...next, naturalidade: composeNaturalidade(next.naturalidadeFreguesia, next.naturalidadeConcelho) });
  }

  const nifInvalido = draft.nif.trim().length > 0 && !nifValido(draft.nif);
  const mostraRegimeBens = /^casad/i.test(draft.estadoCivil);
  const iniciais = draft.nome.trim().slice(0, 1).toUpperCase() || titulo.slice(0, 1);

  return (
    <div className="border border-[#E2E8F0] rounded-xl p-4 space-y-4 bg-white">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={`flex h-6 w-6 items-center justify-center rounded-full ${c.badgeBg} ${c.badgeText} text-[11px] font-bold shrink-0`}>
            {iniciais}
          </span>
          <span className="text-sm font-semibold text-[#0F172A]">{titulo}</span>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-[11px] text-[#64748B]">
            <input
              type="checkbox"
              checked={draft.tipoPessoa === "coletiva"}
              onChange={(e) => set("tipoPessoa", e.target.checked ? "coletiva" : "singular")}
              style={{ accentColor: c.hex }}
            />
            Empresa
          </label>
          {onRemover && (
            <button
              type="button"
              onClick={onRemover}
              className="text-[#94A3B8] hover:text-red-500 text-xs font-medium transition-colors duration-150"
            >
              Remover
            </button>
          )}
        </div>
      </div>

      {comUploadFicheiro && (
        <div>
          <p className={subTituloClass}>Documentos</p>
          <div className="space-y-1.5">
            {draft.ficheiros.map((f, j) => (
              <div key={j} className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 ${c.chipBg}`}>
                <span className={`text-xs font-medium truncate ${c.chipTexto}`}>{f.name}</span>
                <button
                  type="button"
                  onClick={() => set("ficheiros", draft.ficheiros.filter((_, idx) => idx !== j))}
                  className="text-[#94A3B8] hover:text-red-500 text-xs font-medium transition-colors duration-150 shrink-0"
                >
                  Remover
                </button>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 border border-dashed border-[#E2E8F0]">
              <span className="text-xs font-normal text-[#94A3B8]">
                {draft.ficheiros.length > 0 ? "Mais documentos (opcional)" : "Cópia do documento de identificação (lido automaticamente)"}
              </span>
              <label className={`shrink-0 cursor-pointer text-xs font-semibold hover:underline ${c.link}`}>
                + Adicionar
                <input
                  type="file"
                  multiple
                  accept="application/pdf,image/*"
                  className="hidden"
                  onChange={(e) => {
                    const novos = Array.from(e.target.files ?? []);
                    e.target.value = "";
                    if (novos.length === 0) return;
                    const draftAntes = draft;
                    set("ficheiros", [...draft.ficheiros, ...novos]);
                    analisarDocumentos(novos, draftAntes);
                  }}
                />
              </label>
            </div>
            {aAnalisar && (
              <p className={`text-xs flex items-center gap-2 ${c.link}`}>
                <Spinner className="h-3.5 w-3.5" /> A ler o documento...
              </p>
            )}
            {erroAnalise && <p className="text-xs text-red-500">{erroAnalise}</p>}
          </div>
        </div>
      )}

      {avisosLeitura.length > 0 && (
        <ul className="text-xs text-[#9A5B00] bg-[#FFF4E5] border border-[#F5D9A8] rounded-lg px-3 py-2 list-disc pl-6 space-y-1">
          {avisosLeitura.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>
      )}

      {lidoPorIA && (
        <p className="text-xs text-[#9A5B00] bg-[#FFF4E5] border border-[#F5D9A8] rounded-lg px-3 py-2">
          Dados lidos automaticamente do documento - confirma nome, número e validade do documento,
          e morada, antes de gravar. A leitura pode conter erros.
        </p>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{draft.tipoPessoa === "coletiva" ? "Denominação social" : "Nome"}</label>
          <input value={draft.nome} onChange={(e) => set("nome", e.target.value)} className={campoClass} />
        </div>
        <div>
          <label className={labelClass}>{draft.tipoPessoa === "coletiva" ? "NIPC" : "NIF"}</label>
          <input
            value={draft.nif}
            onChange={(e) => set("nif", e.target.value)}
            className={`${campoClass} ${nifInvalido ? "border-red-400 focus:ring-red-400" : ""}`}
          />
          {nifInvalido && <p className="text-[11px] text-red-500 mt-1">NIF inválido.</p>}
        </div>
        <div>
          <label className={labelClass}>Email (sai no contrato)</label>
          <input type="email" value={draft.email} onChange={(e) => set("email", e.target.value)} className={campoClass} />
        </div>
      </div>

      <div className={grupoClass}>
        <p className={subTituloClass}>Morada {draft.tipoPessoa === "coletiva" ? "da sede" : "fiscal"}</p>
        {estruturado ? (
          <div className="space-y-3">
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className={labelClass}>Rua / Avenida</label>
                <input value={draft.moradaRua} onChange={(e) => setMorada("moradaRua", e.target.value)} className={campoClass} />
              </div>
              <div>
                <label className={labelClass}>Número</label>
                <input value={draft.moradaNumero} onChange={(e) => setMorada("moradaNumero", e.target.value)} className={campoClass} />
              </div>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>Andar</label>
                <input
                  value={draft.moradaAndar}
                  onChange={(e) => setMorada("moradaAndar", e.target.value)}
                  placeholder="4º esquerdo"
                  className={campoClass}
                />
              </div>
              <div>
                <label className={labelClass}>Código postal</label>
                <input
                  value={draft.moradaCodigoPostal}
                  onChange={(e) => setMorada("moradaCodigoPostal", e.target.value)}
                  placeholder="0000-000"
                  className={campoClass}
                />
              </div>
              <div>
                <label className={labelClass}>Localidade</label>
                <input value={draft.moradaLocalidade} onChange={(e) => setMorada("moradaLocalidade", e.target.value)} className={campoClass} />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Freguesia</label>
                <input
                  value={draft.moradaFreguesia}
                  onChange={(e) => setMorada("moradaFreguesia", e.target.value)}
                  className={campoClass}
                />
              </div>
              <div>
                <label className={labelClass}>Concelho</label>
                <input
                  value={draft.moradaConcelho}
                  onChange={(e) => setMorada("moradaConcelho", e.target.value)}
                  className={campoClass}
                />
              </div>
            </div>
          </div>
        ) : (
          <input value={draft.morada} onChange={(e) => set("morada", e.target.value)} className={campoClass} />
        )}
        {/* O cartão de cidadão nem sempre traz o código postal e a morada gravada é texto livre: sem
            ele o contrato não é gerado (a solicitadora precisa dele para as cartas registadas). */}
        {draft.morada.trim() !== "" && !/\b\d{4}-\d{3}\b/.test(draft.morada) && (
          <p className="text-[11px] text-[#9A5B00] mt-1">
            Falta o código postal (0000-000) na morada - o CPCV só é gerado com ele.
          </p>
        )}
      </div>

      {draft.tipoPessoa === "singular" ? (
        <>
          <div className={grupoClass}>
            <p className={subTituloClass}>Dados pessoais</p>
            <div className="space-y-3">
              <div className={`grid gap-3 ${mostraRegimeBens ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
                <div>
                  <label className={labelClass}>Estado civil</label>
                  <select value={draft.estadoCivil} onChange={(e) => set("estadoCivil", e.target.value)} className={campoClass}>
                    <option value="">-</option>
                    {ESTADO_CIVIL_OPCOES.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </div>
                {mostraRegimeBens && (
                  <div>
                    <label className={labelClass}>Casal (cônjuge do mesmo lado)</label>
                    <select value={draft.casal} onChange={(e) => set("casal", e.target.value)} className={campoClass}>
                      <option value="">Sem ligação</option>
                      <option value="1">Casal 1</option>
                      <option value="2">Casal 2</option>
                      <option value="3">Casal 3</option>
                    </select>
                  </div>
                )}
                {mostraRegimeBens && (
                  <div>
                    <label className={labelClass}>Regime de bens</label>
                    <input value={draft.regimeBens} onChange={(e) => set("regimeBens", e.target.value)} className={campoClass} />
                  </div>
                )}
                <div>
                  <label className={labelClass}>Nacionalidade</label>
                  <input value={draft.nacionalidade} onChange={(e) => set("nacionalidade", e.target.value)} className={campoClass} />
                </div>
              </div>

              {estruturado ? (
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Naturalidade - Freguesia</label>
                    <input
                      value={draft.naturalidadeFreguesia}
                      onChange={(e) => setNaturalidade("naturalidadeFreguesia", e.target.value)}
                      className={campoClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Naturalidade - Concelho</label>
                    <input
                      value={draft.naturalidadeConcelho}
                      onChange={(e) => setNaturalidade("naturalidadeConcelho", e.target.value)}
                      className={campoClass}
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className={labelClass}>Naturalidade (freguesia, concelho)</label>
                  <input value={draft.naturalidade} onChange={(e) => set("naturalidade", e.target.value)} className={campoClass} />
                </div>
              )}
            </div>
          </div>

          <div className={grupoClass}>
            <p className={subTituloClass}>Documento de identificação</p>
            <div className="space-y-3">
              <div>
                <label className={labelClass}>Tipo de documento</label>
                <select value={draft.documentoTipo} onChange={(e) => set("documentoTipo", e.target.value)} className={campoClass}>
                  {DOCUMENTO_TIPO_OPCOES.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Número</label>
                  <input value={draft.documentoNumero} onChange={(e) => set("documentoNumero", e.target.value)} className={campoClass} />
                </div>
                <div>
                  <label className={labelClass}>Validade</label>
                  <input
                    type="date"
                    value={draft.documentoValidade}
                    onChange={(e) => set("documentoValidade", e.target.value)}
                    className={campoClass}
                  />
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className={grupoClass}>
          <p className={subTituloClass}>Representação</p>
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Representante</label>
              <input value={draft.representanteNome} onChange={(e) => set("representanteNome", e.target.value)} className={campoClass} />
            </div>
            <div>
              <label className={labelClass}>Cargo do representante</label>
              <input value={draft.representanteCargo} onChange={(e) => set("representanteCargo", e.target.value)} className={campoClass} />
            </div>
            <div>
              <label className={labelClass}>Certidão permanente</label>
              <input
                value={draft.certidaoPermanente}
                onChange={(e) => set("certidaoPermanente", e.target.value)}
                className={campoClass}
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
