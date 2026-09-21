import { google } from "googleapis";
import { Readable } from "node:stream";

// Scope "drive.file" (não "drive" nem "drive.readonly") - a app só consegue ver/editar
// ficheiros e pastas que ela própria cria, nunca o resto do Drive da conta ligada.
// Ligação por OAuth a uma conta Google normal (não service account) - ver
// scripts/obter-refresh-token-google.mjs para o processo de autorização única.
function oauthClient() {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return client;
}

function driveClient() {
  return google.drive({ version: "v3", auth: oauthClient() });
}

// Cada processo tem a sua pasta no Drive, criada da primeira vez que o CPCV é
// aprovado/gerado. Chamadas seguintes (regeneração) reutilizam a pasta em vez de
// criar uma nova - procura por nome dentro da pasta-mãe antes de criar.
async function garantirPasta(nomePasta: string): Promise<string> {
  const drive = driveClient();
  const pastaMae = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;

  const query = [
    `name = '${nomePasta.replace(/'/g, "\\'")}'`,
    "mimeType = 'application/vnd.google-apps.folder'",
    "trashed = false",
    ...(pastaMae ? [`'${pastaMae}' in parents`] : []),
  ].join(" and ");

  const existentes = await drive.files.list({ q: query, fields: "files(id)" });
  if (existentes.data.files && existentes.data.files.length > 0) {
    return existentes.data.files[0].id!;
  }

  const nova = await drive.files.create({
    requestBody: {
      name: nomePasta,
      mimeType: "application/vnd.google-apps.folder",
      parents: pastaMae ? [pastaMae] : undefined,
    },
    fields: "id",
  });
  return nova.data.id!;
}

async function enviarFicheiro(pastaId: string, nome: string, buffer: Buffer, mimeType: string) {
  const drive = driveClient();

  const existentes = await drive.files.list({
    q: `name = '${nome.replace(/'/g, "\\'")}' and '${pastaId}' in parents and trashed = false`,
    fields: "files(id)",
  });

  const media = { mimeType, body: Readable.from(buffer) };

  if (existentes.data.files && existentes.data.files.length > 0) {
    await drive.files.update({ fileId: existentes.data.files[0].id!, media });
  } else {
    await drive.files.create({ requestBody: { name: nome, parents: [pastaId] }, media, fields: "id" });
  }
}

// Best-effort: chamado depois de o CPCV já estar aprovado e gravado no Supabase
// Storage (a fonte de verdade da app) - uma falha aqui não deve impedir a aprovação,
// só fica sem cópia no Drive dessa vez (quem chama decide se tenta de novo).
export async function enviarCpcvParaDrive(
  processo: { id: string; imovel_morada: string | null; criado_em: string },
  pdfBuffer: Buffer,
  docxBuffer: Buffer
): Promise<string> {
  const dataCurta = new Date(processo.criado_em).toLocaleDateString("pt-PT").replace(/\//g, "-");
  const nomePasta = `${processo.imovel_morada?.trim() || "Sem morada"} (${dataCurta}) - ${processo.id.slice(0, 8)}`;

  const pastaId = await garantirPasta(nomePasta);
  await enviarFicheiro(pastaId, "cpcv.pdf", pdfBuffer, "application/pdf");
  await enviarFicheiro(
    pastaId,
    "cpcv.docx",
    docxBuffer,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );

  return `https://drive.google.com/drive/folders/${pastaId}`;
}
