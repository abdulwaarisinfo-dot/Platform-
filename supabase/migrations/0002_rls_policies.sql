-- ============================================================
-- Migration 0002: Row-Level Security policies
-- ============================================================

-- ─── Enable RLS on all user-data tables ──────────────────────────────────────

ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_brains   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brain_facts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_records     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospects         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_records  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_messages   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.followups         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_jobs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_urls        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_cost_records   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events    ENABLE ROW LEVEL SECURITY;

-- plans is reference data — no RLS, public read
-- webhook_events is server-only — no user access

-- ─── profiles ────────────────────────────────────────────────────────────────

CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Insert handled by handle_new_user trigger (service role)

-- ─── business_brains ─────────────────────────────────────────────────────────

CREATE POLICY "brains_select_own"
  ON public.business_brains FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "brains_insert_own"
  ON public.business_brains FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "brains_update_own"
  ON public.business_brains FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "brains_delete_own"
  ON public.business_brains FOR DELETE
  USING (user_id = auth.uid());

-- ─── brain_facts ─────────────────────────────────────────────────────────────

CREATE POLICY "facts_select_own"
  ON public.brain_facts FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "facts_insert_own"
  ON public.brain_facts FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "facts_update_own"
  ON public.brain_facts FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "facts_delete_own"
  ON public.brain_facts FOR DELETE
  USING (user_id = auth.uid());

-- ─── subscriptions ────────────────────────────────────────────────────────────

CREATE POLICY "subscriptions_select_own"
  ON public.subscriptions FOR SELECT
  USING (user_id = auth.uid());

-- Mutations handled only by service role (Paddle webhooks, server-side billing)

-- ─── usage_records ────────────────────────────────────────────────────────────

CREATE POLICY "usage_select_own"
  ON public.usage_records FOR SELECT
  USING (user_id = auth.uid());

-- Mutations handled only by service role (quota enforcement)

-- ─── prospects ────────────────────────────────────────────────────────────────

CREATE POLICY "prospects_select_own"
  ON public.prospects FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "prospects_insert_own"
  ON public.prospects FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "prospects_update_own"
  ON public.prospects FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "prospects_delete_own"
  ON public.prospects FOR DELETE
  USING (user_id = auth.uid());

-- ─── research_records ─────────────────────────────────────────────────────────

CREATE POLICY "research_select_own"
  ON public.research_records FOR SELECT
  USING (user_id = auth.uid());

-- Inserts handled by service role (research pipeline)

-- ─── opportunity_analyses ─────────────────────────────────────────────────────

CREATE POLICY "opportunity_select_own"
  ON public.opportunity_analyses FOR SELECT
  USING (user_id = auth.uid());

-- Inserts handled by service role

-- ─── generated_messages ───────────────────────────────────────────────────────

CREATE POLICY "messages_select_own"
  ON public.generated_messages FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "messages_update_own"
  ON public.generated_messages FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Inserts handled by service role; deletes not permitted (audit trail)

-- ─── followups ────────────────────────────────────────────────────────────────

CREATE POLICY "followups_select_own"
  ON public.followups FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "followups_insert_own"
  ON public.followups FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "followups_update_own"
  ON public.followups FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "followups_delete_own"
  ON public.followups FOR DELETE
  USING (user_id = auth.uid());

-- ─── batch_jobs ───────────────────────────────────────────────────────────────

CREATE POLICY "batch_jobs_select_own"
  ON public.batch_jobs FOR SELECT
  USING (user_id = auth.uid());

-- Inserts/updates by service role (Inngest handlers)

-- ─── batch_urls ───────────────────────────────────────────────────────────────

CREATE POLICY "batch_urls_select_own"
  ON public.batch_urls FOR SELECT
  USING (user_id = auth.uid());

-- Inserts/updates by service role

-- ─── ai_cost_records ──────────────────────────────────────────────────────────

CREATE POLICY "cost_records_select_own"
  ON public.ai_cost_records FOR SELECT
  USING (user_id = auth.uid());

-- Inserts by service role only

-- ─── webhook_events ───────────────────────────────────────────────────────────
-- No user access — server-side only via service role
