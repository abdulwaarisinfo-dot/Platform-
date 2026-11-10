-- Migration 0005: Add columns required by application layer
-- Reconciles schema gaps between initial design and app code

-- batch_jobs: add name column
ALTER TABLE public.batch_jobs ADD COLUMN IF NOT EXISTS name TEXT;

-- plans: add per-billing-cycle Paddle price IDs
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS paddle_price_id_monthly TEXT;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS paddle_price_id_annual TEXT;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS paddle_product_id_monthly TEXT;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS paddle_product_id_annual TEXT;

-- prospects: add job_title as alias column and pipeline_stage
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS job_title TEXT
  GENERATED ALWAYS AS (professional_title) STORED;
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS pipeline_stage TEXT
  NOT NULL DEFAULT 'new'
  CHECK (pipeline_stage IN ('new', 'contacted', 'replied', 'meeting_set', 'closed_won', 'closed_lost'));

-- followups: add status column derived from completed_at
ALTER TABLE public.followups ADD COLUMN IF NOT EXISTS status TEXT
  NOT NULL DEFAULT 'pending'
  CHECK (status IN ('pending', 'completed', 'dismissed'));

ALTER TABLE public.followups ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ
  GENERATED ALWAYS AS (due_at) STORED;

-- Drop and recreate the followups index to allow status filtering
DROP INDEX IF EXISTS idx_followups_user;
CREATE INDEX idx_followups_user ON public.followups(user_id, due_at)
  WHERE status = 'pending';
CREATE INDEX idx_followups_status ON public.followups(user_id, status);

-- batch_urls: add url alias and processed_at alias
ALTER TABLE public.batch_urls ADD COLUMN IF NOT EXISTS url TEXT
  GENERATED ALWAYS AS (linkedin_url) STORED;
ALTER TABLE public.batch_urls ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ
  GENERATED ALWAYS AS (processing_completed_at) STORED;

-- usage_records: add columns with app-friendly names
ALTER TABLE public.usage_records ADD COLUMN IF NOT EXISTS prospect_research_used INTEGER
  NOT NULL DEFAULT 0;
ALTER TABLE public.usage_records ADD COLUMN IF NOT EXISTS messages_generated_used INTEGER
  NOT NULL DEFAULT 0;
ALTER TABLE public.usage_records ADD COLUMN IF NOT EXISTS prospect_research_limit INTEGER
  NOT NULL DEFAULT 30;
ALTER TABLE public.usage_records ADD COLUMN IF NOT EXISTS messages_generated_limit INTEGER
  NOT NULL DEFAULT 90;
ALTER TABLE public.usage_records ADD COLUMN IF NOT EXISTS period_start TIMESTAMPTZ
  NOT NULL DEFAULT NOW();

-- increment_batch_counter function for Inngest processUrl
CREATE OR REPLACE FUNCTION public.increment_batch_counter(
  p_job_id UUID,
  p_field TEXT
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF p_field = 'completed_urls' THEN
    UPDATE public.batch_jobs SET completed_count = completed_count + 1 WHERE id = p_job_id;
  ELSIF p_field = 'failed_urls' THEN
    UPDATE public.batch_jobs SET failed_count = failed_count + 1 WHERE id = p_job_id;
  ELSIF p_field = 'skipped_urls' THEN
    UPDATE public.batch_jobs SET skipped_count = skipped_count + 1 WHERE id = p_job_id;
  END IF;
END;
$$;
