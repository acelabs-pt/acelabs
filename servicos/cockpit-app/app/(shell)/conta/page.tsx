"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { sbBrowser } from "@/lib/supabase-browser";
import { useToast } from "@/components/Toast";
import AtivarNotificacoes from "@/components/AtivarNotificacoes";
import OpcaoFaceId from "@/components/OpcaoFaceId";
import { esquecerAparelhoNativo } from "@/lib/nativo";
import { apagarDia } from "@/lib/semRede";
import { exportarCopiaCompleta, exportarLista } from "@/lib/exportarTudo";
import type { Entidade } from "@/lib/importar/esquemas";

const cartao = "space-y-3 rounded-3xl border border-linha bg-white p-5";

export default function Conta() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [repetir, setRepetir] = useState("");
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [aGuardar, setAGuardar] = useState(false);
  const [aExportar, setAExportar] = useState<string | null>(null);
  const [aApagar, setAApagar] = useState(false);
  const [confirmaApagar, setConfirmaApagar] = useState(false);
  const [erroApagar, setErroApagar] = useState<string | null>(null);
  const { avisar } = useToast();

  useEffect(() => {
    sbBrowser()
      .auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  async function mudar(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (password.length < 8) return setMsg({ tipo: "erro", texto: "A password precisa de pelo menos 8 caracteres." });
    if (password !== repetir) return setMsg({ tipo: "erro", texto: "As duas passwords não são iguais." });
    setAGuardar(true);
    const { error } = await sbBrowser().auth.updateUser({ password });
    setAGuardar(false);
    if (error) return setMsg({ tipo: "erro", texto: "Não foi possível mudar a password. Sai, volta a entrar e tenta outra vez." });
    setPassword("");
    setRepetir("");
    setMsg({ tipo: "ok", texto: "Password mudada." });
  }

  async function exportar(qual: Entidade | "tudo") {
    if (aExportar) return;
    setAExportar(qual);
    try {
      if (qual === "tudo") {
        const n = await exportarCopiaCompleta();
        const total = Object.values(n).reduce((a, b) => a + b, 0);
        avisar(`Cópia descarregada (${total.toLocaleString("pt-PT")} registos)`);
      } else {
        const n = await exportarLista(qual);
        avisar(`${n.toLocaleString("pt-PT")} ${n === 1 ? "linha descarregada" : "linhas descarregadas"}`);
      }
    } catch {
      avisar("Não foi possível descarregar. Verifica a rede e tenta outra vez.");
    } finally {
      setAExportar(null);
    }
  }

  async function sair() {
    apagarDia();
    await esquecerAparelhoNativo(); // antes do signOut: precisa da sessão para apagar a linha
    await sbBrowser().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  async function apagarConta() {
    setErroApagar(null);
    setAApagar(true);
    const { error } = await sbBrowser().rpc("apagar_minha_conta");
    if (error) {
      setAApagar(false);
      setErroApagar(
        error.message.includes("ultimo_membro")
          ? "És o único utilizador desta empresa. Fala com a Ace Labs para encerrar o Cockpit."
          : "Não foi possível apagar a conta. Tenta outra vez ou fala com a Ace Labs."
      );
      return;
    }
    apagarDia();
    await sbBrowser().auth.signOut().catch(() => {});
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-4xl font-bold tracking-tight text-tinta md:text-5xl">Conta</h1>
        <p className="text-sm text-secundario">{email ?? "A carregar..."}</p>
      </div>

      <section className={cartao} data-so-web>
        <h2 className="text-sm font-semibold text-tinta">Instalar no telemóvel</h2>
        <p className="text-sm text-secundario">Fica no ecrã inicial como uma app, sem passar pelas lojas.</p>
        <Link href="/instalar" className="block rounded-full bg-black/5 py-3 text-center text-base font-medium text-tinta">
          Ver como
        </Link>
      </section>

      <AtivarNotificacoes />

      <OpcaoFaceId />

      <section className={cartao}>
        <h2 className="text-sm font-semibold text-tinta">Importar contactos</h2>
        <p className="text-sm text-secundario">Traz as tuas listas do Excel ou do Google Sheets.</p>
        <Link href="/importar" className="block rounded-full bg-black/5 py-3 text-center text-base font-medium text-tinta">
          Importar lista
        </Link>
      </section>

      <section className={cartao} aria-busy={!!aExportar}>
        <h2 className="text-sm font-semibold text-tinta">Descarregar os teus dados</h2>
        <p className="text-sm text-secundario">
          Em Excel (CSV), com as mesmas colunas dos modelos de importação. Serve de cópia e pode voltar a ser importado.
        </p>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ["compradores", "Compradores"],
              ["proprietarios", "Proprietários"],
              ["angariacoes", "Angariações"],
            ] as [Entidade, string][]
          ).map(([e, rotulo]) => (
            <button
              key={e}
              onClick={() => exportar(e)}
              disabled={!!aExportar}
              className="rounded-full bg-black/5 px-2 py-3 text-sm font-medium text-tinta disabled:opacity-60"
            >
              {aExportar === e ? "A preparar..." : rotulo}
            </button>
          ))}
        </div>
        <button
          onClick={() => exportar("tudo")}
          disabled={!!aExportar}
          className="w-full rounded-full border border-linha bg-white py-3 text-sm font-medium text-tinta disabled:opacity-60"
        >
          {aExportar === "tudo" ? "A preparar a cópia..." : "Cópia completa"}
        </button>
        <p className="text-xs text-secundario">A cópia completa junta tudo, incluindo tarefas, chamadas, planos e metas, num só ficheiro.</p>
      </section>

      <form onSubmit={mudar} className={cartao}>
        <h2 className="text-sm font-semibold text-tinta">Mudar a password</h2>
        <input
          type="password"
          required
          autoComplete="new-password"
          placeholder="Nova password (mín. 8)"
          aria-label="Nova password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-2xl border border-linha bg-white px-4 py-3.5 text-base"
        />
        <input
          type="password"
          required
          autoComplete="new-password"
          placeholder="Repete a password"
          aria-label="Repete a password"
          value={repetir}
          onChange={(e) => setRepetir(e.target.value)}
          className="w-full rounded-2xl border border-linha bg-white px-4 py-3.5 text-base"
        />
        {msg && (
          <p role={msg.tipo === "erro" ? "alert" : "status"} className={`text-sm ${msg.tipo === "erro" ? "text-red-600" : "text-tinta"}`}>
            {msg.texto}
          </p>
        )}
        <button
          type="submit"
          disabled={aGuardar}
          className="w-full rounded-full bg-tinta py-3.5 text-base font-semibold text-white hover:bg-black disabled:opacity-60"
        >
          {aGuardar ? "A guardar..." : "Mudar password"}
        </button>
      </form>

      <button onClick={sair} className="w-full rounded-full border border-linha bg-white py-3.5 text-base font-semibold text-red-600">
        Sair
      </button>

      <section className={cartao}>
        <h2 className="text-sm font-semibold text-tinta">Apagar a minha conta</h2>
        <p className="text-sm text-secundario">
          Apaga o teu acesso e os telemóveis ligados às notificações. Os contactos, compradores e angariações ficam na tua empresa; para
          os apagar usa a ficha de cada contacto ou fala com a Ace Labs.
        </p>
        {!confirmaApagar ? (
          <button onClick={() => setConfirmaApagar(true)} className="w-full rounded-full border border-linha bg-white py-3 text-sm font-medium text-red-600">
            Apagar a minha conta
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-sm font-medium text-tinta">Isto não se pode desfazer. Apagar mesmo?</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setConfirmaApagar(false)} disabled={aApagar} className="rounded-full bg-black/5 py-3 text-sm font-medium text-tinta">
                Cancelar
              </button>
              <button onClick={apagarConta} disabled={aApagar} className="rounded-full bg-red-600 py-3 text-sm font-semibold text-white disabled:opacity-60">
                {aApagar ? "A apagar..." : "Sim, apagar"}
              </button>
            </div>
          </div>
        )}
        {erroApagar && (
          <p role="alert" className="text-sm text-red-600">
            {erroApagar}
          </p>
        )}
      </section>
    </div>
  );
}
