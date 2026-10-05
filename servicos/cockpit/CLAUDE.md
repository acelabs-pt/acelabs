# CLAUDE.md - Cockpit

Este ficheiro documenta o contexto deste serviço. Está em fase de ideação - ainda não há código.
Ver também o CLAUDE.md na raiz do repositório para o contexto geral da Ace Labs.

## O que é

Aplicação mobile (iOS e Android) tipo CRM para agentes imobiliários, inspirada na Vericasa mas
focada sobretudo em facilidade de uso no dia a dia do agente no terreno. Ideia originada pelo
Miguel: a parte mais importante da solução para agentes é a aplicação e a sua facilidade de uso,
não um painel web complexo.

Encaixa como extensão/variante do produto "Painel de Gestão" do preçário oficial (ver CLAUDE.md
raiz). Nota: discussão recente passou a chamar-lhe "software as a service", o que seria uma
excepção ao modelo geral da Ace Labs (projetos à medida, não SaaS) - ainda por confirmar
explicitamente com o Miguel, ver `pesquisa-boas-praticas.md` nesta pasta.

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

## Sócios

Pedro e Miguel, mesma dinâmica de colaboração assíncrona via git descrita no CLAUDE.md raiz.

## Estado

Ideação / definição de nome e âmbito. Sem código, sem schema, sem design visual definido.
