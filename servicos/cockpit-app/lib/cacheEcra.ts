// Últimos dados de cada separador (Dashboard, CRM, Calendário, Angariações), em memória enquanto a app está aberta.
// Ao voltar a um separador aparece logo o que lá estava e os dados atualizam-se por trás, em vez de um ecrã a carregar.
// Não vai para o disco; limpa-se ao sair da conta (apagarDia), para outra pessoa no mesmo aparelho não ver nada.
const memoria = new Map<string, unknown>();

export function lerEcra<T>(chave: string): T | undefined {
  return memoria.get(chave) as T | undefined;
}

export function guardarEcra<T>(chave: string, valor: T) {
  memoria.set(chave, valor);
}

export function limparEcras() {
  memoria.clear();
}
