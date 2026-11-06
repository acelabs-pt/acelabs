import type { Tudo } from "@/lib/dados";
import { ROTULO_TIPO_CATEGORIA } from "@/lib/dados";
import type { Movimento } from "@/lib/tipos";
import { campo, rotulo } from "./ui";
import Prepreencher, { type Pistas } from "./Prepreencher";

/** Campos de um movimento (novo ou a editar). Os valores escrevem-se sempre positivos; o sentido diz se entra ou sai. */
export default function CamposMovimento({ t, m, hoje }: { t: Tudo; m?: Movimento; hoje: string }) {
  const grupos = (["custo", "proveito", "interno"] as const).map((tipo) => ({ tipo, cats: t.categorias.filter((c) => c.tipo === tipo && (c.ativa || c.id === m?.categoria_id)) }));
  const valor = m ? (Math.abs(m.valor) / 100).toFixed(2).replace(".", ",") : "";
  // Movimento novo: a conta onde se lançou à mão da última vez.
  const ultimaConta = m ? m.conta_id : t.movimentos.find((x) => x.origem === "manual")?.conta_id ?? (t.contas.length === 1 ? t.contas[0].id : "");
  const pistas: Pistas = { categoriaDe: {}, debito: {} };
  for (const x of [...t.movimentos].reverse()) if (x.entidade_id && x.categoria_id) pistas.categoriaDe[x.entidade_id] = x.categoria_id;
  for (const d of t.subscricoes)
    pistas.debito[d.id] = { categoria_id: d.categoria_id, entidade_id: d.entidade_id, conta_id: d.conta_id, valor: d.valor_previsto ? (d.valor_previsto / 100).toFixed(2).replace(".", ",") : null };
  const raiz = `campos-${m?.id ?? "novo"}`;
  return (
    <div id={raiz} className="grid gap-4 sm:grid-cols-2">
      <Prepreencher pistas={pistas} raiz={raiz} />
      <div>
        <label htmlFor="conta_id" className={rotulo}>Conta</label>
        <select id="conta_id" name="conta_id" required defaultValue={ultimaConta} className={campo}>
          <option value="" disabled>Escolher</option>
          {t.contas.filter((c) => c.ativa || c.id === m?.conta_id).map((c) => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="data" className={rotulo}>Data</label>
        <input id="data" name="data" type="date" required defaultValue={m?.data ?? hoje} className={campo} />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="descricao" className={rotulo}>Descrição</label>
        <input id="descricao" name="descricao" required maxLength={500} defaultValue={m?.descricao} className={campo} />
      </div>
      <fieldset>
        <legend className={rotulo}>Sentido</legend>
        <div className="flex gap-4 py-2.5 text-base">
          <label className="flex items-center gap-2">
            <input type="radio" name="sentido" value="saida" defaultChecked={!m || m.valor < 0} /> Saída
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="sentido" value="entrada" defaultChecked={!!m && m.valor > 0} /> Entrada
          </label>
        </div>
      </fieldset>
      <div>
        <label htmlFor="valor" className={rotulo}>Valor (EUR)</label>
        <input id="valor" name="valor" inputMode="decimal" required placeholder="0,00" defaultValue={valor} className={`${campo} numero`} />
      </div>
      <div>
        <label htmlFor="categoria_id" className={rotulo}>Categoria</label>
        <select id="categoria_id" name="categoria_id" defaultValue={m?.categoria_id ?? ""} className={campo}>
          <option value="">Por classificar</option>
          {grupos.map((g) => (
            <optgroup key={g.tipo} label={ROTULO_TIPO_CATEGORIA[g.tipo]}>
              {g.cats.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="socio_id" className={rotulo}>Quem pagou ou fez</label>
        <select id="socio_id" name="socio_id" defaultValue={m?.socio_id ?? ""} className={campo}>
          <option value="">Pela conta (titular)</option>
          {t.socios.map((s) => (
            <option key={s.id} value={s.id}>{s.nome}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="reembolsavel" className={rotulo}>A empresa tem de devolver?</label>
        <select id="reembolsavel" name="reembolsavel" defaultValue={m ? (m.reembolsavel ? "sim" : "nao") : "auto"} className={campo}>
          {!m && <option value="auto">Pela conta (sim se for dinheiro dos sócios)</option>}
          <option value="sim">Sim</option>
          <option value="nao">Não</option>
        </select>
      </div>
      <div>
        <label htmlFor="subscricao_id" className={rotulo}>Débito direto</label>
        <select id="subscricao_id" name="subscricao_id" defaultValue={m?.subscricao_id ?? ""} className={campo}>
          <option value="">Nenhum</option>
          {t.subscricoes.map((x) => (
            <option key={x.id} value={x.id}>{x.nome}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="entidade_id" className={rotulo}>Fornecedor ou cliente</label>
        <select id="entidade_id" name="entidade_id" defaultValue={m?.entidade_id ?? ""} className={campo}>
          <option value="">Nenhum</option>
          {t.entidades.map((e) => (
            <option key={e.id} value={e.id}>{e.nome}</option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="notas" className={rotulo}>Notas</label>
        <input id="notas" name="notas" defaultValue={m?.notas ?? ""} className={campo} />
      </div>
    </div>
  );
}
