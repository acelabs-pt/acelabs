# Painel de Gestão - base

Esqueleto reutilizável extraído de um painel de gestão construído para um cliente real do sector imobiliário (Next.js 14 + Supabase). Não contém nomes, marca ou dados desse cliente - só a arquitectura e os padrões que resultaram bem, para servir de ponto de partida a qualquer novo projecto "Painel de Gestão" da Ace Labs.

## O que está aqui

Configuração completa do projecto (package.json, tsconfig, tailwind, eslint), autenticação por password com cookie de sessão, ligação ao Supabase, layout com sidebar, e dois exemplos de API route (leitura agregada e escrita por acção) com nomes de tabelas genéricos (`clientes`, `atividade_mensal`) em vez dos nomes reais do cliente original.

## Arrancar

Precisa de Node 20 e de um projecto Supabase próprio por cliente (nunca reutilizar o Supabase de outro projecto).

```bash
npm install
cp .env.example .env.local   # preencher com as chaves Supabase e a password à escolha
# colar create_tables_base.sql no SQL Editor do Supabase
npm run dev                   # localhost:3000
```

`npm run build` antes de qualquer deploy - não há testes automatizados, é a única validação.

## Padrões a repetir

**Autenticação simples por cookie.** Um `middleware.ts` intercepta todos os pedidos excepto `/login` e `/api/login`, e exige um cookie assinado com um valor fixo (`AUTH_SECRET`). Chega para um painel interno de uma equipa pequena, sem precisar de um sistema de utilizadores completo. Se o cliente tiver secções com acesso mais restrito (ex.: só o financeiro), o padrão que resultou foi um segundo gate no próprio componente cliente da página, com uma password diferente - não acrescentar essa lógica ao middleware geral.

**Ler tudo de uma vez, filtrar no cliente.** As rotas de leitura (ver `app/api/data/route.ts`) devolvem todas as tabelas relevantes num único pedido, com `dynamic = "force-dynamic"` e `Cache-Control: no-store`. A página guarda o resultado em estado e filtra/agrupa em memória conforme os filtros da UI mudam. Simplifica muito o frontend e evita ter uma rota por combinação de filtros - só compensa enquanto o volume de dados for pequeno (equipas, não milhares de registos).

**Escrita centralizada por acção.** Em vez de um endpoint por operação, um único `POST /api/write` recebe `{ action: "...", ...campos }` e despacha num `if/else` (ver o exemplo em `app/api/write/route.ts`). Cresce depressa - no projecto original chegou a ter cerca de 270 linhas com mais de dez acções. Compensa por manter a lógica de negócio toda visível num sítio em vez de espalhada por ficheiros, mas vale a pena dividir por domínio (`/api/write`, `/api/vendas/write`, etc.) quando o ficheiro começar a ficar difícil de navegar.

**Totais agregados são sempre recalculados, nunca escritos à mão.** Quando a app precisa de mostrar totais mensais (ex.: reuniões feitas, vendas fechadas), o padrão que resultou foi ter uma função `syncTotais(...)` chamada sempre que uma linha de detalhe é criada, editada ou apagada, que relê as linhas desse mês e regrava o total numa tabela separada. Isto evita ter dois sítios onde o mesmo número pode ficar desactualizado. Ponto de atenção: se houver mais do que uma data relevante por registo (ex.: data do evento vs. data em que passou a "concluído"), decidir explicitamente por qual data cada métrica se conta - foi a causa de uma discrepância real entre duas páginas do dashboard original, ambas a mostrar o "número certo" mas segundo datas diferentes.

**Datas mensais como texto, nunca como Date.** As tabelas que agregam por mês usam uma chave de texto em português, ex. `"agosto 26"` (ver `lib/data.ts`). Ordenar por um array fixo de meses (`MONTH_ORDER`), nunca alfabeticamente nem por `Date.parse` - o formato não é reconhecido de forma fiável entre navegadores.

**Duas fontes de dados, quando o cliente já tem um Google Sheets em uso.** Quando o cliente já trabalha num Google Sheets e não quer perder esse hábito, resultou bem tratar o Sheet como a fonte dos valores por omissão (lido por `export?format=csv&gid=...`, sem precisar de API key para um Sheet público) e guardar no Supabase só os overrides feitos dentro da app. A leitura faz o merge: override do Supabase ganha ao valor do Sheet. Isto não está exemplificado no código aqui (é bastante específico de cada Sheet), mas é um padrão a considerar antes de pedir ao cliente para abandonar a folha de cálculo.

## Cuidado com componentes soltos

No projecto original acumularam-se duas versões da sidebar porque uma redesign não apagou a antiga - só o `AppLayout.tsx` chegava a estar ligado ao `app/layout.tsx`, e ainda assim uma alteração foi feita no ficheiro errado antes de se notar que não tinha efeito nenhum no site. Antes de editar um componente de layout, confirmar com uma busca por "import" que é mesmo esse o usado.
