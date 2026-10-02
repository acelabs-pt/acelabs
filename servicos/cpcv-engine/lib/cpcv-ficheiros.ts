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
