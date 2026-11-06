// Cria a conta de um sócio na Torre (ou reativa uma que já exista, e repõe o PIN) com um PIN TEMPORÁRIO: na primeira entrada
// a Torre obriga a escolher um PIN novo, e até lá não deixa ver nada.
// Uso: npm run socio -- miguel@acelabs.pt Miguel                  (PIN aleatório, gravado em .env.senhas-temporarias)
//      npm run socio -- miguel@acelabs.pt Miguel --pin=123456     (PIN combinado; aceita PINs fáceis porque é temporário)
// Precisa de NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e TORRE_PIN_SEGREDO no .env.local (nunca no git; o
// TORRE_PIN_SEGREDO tem de ser igual ao da Vercel, senão os PINs não batem certo).
import { randomInt } from "node:crypto";
import { appendFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { problemaDoPin, senhaDoPin, TAMANHO_PIN } from "../lib/pin";

function pinAleatorio(): string {
  for (;;) {
    const pin = String(randomInt(0, 10 ** TAMANHO_PIN)).padStart(TAMANHO_PIN, "0");
    if (!problemaDoPin(pin)) return pin;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const pinDado = args.find((a) => a.startsWith("--pin="))?.slice(6);
  const [emailBruto, ...resto] = args.filter((a) => !a.startsWith("--"));
  const email = emailBruto?.trim().toLowerCase();
  const nome = resto.join(" ").trim();
  if (!email?.includes("@") || !nome) {
    console.error("Uso: npm run socio -- email@acelabs.pt Nome [--pin=123456]");
    process.exit(1);
  }
  if (pinDado !== undefined && !new RegExp(`^\\d{${TAMANHO_PIN}}$`).test(pinDado)) {
    console.error(`O PIN tem de ter ${TAMANHO_PIN} algarismos.`);
    process.exit(1);
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) {
    console.error("Falta NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no .env.local.");
    process.exit(1);
  }
  const s = createClient(url, chave, { auth: { persistSession: false } });
  const pin = pinDado ?? pinAleatorio();
  const password = senhaDoPin(email, pin);

  let userId: string | undefined;
  const { data: criado, error } = await s.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) {
    if (!/already|registered|exists/i.test(error.message)) throw error;
    const { data: lista } = await s.auth.admin.listUsers({ perPage: 1000 });
    userId = lista.users.find((u) => u.email?.toLowerCase() === email)?.id;
    if (!userId) throw new Error("A conta existe mas não a encontrei.");
    const { error: e2 } = await s.auth.admin.updateUserById(userId, { password });
    if (e2) throw e2;
    console.log("A conta já existia: passa a entrar com o PIN temporário novo.");
  } else userId = criado.user.id;

  // Um PIN reposto também apaga as tentativas falhadas, para não ficar bloqueado.
  await s.from("pin_falhas").delete().eq("email", email);
  const { error: e3 } = await s.from("socios").upsert({ user_id: userId, nome, email, ativo: true, pin_temporario: true }, { onConflict: "user_id" });
  if (e3) throw e3;
  // O PIN não vai para o ecrã (pode estar a ser partilhado ou registado): fica num ficheiro fora do git.
  const ficheiro = path.join(process.cwd(), ".env.senhas-temporarias");
  appendFileSync(ficheiro, `${email} PIN ${pin} (temporário, obriga a escolher outro)\n`, "utf8");
  console.log(`Sócio ${nome} (${email}) pronto. Na primeira entrada escolhe o PIN que quiser.`);
  console.log(`PIN temporário gravado em ${ficheiro} (apagar depois de o mudar).`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
