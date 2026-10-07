import type { sbBrowser } from "./supabase-browser";

// Extensões que a extração por IA sabe processar (ver mediaTypeFor em
// app/api/cpcv/extrair/route.ts) - um ficheiro fora desta lista (ex.: .heic de
// fotos de iPhone, .docx, .webp) era aceite na UI e gravado no Storage sem aviso,
// mas ficava silenciosamente de fora da análise da IA. Agora é rejeitado já na
// escolha do ficheiro, com um aviso claro.
const EXTENSOES_SUPORTADAS = ["pdf", "png", "jpg", "jpeg"];

export function extensaoSuportada(nomeFicheiro: string): boolean {
  const ext = nomeFicheiro.toLowerCase().split(".").pop() ?? "";
  return EXTENSOES_SUPORTADAS.includes(ext);
}

// O caminho no Storage é <utilizador>/<processo>/<nome do ficheiro>, com upsert:true -
// dois ficheiros com o mesmo nome (comum em scans/apps de telemóvel que geram nomes
// previsíveis, ex.: "scan001.pdf") substituíam-se silenciosamente um ao outro,
// mantendo as duas entradas na lista de documentos mas com o conteúdo de só um deles.
export function nomeSemColisao(nome: string, jaUsados: string[]): string {
  if (!jaUsados.includes(nome)) return nome;
  const pontoIdx = nome.lastIndexOf(".");
  const base = pontoIdx === -1 ? nome : nome.slice(0, pontoIdx);
  const ext = pontoIdx === -1 ? "" : nome.slice(pontoIdx);
  let i = 2;
  let candidato = `${base} (${i})${ext}`;
  while (jaUsados.includes(candidato)) {
    i++;
    candidato = `${base} (${i})${ext}`;
  }
  return candidato;
}

// O caminho no Storage tem de ser uma chave válida (sem acentos, cedilhas, tis) - um
// nome como "contrato-promoção.pdf" ou "José Ação.pdf" falhava o upload com erro do
// Storage. O nome original (com acentos) continua a ser guardado em `nome_original`
// para mostrar na UI; só a chave de Storage é que precisa de ficar em ASCII simples.
export function nomeFicheiroSeguro(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_");
}

// Manda ficheiros a analisar por uma rota de IA "ao vivo" (antes de o processo existir - ver
// /api/cpcv/extrair-pessoa e /api/cpcv/extrair-documento-imovel), sem os enviar embutidos em
// base64 no corpo do pedido: um documento com fotos/gráficos (ex.: um certificado energético
// com várias páginas) facilmente ultrapassa o limite de ~4.5MB que a Vercel impõe ao corpo de um
// pedido a uma função serverless, e esse limite falhava silenciosamente para o utilizador (um
// "Erro ao ler o documento." genérico, sem indicar a causa real - testado com um certificado
// energético real enquanto os ficheiros de teste, mais pequenos, passavam sem problema). Em vez
// disso, cada ficheiro vai primeiro para uma pasta temporária do próprio utilizador no Storage
// (upload directo do browser para o Supabase, sem passar pela nossa função), a rota recebe só os
// caminhos, descarrega-os ela própria no servidor (sem limite de corpo do pedido - o mesmo
// padrão já usado em /api/cpcv/extrair), e os ficheiros temporários são sempre apagados a seguir,
// sucesso ou erro.
export async function analisarComUploadTemporario<T>(
  supabase: ReturnType<typeof sbBrowser>,
  ficheiros: File[],
  endpoint: string
): Promise<T> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sessão expirada - entra outra vez.");

  const caminhos: string[] = [];
  try {
    for (const file of ficheiros) {
      const caminho = `${user.id}/_temp/${crypto.randomUUID()}-${nomeFicheiroSeguro(file.name)}`;
      const { error } = await supabase.storage.from("cpcv-documentos").upload(caminho, file);
      if (error) throw new Error(error.message);
      caminhos.push(caminho);
    }

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caminhos }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? "Erro ao ler o documento.");
    }

    return (await res.json()) as T;
  } finally {
    await Promise.all(caminhos.map((c) => supabase.storage.from("cpcv-documentos").remove([c]).catch(() => {})));
  }
}
