-- ============================================================
-- Migration 0004: Development seed data
-- ============================================================
-- Only runs in local dev; CI and production skip this file.
-- Supabase local: supabase db reset applies all migrations in order.

-- ─── Insert a trial subscription for newly created test users ─────────────────
-- Real user rows are created by the auth service; we can only add
-- subscriptions referencing them once they exist. This seed creates a
-- stored procedure that the dev setup script can call after auth.users
-- are created via `supabase auth sign-up`.

CREATE OR REPLACE FUNCTION public.seed_trial_subscription(
  p_user_id  UUID,
  p_plan_id  TEXT DEFAULT 'starter'
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sub_id UUID;
BEGIN
  -- Idempotent: skip if already has a trial
  SELECT id INTO v_sub_id
  FROM public.subscriptions
  WHERE user_id = p_user_id AND status = 'trialing';

  IF FOUND THEN RETURN v_sub_id; END IF;

  INSERT INTO public.subscriptions (
    user_id, plan_id, status,
    current_period_start,
    current_period_end
  ) VALUES (
    p_user_id,
    p_plan_id,
    'trialing',
    NOW(),
    NOW() + INTERVAL '14 days'
  )
  RETURNING id INTO v_sub_id;

  RETURN v_sub_id;
END;
$$;

-- ─── Helper to bootstrap a business brain for a test user ─────────────────────

CREATE OR REPLACE FUNCTION public.seed_demo_brain(p_user_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_brain_id UUID;
BEGIN
  INSERT INTO public.business_brains (user_id, name, description)
  VALUES (
    p_user_id,
    'Demo Agency',
    'A B2B SaaS consulting firm focused on revenue operations'
  )
  RETURNING id INTO v_brain_id;

  INSERT INTO public.brain_facts
    (brain_id, user_id, category, key, value, confidence, source)
  VALUES
    (v_brain_id, p_user_id, 'service',       'primary',      'Revenue operations consulting',       'confirmed', 'user_input'),
    (v_brain_id, p_user_id, 'service',       'secondary',    'CRM implementation and optimization', 'confirmed', 'user_input'),
    (v_brain_id, p_user_id, 'icp_industry',  'primary',      'B2B SaaS',                            'confirmed', 'user_input'),
    (v_brain_id, p_user_id, 'icp_title',     'buyer',        'VP of Sales, CRO, Head of RevOps',    'confirmed', 'user_input'),
    (v_brain_id, p_user_id, 'icp_size',      'sweet_spot',   '50–500 employees',                    'confirmed', 'user_input'),
    (v_brain_id, p_user_id, 'pain_point',    'primary',      'Broken handoff between marketing and sales', 'confirmed', 'user_input'),
    (v_brain_id, p_user_id, 'differentiator','primary',      'Implementation + 90-day revenue guarantee',  'confirmed', 'user_input'),
    (v_brain_id, p_user_id, 'tone',          'style',        'Direct, data-driven, no buzzwords',   'confirmed', 'user_input');

  RETURN v_brain_id;
END;
$$;

-- Note: actual auth.users rows must be created through the Supabase Auth API
-- (supabase auth create-user or the sign-up flow). Once created, run:
--   SELECT seed_trial_subscription('<user-uuid>');
--   SELECT seed_demo_brain('<user-uuid>');
