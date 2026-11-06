import type { Tudo } from "@/lib/dados";
import type { Subscricao } from "@/lib/tipos";
import { campo, rotulo } from "./ui";

export default function CamposSubscricao({ t, x, hoje }: { t: Tudo; x?: Subscricao; hoje: string }) {
  const valor = x?.valor_previsto != null ? (x.valor_previsto / 100).toFixed(2).replace(".", ",") : "";
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <label htmlFor="nome" className={rotulo}>Nome</label>
        <input id="nome" name="nome" required maxLength={80} defaultValue={x?.nome} placeholder="Vercel, Google Workspace..." className={campo} />
      </div>
      <div>
        <label htmlFor="conta_id" className={rotulo}>Conta de onde sai</label>
        <select id="conta_id" name="conta_id" defaultValue={x?.conta_id ?? ""} className={campo}>
          <option value="">Por definir</option>
          {t.contas.map((c) => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="valor_previsto" className={rotulo}>Valor previsto em EUR (vazio = por confirmar)</label>
        <input id="valor_previsto" name="valor_previsto" inputMode="decimal" defaultValue={valor} placeholder="0,00" className={`${campo} numero`} />
      </div>
      <div>
        <label htmlFor="moeda" className={rotulo}>Moeda em que é cobrado</label>
        <select id="moeda" name="moeda" defaultValue={x?.moeda ?? "EUR"} className={campo}>
          <option value="EUR">Euro</option>
          <option value="USD">Dólar (o valor em euros varia)</option>
        </select>
      </div>
      <div>
        <label htmlFor="periodicidade" className={rotulo}>De quanto em quanto tempo</label>
        <select id="periodicidade" name="periodicidade" defaultValue={x?.periodicidade ?? "mensal"} className={campo}>
          <option value="mensal">Todos os meses</option>
          <option value="trimestral">De 3 em 3 meses</option>
          <option value="anual">Uma vez por ano</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="dia" className={rotulo}>Dia</label>
          <input id="dia" name="dia" type="number" min={1} max={31} defaultValue={x?.dia ?? 1} className={`${campo} numero`} />
        </div>
        <div>
          <label htmlFor="inicio" className={rotulo}>Desde</label>
          <input id="inicio" name="inicio" type="date" defaultValue={x?.inicio ?? hoje} className={campo} />
        </div>
      </div>
      <div>
        <label htmlFor="categoria_id" className={rotulo}>Categoria</label>
        <select id="categoria_id" name="categoria_id" defaultValue={x?.categoria_id ?? ""} className={campo}>
          <option value="">Nenhuma</option>
          {t.categorias.filter((c) => c.tipo === "custo").map((c) => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="entidade_id" className={rotulo}>Fornecedor</label>
        <select id="entidade_id" name="entidade_id" defaultValue={x?.entidade_id ?? ""} className={campo}>
          <option value="">Nenhum</option>
          {t.entidades.map((e) => (
            <option key={e.id} value={e.id}>{e.nome}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="debito_direto" className={rotulo}>Como se paga</label>
        <select id="debito_direto" name="debito_direto" defaultValue={x && !x.debito_direto ? "nao" : "sim"} className={campo}>
          <option value="sim">Débito direto ou cartão (sai sozinho)</option>
          <option value="nao">Pagamento à mão</option>
        </select>
      </div>
      <div>
        <label htmlFor="ativa" className={rotulo}>Estado</label>
        <select id="ativa" name="ativa" defaultValue={x && !x.ativa ? "nao" : "sim"} className={campo}>
          <option value="sim">Ativo</option>
          <option value="nao">Cancelado</option>
        </select>
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="notas" className={rotulo}>Notas</label>
        <input id="notas" name="notas" defaultValue={x?.notas ?? ""} className={campo} />
      </div>
    </div>
  );
}
