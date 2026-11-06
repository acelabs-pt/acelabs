import JSZip from "jszip";
import { exigirSocio } from "@/lib/sessao";
import { carregar } from "@/lib/dados";
import { semFatura } from "@/lib/ligar";
import { nomeTipoDoc } from "@/lib/qr-fatura";
import { nomeMes } from "@/lib/texto";

// Pacote do mês para o contabilista: as faturas (ficheiros com nomes arrumados) e duas folhas que abrem no Excel
// (separador ";", vírgula decimal, UTF-8 com BOM).
export const dynamic = "force-dynamic";

const num = (c: number | null | undefined) => (c === null || c === undefined ? "" : (c / 100).toFixed(2).replace(".", ","));
const cel = (v: string | null | undefined) => {
  const x = (v ?? "").replace(/\r?\n/g, " ");
  return /[;"]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x;
};
const linha = (l: (string | null | undefined)[]) => l.map(cel).join(";");
const limpo = (s: string) => s.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 80);

export async function GET(req: Request) {
  const { s } = await exigirSocio();
  const mes = new URL(req.url).searchParams.get("mes") ?? "";
  if (!/^\d{4}-\d{2}$/.test(mes)) return new Response("Mês inválido.", { status: 400 });
  const t = await carregar(s);
  const conta = new Map(t.contas.map((c) => [c.id, c.nome]));
  const categoria = new Map(t.categorias.map((c) => [c.id, c.nome]));
  const entidade = new Map(t.entidades.map((e) => [e.id, e.nome]));
  const socio = new Map(t.socios.map((x) => [x.id, x.nome]));
  const movimento = new Map(t.movimentos.map((m) => [m.id, m]));

  const faturas = t.faturas.filter((f) => f.estado !== "anulada" && (f.data ?? f.criado_em).startsWith(mes)).sort((a, b) => (a.data ?? "").localeCompare(b.data ?? ""));
  const movimentos = t.movimentos.filter((m) => m.data.startsWith(mes)).sort((a, b) => a.data.localeCompare(b.data));
  const faturaDoMov = new Map(t.faturas.filter((f) => f.movimento_id).map((f) => [f.movimento_id!, f]));

  const zip = new JSZip();
  const nomes = new Map<string, string>();
  const usados = new Set<string>();
  for (const f of faturas) {
    if (!f.ficheiro) continue;
    const ext = f.ficheiro.split(".").pop();
    let nome = limpo(`${f.data ?? "sem-data"} ${f.emitente_nome ?? "fatura"} ${f.numero ?? ""}`);
    while (usados.has(nome)) nome += " (2)";
    usados.add(nome);
    const { data } = await s.storage.from("faturas").download(f.ficheiro);
    if (!data) continue;
    zip.file(`faturas/${nome}.${ext}`, await data.arrayBuffer());
    nomes.set(f.id, `${nome}.${ext}`);
  }

  const cabF = ["Data", "Tipo", "Sentido", "Fornecedor ou cliente", "NIF", "Número", "ATCUD", "Moeda", "Sem IVA", "IVA", "Total", "Total em EUR", "Categoria", "Estado", "Pago por (movimento)", "Ficheiro"];
  const folhaF = [linha(cabF)];
  for (const f of faturas) {
    const m = f.movimento_id ? movimento.get(f.movimento_id) : null;
    folhaF.push(
      linha([
        f.data, nomeTipoDoc(f.tipo_doc), f.sentido === "emitida" ? "Emitida" : "Recebida", f.emitente_nome, f.emitente_nif, f.numero, f.atcud, f.moeda,
        num(f.base), num(f.iva), num(f.total), num(f.moeda === "EUR" ? f.total : f.total_eur),
        f.categoria_id ? categoria.get(f.categoria_id) : "", f.estado === "confirmada" ? "Confirmada" : "Por rever",
        m ? `${m.data} ${conta.get(m.conta_id) ?? ""} ${m.descricao}` : "Sem movimento", nomes.get(f.id) ?? "",
      ]),
    );
  }
  const cabM = ["Data", "Conta", "Descrição", "Valor", "Categoria", "Fornecedor ou cliente", "Sócio", "A devolver ao sócio", "Fatura"];
  const folhaM = [linha(cabM)];
  for (const m of movimentos) {
    const f = faturaDoMov.get(m.id);
    folhaM.push(
      linha([
        m.data, conta.get(m.conta_id), m.descricao, num(m.valor), m.categoria_id ? categoria.get(m.categoria_id) : "Por classificar",
        m.entidade_id ? entidade.get(m.entidade_id) : "", m.socio_id ? socio.get(m.socio_id) : "", m.reembolsavel ? "Sim" : "",
        f ? nomes.get(f.id) ?? `${f.emitente_nome ?? ""} ${f.numero ?? ""}` : m.valor < 0 ? "Sem fatura" : "",
      ]),
    );
  }
  const BOM = "﻿";
  zip.file("faturas.csv", BOM + folhaF.join("\r\n"));
  zip.file("movimentos.csv", BOM + folhaM.join("\r\n"));
  const emFalta = semFatura(movimentos, t.faturas, t.categorias).length;
  zip.file(
    "LEIA-ME.txt",
    `Ace Labs - pacote de ${nomeMes(mes)}\r\n\r\n${faturas.length} faturas, ${movimentos.length} movimentos.\r\n` +
      (emFalta ? `${emFalta} despesas ainda sem fatura (ver "Sem fatura" em movimentos.csv).\r\n` : "Todas as despesas têm fatura.\r\n") +
      `\r\nGerado pela Torre a ${new Date().toLocaleString("pt-PT", { timeZone: "Europe/Lisbon" })}.\r\n`,
  );

  const corpo = await zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });
  return new Response(corpo, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="acelabs-contabilidade-${mes}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
