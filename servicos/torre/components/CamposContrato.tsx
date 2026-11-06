import { ROTULO_PRODUTO, type Contrato, type Produto } from "@/lib/tipos";
import { campo, rotulo } from "./ui";

const cents = (c: number) => (c ? (c / 100).toFixed(2).replace(".", ",") : "");

/** Campos de um contrato (novo ou a editar) de um cliente. */
export default function CamposContrato({ entidadeId, c }: { entidadeId: string; c?: Contrato }) {
  const id = c?.id ?? "novo";
  return (
    <div className="grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
      <input type="hidden" name="entidade_id" value={entidadeId} />
      {c && <input type="hidden" name="id" value={c.id} />}
      <div>
        <label htmlFor={`produto-${id}`} className={rotulo}>Produto</label>
        <select id={`produto-${id}`} name="produto" required defaultValue={c?.produto ?? ""} className={campo}>
          <option value="" disabled>Escolher</option>
          {(Object.keys(ROTULO_PRODUTO) as Produto[]).map((p) => (
            <option key={p} value={p}>{ROTULO_PRODUTO[p]}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`estado-${id}`} className={rotulo}>Estado</label>
        <select id={`estado-${id}`} name="estado" defaultValue={c?.estado ?? "ativo"} className={campo}>
          <option value="proposta">Proposta (ainda não conta)</option>
          <option value="ativo">Ativo</option>
          <option value="pausado">Pausado</option>
          <option value="terminado">Terminado</option>
        </select>
      </div>
      <div>
        <label htmlFor={`setup-${id}`} className={rotulo}>Arranque (EUR, uma vez)</label>
        <input id={`setup-${id}`} name="setup" inputMode="decimal" placeholder="0,00" defaultValue={cents(c?.setup ?? 0)} className={`${campo} numero`} />
      </div>
      <div>
        <label htmlFor={`mensalidade-${id}`} className={rotulo}>Mensalidade (EUR)</label>
        <input id={`mensalidade-${id}`} name="mensalidade" inputMode="decimal" placeholder="0,00" defaultValue={cents(c?.mensalidade ?? 0)} className={`${campo} numero`} />
      </div>
      <div>
        <label htmlFor={`inicio-${id}`} className={rotulo}>Começa em</label>
        <input id={`inicio-${id}`} name="inicio" type="date" required defaultValue={c?.inicio ?? ""} className={campo} />
      </div>
      <div>
        <label htmlFor={`fim-${id}`} className={rotulo}>Acaba em (opcional)</label>
        <input id={`fim-${id}`} name="fim" type="date" defaultValue={c?.fim ?? ""} className={campo} />
      </div>
      <div>
        <label htmlFor={`dia-${id}`} className={rotulo}>Dia do mês em que paga</label>
        <input id={`dia-${id}`} name="dia" type="number" min={1} max={31} defaultValue={c?.dia ?? 1} className={`${campo} numero`} />
      </div>
      <div>
        <label htmlFor={`nome-${id}`} className={rotulo}>Nome (opcional)</label>
        <input id={`nome-${id}`} name="nome" placeholder="Cockpit, 5 agentes" defaultValue={c?.nome ?? ""} className={campo} />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor={`notas-${id}`} className={rotulo}>Notas</label>
        <input id={`notas-${id}`} name="notas" defaultValue={c?.notas ?? ""} className={campo} />
      </div>
    </div>
  );
}
