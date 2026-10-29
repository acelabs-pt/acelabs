// Função do Supabase (Deno) que envia os lembretes automáticos do Cockpit. Corre de 5 em 5 minutos
// (pg_cron, ver migracao_notificacoes.sql) e faz duas coisas:
//   1. Eventos (visitas, reuniões) que começam nos próximos 30 minutos: um lembrete por evento.
//   2. De manhã (08:30 em Lisboa): um resumo com as tarefas de hoje e as atrasadas.
// Cada envio fica registado em notificacoes_enviadas, para nunca sair duas vezes.
// Corre aqui (e não na Vercel) porque precisa da chave de administrador do Supabase, que não vai
// para a Vercel - nas funções do Supabase essa chave já existe como variável do próprio projeto.
//
// Publicar: supabase functions deploy enviar-lembretes --no-verify-jwt
// Segredos:  supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:... CRON_SECRET=...

import { createClient } from "npm:@supabase/supabase-js@2";
import { enviarParaAparelho, type Aparelho } from "../_shared/push.ts";

const FUSO = "Europe/Lisbon";

function horaLisboa(d: Date): { data: string; hora: number; minuto: number } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })
      .formatToParts(d)
      .map((x) => [x.type, x.value])
  );
  return { data: `${p.year}-${p.month}-${p.day}`, hora: Number(p.hour) % 24, minuto: Number(p.minute) };
}

function horaCurta(iso: string): string {
  const { hora, minuto } = horaLisboa(new Date(iso));
  return `${String(hora).padStart(2, "0")}:${String(minuto).padStart(2, "0")}`;
}

Deno.serve(async (req) => {
  if (req.headers.get("x-cron-secret") !== Deno.env.get("CRON_SECRET")) {
    return new Response("não autorizado", { status: 401 });
  }
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: subs } = await sb.from("push_subscricoes").select("id, tipo, endpoint, p256dh, auth, token");
  if (!subs || subs.length === 0) return Response.json({ enviados: 0, motivo: "sem aparelhos" });

  // Cada instalação é de um cliente (um consultor ou uma pequena equipa): os lembretes vão para
  // todos os aparelhos registados nesta instalação.
  async function enviar(chave: string, titulo: string, corpo: string, url: string): Promise<boolean> {
    // Reserva a chave primeiro: se já existir, outro ciclo já enviou este lembrete.
    const { error } = await sb.from("notificacoes_enviadas").insert({ chave });
    if (error) return false;
    let correu = false;
    let falhou = false;
    for (const s of subs as Aparelho[]) {
      const r = await enviarParaAparelho(s, { titulo, corpo, url, tag: chave });
      if (r === "ok") correu = true;
      else if (r === "removido") await sb.from("push_subscricoes").delete().eq("id", s.id);
      else {
        falhou = true;
        console.error("push falhou para", s.tipo);
      }
    }
    // Se nenhum aparelho recebeu e houve erro (falha transitória), liberta a chave para o próximo ciclo tentar outra vez.
    if (!correu && falhou) {
      await sb.from("notificacoes_enviadas").delete().eq("chave", chave);
      return false;
    }
    return true;
  }

  const agora = new Date();
  let enviados = 0;

  // 1. Eventos a começar nos próximos 30 minutos.
  const daqui30 = new Date(agora.getTime() + 30 * 60_000).toISOString();
  const { data: eventos } = await sb
    .from("tarefas")
    .select("id, titulo, inicio")
    .eq("tipo", "evento")
    .eq("feita", false)
    .gt("inicio", agora.toISOString())
    .lte("inicio", daqui30);
  for (const ev of eventos ?? []) {
    if (await enviar(`evento-${ev.id}`, `Às ${horaCurta(ev.inicio)}: ${ev.titulo}`, "Começa daqui a pouco.", "/calendario")) enviados++;
  }

  // 2. Resumo da manhã, uma vez por dia, a partir das 08:30 em Lisboa (até às 11h, se o ciclo falhar).
  const lx = horaLisboa(agora);
  const minutos = lx.hora * 60 + lx.minuto;
  if (minutos >= 8 * 60 + 30 && minutos < 11 * 60) {
    const fimDeHoje = new Date(agora.getTime() + 24 * 3600_000).toISOString();
    const { data: pendentes } = await sb
      .from("tarefas")
      .select("id, titulo, inicio")
      .eq("feita", false)
      .not("inicio", "is", null)
      .lte("inicio", fimDeHoje);
    const deHoje = (pendentes ?? []).filter((t) => horaLisboa(new Date(t.inicio)).data <= lx.data);
    if (deHoje.length > 0) {
      const atrasadas = deHoje.filter((t) => horaLisboa(new Date(t.inicio)).data < lx.data).length;
      const corpo =
        `${deHoje.length} ${deHoje.length === 1 ? "tarefa" : "tarefas"} para hoje` +
        (atrasadas > 0 ? `, ${atrasadas} ${atrasadas === 1 ? "atrasada" : "atrasadas"}` : "") +
        `. Primeira: ${deHoje[0].titulo}.`;
      if (await enviar(`resumo-${lx.data}`, "Bom dia", corpo, "/dashboard")) enviados++;
    }
  }

  return Response.json({ enviados });
});
