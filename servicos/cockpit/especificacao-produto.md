# Cockpit - especificação de produto (v1)

Consolida a pesquisa de arquitetura (`pesquisa-boas-praticas.md`) com uma segunda pesquisa
focada em pain points reais de agentes imobiliários (reviews negativas de CRMs concorrentes,
queixas informais) e nos padrões clássicos de seguimento por tipo de relação. Objetivo:
definir o modelo de dados e o MVP antes de escrever código.

## 1. Pain points reais que o Cockpit tem de resolver

Encontrados em reviews negativas e queixas informais sobre CRMs concorrentes (Follow Up Boss,
kvCORE/BoldTrail, Lofty, Sierra Interactive, BoomTown, Chime), não em discursos de vendas:

1. Entrada de dados duplicada entre portais/MLS e o CRM (até 20-30% do tempo do agente).
2. CRMs feitos para o gestor ver relatórios, não para o agente sentir valor pessoal no uso
   diário - por isso ele evita usar.
3. App móvel pior que a versão desktop - o agente desiste de registar notas logo depois de
   uma visita, perde o detalhe enquanto está fresco.
4. Um lead "desaparece" sem ninguém notar - não há sinal visual de "há quanto tempo não falo
   com esta pessoa". Resposta em 5 minutos aumenta 21x a conversão face a resposta tardia
   (HousingWire); a inversa também é verdade, perder tempo mata o negócio.
5. Esquecer o proprietário depois da angariação - "list it and forget it" é a queixa nº1 de
   vendedores insatisfeitos.
6. Não saber "a quem é que já dei seguimento esta semana" - falta de visão agregada de
   atividade recente.
7. Automações de follow-up (sequências) complexas de configurar - o agente médio nunca chega
   a usá-las.
8. Demasiadas notificações de "novo imóvel" sem filtro de relevância - o agente desativa tudo.
9. Conversa real acontece no WhatsApp, fora do CRM - o histórico fica incompleto e desligado.

Isto confirma a tese dos sócios: o Cockpit ganha por fazer bem o básico com fricção mínima, não
por ter mais funcionalidades que os concorrentes.

## 2. Modelo de dados: tracking por tipo de relação

Em CRMs imobiliários maduros, cada tipo de relação guarda informação diferente. Entidades
propostas para o Cockpit:

- **Contacto/Pessoa** - entidade-base de qualquer pessoa no sistema, com um **estado de
  relação** explícito e histórico de transições: `lead_frio` -> `lead_morno` ->
  `cliente_comprador` ou `cliente_proprietario`. A transição lead -> cliente é uma ação
  explícita do agente (ex: assinou contrato de mediação, ou começou a pedir visitas
  concretas), nunca automática por tempo decorrido.

- **Lead** (ainda não é cliente) - origem do contacto, temperatura (frio/morno/quente,
  baseada em sinais de comportamento: abriu email, respondeu, pediu avaliação, deu prazo
  concreto - não em dados estáticos), data do último contacto, próxima ação agendada.

- **Cliente comprador** - perfil de pesquisa (tipologia, zona, orçamento, prazo, motivo da
  compra), regras de alerta de novos imóveis (frequência e canal configuráveis, para não
  repetir o pain point nº8), e por cada imóvel visto: data da visita, feedback estruturado
  (gostou/não gostou/motivo), estado (visitado / proposta feita / recusado / standby).

- **Cliente proprietário/vendedor** - imóvel associado, preço de listagem vs. expectativa real
  do proprietário (frequentemente diferentes), motivo e prazo de venda, histórico de propostas
  recebidas (valor, condições, data, resposta), e um campo central de **cadência de update
  acordada** com data do próximo update devido (mínimo semanal é o padrão do setor) - isto
  ataca diretamente o pain point nº5.

- **Contraparte / agente externo** - quando há dois agentes numa transação (agência do
  comprador + agência do vendedor). Guarda-se só estado objetivo da cooperação (visita feita,
  feedback dado sim/não, proposta pendente), nunca opiniões subjetivas do cliente - por razões
  de confidencialidade e para evitar duplicação de esforço entre as duas agências.

- **Imóvel** - ficha do imóvel (tipologia, zona, preço, estado, fotos), ligado ao cliente
  proprietário e ao histórico de visitas/propostas.

- **Atividade** (registo cronológico transversal) - cada chamada, visita, nota, mensagem
  registada contra o contacto/imóvel relevante. É esta entidade que resolve o pain point nº6
  ("a quem já dei seguimento esta semana") sem esforço extra do agente - tem de aparecer sempre
  visível, não enterrada em menus.

## 3. MVP: essencial vs. decorativo

**Resolve pain point real (construir primeiro):**
- Timeline de atividade por contacto, visível sem cliques extra.
- Alerta automático de "sem contacto há X dias" por lead/cliente.
- Lembrete agendado e visível de update devido ao proprietário (cadência acordada).
- Registo de visita e feedback por imóvel, num só toque, rápido no telemóvel (ataca o pain
  point nº3 - registar logo a seguir à visita, não à noite em casa).
- Ficha de imóvel e ficha de contacto com acesso e edição offline.
- Agenda com vista "hoje" e "próximos dias".
- Click-to-call e click-to-WhatsApp com log automático da interação.
- Transição lead -> cliente como ação explícita e única.
- Sincronização offline-first com feedback visual claro de "enviado" vs "pendente" (ver
  `pesquisa-boas-praticas.md`, secção 2).

**Decorativo / feature creep (adiar para fase 2+):**
- Dashboards analíticos de equipa sofisticados, sem utilidade para o agente individual.
- Automações de nutrição configuráveis ao detalhe (tipo SmartPlans) - ninguém chega a
  configurar, é melhor ter 2-3 sequências pré-feitas e simples.
- Scoring numérico muito granular de leads sem ação associada.
- Integração profunda com múltiplos portais externos antes de validar o essencial.
- Power dialer, distribuição automática de leads, IA a qualificar leads (tipo Sierra AI) - fica
  para depois de validar o uso diário.
- Painel web completo de gestão - mantê-lo deliberadamente simples, a tese é mobile-first.
- Geração automática de CPCV a partir dos dados do Cockpit - diferencial forte, mas só depois
  do Cockpit se provar como ferramenta de terreno (ver `pesquisa-boas-praticas.md`, secção 4).

## 4. Vocabulário sugerido para a app

Nomes de secções/ecrãs em português de Portugal, simples e no tema "cockpit" já escolhido:

- **Hoje** (não "Dashboard") - agenda e tarefas do dia, ecrã de abertura.
- **Contactos** (não "Leads/CRM") - lista única de pessoas, com o estado de relação visível
  por etiqueta de cor (lead frio/morno, comprador, proprietário).
- **Imóveis** - fichas de imóveis, ligadas aos proprietários.
- **Visitas** - agenda e registo de visitas feitas.
- **A fazer** (não "Tasks") - lista de seguimentos pendentes.
- Etiqueta de alerta: **"Sem contacto há N dias"** em vez de termos técnicos como "stale lead".
- Estado do envio offline: **"Guardado no telemóvel"** / **"Enviado"** - linguagem simples, sem
  jargão técnico, para o agente nunca duvidar se o trabalho ficou guardado.

## 5. Por decidir antes de código

- Confirmar esta lista de entidades e MVP com o Miguel.
- Confirmar o ponto já sinalizado em `pesquisa-boas-praticas.md`: Cockpit como excepção SaaS
  ao modelo da Ace Labs.
- Confirmar arranque direto em Capacitor (ver `pesquisa-boas-praticas.md`, secção 1).
