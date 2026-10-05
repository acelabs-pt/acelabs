"use server";

import { revalidatePath } from "next/cache";
import { sbUserServer } from "@/lib/supabase-server";

const ROTULOS_FEEDBACK = {
  gostou: "Gostou",
  talvez: "Talvez",
  nao: "Não gostou",
} as const;

export type Feedback = keyof typeof ROTULOS_FEEDBACK;

// Regista a visita como uma atividade e atualiza ultimo_contacto_em -
// resolve o pain point "a quem já dei seguimento esta semana" sem esforço
// extra do agente (ver especificacao-produto.md, secção 3).
export async function registarFeedbackVisita(contactoId: string, feedback: Feedback) {
  const supabase = await sbUserServer();
  const agora = new Date().toISOString();

  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) {
    throw new Error("Sessão expirada.");
  }

  const { data: contacto } = await supabase
    .from("contactos")
    .select("organizacao_id")
    .eq("id", contactoId)
    .single();

  if (!contacto) {
    throw new Error("Contacto não encontrado.");
  }

  await supabase.from("atividades").insert({
    organizacao_id: contacto.organizacao_id,
    contacto_id: contactoId,
    tipo: "visita",
    descricao: `Registo de visita: ${ROTULOS_FEEDBACK[feedback]}`,
    criado_por: user.user.id,
  });

  await supabase
    .from("contactos")
    .update({ ultimo_contacto_em: agora })
    .eq("id", contactoId);

  revalidatePath(`/contactos/${contactoId}`);
  revalidatePath("/hoje");
  revalidatePath("/contactos");
}
