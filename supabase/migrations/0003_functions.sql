-- ============================================================
-- Migration 0003: Database functions and triggers
-- ============================================================

-- ─── Updated-at trigger ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_business_brains_updated_at
  BEFORE UPDATE ON public.business_brains
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_brain_facts_updated_at
  BEFORE UPDATE ON public.brain_facts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_usage_records_updated_at
  BEFORE UPDATE ON public.usage_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_prospects_updated_at
  BEFORE UPDATE ON public.prospects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_followups_updated_at
  BEFORE UPDATE ON public.followups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Auto-create profile on signup ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── Quota enforcement: atomic increment with limit check ─────────────────────
--
-- Returns 'ok' | 'quota_exceeded' | 'no_subscription'
-- Uses FOR UPDATE to prevent concurrent over-spend.
--
-- Usage:
--   SELECT increment_usage_if_allowed(user_id, 1, 0);  -- 1 prospect
--   SELECT increment_usage_if_allowed(user_id, 0, 1);  -- 1 message

CREATE OR REPLACE FUNCTION public.increment_usage_if_allowed(
  p_user_id       UUID,
  p_prospects     INTEGER DEFAULT 0,
  p_messages      INTEGER DEFAULT 0
)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_subscription_id  UUID;
  v_plan_id          TEXT;
  v_period_start     TIMESTAMPTZ;
  v_prospects_limit  INTEGER;
  v_messages_limit   INTEGER;
  v_usage_id         UUID;
  v_prospects_used   INTEGER;
  v_messages_used    INTEGER;
BEGIN
  -- Lock active subscription row
  SELECT id, plan_id, current_period_start
  INTO v_subscription_id, v_plan_id, v_period_start
  FROM public.subscriptions
  WHERE user_id = p_user_id
    AND status IN ('active', 'trialing')
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'no_subscription';
  END IF;

  -- Get plan limits
  SELECT prospects_per_month, messages_per_month
  INTO v_prospects_limit, v_messages_limit
  FROM public.plans
  WHERE id = v_plan_id;

  -- Upsert usage record for this period
  INSERT INTO public.usage_records (
    user_id, subscription_id, period_start, period_end,
    prospects_used, messages_used
  )
  VALUES (
    p_user_id,
    v_subscription_id,
    v_period_start,
    v_period_start + INTERVAL '1 month',
    0, 0
  )
  ON CONFLICT (user_id, period_start) DO NOTHING;

  -- Lock and read usage row
  SELECT id, prospects_used, messages_used
  INTO v_usage_id, v_prospects_used, v_messages_used
  FROM public.usage_records
  WHERE user_id = p_user_id
    AND period_start = v_period_start
  FOR UPDATE;

  -- Check limits
  IF p_prospects > 0 AND (v_prospects_used + p_prospects) > v_prospects_limit THEN
    RETURN 'quota_exceeded';
  END IF;
  IF p_messages > 0 AND (v_messages_used + p_messages) > v_messages_limit THEN
    RETURN 'quota_exceeded';
  END IF;

  -- Increment
  UPDATE public.usage_records
  SET
    prospects_used = prospects_used + p_prospects,
    messages_used  = messages_used + p_messages,
    updated_at     = NOW()
  WHERE id = v_usage_id;

  RETURN 'ok';
END;
$$;

-- ─── Quota release (on batch cancellation / research failure) ─────────────────

CREATE OR REPLACE FUNCTION public.release_usage(
  p_user_id    UUID,
  p_prospects  INTEGER DEFAULT 0,
  p_messages   INTEGER DEFAULT 0
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_period_start TIMESTAMPTZ;
BEGIN
  SELECT current_period_start
  INTO v_period_start
  FROM public.subscriptions
  WHERE user_id = p_user_id
    AND status IN ('active', 'trialing')
  LIMIT 1;

  IF NOT FOUND THEN RETURN; END IF;

  UPDATE public.usage_records
  SET
    prospects_used = GREATEST(0, prospects_used - p_prospects),
    messages_used  = GREATEST(0, messages_used  - p_messages),
    updated_at     = NOW()
  WHERE user_id = p_user_id
    AND period_start = v_period_start;
END;
$$;

-- ─── Current usage snapshot for a user ───────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_current_usage(p_user_id UUID)
RETURNS TABLE (
  plan_id              TEXT,
  subscription_status  TEXT,
  prospects_used       INTEGER,
  prospects_limit      INTEGER,
  messages_used        INTEGER,
  messages_limit       INTEGER,
  period_start         TIMESTAMPTZ,
  period_end           TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.plan_id,
    s.status,
    COALESCE(u.prospects_used, 0),
    p.prospects_per_month,
    COALESCE(u.messages_used, 0),
    p.messages_per_month,
    s.current_period_start,
    s.current_period_end
  FROM public.subscriptions s
  JOIN public.plans p ON p.id = s.plan_id
  LEFT JOIN public.usage_records u
    ON u.user_id = p_user_id
    AND u.period_start = s.current_period_start
  WHERE s.user_id = p_user_id
    AND s.status IN ('active', 'trialing')
  LIMIT 1;
END;
$$;

-- ─── Business brain completeness score ───────────────────────────────────────
-- Recalculated after any fact insert/update/delete

CREATE OR REPLACE FUNCTION public.update_brain_completeness()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_brain_id    UUID;
  v_score       INTEGER;
  v_categories  TEXT[] := ARRAY[
    'service', 'icp_industry', 'icp_title', 'icp_size',
    'pain_point', 'differentiator', 'tone'
  ];
  v_filled      INTEGER := 0;
BEGIN
  v_brain_id := COALESCE(NEW.brain_id, OLD.brain_id);

  SELECT COUNT(DISTINCT category)
  INTO v_filled
  FROM public.brain_facts
  WHERE brain_id = v_brain_id
    AND is_active = true
    AND category = ANY(v_categories);

  v_score := LEAST(100, (v_filled * 100) / array_length(v_categories, 1));

  UPDATE public.business_brains
  SET completeness_score = v_score, updated_at = NOW()
  WHERE id = v_brain_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_brain_facts_completeness
  AFTER INSERT OR UPDATE OR DELETE ON public.brain_facts
  FOR EACH ROW EXECUTE FUNCTION public.update_brain_completeness();
