import type { MetadataRoute } from "next";

// Para instalar a Torre no ecrã do telemóvel (iPhone: Partilhar, "Adicionar ao ecrã principal"; Android: "Instalar app").
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ace Labs Torre",
    short_name: "Torre",
    description: "Gestão interna da Ace Labs: contas, faturas, tesouraria e clientes.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f5f5f7",
    theme_color: "#ffffff",
    lang: "pt-PT",
    icons: [
      { src: "/icones/192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icones/512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icones/512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
