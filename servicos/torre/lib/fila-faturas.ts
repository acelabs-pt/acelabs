// Faturas largadas em qualquer ecrã esperam aqui até a caixa de faturas as apanhar (ver LargarFaturas e CaixaFaturas).
// Só no browser. O módulo é partilhado por toda a app enquanto a página não é recarregada.

const fila: File[] = [];

export function juntarFaturas(ficheiros: File[]) {
  fila.push(...ficheiros);
}

export function esvaziarFaturas(): File[] {
  return fila.splice(0);
}
