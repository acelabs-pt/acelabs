"use client";

import { useFormState, useFormStatus } from "react-dom";
import { apagarEmpresaAcao, convidar, convidarNaEmpresa, entrar, guardarEmpresa, novaEmpresa, novoCliente, type Resposta } from "@/app/acoes";
import { useState } from "react";

const campo = "w-full rounded-xl border border-linha bg-white px-3 py-2.5 text-base outline-none focus:border-azul focus:ring-2 focus:ring-azul/20";
const rotulo = "mb-1 block text-sm font-medium text-tinta";

function Enviar({ texto }: { texto: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="min-h-[44px] rounded-full bg-azul px-6 text-base font-semibold text-white hover:bg-azul-escuro disabled:opacity-60">
      {pending ? "A trabalhar..." : texto}
    </button>
  );
}

function Mensagem({ r }: { r: Resposta }) {
  if (r.erro) return <p role="alert" className="rounded-xl bg-ambar-fundo px-4 py-3 text-sm text-ambar-texto">{r.erro}</p>;
  if (r.aviso)
    return (
      <div role="status" className="space-y-2 rounded-xl bg-verde-suave px-4 py-3 text-sm text-tinta">
        <p>{r.aviso}</p>
        {r.passwordTemporaria && <p className="rounded-lg bg-white px-3 py-2 font-mono text-base font-semibold select-all" data-teste="password-temporaria">{r.passwordTemporaria}</p>}
      </div>
    );
  return null;
}

export function FormLogin() {
  const [r, acao] = useFormState(entrar, {});
  return (
    <form action={acao} className="space-y-4">
      <div>
        <label htmlFor="password" className={rotulo}>Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className={campo} />
      </div>
      <Mensagem r={r} />
      <Enviar texto="Entrar" />
    </form>
  );
}

export function FormNovoCliente() {
  const [r, acao] = useFormState(novoCliente, {});
  return (
    <form action={acao} className="space-y-4">
      <div>
        <label htmlFor="nome" className={rotulo}>Nome do cliente</label>
        <input id="nome" name="nome" required className={campo} />
      </div>
      <div>
        <label htmlFor="produto" className={rotulo}>Produto</label>
        <select id="produto" name="produto" className={campo}>
          <option value="cockpit">Cockpit</option>
          <option value="cpcv">CPCV com IA</option>
        </select>
      </div>
      <div>
        <label htmlFor="supabase_url" className={rotulo}>Endereço do Supabase</label>
        <input id="supabase_url" name="supabase_url" placeholder="https://xxxxxxxx.supabase.co" required className={campo} />
      </div>
      <div>
        <label htmlFor="anon_key" className={rotulo}>Chave anon (pública)</label>
        <input id="anon_key" name="anon_key" required className={campo} autoComplete="off" />
      </div>
      <div>
        <label htmlFor="app_url" className={rotulo}>Endereço da app deste cliente (para o link do convite)</label>
        <input id="app_url" name="app_url" placeholder="https://cockpit.acelabs.pt" className={campo} />
      </div>
      <label className="flex items-start gap-2 rounded-xl bg-azul-suave px-3 py-2.5 text-sm text-tinta">
        <input type="checkbox" name="partilhado" value="1" className="mt-1" />
        <span>É o projeto Cockpit partilhado da Ace Labs (várias empresas no mesmo Supabase). Não é um cliente: aparece no Painel, onde se criam as empresas.</span>
      </label>
      <div>
        <label htmlFor="empresa" className={rotulo}>Código da empresa (só no Cockpit com vários clientes no mesmo projeto Supabase)</label>
        <input id="empresa" name="empresa" placeholder="alvorada" className={campo} autoCapitalize="none" />
      </div>
      <div>
        <label htmlFor="codigo_app" className={rotulo}>Código do cliente na app (só se a app tiver vários clientes)</label>
        <input id="codigo_app" name="codigo_app" placeholder="alvorada" className={campo} autoCapitalize="none" />
      </div>
      <div>
        <label htmlFor="modo" className={rotulo}>Como se administra</label>
        <select id="modo" name="modo" className={campo}>
          <option value="funcao">Função no Supabase do cliente (recomendado, sem chaves aqui)</option>
          <option value="chave">Chave de administrador neste computador (provisório)</option>
        </select>
      </div>
      <Mensagem r={r} />
      <Enviar texto="Guardar cliente" />
    </form>
  );
}

