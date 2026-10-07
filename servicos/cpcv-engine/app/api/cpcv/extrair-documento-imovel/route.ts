import { NextRequest, NextResponse } from "next/server";
import { sbUserServer } from "@/lib/supabase-server";
import { anthropicClient, EXTRACTION_MODEL } from "@/lib/anthropic";

// Mesma lógica de /api/cpcv/extrair-pessoa (ver o comentário no topo dessa rota): em
// app/cpcv/novo o processo ainda não existe, por isso isto nunca grava nada - só devolve
// valores sugeridos para os campos manuais do imóvel (morada estruturada, licença, certificado
// energético), a partir de qualquer documento juntado na secção "Documentos do imóvel"
// (caderneta predial, certidão predial, licença de utilização ou certificado energético - todos
// costumam trazer a morada completa do imóvel, não só o seu próprio dado específico).

function mediaTypeFor(nome: string): "application/pdf" | "image/png" | "image/jpeg" | null {
  const ext = nome.toLowerCase().split(".").pop();
  if (ext === "pdf") return "application/pdf";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  return null;
}

const SYSTEM_PROMPT = `Lês um documento sobre um imóvel em Portugal (caderneta predial, certidão
predial, licença de utilização, certificado energético, ou documento semelhante) e devolves os
dados do imóvel que conseguires ler com confiança.

NUNCA inventes valores - só devolves o que está mesmo escrito no documento. Qualquer campo que não
consigas ler com confiança fica null.

"licenca_utilizacao" é o número do alvará de licença de utilização, normalmente escrito como
"Alvará de Licença n.º X" (ex.: "603/85") - nunca o número de um "Termo de Autenticação" ou de
outro documento que acompanhe a licença.

"certificado_energetico" é o número de registo do certificado energético (SCE), normalmente no
canto superior do documento, com o prefixo "SCE" (ex.: "SCE386817639") - nunca a classe energética
(a letra, ex. "B-").

Se houver mais do que um ficheiro (ex.: várias páginas do mesmo documento), trata-os como o mesmo
documento - não dupliques nem contradigas dados entre eles.

Responde APENAS com um objecto JSON válido, sem markdown, sem texto à volta, exactamente com esta
forma:

{
  "rua": string|null,
  "numero": string|null,
  "andar_fracao": string|null,
  "codigo_postal": string|null,
  "localidade": string|null,
  "freguesia": string|null,
  "concelho": string|null,
  "distrito": string|null,
  "licenca_utilizacao": string|null,
  "certificado_energetico": string|null
}`;

export async function POST(req: NextRequest) {
  const supabase = await sbUserServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  }

  const { ficheiros } = await req.json();

  if (!Array.isArray(ficheiros) || ficheiros.length === 0) {
    return NextResponse.json({ error: "Nenhum documento enviado." }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const documentBlocks: any[] = [];
  for (const f of ficheiros) {
    const mediaType = mediaTypeFor(typeof f?.nome === "string" ? f.nome : "");
    if (!mediaType || typeof f?.base64 !== "string") continue;
    if (mediaType === "application/pdf") {
      documentBlocks.push({ type: "document", source: { type: "base64", media_type: mediaType, data: f.base64 } });
    } else {
      documentBlocks.push({ type: "image", source: { type: "base64", media_type: mediaType, data: f.base64 } });
    }
  }

  if (documentBlocks.length === 0) {
    return NextResponse.json({ error: "Nenhum documento em formato suportado (PDF, JPG ou PNG)." }, { status: 400 });
  }

  const anthropic = anthropicClient();

  try {
    const response = await anthropic.messages.create({
      model: EXTRACTION_MODEL,
      max_tokens: 500,
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
    return NextResponse.json({ dados });
  } catch (e) {
    console.error("Erro ao chamar a IA em /api/cpcv/extrair-documento-imovel:", e);
    return NextResponse.json(
      { error: "Não foi possível ler o documento agora. Tenta outra vez daqui a pouco." },
      { status: 500 }
    );
  }
}
