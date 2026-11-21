import { sbBrowser } from "@/lib/supabase-browser";
import { descarregar, linhaDaFicha, paraCsv } from "@/lib/exportarTudo";
import { nomeFicheiro, novoPdf } from "@/lib/pdf";

type Linha = Record<string, unknown>;

/**
 * Reúne tudo o que a app guarda sobre uma pessoa (contacto, ficha de comprador ou de proprietário, imóveis,
 * documentos, zonas, chamadas, tarefas, alertas e angariações) num único objeto. É o que se entrega quando
 * alguém pede os seus dados. Só lê, não altera nada.
 */
export async function reunirDadosDoContacto(contactoId: string) {
  const sb = sbBrowser();
  const um = async (q: PromiseLike<{ data: unknown; error: unknown }>): Promise<Linha[]> => {
    const { data, error } = await q;
    if (error) throw new Error("Não foi possível ler os dados.");
    return (data ?? []) as Linha[];
  };

  const [contacto] = await um(sb.from("contactos").select("*").eq("id", contactoId));
  if (!contacto) throw new Error("Contacto não encontrado.");

  const [comprador] = await um(sb.from("compradores").select("*").eq("contacto_id", contactoId));
  const [proprietario] = await um(sb.from("proprietarios").select("*").eq("contacto_id", contactoId));
  const cid = comprador?.id as string | undefined;
  const pid = proprietario?.id as string | undefined;

  const [zonas, imoveis, documentos, documentosProprietario, angariacoes, chamadas, tarefasContacto, tarefasComprador, tarefasProprietario, alertasComprador, alertasProprietario] = await Promise.all([
    cid ? um(sb.from("comprador_zonas").select("*").eq("comprador_id", cid)) : [],
    cid ? um(sb.from("comprador_imoveis").select("*").eq("comprador_id", cid)) : [],
    cid ? um(sb.from("comprador_documentos").select("*").eq("comprador_id", cid)) : [],
    pid ? um(sb.from("proprietario_documentos").select("*").eq("proprietario_id", pid)) : [],
    pid ? um(sb.from("angariacoes").select("*").eq("proprietario_id", pid)) : [],
    um(sb.from("chamadas").select("*").eq("contacto_id", contactoId).order("ocorreu_em")),
    um(sb.from("tarefas").select("*").eq("contacto_id", contactoId)),
    cid ? um(sb.from("tarefas").select("*").eq("comprador_id", cid)) : [],
    pid ? um(sb.from("tarefas").select("*").eq("proprietario_id", pid)) : [],
    cid ? um(sb.from("correspondencias").select("*").eq("comprador_id", cid)) : [],
    pid ? um(sb.from("correspondencias").select("*").eq("proprietario_id", pid)) : [],
  ]);

  const unicos = (l: Linha[]) => [...new Map(l.map((x) => [x.id as string, x])).values()];
  return {
    exportado_em: new Date().toISOString(),
    origem: "Cockpit (Ace Labs)",
    contacto,
    ficha_de_comprador: comprador ? { ...comprador, zonas, imoveis, documentos_da_escritura: documentos } : null,
    ficha_de_proprietario: proprietario ? { ...proprietario, angariacoes, documentos: documentosProprietario } : null,
    chamadas,
    tarefas: unicos([...tarefasContacto, ...tarefasComprador, ...tarefasProprietario]),
    alertas_de_correspondencia: unicos([...alertasComprador, ...alertasProprietario]),
  };
}

