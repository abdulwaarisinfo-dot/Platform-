-- ============================================================
-- Migration 0001: Initial schema
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── profiles ────────────────────────────────────────────────────────────────

CREATE TABLE public.profiles (
  id                       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name                TEXT,
  avatar_url               TEXT,
  onboarding_completed_at  TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── business_brains ─────────────────────────────────────────────────────────

CREATE TABLE public.business_brains (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name              TEXT,
  description       TEXT,
  website_url       TEXT,
  completeness_score INTEGER NOT NULL DEFAULT 0,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_business_brains_user ON public.business_brains(user_id) WHERE is_active = true;

-- ─── brain_facts ─────────────────────────────────────────────────────────────

CREATE TABLE public.brain_facts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brain_id    UUID NOT NULL REFERENCES public.business_brains(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category    TEXT NOT NULL,  -- service, icp, differentiator, pain_point, tone, etc.
  key         TEXT NOT NULL,
  value       TEXT NOT NULL,
  confidence  TEXT NOT NULL DEFAULT 'inferred' CHECK (confidence IN ('confirmed', 'inferred')),
  source      TEXT,           -- user_input, document_upload, website, ai_generated
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_brain_facts_brain ON public.brain_facts(brain_id) WHERE is_active = true;
CREATE INDEX idx_brain_facts_user ON public.brain_facts(user_id) WHERE is_active = true;

-- ─── plans (reference data, no user-id) ──────────────────────────────────────

CREATE TABLE public.plans (
  id                    TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  price_monthly_usd     DECIMAL(10,2) NOT NULL,
  price_annual_usd      DECIMAL(10,2),
  prospects_per_month   INTEGER NOT NULL,
  messages_per_month    INTEGER NOT NULL,
  bulk_upload_enabled   BOOLEAN NOT NULL DEFAULT false,
  max_batch_size        INTEGER NOT NULL DEFAULT 0,
  paddle_product_id     TEXT,
  is_active             BOOLEAN NOT NULL DEFAULT true
);

INSERT INTO public.plans (id, name, price_monthly_usd, price_annual_usd, prospects_per_month, messages_per_month, bulk_upload_enabled, max_batch_size) VALUES
  ('starter',  'Starter',  9.00,  86.40, 30,  90,  false, 0),
  ('pro',      'Pro',      19.00, 182.40, 100, 300, true,  50),
  ('business', 'Business', 49.00, 470.40, 300, 900, true,  100);

-- ─── subscriptions ────────────────────────────────────────────────────────────

CREATE TABLE public.subscriptions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id                 TEXT NOT NULL REFERENCES public.plans(id),
  status                  TEXT NOT NULL DEFAULT 'trialing'
                            CHECK (status IN ('active', 'past_due', 'canceled', 'trialing', 'paused')),
  paddle_subscription_id  TEXT UNIQUE,
  paddle_customer_id      TEXT,
  current_period_start    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 month'),
  cancel_at_period_end    BOOLEAN NOT NULL DEFAULT false,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_subscriptions_user_active ON public.subscriptions(user_id)
  WHERE status IN ('active', 'trialing');
CREATE INDEX idx_subscriptions_paddle ON public.subscriptions(paddle_subscription_id)
  WHERE paddle_subscription_id IS NOT NULL;

-- ─── usage_records ────────────────────────────────────────────────────────────

CREATE TABLE public.usage_records (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subscription_id  UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  period_start     TIMESTAMPTZ NOT NULL,
  period_end       TIMESTAMPTZ NOT NULL,
  prospects_used   INTEGER NOT NULL DEFAULT 0,
  messages_used    INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_usage_records_user ON public.usage_records(user_id, period_start DESC);
CREATE UNIQUE INDEX idx_usage_records_period ON public.usage_records(user_id, period_start);

-- ─── prospects ────────────────────────────────────────────────────────────────

CREATE TABLE public.prospects (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  full_name           TEXT NOT NULL,
  company_name        TEXT,
  professional_title  TEXT,
  linkedin_url        TEXT,
  company_website     TEXT,
  user_provided_bio   TEXT,
  status              TEXT NOT NULL DEFAULT 'new'
                        CHECK (status IN ('new', 'researched', 'ready', 'sent', 'replied', 'not_interested', 'converted')),
  connection_status   TEXT CHECK (connection_status IN ('connected', 'not_connected')),
  last_activity_at    TIMESTAMPTZ,
  next_followup_at    TIMESTAMPTZ,
  archived_at         TIMESTAMPTZ,
  notes               TEXT,
  tags                JSONB NOT NULL DEFAULT '[]',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_prospects_user ON public.prospects(user_id, created_at DESC)
  WHERE archived_at IS NULL;
CREATE INDEX idx_prospects_linkedin ON public.prospects(user_id, linkedin_url)
  WHERE linkedin_url IS NOT NULL;
CREATE INDEX idx_prospects_followup ON public.prospects(user_id, next_followup_at)
  WHERE next_followup_at IS NOT NULL AND archived_at IS NULL;
CREATE INDEX idx_prospects_status ON public.prospects(user_id, status)
  WHERE archived_at IS NULL;

-- ─── research_records ─────────────────────────────────────────────────────────

CREATE TABLE public.research_records (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id           UUID NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  user_id               UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  input_mode            TEXT NOT NULL CHECK (input_mode IN ('linkedin_url', 'manual', 'bulk')),
  linkedin_url          TEXT,
  enrichment_provider   TEXT,
  enrichment_matched    BOOLEAN,
  enrichment_confidence TEXT CHECK (enrichment_confidence IN ('enriched', 'web_only', 'limited')),
  enrichment_data       JSONB,
  professional_summary  TEXT,
  company_summary       TEXT,
  recent_developments   JSONB,
  potential_signals     JSONB,
  confidence            TEXT CHECK (confidence IN ('high', 'medium', 'low')),
  gaps                  JSONB,
  sources               JSONB,
  raw_ai_response       JSONB,
  cost_usd              DECIMAL(10,6),
  tokens_used           INTEGER,
  cached                BOOLEAN NOT NULL DEFAULT false,
  expires_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_research_records_prospect ON public.research_records(prospect_id, created_at DESC);
CREATE INDEX idx_research_records_linkedin ON public.research_records(linkedin_url)
  WHERE linkedin_url IS NOT NULL;
CREATE INDEX idx_research_records_expires ON public.research_records(expires_at)
  WHERE expires_at IS NOT NULL;
CREATE INDEX idx_research_records_user ON public.research_records(user_id, created_at DESC);

-- ─── opportunity_analyses ─────────────────────────────────────────────────────

CREATE TABLE public.opportunity_analyses (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id         UUID NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  research_id         UUID NOT NULL REFERENCES public.research_records(id) ON DELETE CASCADE,
  overall_score       INTEGER NOT NULL CHECK (overall_score BETWEEN 0 AND 100),
  relevance_score     INTEGER NOT NULL CHECK (relevance_score BETWEEN 0 AND 100),
  signal_score        INTEGER NOT NULL CHECK (signal_score BETWEEN 0 AND 100),
  fit_score           INTEGER NOT NULL CHECK (fit_score BETWEEN 0 AND 100),
  timing_score        INTEGER NOT NULL CHECK (timing_score BETWEEN 0 AND 100),
  primary_opportunity TEXT NOT NULL,
  supporting_evidence JSONB NOT NULL DEFAULT '[]',
  weak_points         JSONB NOT NULL DEFAULT '[]',
  recommended_angle   TEXT NOT NULL,
  score_explanation   TEXT NOT NULL,
  cost_usd            DECIMAL(10,6) NOT NULL DEFAULT 0,
  tokens_used         INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_opportunity_analyses_prospect ON public.opportunity_analyses(prospect_id, created_at DESC);

-- ─── generated_messages ───────────────────────────────────────────────────────

CREATE TABLE public.generated_messages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id       UUID NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  opportunity_id    UUID NOT NULL REFERENCES public.opportunity_analyses(id) ON DELETE CASCADE,
  message_type      TEXT NOT NULL CHECK (message_type IN (
                      'linkedin_connection_request', 'linkedin_direct_message',
                      'cold_email', 'short_intro',
                      'followup_no_response', 'followup_after_reply'
                    )),
  subject           TEXT,
  body              TEXT NOT NULL,
  version           INTEGER NOT NULL DEFAULT 1,
  parent_id         UUID REFERENCES public.generated_messages(id),
  modification_type TEXT,
  character_count   INTEGER NOT NULL,
  is_saved          BOOLEAN NOT NULL DEFAULT false,
  copied_at         TIMESTAMPTZ,
  sent_at           TIMESTAMPTZ,
  cost_usd          DECIMAL(10,6) NOT NULL DEFAULT 0,
  tokens_used       INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_generated_messages_prospect ON public.generated_messages(prospect_id, created_at DESC);
CREATE INDEX idx_generated_messages_saved ON public.generated_messages(user_id)
  WHERE is_saved = true;

-- ─── followups ────────────────────────────────────────────────────────────────

CREATE TABLE public.followups (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id  UUID NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  due_at       TIMESTAMPTZ NOT NULL,
  note         TEXT,
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_followups_user ON public.followups(user_id, due_at)
  WHERE completed_at IS NULL;

-- ─── batch_jobs ───────────────────────────────────────────────────────────────

CREATE TABLE public.batch_jobs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  total_urls       INTEGER NOT NULL,
  queued_count     INTEGER NOT NULL DEFAULT 0,
  completed_count  INTEGER NOT NULL DEFAULT 0,
  failed_count     INTEGER NOT NULL DEFAULT 0,
  skipped_count    INTEGER NOT NULL DEFAULT 0,
  cancelled_count  INTEGER NOT NULL DEFAULT 0,
  usage_reserved   INTEGER NOT NULL DEFAULT 0,
  usage_consumed   INTEGER NOT NULL DEFAULT 0,
  inngest_event_id TEXT,
  started_at       TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,
  cancelled_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_batch_jobs_user ON public.batch_jobs(user_id, created_at DESC);
CREATE INDEX idx_batch_jobs_active ON public.batch_jobs(user_id, status)
  WHERE status IN ('pending', 'running');

-- ─── batch_urls ───────────────────────────────────────────────────────────────

CREATE TABLE public.batch_urls (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_job_id            UUID NOT NULL REFERENCES public.batch_jobs(id) ON DELETE CASCADE,
  user_id                 UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  linkedin_url            TEXT NOT NULL,
  normalized_url          TEXT NOT NULL,
  status                  TEXT NOT NULL DEFAULT 'queued'
                            CHECK (status IN ('queued', 'in_progress', 'completed', 'failed', 'skipped', 'cancelled')),
  skip_reason             TEXT CHECK (skip_reason IN ('duplicate', 'quota_exceeded', 'invalid_url')),
  prospect_id             UUID REFERENCES public.prospects(id),
  error_message           TEXT,
  processing_started_at   TIMESTAMPTZ,
  processing_completed_at TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_batch_urls_job ON public.batch_urls(batch_job_id, status);
CREATE INDEX idx_batch_urls_prospect ON public.batch_urls(prospect_id)
  WHERE prospect_id IS NOT NULL;

-- ─── ai_cost_records ──────────────────────────────────────────────────────────

CREATE TABLE public.ai_cost_records (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  prospect_id         UUID REFERENCES public.prospects(id) ON DELETE SET NULL,
  batch_job_id        UUID REFERENCES public.batch_jobs(id) ON DELETE SET NULL,
  operation           TEXT NOT NULL CHECK (operation IN (
                        'brain_extraction', 'research_synthesis',
                        'opportunity_analysis', 'message_generation'
                      )),
  model               TEXT NOT NULL,
  input_tokens        INTEGER NOT NULL,
  output_tokens       INTEGER NOT NULL,
  cost_usd            DECIMAL(10,6) NOT NULL,
  enrichment_provider TEXT,
  enrichment_matched  BOOLEAN,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_cost_records_user ON public.ai_cost_records(user_id, created_at DESC);
CREATE INDEX idx_ai_cost_records_prospect ON public.ai_cost_records(prospect_id)
  WHERE prospect_id IS NOT NULL;

-- ─── webhook_events ───────────────────────────────────────────────────────────

CREATE TABLE public.webhook_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider     TEXT NOT NULL CHECK (provider IN ('paddle', 'inngest')),
  event_id     TEXT NOT NULL,
  event_type   TEXT NOT NULL,
  payload      JSONB NOT NULL,
  processed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(provider, event_id)
);

CREATE INDEX idx_webhook_events_unprocessed ON public.webhook_events(provider, created_at)
  WHERE processed_at IS NULL;
