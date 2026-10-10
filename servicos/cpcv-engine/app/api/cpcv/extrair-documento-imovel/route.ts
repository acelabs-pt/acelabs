import { NextRequest, NextResponse } from "next/server";
import { sbUserServer } from "@/lib/supabase-server";
import { anthropicClient, EXTRACTION_MODEL } from "@/lib/anthropic";

// Mesma lógica de /api/cpcv/extrair-pessoa (ver o comentário no topo dessa rota): em
// app/cpcv/novo o processo ainda não existe, por isso isto nunca grava nada - só devolve
// valores sugeridos para os campos manuais do imóvel (morada estruturada, licença, certificado
// energético), a partir de qualquer documento juntado na secção "Documentos do imóvel"
// (caderneta predial, certidão predial, licença de utilização ou certificado energético - todos
// costumam trazer a morada completa do imóvel, não só o seu próprio dado específico).
//
// Recebe caminhos no Storage (não os ficheiros em base64 no corpo do pedido) - um certificado
// energético real, com várias páginas de fotos/gráficos, facilmente ultrapassa o limite de
// ~4.5MB que a Vercel impõe ao corpo de um pedido a uma função serverless (testado: falhava em
// produção só com esse documento, com um erro genérico sem indicar a causa). Ver
// lib/cpcv-ficheiros.ts (analisarComUploadTemporario) para o lado do cliente.

function mediaTypeFor(nome: string): "application/pdf" | "image/png" | "image/jpeg" | null {
  const ext = nome.toLowerCase().split(".").pop();
  if (ext === "pdf") return "application/pdf";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  return null;
}

const SYSTEM_PROMPT = `Lês um ou mais documentos sobre um imóvel em Portugal (caderneta predial,
certidão predial/permanente, licença de utilização, certificado energético, ou documento
semelhante) e devolves os dados do imóvel que conseguires ler com confiança.

NUNCA inventes valores - só devolves o que está mesmo escrito no documento. Qualquer campo que não
consigas ler com confiança fica null.

"licenca_utilizacao" é o número do alvará de licença de utilização, normalmente escrito como
"Alvará de Licença n.º X" (ex.: "603/85") - nunca o número de um "Termo de Autenticação" ou de
outro documento que acompanhe a licença.

"licenca_data_emissao" é a data de emissão da própria licença de utilização (formato
"YYYY-MM-DD"), normalmente a seguir ao número do alvará (ex.: em "licença de habitação nº 2128/79
de 03/08/1979", a data é "1979-08-03") - não confundir com a data de emissão de uma certidão/cópia
posterior desse documento.

"certificado_energetico" é o número de registo do certificado energético (SCE), normalmente no
canto superior do documento, com o prefixo "SCE" (ex.: "SCE386817639") - nunca a classe energética.

"certificado_validade" é a data de validade do certificado energético (formato "YYYY-MM-DD"),
normalmente junto ao número SCE (ex.: "Válido até 10/02/2027" -> "2027-02-10").

"certificado_classe" é só a letra da classe energética (ex.: "B-", "D") - nunca a percentagem ao
lado nem o número de indicadores de desempenho.

"fracao_letra" é a letra (ou letras) que identifica a fracção autónoma numa certidão predial/
permanente ou num certificado energético (ex.: "AH") - normalmente no canto superior direito da
certidão, a seguir ao número de inscrição e à data (ex.: "538 19980706 - AH" -> fracao_letra
"AH"), ou na secção "Identificação Predial/Fiscal" de um certificado energético ("Fracção
Autónoma AH").

"conservatoria" é o nome da Conservatória do Registo Predial responsável pelo imóvel (ex.: "2ª
Conservatória do Registo Predial de Braga"), normalmente no topo de uma certidão predial/
permanente ou na secção "Identificação Predial/Fiscal" de um certificado energético.

"descricao_predial" é o número de descrição/inscrição predial (ex.: "538" ou "538/19980706"),
normalmente junto à conservatória - nunca uma categoria do imóvel como "fracção autónoma" ou
"prédio urbano".

"artigo_matricial" é o número do artigo matricial (ex.: em "Artigo Matricial nº 3", o valor é
"3").

Se houver mais do que um ficheiro - várias páginas do mesmo documento, ou documentos diferentes
sobre o mesmo imóvel (ex.: certidão predial + licença + certificado energético) - usa todos para
preencher o máximo de campos possível, sem duplicar nem contradizer dados entre eles.

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
  "licenca_data_emissao": string|null,
  "certificado_energetico": string|null,
  "certificado_validade": string|null,
  "certificado_classe": string|null,
  "fracao_letra": string|null,
  "conservatoria": string|null,
  "descricao_predial": string|null,
  "artigo_matricial": string|null
}`;

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
