import { createClient } from "@supabase/supabase-js";

// Liga um utilizador já criado (via Supabase Dashboard > Authentication >
// Add user) a uma organização nova - não há ainda fluxo de signup
// self-service (ver especificacao-produto.md, secção "Por decidir"). Sem
// isto o login funciona mas nenhuma policy de RLS deixa ver/escrever dados,
// porque organizacao_atual() lê organizacao_id do app_metadata do JWT.
//
// Uso: npx tsx scripts/bootstrap-organizacao.ts <email> "<nome da organizacao>"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no .env.local");
  process.exit(1);
}

const [email, nomeOrganizacao] = process.argv.slice(2);

if (!email || !nomeOrganizacao) {
  console.error('Uso: npx tsx scripts/bootstrap-organizacao.ts <email> "<nome da organizacao>"');
  process.exit(1);
}

const supabase = createClient(url, serviceKey);

async function main() {
  const { data: usersPage, error: errUsers } = await supabase.auth.admin.listUsers();
  if (errUsers) throw errUsers;

  const user = usersPage.users.find((u) => u.email === email);
  if (!user) {
    throw new Error(
      `Utilizador ${email} não encontrado. Cria a conta em Supabase Dashboard > Authentication > Add user primeiro.`
    );
  }

  const { data: organizacao, error: errOrg } = await supabase
    .from("organizacoes")
    .insert({ nome: nomeOrganizacao })
    .select()
    .single();
  if (errOrg) throw errOrg;

  const { error: errMetadata } = await supabase.auth.admin.updateUserById(user.id, {
    app_metadata: { organizacao_id: organizacao.id },
  });
  if (errMetadata) throw errMetadata;

  const { error: errMembro } = await supabase.from("membros_organizacao").insert({
    organizacao_id: organizacao.id,
    user_id: user.id,
    role: "owner",
  });
  if (errMembro) throw errMembro;

  console.log(
    `Organização "${nomeOrganizacao}" criada (${organizacao.id}) e ${email} associado como owner.`
  );
  console.log("Faz logout/login outra vez - o token JWT só inclui organizacao_id depois disso.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
