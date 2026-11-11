import { sbBrowser } from "@/lib/supabase-browser";
import { distribuirHoras } from "@/lib/horas";
import { ACOES_PADRAO, dataDoDia, linhasDoPlano, tarefaDaAcao, type Acao } from "@/lib/angariacao";
import type { Entidade } from "@/lib/importar/esquemas";
import type { Existentes, LinhaValida } from "@/lib/importar/validar";
import { todas } from "@/lib/todas";

const LOTE = 200;

/** Telemóveis, emails e títulos que já existem, para não importar duas vezes a mesma pessoa. */
export async function carregarExistentes(): Promise<Existentes> {
  const sb = sbBrowser();
  const [c, a] = await Promise.all([
    todas<{ telemovel: string | null; email: string | null }>((de, ate) => sb.from("contactos").select("telemovel, email").order("id").range(de, ate)),
    todas<{ titulo: string }>((de, ate) => sb.from("angariacoes").select("titulo").order("id").range(de, ate)),
  ]);
  const norm = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[_\-.]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  return {
    telemoveis: new Set(c.data.map((x) => x.telemovel).filter((x): x is string => !!x)),
    emails: new Set(c.data.map((x) => x.email?.toLowerCase()).filter((x): x is string => !!x)),
    titulos: new Set(a.data.map((x) => norm(x.titulo))),
  };
}

export type Progresso = { feitas: number; total: number; fase: string };
export type Opcoes = {
  /** Angariações: criar o plano de ações do contrato. */
  montarPlano: boolean;
  /** Angariações: não criar ações cuja data já passou (evita encher o calendário de atrasos). */
  soAcoesFuturas: boolean;
};
export type Resultado = { importadas: number; erro: string | null };

/** Data de hoje (aaaa-mm-dd) no fuso do telemóvel. */
function hojeLocal(): string {
  const h = new Date();
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}-${String(h.getDate()).padStart(2, "0")}`;
}

const em = <T,>(l: T[]): T[][] => Array.from({ length: Math.ceil(l.length / LOTE) }, (_, i) => l.slice(i * LOTE, (i + 1) * LOTE));

/** Grava as linhas válidas, em lotes. Se um lote falhar, desfaz esse lote e para (os anteriores ficam gravados). */
export async function gravar(
  e: Entidade,
  validas: LinhaValida[],
  opcoes: Opcoes,
  onProgresso: (p: Progresso) => void
): Promise<Resultado> {
  const sb = sbBrowser();
  let feitas = 0;
  const total = validas.length;
  const avanco = (fase: string) => onProgresso({ feitas, total, fase });

  if (e === "angariacoes") {
    for (const lote of em(validas)) {
      avanco("A guardar angariações");
      const linhas = lote.map((l) => {
        const d = { ...l.dados };
        // Sem data, conta a partir de hoje. Vai sempre preenchida: num lote em que umas linhas têm data e outras não,
        // a base recebia o campo vazio nas que não tinham e recusava o lote inteiro.
        if (!d.inicio) d.inicio = hojeLocal();
        return { id: crypto.randomUUID(), ...d };
      });
      const { error } = await sb.from("angariacoes").insert(linhas);
      if (error) return { importadas: feitas, erro: "Não foi possível guardar as angariações." };
      if (opcoes.montarPlano) {
        avanco("A montar os planos");
        const err = await montarPlanos(linhas as { id: string; titulo: string; inicio?: string; duracao_dias: 120 | 180 }[], opcoes.soAcoesFuturas);
        if (err) return { importadas: feitas + lote.length, erro: err };
      }
      feitas += lote.length;
      avanco("A guardar angariações");
    }
    return { importadas: feitas, erro: null };
  }

  for (const lote of em(validas)) {
    avanco(`A guardar ${e}`);
    const ids = lote.map(() => ({ contacto: crypto.randomUUID(), dono: crypto.randomUUID() }));
    const contactos = lote.map((l, i) => ({ id: ids[i].contacto, ...l.contacto }));
    const { error: e1 } = await sb.from("contactos").insert(contactos);
    if (e1) return { importadas: feitas, erro: "Não foi possível guardar os contactos." };

    const donos = lote.map((l, i) => ({ id: ids[i].dono, contacto_id: ids[i].contacto, ...l.dados }));
    const { error: e2 } = await sb.from(e).insert(donos);
    if (e2) {
      await sb.from("contactos").delete().in("id", ids.map((x) => x.contacto)); // não deixar contactos sem ficha
      return { importadas: feitas, erro: `Não foi possível guardar os ${e}.` };
    }

    if (e === "compradores") {
      const zonas = lote.flatMap((l, i) =>
        l.zonas.map((z) => ({ comprador_id: ids[i].dono, distrito: z.distrito, concelho: z.concelho || null, freguesia: z.freguesia || null }))
      );
      if (zonas.length > 0) {
        const { error: e3 } = await sb.from("comprador_zonas").insert(zonas);
        if (e3) {
          await sb.from("contactos").delete().in("id", ids.map((x) => x.contacto)); // apaga em cascata a ficha
          return { importadas: feitas, erro: "Não foi possível guardar as zonas." };
        }
      }
    }
    feitas += lote.length;
    avanco(`A guardar ${e}`);
  }
  return { importadas: feitas, erro: null };
}

async function montarPlanos(angs: { id: string; titulo: string; inicio?: string; duracao_dias: 120 | 180 }[], soFuturas: boolean): Promise<string | null> {
  const sb = sbBrowser();
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const hojeIso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
  const nomes = ACOES_PADRAO.map((a) => a.nome);
  const acoes: (Acao & { angariacao_id: string })[] = [];
  const pendentes: { acao: Acao; inicio: string; titulo: string }[] = [];
  for (const a of angs) {
    const inicio = a.inicio ?? hojeIso;
    for (const l of linhasDoPlano(nomes, true, a.duracao_dias)) {
      if (soFuturas && dataDoDia(inicio, l.dia) < hoje) continue;
      const acao = { id: crypto.randomUUID(), angariacao_id: a.id, nome: l.nome, dia: l.dia, follow_up: l.follow_up, feita: false, feita_em: null, feedback: null } as Acao;
      acoes.push(acao);
      pendentes.push({ acao, inicio, titulo: a.titulo });
    }
  }
  const horas = await distribuirHoras(pendentes.map((p) => ({ chave: p.acao.id, dia: dataDoDia(p.inicio, p.acao.dia) })));
  const tarefas = pendentes.map((p, i) => tarefaDaAcao(p.acao, { inicio: p.inicio, titulo: p.titulo }, horas[i]));
  for (const lote of em(acoes)) {
    const { error } = await sb.from("angariacao_acoes").insert(lote);
    if (error) return "As angariações foram criadas mas não foi possível montar os planos.";
  }
  for (const lote of em(tarefas)) {
    const { error } = await sb.from("tarefas").insert(lote);
    if (error) return "Os planos foram criados mas não foi possível pô-los no calendário.";
  }
  return null;
}
