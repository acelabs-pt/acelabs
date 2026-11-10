import { EsqueletoLista } from "@/components/Esqueleto";

// Mostrado logo ao tocar numa página do menu, enquanto a seguinte carrega: a app responde de imediato.
export default function Carregar() {
  return (
    <div className="p-4 md:p-8">
      <EsqueletoLista />
    </div>
  );
}
