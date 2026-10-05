# CLAUDE.md - Cockpit

Este ficheiro documenta o contexto deste serviço. Já há código (Next.js/Supabase) em
desenvolvimento ativo. Ver também o CLAUDE.md na raiz do repositório para o contexto geral da
Ace Labs.

## O que é

Aplicação mobile (iOS e Android) tipo CRM para agentes imobiliários, inspirada na Vericasa mas
focada sobretudo em facilidade de uso no dia a dia do agente no terreno. Ideia originada pelo
Miguel: a parte mais importante da solução para agentes é a aplicação e a sua facilidade de uso,
não um painel web complexo.

Encaixa como extensão/variante do produto "Painel de Gestão" do preçário oficial (ver CLAUDE.md
raiz). Decidido: avança como SaaS horizontal (várias agências, multi-tenant com RLS), excepção
deliberada ao modelo geral da Ace Labs (projetos à medida) - confirmado pelo Pedro, ver
`create_tables_cockpit.sql` (schema por `organizacao_id`).

## Nome

Decidido: **Cockpit**. Alinha com o tema cockpit/nave discutido com o Miguel - o app como
painel de comando do agente no terreno. Outros candidatos considerados antes de fechar: AgentBoard,
PowerAgent, CoPiloto, Painel de Bordo, Terreno, Rota Agente, Agente360.

## Abordagem técnica (atualizada após pesquisa, ainda não implementada)

Ver `pesquisa-boas-praticas.md` nesta pasta para o estudo completo (feito com uma equipa de
agentes de IA). Prioridade: facilidade de instalação sem depender de aprovação em loja (App
Store / Play Store), e sincronização fiável no terreno com rede instável.

Recomendação da pesquisa: avançar logo para **Capacitor** (envolve o código React/Next.js num
wrapper nativo), não ficar numa fase PWA pura primeiro - em iOS, PWA pura não garante push
notifications fiáveis nem sincronização em segundo plano, e isso é crítico para uma app cujo
valor principal é notificação de novo lead/mensagem. Reaproveita o mesmo stack Next.js do
`cpcv-engine`. Distribuição fora de loja pública: Android por `.apk` direto; iOS via TestFlight
(builds expiram aos 90 dias, exige reenvio periódico - tarefa operacional recorrente, conta
Apple Developer paga).

Por decidir: funcionalidades do CRM (ver secção de produto na pesquisa - MVP sugerido: ficha de
imóvel/lead, registo de visita num toque, agenda, click-to-call/WhatsApp com log automático,
tarefas, sync offline-first), e se reaproveita dados/schema do Supabase já em uso no
`cpcv-engine` ou é um projeto Supabase novo multi-tenant (ver secção de arquitetura SaaS na
pesquisa - recomendação: schema partilhado com RLS por `organizacao_id`, não um projeto por
cliente).

## Design visual

Ver `pesquisa-ux-design.md` nesta pasta (referências de UX/código no GitHub) e o mockup
clicável feito como Artifact (validado pelo Miguel - ver memória do Claude Code, não está no
repo). Aplicado: bottom nav fixa com ícone + texto (`components/TabBar.tsx`), cards com sombra e
`rounded-2xl` em Hoje/Contactos/Imóveis, paleta da marca por `lib/estado-relacao.ts`.

Discrepância a resolver: o mockup validado pelo Miguel tem 4 separadores (Hoje/Contactos/
Imóveis/A fazer); a `pesquisa-ux-design.md` fala de "5 ecrãs" incluindo "Visitas" separado de
Contactos. Por agora o código segue os 4 do mockup já validado - confirmar com o Miguel se
"Visitas" deve ser um 5º separador antes de o adicionar.

## Sócios

Pedro e Miguel, mesma dinâmica de colaboração assíncrona via git descrita no CLAUDE.md raiz.

## Estado

Nome, arquitetura técnica e especificação de produto definidos e validados pelos dois sócios
(mockup clicável aprovado). Código real em `app/(shell)/`: login, Hoje, Contactos (lista +
ficha com registo de visita num toque e timeline), Imóveis (lista). Falta: ecrã "A fazer" (sem
modelo de dados de tarefas ainda), projeto Supabase real a criar, app Capacitor ainda não
gerada (`npx cap add ios android`).

## Pôr a correr localmente (depois de criar o projeto Supabase)

Não há projeto Supabase real ainda - criar em supabase.com (conta do Pedro/Miguel), depois:

1. Copiar `.env.example` para `.env.local` e preencher com as chaves do projeto novo.
2. Correr `create_tables_cockpit.sql` no SQL Editor do Supabase.
3. Criar o primeiro utilizador em Authentication > Add user (não há signup self-service ainda).
4. `npm run bootstrap:organizacao -- <email> "<nome da organização>"` - associa esse utilizador
   a uma organização nova como owner (sem isto o login funciona mas RLS bloqueia tudo, porque
   `organizacao_atual()` lê `organizacao_id` do `app_metadata` do JWT).
5. `npm run dev`, login com esse utilizador.