/** Descarrega os dados do contacto como um ficheiro JSON. Devolve o nome do ficheiro. */
export async function exportarContacto(contactoId: string, nome: string): Promise<string> {
  const dados = await reunirDadosDoContacto(contactoId);
  const slug = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const ficheiro = `cockpit-${slug || "contacto"}-${new Date().toISOString().slice(0, 10)}.json`;
  const url = URL.createObjectURL(new Blob([JSON.stringify(dados, null, 2)], { type: "application/json;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = ficheiro;
  a.click();
  URL.revokeObjectURL(url);
  return ficheiro;
}

// ---------------------------------------------------------------------------------------------------------------
// Ficha em Excel e em PDF: o que o consultor usa no dia a dia (passar a lead a alguém, um dashboard próprio, imprimir).
// O ficheiro acima (JSON, com tudo) fica para os pedidos de acesso aos dados.

type Tipo = "compradores" | "proprietarios";

async function lerFicha(tipo: Tipo, contactoId: string) {
  const sb = sbBrowser();
  const { data, error } = await sb.from(tipo).select("*, contactos(*)").eq("contacto_id", contactoId).limit(1);
  const ficha = (data ?? [])[0] as Linha | undefined;
  if (error || !ficha) throw new Error("Ficha não encontrada.");
  const zonas = tipo === "compradores" ? ((await sb.from("comprador_zonas").select("*").eq("comprador_id", ficha.id as string)).data ?? []) : [];
  return { ficha, zonas: zonas as Linha[] };
}

/** Uma linha em Excel (CSV) com as mesmas colunas do modelo de importação: abre no Excel e importa-se noutro Cockpit. */
export async function exportarFichaExcel(tipo: Tipo, contactoId: string, nome: string): Promise<void> {
  const { ficha, zonas } = await lerFicha(tipo, contactoId);
  descarregar(paraCsv(tipo, [linhaDaFicha(tipo, ficha, zonas)]), nomeFicheiro(`ficha ${nome}`, "csv"), "text/csv;charset=utf-8");
}

const eur = (v: unknown) => (v == null || v === "" ? "" : `${Number(v).toLocaleString("pt-PT")} euros`);
const dia = (v: unknown) => (typeof v === "string" && v ? new Date(v.slice(0, 10) + "T00:00:00").toLocaleDateString("pt-PT") : "");

/** PDF "Ficha de cliente": os dados e o que procura (ou o imóvel), pronto a imprimir ou a enviar. */
export async function exportarFichaPdf(tipo: Tipo, contactoId: string, nome: string): Promise<void> {
  const { ficha: f, zonas } = await lerFicha(tipo, contactoId);
  const c = (f.contactos ?? {}) as Linha;
  const l = linhaDaFicha(tipo, f, zonas);
  const sb = sbBrowser();
  const pdf = await novoPdf(`Ficha de ${nome} · ${new Date().toLocaleDateString("pt-PT")}`);
  pdf.rotulo(tipo === "compradores" ? "Ficha de cliente comprador" : "Ficha de cliente proprietário");
  pdf.titulo(nome);
  pdf.texto(`Emitida a ${new Date().toLocaleDateString("pt-PT", { day: "numeric", month: "long", year: "numeric" })}`, { cor: "sec", tamanho: 8.5 });
  pdf.secao("Contacto");
  pdf.campos([
    ["Telemóvel", c.telemovel as string],
    ["Email", c.email as string],
    ["Origem", c.canal_origem as string],
  ]);
  const zona = [l.freguesia, l.concelho, l.distrito].filter(Boolean).join(", ");
  if (tipo === "compradores") {
    pdf.secao("O que procura");
    pdf.campos([
      ["Tipo de imóvel", l.tipo_imovel],
      ["Tipologia", l.tipologia_minima ? `${l.tipologia_minima} ou mais` : ""],
      ["Orçamento até", eur(f.expectativa_valor)],
      ["Zona", zona],
      ["Outras zonas", l.outras_zonas.split(" | ").join(", ")],
      ["Financiamento", l.financiamento],
      ["Precisa de vender", l.precisa_vender],
      ["Motivação", l.motivacao ? `${l.motivacao} em 10` : ""],
      ["Fase", l.estado],
    ]);
    const { data } = await sb.from("comprador_imoveis").select("*").eq("comprador_id", f.id as string).order("created_at");
    const imoveis = (data ?? []) as Linha[];
    if (imoveis.length) {
      pdf.secao("Imóveis enviados", String(imoveis.length));
      for (const i of imoveis) {
        const marcos = [
          i.enviado_em && `enviado a ${dia(i.enviado_em)}`,
          i.visitado_em && `visita a ${dia(i.visitado_em)}${i.visita_hora ? ` às ${i.visita_hora}` : ""}`,
          i.proposta_em && `proposta a ${dia(i.proposta_em)}`,
          i.sem_interesse_em && "sem interesse",
        ].filter(Boolean).join(" · ");
        pdf.item(String(i.descricao || i.link || "Imóvel"), marcos || null, [i.visita_obs, i.proposta_obs].filter(Boolean).join(" ") || null);
      }
    }
  } else {
    pdf.secao("O imóvel");
    pdf.campos([
      ["Tipo de imóvel", l.tipo_imovel],
      ["Tipologia", l.tipologia],
      ["Valor pretendido", eur(f.valor)],
      ["Zona", zona],
      ["Anúncio", l.link_imovel],
      ["Fase", l.estado],
    ]);
  }
  if (c.observacoes) {
    pdf.secao("Notas");
    pdf.texto(String(c.observacoes));
  }
  pdf.guardar(nomeFicheiro(`ficha ${nome}`));
}
