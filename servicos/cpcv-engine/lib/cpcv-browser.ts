import type { Browser } from "playwright-core";

// Em produção (Vercel) não há Chromium instalado - usa-se o build leve do
// @sparticuz/chromium, feito para funções serverless. Em desenvolvimento local
// usa-se o Chromium normal, descarregado pelo `playwright` (devDependency) via
// `npm install` / `npx playwright install`, que o playwright-core encontra
// automaticamente na cache partilhada sem precisar de executablePath.
export async function launchChromium(): Promise<Browser> {
  const { chromium } = await import("playwright-core");

  if (process.env.VERCEL) {
    const sparticuzChromium = (await import("@sparticuz/chromium")).default;
    return chromium.launch({
      args: sparticuzChromium.args,
      executablePath: await sparticuzChromium.executablePath(),
      headless: true,
    });
  }

  return chromium.launch();
}
