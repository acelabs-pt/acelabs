# Plano de trabalho: feedback dos testers

Fonte: sessão de 2 horas com a primeira tester beta (consultora numa agência RE/MAX de Braga, usa o MaxWork como referência),
mais os reportes que ela já mandou pela app (Torre > ficha do tester). Sem nomes nem dados de clientes neste ficheiro: o
repositório é público.

Princípio: a app continua simples. Cada ponto resolve-se com o mínimo de opções novas; quando há dúvida entre "dá para
configurar" e "funciona sozinho", ganha o "funciona sozinho".

Esforço: **S** = até meio dia, **M** = 1 a 2 dias, **L** = 3 dias ou mais (inclui testes e verificação no browser).

---

## 0. Como processamos o feedback

Um só circuito, para nada se perder:

1. **Entrada.** Pedir à tester que use sempre o botão de ajuda da app (canto inferior esquerdo): leva a página, a captura e o
   áudio já transcrito, e cai na ficha dela na Torre. O que chegar por WhatsApp (screenshots, áudios) o Pedro reencaminha:
   as imagens vão para `business-center/cockpit-beta/feedback/` (fora do git) e os áudios vão como texto (o WhatsApp tem
   "Transcrever" na nota de voz; ou ouvir e escrever duas linhas).
2. **Triagem (Claude, 1 vez por semana ou quando o Pedro pedir).** Ler os reportes novos na Torre e a pasta, e meter cada
   ponto neste ficheiro com um código (B, R, F), ou juntá-lo a um ponto que já exista. Marcar o reporte como "visto" na Torre.
3. **Fazer.** Por fases (abaixo). Cada ponto: código, testes, verificação no browser, commit com o código do ponto
   (ex. "Cockpit: B3 relatório em PDF descarregado").
4. **Publicar.** Pedro faz o deploy (só ele tem acesso), SQL no projeto partilhado antes do deploy.
5. **Fechar.** Marcar o reporte como "resolvido" na Torre e mandar à tester uma mensagem curta "o que mudou" (pronta a
   copiar, gerada a partir dos pontos fechados). A chamada semanal de 10 minutos do Miguel serve para validar.

---

## Fase 1. Bugs (esta semana)

Feitos a 21/11, à espera de deploy: B1 (tarefas na hora certa na vista Dia, arrastar para outra hora, e "Mudar dia e hora" no detalhe para o telemóvel), B2 (tarefas automáticas do comprador sem hora inventada), B8 (as folhas ficavam presas à página por causa da animação de entrada) e B9 ("+ Nova tarefa" abre na página onde se está).

Feitos a 21/11 (segunda volta), à espera de deploy: B3 (PDF do relatório descarregado logo, sempre claro, com a base `lib/pdf.ts`), B4 (exportar a ficha em Excel e PDF "Ficha de cliente"; o ficheiro com tudo fica para pedidos de acesso aos dados), B5 ("Copiar número" no computador), B6 (Ligar, WhatsApp e Email sempre à vista nas fichas), B7 (visita marcada em âmbar até à hora; depois fica "Visitado" e o funil avança sozinho; escolhi "dá-se como feita sozinha", tocar em "Visitado" desfaz) e R2 (WhatsApp em cada link, conta como enviado).

