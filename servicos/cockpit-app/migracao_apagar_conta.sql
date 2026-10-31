-- Cockpit: "Apagar a minha conta" (a Apple exige que uma app com contas deixe apagar a conta dentro da app).
--
-- A função apaga o utilizador que a chama (auth.uid()) em auth.users. Em cascata saem o registo em `membros` e os
-- aparelhos de notificações (`push_subscricoes`). NÃO apaga os contactos, compradores, proprietários e angariações:
-- esses dados pertencem à empresa cliente (um Supabase por cliente, partilhado pelos membros) e não à pessoa.
-- Quem pede a eliminação dos dados da empresa fala com a Ace Labs; cada contacto individual pode ser apagado na ficha.
--
-- Não deixa apagar o último membro: ficava uma base de dados sem ninguém com acesso. Nesse caso o botão da app avisa
-- para falar com a Ace Labs.
-- Correr uma vez no SQL Editor do Supabase de cada cliente (depois de migracao_seguranca.sql). Pode correr-se outra vez.

create or replace function apagar_minha_conta() returns void
language plpgsql security definer set search_path = public, auth
as $$
declare quem uuid := auth.uid();
begin
  if quem is null then
    raise exception 'sem sessão' using errcode = '28000';
  end if;
  if (select count(*) from membros) <= 1 and exists (select 1 from membros where user_id = quem) then
    raise exception 'ultimo_membro' using errcode = 'P0001';
  end if;
  delete from auth.users where id = quem;
end $$;

revoke all on function apagar_minha_conta() from public, anon;
grant execute on function apagar_minha_conta() to authenticated;
