-- =====================================================
-- Sunset Tabas — login de admin/motoboy 100% dentro do
-- schema `sunset`, SEM usar o Supabase Auth (auth.users).
--
-- POR QUÊ NÃO USAR auth.users: ele é compartilhado por TODO o
-- projeto Supabase (o mesmo projeto usado pelo VRTech). Além de
-- um login não ter como "pertencer" a um app só, as policies do
-- VRTech usam `TO authenticated USING (true)` em várias tabelas
-- — ou seja, qualquer login feito ali (inclusive um admin do
-- Sunset) passaria a enxergar dados do VRTech também. Pra não
-- criar esse vazamento entre os dois projetos, o Sunset usa sua
-- própria tabela de sessões dentro do schema `sunset`, nunca
-- toca no papel "authenticated" do Postgres, e continua 100%
-- isolado — igual products/orders/etc já são.
--
-- Execute no SQL Editor do Supabase, DEPOIS de já ter rodado
-- sunset_public_rls_and_rpc.sql.
-- =====================================================

-- Necessário pra crypt()/gen_salt() (hash de senha) e
-- gen_random_bytes() (token de sessão). Extensão de projeto
-- inteiro, não é específica de nenhum schema — comum em
-- qualquer projeto Supabase, não afeta dados do VRTech.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─────────────────────────────────────────────────────
-- 1. Tabela de sessões (token opaco, sem JWT)
-- ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sunset.sessions (
  token text PRIMARY KEY,
  role text NOT NULL CHECK (role IN ('admin', 'motoboy')),
  subject_id text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sunset.sessions ENABLE ROW LEVEL SECURITY;
-- Sem nenhuma policy pra anon/authenticated de propósito: essa
-- tabela só é lida/escrita pelas funções SECURITY DEFINER abaixo,
-- nunca diretamente pela API REST.

-- Re-hash das credenciais de teste seedadas pelo backend Rust em
-- argon2 (que o Postgres não verifica nativamente) pra bcrypt via
-- pgcrypto. Se você criou outras contas de admin/motoboy além das
-- duas de teste, a senha delas precisa ser resetada também.
UPDATE sunset.admins SET password_hash = crypt('admin123', gen_salt('bf'))
  WHERE email = 'admin@sonset.com';
UPDATE sunset.motoboys SET password_hash = crypt('motoboy123', gen_salt('bf'))
  WHERE email = 'motoboy@sonset.com';

-- ─────────────────────────────────────────────────────
-- 2. Login
-- ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sunset.admin_login(p_email text, p_password text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = sunset, public
AS $$
DECLARE
  v_admin sunset.admins%ROWTYPE;
  v_token text;
BEGIN
  SELECT * INTO v_admin FROM sunset.admins WHERE email = p_email;
  IF NOT FOUND OR v_admin.password_hash <> crypt(p_password, v_admin.password_hash) THEN
    RAISE EXCEPTION 'invalid credentials';
  END IF;

  v_token := encode(gen_random_bytes(32), 'hex');
  INSERT INTO sunset.sessions (token, role, subject_id) VALUES (v_token, 'admin', v_admin.id);

  RETURN jsonb_build_object('token', v_token, 'name', v_admin.name);
END;
$$;

GRANT EXECUTE ON FUNCTION sunset.admin_login(text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION sunset.motoboy_login(p_email text, p_password text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = sunset, public
AS $$
DECLARE
  v_m sunset.motoboys%ROWTYPE;
  v_token text;
BEGIN
  SELECT * INTO v_m FROM sunset.motoboys WHERE email = p_email;
  IF NOT FOUND OR v_m.active = 0 OR v_m.password_hash <> crypt(p_password, v_m.password_hash) THEN
    RAISE EXCEPTION 'invalid credentials';
  END IF;

  v_token := encode(gen_random_bytes(32), 'hex');
  INSERT INTO sunset.sessions (token, role, subject_id) VALUES (v_token, 'motoboy', v_m.id);

  RETURN jsonb_build_object('token', v_token, 'name', v_m.name);
END;
$$;

GRANT EXECUTE ON FUNCTION sunset.motoboy_login(text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION sunset.logout(p_token text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = sunset, public
AS $$
  DELETE FROM sunset.sessions WHERE token = p_token;
$$;

GRANT EXECUTE ON FUNCTION sunset.logout(text) TO anon, authenticated;

-- ─────────────────────────────────────────────────────
-- 3. Helpers internos (usados pelas próximas RPCs de CRUD do
--    admin/motoboy — não chamados direto pelo frontend)
-- ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sunset._require_admin(p_token text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = sunset, public
AS $$
DECLARE
  v_subject text;
BEGIN
  SELECT subject_id INTO v_subject FROM sunset.sessions
    WHERE token = p_token AND role = 'admin' AND expires_at > now();
  IF v_subject IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  RETURN v_subject;
END;
$$;

CREATE OR REPLACE FUNCTION sunset._require_motoboy(p_token text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = sunset, public
AS $$
DECLARE
  v_subject text;
BEGIN
  SELECT subject_id INTO v_subject FROM sunset.sessions
    WHERE token = p_token AND role = 'motoboy' AND expires_at > now();
  IF v_subject IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  RETURN v_subject;
END;
$$;
