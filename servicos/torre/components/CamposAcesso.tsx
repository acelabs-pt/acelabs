import { CATEGORIAS_ACESSO, DOIS_FATORES, ESTADOS_ACESSO, type Acesso } from "@/lib/acessos";
import { campo, rotulo } from "./ui";

const ROTULO_ESTADO: Record<string, string> = { ativo: "Ativo", "por criar": "Por criar", "a cancelar": "A cancelar" };
const ROTULO_2FA: Record<string, string> = { sim: "Sim", não: "Não", "não sei": "Não sei" };

/** Campos de um acesso (novo ou a editar). O aviso não sai: o formulário nunca é sítio para segredos. */
export default function CamposAcesso({ a, donos, prefixo }: { a?: Acesso; donos: string[]; prefixo: string }) {
  const id = (k: string) => `${prefixo}-${k}`;
  const categorias = a && !(CATEGORIAS_ACESSO as readonly string[]).includes(a.categoria) ? [...CATEGORIAS_ACESSO, a.categoria] : CATEGORIAS_ACESSO;
  const opcoesDono = a?.dono && !donos.includes(a.dono) ? [...donos, a.dono] : donos;
  return (
    <>
      <p role="note" className="rounded-xl bg-ambar-fundo px-4 py-3 text-sm font-medium text-ambar-texto">
        Nunca escrevas aqui passwords ou chaves. Escreve só onde estão guardadas (ex.: cofre de passwords, .env.local do Pedro em servicos/torre).
      </p>
      {a && <input type="hidden" name="id" value={a.id} />}
      <div className="grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
        <div>
          <label htmlFor={id("servico")} className={rotulo}>Serviço</label>
          <input id={id("servico")} name="servico" required defaultValue={a?.servico ?? ""} placeholder="Ex.: Vercel, equipa acelabs1" className={campo} />
        </div>
        <div>
          <label htmlFor={id("categoria")} className={rotulo}>Categoria</label>
          <select id={id("categoria")} name="categoria" defaultValue={a?.categoria ?? "Alojamento"} className={campo}>
            {categorias.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={id("para_que")} className={rotulo}>Para que serve</label>
          <input id={id("para_que")} name="para_que" defaultValue={a?.para_que ?? ""} className={campo} />
        </div>
        <div>
          <label htmlFor={id("conta")} className={rotulo}>Conta (email ou utilizador de entrada)</label>
          <input id={id("conta")} name="conta" defaultValue={a?.conta ?? ""} autoComplete="off" className={campo} />
        </div>
        <div>
          <label htmlFor={id("url")} className={rotulo}>Endereço</label>
          <input id={id("url")} name="url" type="url" defaultValue={a?.url ?? ""} placeholder="https://" className={campo} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={id("onde_esta")} className={rotulo}>Onde está a credencial</label>
          <input id={id("onde_esta")} name="onde_esta" defaultValue={a?.onde_esta ?? ""} autoComplete="off" placeholder="Ex.: cofre de passwords; só no PC do Pedro; segredo da função no Supabase" className={campo} />
        </div>
        <div>
          <label htmlFor={id("dono")} className={rotulo}>Dono</label>
          <select id={id("dono")} name="dono" defaultValue={a?.dono ?? ""} className={campo}>
            <option value="">Sem dono definido</option>
            {opcoesDono.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={id("dois_fatores")} className={rotulo}>Verificação em dois passos (2FA)</label>
          <select id={id("dois_fatores")} name="dois_fatores" defaultValue={a?.dois_fatores ?? "não sei"} className={campo}>
            {DOIS_FATORES.map((d) => (
              <option key={d} value={d}>{ROTULO_2FA[d]}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={id("custo_mensal")} className={rotulo}>Custo por mês (EUR)</label>
          <input id={id("custo_mensal")} name="custo_mensal" inputMode="decimal" defaultValue={a?.custo_mensal != null ? (a.custo_mensal / 100).toFixed(2).replace(".", ",") : ""} placeholder="0,00" className={`${campo} numero`} />
        </div>
        <div>
          <label htmlFor={id("renovacao")} className={rotulo}>Renovação</label>
          <input id={id("renovacao")} name="renovacao" type="date" defaultValue={a?.renovacao ?? ""} className={campo} />
        </div>
        <div>
          <label htmlFor={id("estado")} className={rotulo}>Estado</label>
          <select id={id("estado")} name="estado" defaultValue={a?.estado ?? "ativo"} className={campo}>
            {ESTADOS_ACESSO.map((e) => (
              <option key={e} value={e}>{ROTULO_ESTADO[e]}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={id("notas")} className={rotulo}>Notas</label>
          <textarea id={id("notas")} name="notas" rows={2} defaultValue={a?.notas ?? ""} className={campo} />
        </div>
      </div>
    </>
  );
}