export function FormConvidar({ id, produto, papeis, empresa }: { id: string; produto: "cockpit" | "cpcv"; papeis: string[]; empresa?: string }) {
  const [r, acao] = useFormState(empresa ? convidarNaEmpresa.bind(null, empresa) : convidar.bind(null, id), {});
  const [modo, setModo] = useState(produto === "cockpit" ? "convite" : "password");
  return (
    <form action={acao} className="space-y-4">
      {produto === "cpcv" && (
        <div>
          <label htmlFor="nome" className={rotulo}>Nome</label>
          <input id="nome" name="nome" required className={campo} />
        </div>
      )}
      <div>
        <label htmlFor="email" className={rotulo}>Email</label>
        <input id="email" name="email" type="email" required className={campo} autoComplete="off" />
      </div>
      {papeis.length > 1 && (
        <div>
          <label htmlFor="papel" className={rotulo}>Papel</label>
          <select id="papel" name="papel" className={campo}>
            {papeis.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      )}
      {produto === "cockpit" && (
        <fieldset className="space-y-2">
          <legend className={rotulo}>Como entra</legend>
          <label className="flex items-center gap-2 text-sm"><input type="radio" name="modo" value="convite" checked={modo === "convite"} onChange={() => setModo("convite")} /> Convite por email (escolhe a própria password)</label>
          <label className="flex items-center gap-2 text-sm"><input type="radio" name="modo" value="password" checked={modo === "password"} onChange={() => setModo("password")} /> Password temporária (dou-lha eu)</label>
        </fieldset>
      )}
      {produto === "cpcv" && <input type="hidden" name="modo" value="password" />}
      <Mensagem r={r} />
      <Enviar texto="Criar utilizador" />
    </form>
  );
}

const RESPONSAVEIS = [
  ["", "Sem responsável"],
  ["pedro", "Pedro"],
  ["miguel", "Miguel"],
];

export function FormNovaEmpresa() {
  const [r, acao] = useFormState(novaEmpresa, {});
  return (
    <form action={acao} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="ne-nome" className={rotulo}>Nome da empresa</label>
          <input id="ne-nome" name="nome" required className={campo} />
        </div>
        <div>
          <label htmlFor="ne-codigo" className={rotulo}>Código (letras minúsculas, números, hífen)</label>
          <input id="ne-codigo" name="codigo" required placeholder="alvorada" className={campo} autoCapitalize="none" autoComplete="off" />
        </div>
        <div>
          <label htmlFor="ne-cn" className={rotulo}>Pessoa de contacto</label>
          <input id="ne-cn" name="contacto_nome" className={campo} />
        </div>
        <div>
          <label htmlFor="ne-ce" className={rotulo}>Email de contacto</label>
          <input id="ne-ce" name="contacto_email" type="email" className={campo} autoComplete="off" />
        </div>
        <div>
          <label htmlFor="ne-resp" className={rotulo}>Quem acompanha</label>
          <select id="ne-resp" name="responsavel" className={campo}>
            {RESPONSAVEIS.map(([v, t]) => (
              <option key={v} value={v}>{t}</option>
            ))}
          </select>
        </div>
      </div>
      <Mensagem r={r} />
      <Enviar texto="Criar empresa" />
    </form>
  );
}

export type DadosFormulario = { nome: string; contacto_nome: string; contacto_email: string; responsavel: string; notas: string; inicio: string };

export function FormDadosEmpresa({ codigo, dados }: { codigo: string; dados: DadosFormulario }) {
  const [r, acao] = useFormState(guardarEmpresa.bind(null, codigo), {});
  return (
    <form action={acao} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="de-nome" className={rotulo}>Nome</label>
          <input id="de-nome" name="nome" required defaultValue={dados.nome} className={campo} />
        </div>
        <div>
          <label htmlFor="de-inicio" className={rotulo}>Início</label>
          <input id="de-inicio" name="inicio" type="date" defaultValue={dados.inicio} className={campo} />
        </div>
        <div>
          <label htmlFor="de-cn" className={rotulo}>Pessoa de contacto</label>
          <input id="de-cn" name="contacto_nome" defaultValue={dados.contacto_nome} className={campo} />
        </div>
        <div>
          <label htmlFor="de-ce" className={rotulo}>Email de contacto</label>
          <input id="de-ce" name="contacto_email" type="email" defaultValue={dados.contacto_email} className={campo} autoComplete="off" />
        </div>
        <div>
          <label htmlFor="de-resp" className={rotulo}>Quem acompanha</label>
          <select id="de-resp" name="responsavel" defaultValue={dados.responsavel} className={campo}>
            {RESPONSAVEIS.map(([v, t]) => (
              <option key={v} value={v}>{t}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="de-notas" className={rotulo}>Notas internas (os utilizadores do cliente nunca as veem)</label>
        <textarea id="de-notas" name="notas" rows={3} defaultValue={dados.notas} className={campo} />
      </div>
      <Mensagem r={r} />
      <Enviar texto="Guardar" />
    </form>
  );
}

export function FormApagarEmpresa({ codigo }: { codigo: string }) {
  const [r, acao] = useFormState(apagarEmpresaAcao.bind(null, codigo), {});
  return (
    <form action={acao} className="space-y-3">
      <div>
        <label htmlFor="ap-conf" className={rotulo}>Para apagar, escreve o código da empresa: {codigo}</label>
        <input id="ap-conf" name="confirmar" autoComplete="off" autoCapitalize="none" className={campo} />
      </div>
      <Mensagem r={r} />
      <button type="submit" className="min-h-[44px] rounded-full border border-linha px-6 text-base font-semibold text-ambar-texto hover:bg-ambar-fundo">Apagar a empresa e os dados</button>
    </form>
  );
}
