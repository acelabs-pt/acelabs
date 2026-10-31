import { FUNIL } from "@/lib/comprador";
import { FUNIL_PROP } from "@/lib/proprietario";

export type Entidade = "compradores" | "proprietarios" | "angariacoes";

export type Coluna = {
  chave: string;
  rotulo: string;
  obrigatoria?: boolean;
  /** Outros nomes que a coluna pode ter no ficheiro do agente (sem acentos, minúsculas). */
  apelidos: string[];
  exemplo: string;
  ajuda?: string;
};

const CONTACTO: Coluna[] = [
  { chave: "nome", rotulo: "Nome", obrigatoria: true, apelidos: ["nome", "cliente", "contacto", "name", "nome completo"], exemplo: "Ana Ferreira" },
  { chave: "telemovel", rotulo: "Telemóvel", apelidos: ["telemovel", "telefone", "tlm", "tlf", "contacto telefonico", "phone", "numero"], exemplo: "912 345 678", ajuda: "Sem indicativo assume +351" },
  { chave: "email", rotulo: "Email", apelidos: ["email", "e-mail", "mail", "correio"], exemplo: "ana@exemplo.pt" },
  { chave: "canal_origem", rotulo: "Canal de origem", apelidos: ["canal", "canal origem", "origem", "fonte", "lead"], exemplo: "Idealista" },
  { chave: "observacoes", rotulo: "Observações", apelidos: ["observacoes", "notas", "nota", "comentarios", "obs"], exemplo: "Prefere contacto à tarde" },
];

const IMOVEL: Coluna[] = [
  { chave: "tipo_imovel", rotulo: "Tipo de imóvel", apelidos: ["tipo", "tipo imovel", "tipo de imovel", "imovel"], exemplo: "Apartamento", ajuda: "Apartamento, Moradia, Terreno, Armazém, Loja, Prédio, Outro" },
  { chave: "distrito", rotulo: "Distrito", apelidos: ["distrito"], exemplo: "Braga" },
  { chave: "concelho", rotulo: "Concelho", apelidos: ["concelho", "municipio", "cidade"], exemplo: "Guimarães" },
  { chave: "freguesia", rotulo: "Freguesia", apelidos: ["freguesia"], exemplo: "Creixomil" },
];

export const ESQUEMAS: Record<Entidade, { titulo: string; singular: string; colunas: Coluna[] }> = {
  compradores: {
    titulo: "Compradores",
    singular: "comprador",
    colunas: [
      ...CONTACTO,
      { chave: "motivacao", rotulo: "Motivação (0 a 10)", apelidos: ["motivacao", "motivação", "score"], exemplo: "7" },
      ...IMOVEL,
      {
        chave: "outras_zonas",
        rotulo: "Outras zonas",
        apelidos: ["outras zonas", "zonas", "zonas extra"],
        exemplo: "Porto/Maia | Braga/Barcelos",
        ajuda: "Zonas além da primeira, separadas por uma barra vertical (|), no formato Distrito/Concelho/Freguesia (concelho e freguesia são opcionais)",
      },
      { chave: "tipologia_minima", rotulo: "Tipologia mínima", apelidos: ["tipologia", "tipologia minima", "quartos"], exemplo: "T2" },
      { chave: "expectativa_valor", rotulo: "Expectativa de valor (EUR)", apelidos: ["valor", "orcamento", "preco", "expectativa", "expectativa valor", "budget"], exemplo: "250000" },
      { chave: "financiamento", rotulo: "Financiamento", apelidos: ["financiamento", "credito"], exemplo: "Crédito pré-aprovado", ajuda: "Capitais próprios, Crédito pré-aprovado, Vai pedir crédito" },
      { chave: "precisa_vender", rotulo: "Precisa de vender?", apelidos: ["precisa vender", "precisa de vender", "vende primeiro"], exemplo: "Não", ajuda: "Sim ou Não" },
      { chave: "referencia_imovel", rotulo: "Referência do imóvel", apelidos: ["referencia", "ref", "referencia imovel"], exemplo: "REF-1042" },
      { chave: "estado", rotulo: "Fase do funil", apelidos: ["estado", "fase", "funil", "etapa"], exemplo: "Imóveis enviados", ajuda: FUNIL.map((f) => f.label).join(", ") + ". Em branco = Lead qualificada" },
    ],
  },
  proprietarios: {
    titulo: "Proprietários",
    singular: "proprietário",
    colunas: [
      ...CONTACTO,
      ...IMOVEL,
      { chave: "tipologia", rotulo: "Tipologia", apelidos: ["tipologia", "quartos"], exemplo: "T3" },
      { chave: "valor", rotulo: "Preço pedido (EUR)", apelidos: ["valor", "preco", "preco pedido", "pedido"], exemplo: "320000" },
      { chave: "link_imovel", rotulo: "Link do anúncio", apelidos: ["link", "anuncio", "url", "link imovel", "link do anuncio"], exemplo: "https://www.idealista.pt/imovel/123" },
      { chave: "estado", rotulo: "Fase do funil", apelidos: ["estado", "fase", "funil", "etapa"], exemplo: "FSBO", ajuda: FUNIL_PROP.map((f) => f.label).join(", ") + ". Em branco = FSBO" },
    ],
  },
  angariacoes: {
    titulo: "Angariações",
    singular: "angariação",
    colunas: [
      { chave: "titulo", rotulo: "Imóvel (morada ou referência)", obrigatoria: true, apelidos: ["titulo", "imovel", "morada", "referencia", "angariacao", "descricao"], exemplo: "Apartamento T3 Azurém" },
      { chave: "inicio", rotulo: "Início do contrato", apelidos: ["inicio", "data inicio", "inicio contrato", "data", "data de inicio", "assinatura"], exemplo: "15/09/2026", ajuda: "dd/mm/aaaa. Em branco = hoje" },
      { chave: "duracao_dias", rotulo: "Duração (120 ou 180 dias)", apelidos: ["duracao", "duracao dias", "prazo", "dias"], exemplo: "180", ajuda: "Em branco = 180" },
      { chave: "regime", rotulo: "Regime", apelidos: ["regime", "exclusividade", "exclusivo"], exemplo: "Exclusivo", ajuda: "Exclusivo ou Não exclusivo" },
      ...IMOVEL,
      { chave: "tipologia", rotulo: "Tipologia", apelidos: ["tipologia", "quartos"], exemplo: "T3" },
      { chave: "valor", rotulo: "Preço pedido (EUR)", apelidos: ["valor", "preco", "preco pedido", "pedido"], exemplo: "400000" },
    ],
  },
};

/** Modelo para descarregar: cabeçalho e uma linha de exemplo. CSV com ";" e BOM, que o Excel em português abre bem. */
export function modeloCsv(e: Entidade): string {
  const cols = ESQUEMAS[e].colunas;
  const esc = (s: string) => (/[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  return "﻿" + [cols.map((c) => esc(c.rotulo)).join(";"), cols.map((c) => esc(c.exemplo)).join(";")].join("\r\n") + "\r\n";
}
