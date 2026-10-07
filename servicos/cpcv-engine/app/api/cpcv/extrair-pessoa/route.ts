import { NextRequest, NextResponse } from "next/server";
import { sbUserServer } from "@/lib/supabase-server";
import { anthropicClient, EXTRACTION_MODEL } from "@/lib/anthropic";

// Esta rota é diferente de /api/cpcv/extrair: aquela lê o processo já gravado na BD e
// actualiza cpcv_processos/campos_em_falta directamente. Esta nunca toca em cpcv_partes -
// só sugere valores para um formulário ainda em memória no browser (app/cpcv/ParteCampos.tsx),
// antes de o agente confirmar e gravar. Isto é deliberado: a versão antiga da extracção por IA
// fazia delete-and-reinsert de toda a cpcv_partes a cada chamada (sem id estável por pessoa),
// frágil para dados legais como NIF/estado civil - ver lib/cpcv-partes-form.ts. Manter a
// gravação sempre manual (um único insert/update, nunca em nome da IA) evita reabrir esse
// problema enquanto ainda se dá à IA a ler o documento de identificação.
//
// Recebe caminhos no Storage (não os ficheiros em base64 no corpo do pedido) - uma foto de
// telemóvel de um Cartão de Cidadão facilmente ultrapassa o limite de ~4.5MB que a Vercel impõe
// ao corpo de um pedido a uma função serverless (ver o mesmo problema, confirmado em produção,
// no comentário de /api/cpcv/extrair-documento-imovel). Ver lib/cpcv-ficheiros.ts
// (analisarComUploadTemporario) para o lado do cliente.

function mediaTypeFor(nome: string): "application/pdf" | "image/png" | "image/jpeg" | null {
  const ext = nome.toLowerCase().split(".").pop();
  if (ext === "pdf") return "application/pdf";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  return null;
}

const SYSTEM_PROMPT = `Lês documentos de identificação (Cartão de Cidadão, Passaporte, Título de
Residência) ou documentos de pessoa colectiva (certidão permanente comercial) de uma pessoa que é
vendedora ou compradora num Contrato-Promessa de Compra e Venda em Portugal, e devolves os dados
de identificação que conseguires ler com confiança.

NUNCA inventes valores - só devolves o que está mesmo escrito no documento. Qualquer campo que não
consigas ler com confiança fica null.

Se houver mais do que um ficheiro (ex.: frente e verso do mesmo Cartão de Cidadão), trata-os como
o mesmo documento - não dupliques nem contradigas dados entre eles.

Responde APENAS com um objecto JSON válido, sem markdown, sem texto à volta, exactamente com esta
forma:

{
  "tipo_pessoa": "singular" | "coletiva" | null,
  "nome": string|null,
  "nif": string|null,
  "morada_rua": string|null,
  "morada_numero": string|null,
  "morada_codigo_postal": string|null,
  "morada_localidade": string|null,
  "nacionalidade": string|null,
  "naturalidade_concelho": string|null,
  "naturalidade_freguesia": string|null,
  "documento_tipo": "Cartão de Cidadão" | "Passaporte" | "Título de Residência" | "Outro" | null,
  "documento_numero": string|null,
  "documento_validade": "YYYY-MM-DD"|null,
  "representante_nome": string|null,
  "representante_cargo": string|null,
  "certidao_permanente": string|null
}

"tipo_pessoa" só é "coletiva" se o documento for uma certidão permanente comercial ou identificar
claramente uma empresa - nesse caso "nome" é a denominação social, e preenches
"representante_nome"/"representante_cargo"/"certidao_permanente" em vez dos campos de pessoa
singular (que ficam null). Para pessoa singular, esses três campos ficam null.`;

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

    const extraido = JSON.parse(jsonText);
    return NextResponse.json({ extraido });
  } catch (e) {
    console.error("Erro ao chamar a IA em /api/cpcv/extrair-pessoa:", e);
    return NextResponse.json(
      { error: "Não foi possível ler o documento agora. Tenta outra vez daqui a pouco." },
      { status: 500 }
    );
  }
}
