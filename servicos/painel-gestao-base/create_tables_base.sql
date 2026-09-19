-- =============================================================
-- Painel de Gestão - esquema de exemplo
-- Colar no SQL Editor do Supabase e executar (Run)
-- Substituir pelas tabelas reais do cliente antes de usar em produção.
-- =============================================================

CREATE TABLE IF NOT EXISTS clientes (
  id            BIGSERIAL PRIMARY KEY,
  nome          TEXT NOT NULL,
  estado        TEXT DEFAULT 'Ativo',
  data_entrada  DATE
);

CREATE TABLE IF NOT EXISTS atividade_mensal (
  id             BIGSERIAL PRIMARY KEY,
  data           TEXT NOT NULL,  -- formato "mês ano", ex. "agosto 26"
  valor_real     NUMERIC DEFAULT 0,
  valor_objetivo NUMERIC DEFAULT 0
);

-- Permitir leitura/escrita via service role key (usada só em API routes do lado do servidor).
-- Se a app também ler directamente do browser com a anon key, criar policies de RLS
-- em vez de desligar a segurança ao nível da tabela.
ALTER TABLE clientes         DISABLE ROW LEVEL SECURITY;
ALTER TABLE atividade_mensal DISABLE ROW LEVEL SECURITY;
