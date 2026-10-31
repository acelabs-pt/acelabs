# Cockpit: registar por voz (proposta técnica, 31/10/2026)

O consultor fala, o Cockpit mostra ações sugeridas (tarefa, comprador, visita) e o consultor toca para aprovar cada uma.
Nada é gravado sem esse toque. É a funcionalidade que o ImoAgent tem e o Cockpit ainda não.

## Como funciona, passo a passo

1. **Gravar.** Botão de microfone no Dashboard e nas fichas. Toca para começar e para acabar (máximo 60 segundos).
2. **Voz para texto.** Dois caminhos, conforme onde o Cockpit está aberto:
   - **App nativa (iPhone e Android):** reconhecimento de voz do próprio telemóvel (Apple e Google, ambos com português de
     Portugal), através de um plugin do Capacitor. Grátis, rápido, e o texto aparece enquanto a pessoa fala.
   - **App web (Safari, Chrome):** grava o áudio e envia-o para `/api/voz` no servidor, que o manda a um serviço de transcrição.
     Junta-se ao pedido a lista de nomes dos clientes do consultor, para acertar nos nomes próprios e nas ruas.
3. **Perceber o que ele quer.** `/api/voz/interpretar` (servidor, a chave da Anthropic nunca vai para o telemóvel) envia ao Claude:
   - o texto transcrito;
   - a data e a hora de agora (para "amanhã às 10h" virar uma data);
   - uma lista curta das fichas da empresa do consultor (nome e id de compradores, proprietários e angariações), lida com a
     sessão dele, por isso as regras por empresa continuam a valer.
   O Claude devolve uma lista de ações em JSON com um formato fixo (ver abaixo).
4. **Aprovar.** Ecrã "Ações sugeridas": um cartão por ação, com os campos já preenchidos e editáveis, um botão "Adicionar" em
   cada um e "Adicionar todas". Se a ação fala de alguém que já existe, o cartão mostra a ficha encontrada ("João Silva,
   comprador"); se não encontra, propõe criar.
5. **Gravar no Cockpit.** Só depois do toque, com as funções que já existem (`lib/comprador.ts`, tarefas, visitas). O áudio
   nunca fica guardado.

## Formato da resposta do Claude

Saída estruturada (`output_config.format` com um JSON Schema; no SDK de TypeScript, `client.messages.parse()` com Zod), e não
tool use: queremos dados para mostrar ao consultor, não que o modelo execute nada. Cada ação traz:

| Campo | Exemplo |
|---|---|
| `tipo` | `criar_tarefa`, `criar_comprador`, `registar_visita`, `registar_chamada`, `nota` |
| `ficha` | id de uma ficha existente, ou `null` para criar |
| `campos` | os campos do tipo (título, data e hora; nome, telemóvel, zona, tipologia, orçamento; ...) |
| `frase` | o pedaço do texto de onde a ação saiu, para o consultor perceber de onde veio |
| `confianca` | alta, média ou baixa (as de confiança baixa aparecem desmarcadas) |

Exemplo: "Liguei ao João Silva, quer T2 em Braga até 250 mil, marca visita ao apartamento da Rua do Souto amanhã às 10h"
dá três cartões: atualizar o comprador João Silva (T2, Braga, 250.000 EUR), registar a chamada, e marcar a visita para amanhã
às 10h00 ligada à angariação da Rua do Souto.

## Que ferramentas

- **Claude:** a API do Claude não aceita áudio (os modelos atuais recebem texto, imagens e PDF), por isso a transcrição vem antes.
  Para perceber as ações, começar pelo **Claude Haiku 5.5** (`claude-haiku-5-5`, a partir de 0,10 USD por milhão de tokens de
  entrada e 0,50 USD de saída), que a Anthropic indica para extração e classificação e é da mesma família do que o CPCV já usa.
  Esforço `low`, para responder em poucos segundos. Se nas notas de teste falhar demasiado, subir para o Claude Sonnet 5.5
  (`claude-sonnet-5-5`, 2 / 10 USD por milhão). A decisão final é do Pedro e do Miguel, com base no teste abaixo.
- **Transcrição na web:** testar duas, com as mesmas notas: OpenAI `gpt-4o-mini-transcribe` (cerca de 0,003 USD por minuto) e
  ElevenLabs Scribe (cerca de 0,0037 USD por minuto). Os preços vêm de comparações de 2026 e confirmam-se nas páginas de cada um.
  Nenhuma das fontes confirma a qualidade em português de Portugal: é o teste que decide.
- **Transcrição na app nativa:** plugin de reconhecimento de voz do Capacitor (Apple e Google no telemóvel). Sem custo.

## Quanto custa por consultor

Hipótese: 20 notas por dia de 30 segundos, 22 dias por mês (440 notas, 220 minutos).

| Parte | Custo por mês |
|---|---|
| Transcrição na web | cerca de 0,70 a 0,80 USD (0 na app nativa) |
| Claude Haiku 5.5 (cerca de 2.500 tokens de entrada e 800 de saída por nota) | cerca de 0,30 USD |
| Total | cerca de 1 USD por consultor; com Sonnet 5.5 seriam cerca de 6 USD |

Cabe nos 15 EUR por mês da proposta para consultores, com folga.

## Cuidados

- **Privacidade:** o áudio vai para o serviço de transcrição (na web) e o texto para a Anthropic. Ver onde cada um processa os
  dados e ter contrato de subcontratação antes de dados reais. Nada sobre RGPD no site nem nas propostas até haver resposta.
- **Microfone na app nativa:** pedir autorização no iPhone (`NSMicrophoneUsageDescription` e `NSSpeechRecognitionUsageDescription`
  no `Info.plist`) e no Android (`RECORD_AUDIO`).
- **Sem rede:** na primeira versão, mostra uma mensagem e não perde o texto já transcrito.
- **Chave da Anthropic:** só na Vercel (`ANTHROPIC_API_KEY`, ambiente de produção), nunca no repositório nem no telemóvel.

## Plano

1. **Teste antes de programar (1 dia):** o Miguel grava 30 notas reais, como as diria no carro. Passam pelas duas transcrições e
   pelo Claude, e contamos quantas ações saem certas.
2. **Protótipo (2 a 3 dias):** botão, transcrição na web, interpretação, cartões para tarefas e compradores.
3. **Resto (cerca de 1 semana):** visitas, chamadas, notas, ligação a fichas existentes, e o reconhecimento do telemóvel na app nativa.
4. **Medir:** guardar quantas ações são aceites, editadas ou recusadas, para afinar as instruções do Claude.
