// O admin herda tudo o que a gestora já tem sobre os processos (ver, aprovar, gerar, pedir
// alterações, fechar) - esta função é o único critério que muda em todos esses sítios, para
// não haver dois caminhos de código a divergir com o tempo.
export function temGestaoTotal(role: string | null | undefined): boolean {
  return role === "gestora" || role === "admin";
}
