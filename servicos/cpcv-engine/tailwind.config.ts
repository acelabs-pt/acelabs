import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      // Indicador "IA a pensar" (shimmer de texto + glow em gradiente a rodar) - padrão
      // usado em produtos de IA actuais (ChatGPT, Vercel AI SDK, ElevenLabs UI) em vez de um
      // spinner genérico, para sinalizar "a processar" em vez de "parado à espera".
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "150% 0" },
          "100%": { backgroundPosition: "-150% 0" },
        },
        "spin-lento": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        "pulsar-glow": {
          "0%, 100%": { opacity: "0.5", transform: "scale(0.9)" },
          "50%": { opacity: "1", transform: "scale(1.1)" },
        },
      },
      animation: {
        shimmer: "shimmer 2.2s linear infinite",
        "spin-lento": "spin-lento 3s linear infinite",
        "pulsar-glow": "pulsar-glow 2.2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
