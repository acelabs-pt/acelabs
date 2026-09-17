export function mensagemPerguntas(
  campos_em_falta: { campo: string; pergunta: string }[],
  primeiraVez: boolean
): string {
  if (campos_em_falta.length === 0) {
    return "Já tenho toda a informação de que preciso. O processo está pronto para a aprovação da gestora.";
  }

  const intro = primeiraVez
    ? "Já analisei o que enviaste. Para completar o CPCV preciso que me digas o seguinte (podes responder tudo de uma vez, numa única mensagem):"
    : "Obrigado. Ainda preciso do seguinte (responde tudo numa única mensagem, se conseguires):";

  const lista = campos_em_falta.map((c, i) => `${i + 1}. ${c.pergunta}`).join("\n");

  return `${intro}\n\n${lista}`;
}
