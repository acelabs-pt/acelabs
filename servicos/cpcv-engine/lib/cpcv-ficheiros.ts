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
