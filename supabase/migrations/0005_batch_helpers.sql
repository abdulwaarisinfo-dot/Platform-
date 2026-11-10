-- ============================================================
-- Migration 0005: Batch job counter helper
-- ============================================================

CREATE OR REPLACE FUNCTION public.increment_batch_counter(
  p_job_id UUID,
  p_field  TEXT  -- 'completed' | 'failed' | 'skipped' | 'cancelled'
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_field = 'completed' THEN
    UPDATE public.batch_jobs
    SET completed_count = completed_count + 1
    WHERE id = p_job_id;
  ELSIF p_field = 'failed' THEN
    UPDATE public.batch_jobs
    SET failed_count = failed_count + 1
    WHERE id = p_job_id;
  ELSIF p_field = 'skipped' THEN
    UPDATE public.batch_jobs
    SET skipped_count = skipped_count + 1
    WHERE id = p_job_id;
  ELSIF p_field = 'cancelled' THEN
    UPDATE public.batch_jobs
    SET cancelled_count = cancelled_count + 1
    WHERE id = p_job_id;
  END IF;
END;
$$;
