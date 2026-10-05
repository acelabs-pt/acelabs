# Cockpit - pesquisa de UX/design (v1)

Pesquisa no GitHub por referências de código/design para a interface do Cockpit, pedida pelo
Pedro a 2026-10-05. Objetivo: encontrar inspiração de UX moderna sem aumentar a complexidade de
funcionalidades - o segmento (agentes imobiliários) não é muito tech-savvy, só precisa de ter a
aparência de uma app atual.

## Estado do código no momento da pesquisa

Login e ecrã "Hoje" já funcionais mas muito básicos: inputs genéricos, cards com borda fina sem
sombra, sem navegação por separadores. Paleta de marca Ace Labs já ligada ao Tailwind
(`tailwind.config.ts`: tinta, secundario, bege, azul, verde, ambar, ambar-fundo, ambar-texto).

## Referências encontradas

- **[pnewsam/pwa-ui](https://github.com/pnewsam/pwa-ui)** - biblioteca React para PWAs
  mobile-first (AppShell, TabBar, safe-area, comportamento do teclado). É a mais alinhada ao
  nosso stack (Next.js + Capacitor, como o cpcv-engine). Vale a pena olhar para a estrutura do
  `TabBar`/`AppShell` como referência de implementação, mesmo sem instalar a biblioteca.
- **Bloco "navbar-mobile-bottom" do shadcn** (shadcn.io/blocks/navbar-mobile-bottom) - código de
  uma barra de navegação inferior com ícones, estado ativo e padding de safe-area. Copiar o
  padrão à mão para os nossos 5 ecrãs (Hoje / Contactos / Imóveis / Visitas / A fazer) sem trazer
  a dependência shadcn toda.
- **[alemat13/MyFinance](https://github.com/alemat13/MyFinance)** (PRs #134 e #135) - app Next.js
  real redesenhada para mobile: tabelas trocadas por listas de cards, bottom nav acrescentada,
  "sheet" para opções secundárias. Padrão direto para a lista de Contactos/Imóveis do Cockpit.
- **[twentyhq/twenty](https://github.com/twentyhq/twenty)** - CRM open source mais conhecido por
  design moderno (inspirado no Notion: cards com sombra leve, tipografia limpa, badges de estado
  discretos). Stack diferente do nosso (NestJS/GraphQL), não para reaproveitar código, mas boa
  referência visual de "CRM moderno sem ser complexo".

Descartado: os CRMs imobiliários open source que aparecem primeiro numa pesquisa (InsulaCRM,
dhruvb2028/Real-Estate-CRM, prolinkinfo/RealEstateCRM) são todos painéis web de admin
tradicionais (Laravel/MERN), não mobile-first - não têm nada de design que valha a pena copiar
para o Cockpit.

## Recomendação (aparência, não funcionalidades novas)

- Barra de navegação inferior fixa com os 5 ecrãs já definidos, ícone + texto sempre visível
  (não só ícone - o público não é muito tech-savvy, o texto evita ambiguidade).
- Cards com mais "respiração": sombra suave, cantos mais arredondados (`rounded-2xl`), em vez da
  borda fina atual.
- Manter a paleta já definida (azul, verde, âmbar) só para badges de estado, sem inventar cores
  novas.
- Tipografia maior e área de toque generosa nos botões (uso com o dedo no terreno, não com rato).
- Empty states simples (ex. "Bom trabalho" já existe no código) com um ícone simples, sem
  ilustração elaborada.

## Por decidir

- Se avança já para bottom nav + cards redesenhados no ecrã "Hoje" e login, usando só Tailwind
  (sem adicionar shadcn como dependência nova).
