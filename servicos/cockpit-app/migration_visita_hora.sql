-- Hora da visita agendada ao comprador (HH:MM).
alter table comprador_imoveis add column if not exists visita_hora text;
