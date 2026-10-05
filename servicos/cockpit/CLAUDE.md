# CLAUDE.md - Cockpit

Este ficheiro documenta o contexto deste serviço. Está em fase de ideação - ainda não há código.
Ver também o CLAUDE.md na raiz do repositório para o contexto geral da Ace Labs.

## O que é

Aplicação mobile (iOS e Android) tipo CRM para agentes imobiliários, inspirada na Vericasa mas
focada sobretudo em facilidade de uso no dia a dia do agente no terreno. Ideia originada pelo
Miguel: a parte mais importante da solução para agentes é a aplicação e a sua facilidade de uso,
não um painel web complexo.

Encaixa como extensão/variante do produto "Painel de Gestão" do preçário oficial (ver CLAUDE.md
raiz), não como SaaS horizontal novo - mantém o modelo de projetos à medida da Ace Labs.

## Nome

Decidido: **Cockpit**. Alinha com o tema cockpit/nave discutido com o Miguel - o app como
painel de comando do agente no terreno. Outros candidatos considerados antes de fechar: AgentBoard,
PowerAgent, CoPiloto, Painel de Bordo, Terreno, Rota Agente, Agente360.

## Abordagem técnica (discutida, não implementada)

Prioridade: facilidade de instalação sem depender de aprovação em loja (App Store / Play Store).

1. **Fase 1 - PWA**: app instalável via browser ("Adicionar ao ecrã principal"), sem loja.
   Funciona bem em Android; em iOS (16.4+) instala mas com limitações em notificações push e
   acesso a funcionalidades nativas. Reaproveita stack Next.js, à semelhança do `cpcv-engine`.
2. **Fase 2 - nativa via Capacitor** (se for preciso push fiável ou sensação mais nativa):
   envolve o mesmo código React/Next.js num wrapper nativo. Distribuição fora de loja pública:
   Android por `.apk` direto; iOS via TestFlight (tem revisão da Apple mas sem listagem pública,
   é o caminho mais viável sem loja porque a Apple não permite sideload livre como o Android).

Nenhuma destas fases está implementada. Por decidir: funcionalidades do CRM (gestão de leads,
imóveis, contactos, agenda), se reaproveita dados/schema do Supabase já em uso no `cpcv-engine`
ou é um projeto Supabase novo (ver regra "um projeto Supabase por cliente" no CLAUDE.md raiz -
aqui aplica-se "por serviço/produto").

## Sócios

Pedro e Miguel, mesma dinâmica de colaboração assíncrona via git descrita no CLAUDE.md raiz.

## Estado

Ideação / definição de nome e âmbito. Sem código, sem schema, sem design visual definido.
