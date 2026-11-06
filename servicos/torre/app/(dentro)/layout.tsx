import Casca from "@/components/Casca";
import EscolherPin from "@/components/EscolherPin";
import { sessaoSocio } from "@/lib/sessao";

export const dynamic = "force-dynamic";

export default async function Dentro({ children }: { children: React.ReactNode }) {
  const { s, socio } = await sessaoSocio();
  // PIN temporário (conta nova ou PIN reposto): primeiro escolhe-se o PIN, e só depois se vê a Torre.
  if (socio.pin_temporario) return <EscolherPin nome={socio.nome} />;
  // Os números do menu: o que está à espera de ti.
  const [rever, soltos] = await Promise.all([
    s.from("faturas").select("id", { count: "exact", head: true }).eq("estado", "rever"),
    s.from("movimentos").select("id", { count: "exact", head: true }).is("categoria_id", null),
  ]);
  return (
    <Casca nome={socio.nome} contadores={{ faturas: rever.count ?? 0, movimentos: soltos.count ?? 0 }}>
      {children}
    </Casca>
  );
}
