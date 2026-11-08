import type { Config } from "tailwindcss";

// Cores da identidade visual Ace Labs (ver CLAUDE.md da raiz, secção
// "Identidade visual") - o Cockpit segue a mesma marca em vez de inventar
// paleta própria.
const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Inter",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        tinta: "rgb(var(--c-tinta) / <alpha-value>)",
        secundario: "rgb(var(--c-secundario) / <alpha-value>)",
        bege: "rgb(var(--c-bege) / <alpha-value>)",
        azul: "rgb(var(--c-azul) / <alpha-value>)",
        "azul-escuro": "rgb(var(--c-azul-escuro) / <alpha-value>)",
        escuro: "#0a1620",
        verde: "rgb(var(--c-verde) / <alpha-value>)",
        ambar: "rgb(var(--c-ambar) / <alpha-value>)",
        "ambar-fundo": "rgb(var(--c-ambar-fundo) / <alpha-value>)",
        "ambar-texto": "rgb(var(--c-ambar-texto) / <alpha-value>)",
        "azul-suave": "rgb(var(--c-azul-suave) / <alpha-value>)",
        "verde-suave": "rgb(var(--c-verde-suave) / <alpha-value>)",
        linha: "var(--linha)",
      },
    },
  },
  plugins: [],
};
export default config;
