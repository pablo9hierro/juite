-- =====================================================
-- Horário de funcionamento da loja + fechamento manual (com justificativa
-- obrigatória quando o admin fecha durante um horário que deveria estar
-- aberto). A landing page usa isso pra decidir se mostra o site "aberto"
-- (normal) ou "fechado" (grayscale + mensagem de justificativa).
-- =====================================================

CREATE TABLE IF NOT EXISTS sunset.store_hours (
  day_of_week smallint PRIMARY KEY CHECK (day_of_week BETWEEN 0 AND 6), -- 0=domingo .. 6=sábado
  is_open boolean NOT NULL DEFAULT true,
  opens_at text, -- 'HH:MM', hora local (America/Recife)
  closes_at text
);

INSERT INTO sunset.store_hours (day_of_week, is_open, opens_at, closes_at)
  SELECT d, true, '09:00', '18:00' FROM generate_series(0, 6) AS d
  ON CONFLICT (day_of_week) DO NOTHING;

CREATE TABLE IF NOT EXISTS sunset.store_status (
  id int PRIMARY KEY DEFAULT 1,
  manually_closed boolean NOT NULL DEFAULT false,
  manual_closed_reason text,
  CHECK (id = 1)
);

INSERT INTO sunset.store_status (id, manually_closed) VALUES (1, false) ON CONFLICT (id) DO NOTHING;

ALTER TABLE sunset.store_hours ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON sunset.store_hours TO anon, authenticated;
DROP POLICY IF EXISTS "sunset_anon_select_store_hours" ON sunset.store_hours;
CREATE POLICY "sunset_anon_select_store_hours" ON sunset.store_hours
  FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE sunset.store_status ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON sunset.store_status TO anon, authenticated;
DROP POLICY IF EXISTS "sunset_anon_select_store_status" ON sunset.store_status;
CREATE POLICY "sunset_anon_select_store_status" ON sunset.store_status
  FOR SELECT TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION sunset.admin_set_store_hours(p_token text, p_hours jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = sunset, public, extensions AS $$
DECLARE
  v_h jsonb;
BEGIN
  PERFORM sunset._require_admin(p_token);
  FOR v_h IN SELECT * FROM jsonb_array_elements(p_hours) LOOP
    UPDATE sunset.store_hours SET
      is_open = COALESCE((v_h->>'is_open')::boolean, false),
      opens_at = NULLIF(trim(v_h->>'opens_at'), ''),
      closes_at = NULLIF(trim(v_h->>'closes_at'), '')
    WHERE day_of_week = (v_h->>'day_of_week')::smallint;
  END LOOP;
  RETURN jsonb_build_object('ok', true);
END;
$$;
GRANT EXECUTE ON FUNCTION sunset.admin_set_store_hours(text, jsonb) TO anon, authenticated;

-- Fechamento manual: se o admin está fechando a loja justamente num
-- horário em que ela deveria estar aberta (segundo o horário semanal),
-- exige justificativa — senão pode fechar/abrir livremente (ex: fechar
-- num horário que já estaria fechado mesmo, não precisa justificar nada).
CREATE OR REPLACE FUNCTION sunset.admin_set_store_manual_status(p_token text, p_manually_closed boolean, p_reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = sunset, public, extensions AS $$
DECLARE
  v_now            timestamp := now() at time zone 'America/Recife';
  v_dow            smallint := extract(dow from v_now)::smallint;
  v_hour_row       sunset.store_hours%ROWTYPE;
  v_now_time       time := v_now::time;
  v_should_be_open boolean := false;
BEGIN
  PERFORM sunset._require_admin(p_token);
  IF p_manually_closed THEN
    SELECT * INTO v_hour_row FROM sunset.store_hours WHERE day_of_week = v_dow;
    IF FOUND AND v_hour_row.is_open AND v_hour_row.opens_at IS NOT NULL AND v_hour_row.closes_at IS NOT NULL THEN
      v_should_be_open := v_now_time >= v_hour_row.opens_at::time AND v_now_time < v_hour_row.closes_at::time;
    END IF;
    IF v_should_be_open AND trim(COALESCE(p_reason, '')) = '' THEN
      RAISE EXCEPTION 'a justification is required to close the store during scheduled open hours';
    END IF;
  END IF;

  UPDATE sunset.store_status SET
    manually_closed = p_manually_closed,
    manual_closed_reason = CASE WHEN p_manually_closed THEN NULLIF(trim(p_reason), '') ELSE NULL END
  WHERE id = 1;

  RETURN jsonb_build_object('ok', true);
END;
$$;
GRANT EXECUTE ON FUNCTION sunset.admin_set_store_manual_status(text, boolean, text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
