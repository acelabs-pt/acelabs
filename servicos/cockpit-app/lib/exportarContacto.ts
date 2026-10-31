import { sbBrowser } from "@/lib/supabase-browser";

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

  const [zonas, imoveis, documentos, angariacoes, chamadas, tarefasContacto, tarefasComprador, tarefasProprietario, alertasComprador, alertasProprietario] = await Promise.all([
    cid ? um(sb.from("comprador_zonas").select("*").eq("comprador_id", cid)) : [],
    cid ? um(sb.from("comprador_imoveis").select("*").eq("comprador_id", cid)) : [],
    cid ? um(sb.from("comprador_documentos").select("*").eq("comprador_id", cid)) : [],
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
    ficha_de_proprietario: proprietario ? { ...proprietario, angariacoes } : null,
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
