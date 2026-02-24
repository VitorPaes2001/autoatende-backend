-- Billing v1: franquia + excedente (sem bloqueio)

CREATE TABLE IF NOT EXISTS public.monthly_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID,
  year INTEGER,
  month INTEGER,
  templates_used INTEGER NOT NULL DEFAULT 0,
  conversations_used INTEGER NOT NULL DEFAULT 0,
  overage_templates INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'monthly_usage_client_period_uidx'
  ) THEN
    CREATE UNIQUE INDEX monthly_usage_client_period_uidx
      ON public.monthly_usage (client_id, year, month)
      WHERE client_id IS NOT NULL AND year IS NOT NULL AND month IS NOT NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.monthly_overage_invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  overage_templates INTEGER NOT NULL DEFAULT 0,
  unit_amount_cents INTEGER NOT NULL DEFAULT 99,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  stripe_invoice_item_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  UNIQUE(client_id, year, month)
);

CREATE OR REPLACE FUNCTION public.try_consume_usage(
  p_client_id uuid,
  p_year int,
  p_month int,
  p_templates_delta int,
  p_conversations_delta int,
  p_templates_limit int
)
RETURNS TABLE(
  allowed boolean,
  templates_used int,
  conversations_used int,
  overage_templates int,
  reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_templates_used int;
  v_conversations_used int;
  v_new_templates int;
  v_new_conversations int;
  v_overage int;
BEGIN
  IF p_client_id IS NULL THEN
    RETURN QUERY SELECT false, 0, 0, 0, 'INVALID_CLIENT_ID';
    RETURN;
  END IF;

  INSERT INTO public.monthly_usage (client_id, year, month, templates_used, conversations_used, overage_templates)
  VALUES (p_client_id, p_year, p_month, 0, 0, 0)
  ON CONFLICT (client_id, year, month) DO NOTHING;

  SELECT mu.templates_used, mu.conversations_used
    INTO v_templates_used, v_conversations_used
  FROM public.monthly_usage mu
  WHERE mu.client_id = p_client_id AND mu.year = p_year AND mu.month = p_month
  FOR UPDATE;

  UPDATE public.monthly_usage mu
    SET templates_used = mu.templates_used + COALESCE(p_templates_delta, 0),
        conversations_used = mu.conversations_used + COALESCE(p_conversations_delta, 0),
        overage_templates = GREATEST((mu.templates_used + COALESCE(p_templates_delta, 0)) - COALESCE(p_templates_limit, 0), 0),
        updated_at = now()
  WHERE mu.client_id = p_client_id AND mu.year = p_year AND mu.month = p_month
  RETURNING mu.templates_used, mu.conversations_used, mu.overage_templates
  INTO v_new_templates, v_new_conversations, v_overage;

  RETURN QUERY
  SELECT true,
         v_new_templates,
         v_new_conversations,
         v_overage,
         CASE WHEN v_overage > 0 THEN 'OVERAGE_APPLIED' ELSE 'OK' END;
END;
$$;
