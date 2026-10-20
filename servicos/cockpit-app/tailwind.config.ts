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
        tinta: "#1d1d1f",
        secundario: "#6e6e73",
        bege: "#EDEBE5",
        azul: "#0071e3",
        "azul-escuro": "#0059b3",
        escuro: "#0a1620",
        verde: "#1fae5a",
        ambar: "#ff9f0a",
        "ambar-fundo": "#fff4e5",
        "ambar-texto": "#9a5b00",
      },
    },
  },
  plugins: [],
};
export default config;
