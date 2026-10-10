import { NextRequest, NextResponse } from "next/server";
import { sbUserServer } from "@/lib/supabase-server";
import { anthropicClient, EXTRACTION_MODEL } from "@/lib/anthropic";

// Mesmo padrão de /api/cpcv/extrair-documento-imovel e /api/cpcv/extrair-pessoa: nunca escreve
// na BD, só devolve sugestões - quem grava em cpcv_hipotecas é sempre a gestora/agente, a partir
// de app/cpcv/[id]/IdentificacaoImovel.tsx (botão "Analisar certidão predial"), nunca esta rota
// directamente. Ao contrário das outras duas, os ficheiros já estão permanentemente no Storage
// (vêm de cpcv_ficheiros, não de um upload novo) - por isso recebe os `caminhos` directamente,
// sem passar por analisarComUploadTemporario (essa função é só para ficheiros novos ainda não
// gravados, ver lib/cpcv-ficheiros.ts).

function mediaTypeFor(nome: string): "application/pdf" | "image/png" | "image/jpeg" | null {
  const ext = nome.toLowerCase().split(".").pop();
  if (ext === "pdf") return "application/pdf";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  return null;
}

const SYSTEM_PROMPT = `Lês uma certidão predial (ou certidão permanente) de um imóvel em Portugal e
identificas todas as hipotecas registadas sobre ele.

NUNCA inventes hipotecas - só devolves as que estão mesmo escritas no documento, na secção de
ónus/encargos/inscrições (ex.: "C - Hipotecas" ou "Inscrições"). Se o documento não for uma
certidão predial, ou não tiver uma secção de ónus/encargos legível, ou não conseguires ter a
certeza de que leste o documento completo, NUNCA assumas que não há hipotecas - responde com
"estado": "inconclusiva" ou "sem_documento" em vez de "concluida", para a gestora confirmar à mão.

Para cada hipoteca encontrada, extrai:
- "entidade_credora": a entidade a favor de quem a hipoteca está registada (ex.: um banco).
- "natureza": o tipo de hipoteca tal como está escrito (ex.: "Hipoteca voluntária"), ou null se não
  estiver explícito.
- "numero_apresentacao": o número de apresentação do registo (ex.: "AP. 3661"), ou null.
- "data_registo": a data do registo em formato "YYYY-MM-DD", ou null se não conseguires ler com
  confiança.

Se houver mais do que um ficheiro (ex.: várias páginas do mesmo documento), trata-os como o mesmo
documento - não dupliques nem contradigas hipotecas entre eles.

Responde APENAS com um objecto JSON válido, sem markdown, sem texto à volta, exactamente com esta
forma:

{
  "estado": "concluida" | "inconclusiva" | "sem_documento",
  "hipotecas": [
    { "entidade_credora": string, "natureza": string|null, "numero_apresentacao": string|null, "data_registo": string|null }
  ]
}

"estado" só é "concluida" quando tiveres a certeza de ter lido a secção de ónus/encargos completa
do imóvel - "hipotecas" vem vazio e "concluida" quando essa secção existe e não tem nenhuma
hipoteca registada. Nos outros dois estados, "hipotecas" vem sempre vazio.`;

export async function POST(req: NextRequest) {
  const supabase = await sbUserServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  }

  const { caminhos } = await req.json();

  if (!Array.isArray(caminhos) || caminhos.length === 0) {
    return NextResponse.json({ error: "Nenhum documento enviado." }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const documentBlocks: any[] = [];
  for (const caminho of caminhos) {
    if (typeof caminho !== "string") continue;
    const mediaType = mediaTypeFor(caminho);
    if (!mediaType) continue;

    const { data: blob, error: downloadError } = await supabase.storage.from("cpcv-documentos").download(caminho);
    if (downloadError || !blob) continue;

    const base64 = Buffer.from(await blob.arrayBuffer()).toString("base64");
    if (mediaType === "application/pdf") {
      documentBlocks.push({ type: "document", source: { type: "base64", media_type: mediaType, data: base64 } });
    } else {
      documentBlocks.push({ type: "image", source: { type: "base64", media_type: mediaType, data: base64 } });
    }
  }

  if (documentBlocks.length === 0) {
    return NextResponse.json({ error: "Nenhum documento em formato suportado (PDF, JPG ou PNG)." }, { status: 400 });
  }

  const anthropic = anthropicClient();

  try {
    const response = await anthropic.messages.create({
      model: EXTRACTION_MODEL,
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: documentBlocks }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("A IA não devolveu texto.");
    }

    const jsonText = textBlock.text
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "");

    const dados = JSON.parse(jsonText);
    return NextResponse.json({ estado: dados.estado ?? "inconclusiva", hipotecas: Array.isArray(dados.hipotecas) ? dados.hipotecas : [] });
  } catch (e) {
    console.error("Erro ao chamar a IA em /api/cpcv/extrair-hipotecas:", e);
    return NextResponse.json(
      { error: "Não foi possível analisar o documento agora. Tenta outra vez daqui a pouco." },
      { status: 500 }
    );
  }
}
