import { Capacitor } from "@capacitor/core";
import { sbBrowser } from "@/lib/supabase-browser";

// Ponte entre a app web e as funções nativas do iPhone (Capacitor). Dentro da app da App Store `naApp()` é true;
// no browser e na PWA é false e cada função devolve o comportamento web de sempre (ou não faz nada). Os plugins
// carregam-se só quando se usam, para não pesarem no site.

export function naApp(): boolean {
  return typeof window !== "undefined" && Capacitor.isNativePlatform();
}

/** Vibração ligeira, por exemplo ao concluir uma tarefa. Sem efeito fora da app. */
export async function vibrar(): Promise<void> {
  if (!naApp()) return;
  const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
  await Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
}

/** Folha de partilha do iOS. Fora da app usa a partilha do browser, se existir. Devolve false se não houve como partilhar. */
export async function partilhar(o: { titulo?: string; texto?: string; url?: string }): Promise<boolean> {
  try {
    if (naApp()) {
      const { Share } = await import("@capacitor/share");
      await Share.share({ title: o.titulo, text: o.texto, url: o.url, dialogTitle: o.titulo });
      return true;
    }
    if (typeof navigator !== "undefined" && "share" in navigator) {
      await navigator.share({ title: o.titulo, text: o.texto, url: o.url });
      return true;
    }
  } catch {
    // o utilizador fechou a folha de partilha: não é erro
    return true;
  }
  return false;
}

/** Pede Face ID (ou o código do telemóvel). true = autenticado, ou não há biometria disponível. */
export async function pedirFaceId(motivo = "Abrir o Cockpit"): Promise<boolean> {
  if (!naApp()) return true;
  // Se o plugin não estiver instalado no projeto iOS (esquecido o `npm run cap:sync`), o Capacitor entra num ciclo infinito
  // ao chamá-lo e a app congela ao abrir. Sem plugin não se tranca nada.
  if (!Capacitor.isPluginAvailable("BiometricAuth")) return true;
  const { BiometricAuth } = await import("@aparajita/capacitor-biometric-auth");
  try {
    const info = await BiometricAuth.checkBiometry();
    if (!info.isAvailable) return true; // sem Face ID configurado não se tranca o utilizador fora
    await BiometricAuth.authenticate({ reason: motivo, allowDeviceCredential: true });
    return true;
  } catch {
    return false;
  }
}

/** Escolhe um contacto do telemóvel (com o seletor do sistema, sem pedir acesso a toda a lista). */
export async function escolherContacto(): Promise<{ nome: string; telemovel: string; email: string } | null> {
  if (!naApp()) return null;
  const { Contacts } = await import("@capacitor-community/contacts");
  try {
    const { contact } = await Contacts.pickContact({ projection: { name: true, phones: true, emails: true } });
    return {
      nome: contact.name?.display ?? [contact.name?.given, contact.name?.family].filter(Boolean).join(" "),
      telemovel: contact.phones?.[0]?.number ?? "",
      email: contact.emails?.[0]?.address ?? "",
    };
  } catch {
    return null;
  }
}

/**
 * Põe uma tarefa ou marcação na agenda do telemóvel. `urlIcs` é o endereço /api/tarefas/<id>/calendario: na app
 * nativa lê os dados em JSON e cria o evento direto na agenda do iPhone (com alarme 30 minutos antes); no browser
 * descarrega o ficheiro .ics como antes.
 */
export async function pontoNoCalendario(urlIcs: string): Promise<string | null> {
  if (!naApp()) {
    window.location.href = urlIcs;
    return null;
  }
  try {
    const res = await fetch(`${urlIcs}?formato=json`);
    if (!res.ok) return "Não foi possível ler a marcação.";
    const e = (await res.json()) as { titulo: string; inicio: string; fim: string | null; diaInteiro: boolean; telefone: string | null; url: string | null };
    const { CapacitorCalendar } = await import("@ebarooni/capacitor-calendar");
    const acesso = await CapacitorCalendar.requestWriteOnlyCalendarAccess();
    if (acesso.result !== "granted") return "Sem autorização para usar a agenda. Ativa-a em Definições, Cockpit.";
    const inicio = new Date(e.inicio).getTime();
    const fim = e.fim ? new Date(e.fim).getTime() : inicio + 30 * 60_000;
    await CapacitorCalendar.createEvent({
      title: e.titulo,
      startDate: inicio,
      endDate: fim,
      isAllDay: e.diaInteiro,
      alerts: e.diaInteiro ? [] : [-30],
      description: [e.telefone ? `Telefone: ${e.telefone}` : "", e.url ?? ""].filter(Boolean).join("\n"),
    });
    return null;
  } catch {
    return "Não foi possível pôr na agenda. Tenta outra vez.";
  }
}