| # | Problema | Solução proposta | Esforço |
|---|---|---|---|
| B1 (feito) | Calendário, vista Dia: as tarefas ficam numa lista no topo, não na hora, e não se arrastam. | Hoje é propositado: as tarefas automáticas vão todas para as 9h e ficavam ilegíveis na grelha (`Tempo.tsx`). Mudar para: uma tarefa **com hora escolhida pela pessoa** vai para a grelha e arrasta-se como um evento; as automáticas ficam na lista "Para hoje" e podem ser arrastadas da lista para uma hora. Precisa de saber se a hora foi escolhida (coluna nova `com_hora` em `tarefas`). | M |
| B2 (feito) | A tarefa "Enviar novas opções de imóveis" nasce com data e hora que ninguém escolheu. | Mesma raiz que o B1: as automáticas ganham uma hora inventada. Passam a ter só dia (sem hora), e o dia segue uma regra clara (ex. 2 dias depois de criar o comprador, ou o dia do último envio mais 7). Rever a regra em `AgendaDoComprador.tsx` e nas automações. | S (com o B1) |
| B3 (feito) | Relatório da angariação: "Guardar em PDF" abre a impressão do browser e o PDF sai cortado. | Gerar um PDF a sério, descarregado logo, com paginação própria (cabeçalho, rodapé com data, quebras de página). Fazer uma **base de PDF** reutilizável, porque serve também o R3 e o F2. | M |
| B4 (feito) | Exportar o contacto descarrega um `.json`. | Trocar pelo Excel (já existe para "Descarregar os teus dados", reutilizar) e pelo PDF do R3. | S |
| B5 (feito) | "Ligar" no computador: o Windows pergunta que aplicação usar. | Em ecrãs sem telefone (sem toque), o botão passa a "Copiar número" e mostra "Copiado". | S |
| B6 (feito) | Ações rápidas (Ligar, WhatsApp, Email) escondidas atrás do nome na ficha do comprador. | Barra fixa no topo da ficha com os 3 botões sempre visíveis; o resto dos detalhes fica recolhido como está. | S |
| B7 (feito) | O comprador aparece como "visitado" quando a visita só está agendada (reporte de 20/11). | O funil só avança para "Visitas realizadas" depois da hora da visita passar e de ela confirmar: na visita aparece "Aconteceu?" com Sim / Não. Até lá fica "Visita agendada" (âmbar). Cuidado: o funil automático foi validado, mexer só neste passo. | S/M |
| B8 (feito) | Calendário: o popup da tarefa aparece em baixo e tem de se descer a página (reporte de 19/11). | Abrir o popup como folha a partir do fundo no telemóvel e centrado no computador, sempre visível sem descer. | S |
| B9 (feito) | "+" > Nova tarefa: o popup aparece e desaparece logo, e vai parar à lista de tarefas (reportes de 19/11). | O "+" abre logo o formulário de nova tarefa onde a pessoa está, sem mudar de página. | S |

## Fase 2. Melhorias rápidas

| # | Pedido | Solução proposta | Esforço |
|---|---|---|---|
| R1 | WhatsApp com imóvel manda o ID, que não diz nada ao cliente. | Campo novo **"Link do anúncio"** na angariação; a mensagem passa a levar o link. Sem link, leva a descrição (tipologia, zona, preço) em vez do ID. Sem API do WhatsApp: continua a abrir com o texto escrito. | S |
| R2 (feito) | Na secção de links do comprador, abrir o WhatsApp com o link sem copiar e colar (reporte de 20/11). | Botão WhatsApp ao lado de cada link, com o texto já escrito. Junta-se ao R1. | S |
| R3 | Relatório ao proprietário: texto robótico, saudação sem nome, botão pouco visível. | (a) Antes de enviar, o texto aparece numa caixa editável ("Personalizar mensagem"); (b) sem proprietário, aviso "Associar proprietário" com o botão ali mesmo; (c) botão "Enviar relatório" no topo da angariação. Reescrever o texto base num tom mais humano. | S |
| R4 | Exportar a ficha do contacto em Excel e PDF. | Menu "Exportar" com 2 opções: Excel e PDF "Ficha de cliente" (usa a base do B3). | S |
| R5 | Follow-up do plano fixo de 10 em 10 dias. | Escolher **semanal, quinzenal ou mensal** ao criar a angariação (e mudar depois), com o dia da semana (ex. sexta). Ver nota técnica do F4: o plano está feito em blocos de 10 dias. | M |
| R6 | Orçamento diferente por tipologia (T2 até X, T3 até Y). | Na ficha, o orçamento passa a poder ter várias linhas "tipologia + valor máximo"; a maioria continua com uma só e o ecrã fica igual. O cruzamento com angariações usa o valor da tipologia certa. Muda dados (hoje `tipologia_minima` + `expectativa_valor`). | M |
| R7 | Cartão "Compradores com interesse" sem os critérios; falso positivo. | Mostrar no cartão zona, tipo, tipologia e orçamento do comprador. O falso positivo veio de um comprador sem tipo de imóvel preenchido: quando falta o tipo, o cartão diz "tipo por definir". | S |
| R8 | "Valor da comissão" em "Marcar como vendido" pouco claro. | Rótulo "Comissão para ti (€)" e ajuda "o que recebes, não a faturação da agência". Fica resolvido de vez com o F5. | S |
| R9 | Metas: quer defini-las ela. | Já existe (Dashboard > Metas > Editar), mas não se encontra. Tornar o botão visível e pôr no guia. A análise por meta fica para depois. | S |

