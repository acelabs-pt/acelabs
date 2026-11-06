// Testes das regras de acesso e da base de dados da Torre, contra o projeto Supabase do .env.local.
// Cria contas e dados de teste próprios (marcados com um código aleatório) e apaga tudo no fim, mesmo se falhar.
// Só corre com TORRE_TESTES_PERMITIDOS=1 no .env.local (escreve dados; nunca toca nos que já lá estão).
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export async function correrIntegracao(env: Record<string, string>) {
  console.log("Integração (Supabase)");
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const admin = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const marca = `teste-${randomBytes(4).toString("hex")}`;
  const cliente = () => createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const utilizadores: string[] = [];
  let n = 0;
  const ok = (nome: string) => {
    n++;
    console.log(`  ok  ${nome}`);
  };

  async function novaConta(nome: string, socio: boolean): Promise<{ s: SupabaseClient; id: string; email: string; password: string }> {
    const email = `${marca}-${nome}@exemplo.invalid`;
    const password = randomBytes(16).toString("base64url");
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    utilizadores.push(data.user.id);
    if (socio) {
      const { error: e } = await admin.from("socios").insert({ user_id: data.user.id, nome: `${marca} ${nome}`, email });
      if (e) throw e;
    }
    const s = cliente();
    const { error: e2 } = await s.auth.signInWithPassword({ email, password });
    if (e2) throw e2;
    return { s, id: data.user.id, email, password };
  }

  try {
    // Um registo criado pela service_role para os outros tentarem ler.
    const { data: conta, error: e0 } = await admin.from("contas").insert({ nome: `${marca} empresa`, tipo: "empresa" }).select("id").single();
    if (e0 || !conta) throw e0;

    const anonimo = cliente();
    const { data: a1 } = await anonimo.from("contas").select("id");
    const { error: a2 } = await anonimo.from("contas").insert({ nome: `${marca} x`, tipo: "empresa" });
    assert.ok(!a1?.length && a2);
    ok("sem sessão: não lê nem escreve");

    const intruso = await novaConta("intruso", false);
    const { data: i1 } = await intruso.s.from("contas").select("id");
    const { data: i2 } = await intruso.s.from("socios").select("id");
    const { error: i3 } = await intruso.s.from("movimentos").insert({ conta_id: conta.id, data: "2026-10-01", descricao: "x", valor: -100 });
    const { error: i4 } = await intruso.s.from("socios").insert({ user_id: intruso.id, nome: "eu" });
    assert.ok(!i1?.length && !i2?.length && i3 && i4);
    ok("conta com sessão mas fora dos sócios: não lê, não escreve, não se faz sócia");

    const socio = await novaConta("socio", true);
    const { data: s3 } = await socio.s.from("contas").select("id").eq("id", conta.id);
    assert.equal(s3?.length, 1);
    const linhas = [
      { conta_id: conta.id, data: "2026-10-02", descricao: "DD VERCEL", valor: -2000, origem: "extrato", hash: `${marca}-1` },
      { conta_id: conta.id, data: "2026-10-05", descricao: "TRF CLIENTE", valor: 150000, origem: "extrato", hash: `${marca}-2` },
    ];
    const { data: r1, error: s4 } = await socio.s.from("movimentos").upsert(linhas, { onConflict: "conta_id,hash", ignoreDuplicates: true }).select("id");
    assert.ifError(s4);
    assert.equal(r1?.length, 2);
    const { data: r2 } = await socio.s.from("movimentos").upsert(linhas, { onConflict: "conta_id,hash", ignoreDuplicates: true }).select("id");
    assert.equal(r2?.length, 0);
    ok("sócio com password: lê e escreve; importar duas vezes não duplica");

    // Um sócio desativado perde o acesso logo, mesmo com a sessão aberta.
    await admin.from("socios").update({ ativo: false }).eq("user_id", socio.id);
    const { data: inativo } = await socio.s.from("contas").select("id");
    assert.ok(!inativo?.length);
    await admin.from("socios").update({ ativo: true }).eq("user_id", socio.id);
    ok("sócio desativado: deixa de ler, mesmo com sessão aberta");

    const { error: s5 } = await socio.s.from("socios").update({ nome: "outro" }).eq("user_id", socio.id).select();
    const { data: s6 } = await admin.from("socios").select("nome").eq("user_id", socio.id).single();
    assert.ok(s5 || s6?.nome === `${marca} socio`);
    const { error: s7 } = await socio.s.from("auditoria").insert({ quem: "falso", tabela: "x", operacao: "insert" });
    assert.ok(s7);
    ok("sócio não muda a tabela de sócios nem escreve no registo");

    const { data: m } = await socio.s.from("movimentos").insert({ conta_id: conta.id, data: "2026-10-07", descricao: `${marca} café`, valor: -120 }).select("id").single();
    const { data: reg } = await socio.s.from("auditoria").select("quem, tabela, operacao, resumo").eq("registo", m!.id);
    assert.deepEqual(reg, [{ quem: `${marca} socio`, tabela: "movimentos", operacao: "insert", resumo: `${marca} café` }]);
    const { data: regImport } = await admin.from("auditoria").select("id").eq("tabela", "movimentos").in("resumo", ["DD VERCEL", "TRF CLIENTE"]).gte("quando", new Date(Date.now() - 600_000).toISOString());
    assert.equal(regImport?.length, 0);
    ok("registo de ações: guarda quem fez; linhas de extrato não enchem o registo");

    const { error: c1 } = await socio.s.from("contas").insert({ nome: `${marca} pessoal`, tipo: "pessoal" });
    const { error: c2 } = await socio.s.from("movimentos").insert({ conta_id: conta.id, data: "2026-10-07", descricao: "zero", valor: 0 });
    assert.ok(c1 && c2);
    ok("regras da base de dados: conta pessoal sem titular e movimento a zero recusados");

    // Bloqueio do PIN: 10 falhas bloqueiam; sem sessão não se limpa nem se lê a tabela; quem entra limpa as suas.
    const alvo = `${marca}-pin@exemplo.invalid`;
    for (let i = 0; i < 10; i++) await anonimo.rpc("pin_falhou", { p_email: alvo });
    const { data: b1 } = await anonimo.rpc("pin_bloqueado", { p_email: alvo.toUpperCase() });
    assert.equal(b1, true);
    const { error: p1 } = await anonimo.rpc("pin_ok");
    const { data: p2 } = await anonimo.from("pin_falhas").select("email");
    const { data: p3 } = await socio.s.from("pin_falhas").select("email");
    assert.ok(p1 && !p2?.length && !p3?.length);
    await admin.from("pin_falhas").delete().eq("email", alvo);
    const { data: b2 } = await anonimo.rpc("pin_bloqueado", { p_email: alvo });
    assert.equal(b2, false);
    ok("PIN: 10 falhas bloqueiam o email; ninguém lê a tabela nem limpa sem ter entrado");
  } finally {
    // Limpeza: dados de teste, contas de teste e o registo que geraram.
    const { data: contas } = await admin.from("contas").select("id").like("nome", `${marca}%`);
    const ids = (contas ?? []).map((c) => c.id);
    // Guardar os ids de tudo o que se apaga: o próprio apagamento também fica no registo e tem de sair.
    const registos = [...ids];
    if (ids.length) {
      for (const t of ["movimentos", "importacoes"]) {
        const { data } = await admin.from(t).select("id").in("conta_id", ids);
        registos.push(...(data ?? []).map((x) => x.id));
      }
      await admin.from("movimentos").delete().in("conta_id", ids);
      await admin.from("importacoes").delete().in("conta_id", ids);
      await admin.from("contas").delete().in("id", ids);
    }
    await admin.from("socios").delete().like("nome", `${marca}%`);
    for (const id of utilizadores) await admin.auth.admin.deleteUser(id);
    await admin.from("auditoria").delete().or(`quem.like.${marca}%,resumo.like.${marca}%`);
    if (registos.length) await admin.from("auditoria").delete().in("registo", registos);
  }
  console.log(`  ${n} testes passaram (dados de teste apagados)`);
}