// ---------------------------------------------------------------------------------------------
// Notificações push nativas (APNs). O token do aparelho guarda-se em push_subscricoes com tipo 'ios'.
// ---------------------------------------------------------------------------------------------

export type EstadoPushNativo = "ligado" | "desligado" | "bloqueado";

export async function estadoPushNativo(): Promise<EstadoPushNativo> {
  const { PushNotifications } = await import("@capacitor/push-notifications");
  const p = await PushNotifications.checkPermissions();
  if (p.receive === "denied") return "bloqueado";
  if (p.receive !== "granted") return "desligado";
  const { Preferences } = await import("@capacitor/preferences");
  return (await Preferences.get({ key: "push-token" })).value ? "ligado" : "desligado";
}

/** Pede autorização, regista o aparelho na Apple e guarda o token no Supabase. Devolve uma mensagem de erro ou null. */
export async function ligarPushNativo(): Promise<string | null> {
  const { PushNotifications } = await import("@capacitor/push-notifications");
  const { Preferences } = await import("@capacitor/preferences");
  const p = await PushNotifications.requestPermissions();
  if (p.receive !== "granted") return "Sem autorização para notificações. Ativa-as em Definições, Notificações, Cockpit.";

  // Os listeners só vivem durante este pedido: sem isto acumulavam-se a cada toque em "Ativar".
  const ouvintes: Array<{ remove: () => Promise<void> }> = [];
  let terminou = false;
  const resultado = new Promise<string | null>((resolve) => {
    const fim = (msg: string | null) => {
      if (terminou) return;
      terminou = true;
      resolve(msg);
    };
    void PushNotifications.addListener("registration", async (t) => {
      if (terminou) return;
      const { error } = await sbBrowser().rpc("registar_push_ios", { p_token: t.value, p_aparelho: "iPhone (app)" });
      if (error) return fim("Não foi possível guardar este telemóvel. Confirma que a migração das notificações está corrida.");
      await Preferences.set({ key: "push-token", value: t.value });
      fim(null);
    }).then((h) => ouvintes.push(h));
    void PushNotifications.addListener("registrationError", () => fim("A Apple não conseguiu registar este telemóvel. Tenta outra vez.")).then((h) => ouvintes.push(h));
    setTimeout(() => fim("Demorou demasiado. Tenta outra vez."), 15_000);
  });
  await PushNotifications.register();
  try {
    return await resultado;
  } finally {
    terminou = true;
    await Promise.all(ouvintes.map((h) => h.remove().catch(() => {})));
  }
}

/** No logout: apaga o registo deste aparelho no Supabase (para não receber as notificações de quem saiu). Não desregista na Apple. */
export async function esquecerAparelhoNativo(): Promise<void> {
  if (!naApp()) return;
  try {
    const { Preferences } = await import("@capacitor/preferences");
    const token = (await Preferences.get({ key: "push-token" })).value;
    if (token) await sbBrowser().from("push_subscricoes").delete().eq("token", token);
    await Preferences.remove({ key: "push-token" });
  } catch {
    // sem rede ou sem plugin: o próximo registo, por outro utilizador, passa o aparelho para ele (registar_push_ios)
  }
}

/**
 * Lista do dia para o ecrã "sem ligação" da casca (capacitor/www/erro.html). Esse ecrã vive noutra origem, por isso não
 * vê o localStorage da app: lê a mesma chave pelo armazenamento nativo (Preferences). Sem efeito fora da app.
 */
export async function guardarDiaNativo(json: string): Promise<void> {
  if (!naApp()) return;
  try {
    const { Preferences } = await import("@capacitor/preferences");
    await Preferences.set({ key: "cockpit-dia", value: json });
  } catch {
    // sem plugin: o ecrã sem ligação mostra só a mensagem
  }
}

export async function apagarDiaNativo(): Promise<void> {
  if (!naApp()) return;
  try {
    const { Preferences } = await import("@capacitor/preferences");
    await Preferences.remove({ key: "cockpit-dia" });
  } catch {
    // nada a apagar
  }
}

export async function desligarPushNativo(): Promise<void> {
  const { PushNotifications } = await import("@capacitor/push-notifications");
  const { Preferences } = await import("@capacitor/preferences");
  const token = (await Preferences.get({ key: "push-token" })).value;
  if (token) await sbBrowser().from("push_subscricoes").delete().eq("token", token);
  await Preferences.remove({ key: "push-token" });
  await PushNotifications.unregister().catch(() => {});
}

/** Pede ao servidor uma notificação de teste para este utilizador (função do Supabase, que fala com a Apple). */
export async function enviarTesteNativo(): Promise<string | null> {
  const { error } = await sbBrowser().functions.invoke("enviar-teste", { body: {} });
  return error ? "Não foi possível enviar o teste. Confirma que a função está publicada." : null;
}