## Fase 3. Funcionalidades maiores (por esta ordem)

| # | Pedido | Solução proposta | Esforço |
|---|---|---|---|
| F1 | **Comissão automática** (estilo MaxWork) | Na angariação: honorários do vendedor e do comprador em % (lista com os valores habituais) e "negócio pleno / partilhado". Em "Marcar como vendido": pré-preenche o valor da proposta aceite e calcula a comissão, editável para o valor efetivo. Precisa de saber a parte do consultor (pergunta 4). | M |
| F2 | **Custos por angariação e lucro real** (a dor que ela mais sublinhou) | Lista de despesas por angariação (descrição, valor, data). Na angariação: comissão, custos, **lucro**. No Dashboard, nas metas: comissões do ano menos custos. Tabela nova (`create_tables.sql`, as 2 listas de `migracao_multiempresa.sql` e os dados de teste). Faz-se a seguir ao F1. | M |
| F3 | **Leads FSBO rápidas** | Botão "FSBO rápido" no "+": só telemóvel (nome opcional), cria o proprietário em FSBO e abre logo o WhatsApp com a primeira mensagem de um modelo (com o Instagram dela). Se não carregar em enviar, fica uma tarefa "Mandar mensagem a ..." para o dia seguinte. Modelo editável uma vez em Conta. | M |
| F4 | **Plano da angariação em semanas** | Vista "Semana" no plano: as próximas semanas, cada ação com dia concreto, e essa ação vai para o calendário nesse dia. Nota técnica: o plano está em blocos de 10 dias (`DIAS_POR_BLOCO`, `FOLLOW_UP_BLOCOS` em `lib/angariacao.ts`), mas cada ação já guarda o dia exato (`dia`), por isso a mudança é sobretudo no ecrã e na regra "uma ação por bloco". Fazer junto com o R5. | L (com o R5) |
| F5 | **Ficha de cliente comprador em PDF para assinar** | PDF com os interesses do comprador, espaço para assinatura e data, para enviar com o acordo de representação ou imprimir. Base do B3. Precisa do modelo em papel da RE/MAX (pergunta 3). | M |
| F6 | **Cores por temperatura e inatividade** | Um só sinal discreto: uma barra fina à esquerda do cartão que passa de neutro a âmbar a vermelho conforme a motivação e os dias sem contacto (chamada, envio, visita, nota). Sem mexer no resto do cartão. Regra simples: motivação 7+ e mais de 7 dias sem contacto = âmbar, mais de 14 = vermelho. | M |

## Backlog (não agora)

- Arrendamentos (tipo de negócio, comissão em rendas, inquilinos). Hoje ela contorna com "vendido".
- Relatório ao proprietário em vídeo curto.
- Nota de voz depois de uma chamada, com a IA a sugerir atualizações (já em desenvolvimento).
- Entrar no iPhone por Face ID (passkeys na PWA é possível; avaliar quando a app nativa avançar).
- App na App Store (depende da empresa constituída e da Apple).
- Análise por meta (entrar numa meta e ver o detalhe).

## Validado, não mexer

WhatsApp e WhatsApp Business com o contacto certo; Ligar no iPhone; funil automático do comprador (exceto o B7); plano editável
com "juntar ação"; "Marcar como vendido" limpa as tarefas; visita com feedback no relatório; "Abrir ficha" a partir do
calendário; propostas de compradores de outros consultores; reporte com áudio transcrito e captura.

---

## Perguntas em aberto

1. **B7, visitas:** confirmar com "Aconteceu? Sim / Não" depois da hora, ou dar como feita sozinha quando a hora passa (e ela
   desfaz se não aconteceu)?
2. **R5, follow-up:** chega semanal / quinzenal / mensal com dia da semana, ou ela quer mesmo "de 7 em 7 dias a partir do
   início"?
3. **F5, ficha de interesses:** pedir-lhe uma foto do papel da RE/MAX, para copiar os campos e a ordem.
4. **F1, comissão:** a comissão que ela quer ver é a dela depois da parte da agência (ex. 50% dos honorários)? Essa
   percentagem é fixa por consultor (fica em Conta) ou muda por negócio?
5. **F3, FSBO:** qual o texto da primeira mensagem que ela usa hoje, e o link do Instagram dela?
6. **Ordem da fase 3:** proponho comissão e custos primeiro (a dor maior), depois FSBO. Concordas?
