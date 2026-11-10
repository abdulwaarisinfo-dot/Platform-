import type { BrainFact } from './database';
import type { InputMode, EnrichmentConfidence } from './research';

// ─── Business Brain ───────────────────────────────────────────────────────────

export interface BrainResponse {
  brain: {
    id: string;
    name: string | null;
    description: string | null;
    completeness_score: number;
    updated_at: string;
  };
  facts: BrainFact[];
}

export interface ExtractBrainRequest {
  text: string;
  source_type: 'manual_input' | 'document_upload' | 'website';
}

export interface ValidateBrainResponse {
  completeness_score: number;
  critical_gaps: string[];
  suggestions: string[];
  ready_for_research: boolean;
}

export interface UpdateFactRequest {
  value: string;
  confidence: 'confirmed' | 'inferred';
}

// ─── Prospects ────────────────────────────────────────────────────────────────

export type ProspectStatus =
  | 'new'
  | 'researched'
  | 'ready'
  | 'sent'
  | 'replied'
  | 'not_interested'
  | 'converted';

export interface ProspectResponse {
  id: string;
  full_name: string;
  company_name: string | null;
  professional_title: string | null;
  linkedin_url: string | null;
  company_website: string | null;
  status: ProspectStatus;
  connection_status: 'connected' | 'not_connected' | 'pending' | 'replied' | null;
  last_activity_at: string | null;
  next_followup_at: string | null;
  notes: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
  latest_research?: ResearchResponse;
  latest_opportunity?: OpportunityAnalysisResponse;
}

export interface CreateProspectRequest {
  full_name: string;
  company_name?: string;
  professional_title?: string;
  linkedin_url?: string;
  company_website?: string;
  user_provided_bio?: string;
}

export interface UpdateProspectRequest {
  status?: ProspectStatus;
  connection_status?: 'connected' | 'not_connected' | 'pending' | 'replied' | null;
  notes?: string;
  tags?: string[];
  next_followup_at?: string | null;
}

export interface ProspectListResponse {
  prospects: ProspectResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// ─── Research ─────────────────────────────────────────────────────────────────
// EnrichmentConfidence and InputMode are defined in research.ts

export interface ResearchSource {
  url: string;
  title: string;
  snippet: string;
  type: string;
}

export interface ResearchResponse {
  research_id: string;
  status: 'completed' | 'failed';
  input_mode: InputMode;
  enrichment_confidence: EnrichmentConfidence;
  enrichment_matched: boolean | null;
  professional_summary: string;
  company_summary: string;
  recent_developments: string[];
  potential_signals: string[];
  confidence: 'high' | 'medium' | 'low';
  gaps: string[];
  sources: ResearchSource[];
  cached: boolean;
  cost_usd: number;
}

// ─── Opportunity Analysis ─────────────────────────────────────────────────────

export interface SupportingEvidence {
  point: string;
  source: string | null;
  confidence: 'confirmed' | 'inferred';
}

export interface OpportunityAnalysisResponse {
  opportunity_id: string;
  overall_score: number;
  relevance_score: number;
  signal_score: number;
  fit_score: number;
  timing_score: number;
  primary_opportunity: string;
  supporting_evidence: SupportingEvidence[];
  weak_points: string[];
  recommended_angle: string;
  score_explanation: string;
}

// ─── Outreach / Messages ──────────────────────────────────────────────────────

export type MessageType =
  | 'linkedin_connection_request'
  | 'linkedin_direct_message'
  | 'cold_email'
  | 'short_intro'
  | 'followup_no_response'
  | 'followup_after_reply';

export type MessageModification =
  | 'shorten'
  | 'more_direct'
  | 'more_conversational'
  | 'tone_formal'
  | 'tone_casual'
  | 'fix_opening';

export interface GenerateMessageRequest {
  message_type: MessageType;
  connection_status?: 'connected' | 'not_connected' | 'pending' | 'replied' | null;
  opportunity_id: string;
  previous_message_id?: string;
  conversation_context?: string;
}

// GeneratedMessage Row type comes from database.ts
export interface GeneratedMessageResponse {
  message_id: string;
  message_type: MessageType;
  subject: string | null;
  body: string;
  version: number;
  character_count: number;
}

export interface RewriteMessageRequest {
  modification: MessageModification;
}

export interface UpdateMessageRequest {
  is_saved?: boolean;
  copied_at?: string;
  sent_at?: string;
}

// ─── Bulk Processing ──────────────────────────────────────────────────────────

export interface BulkSubmitRequest {
  linkedin_urls: string[];
  auto_research?: boolean;
}

export interface BulkSubmitResponse {
  batch_job_id: string;
  total_urls: number;
  skipped_duplicates: number;
  skipped_invalid: number;
  queued: number;
  usage_available: number;
  will_process: number;
  will_skip_quota: number;
  estimated_completion_seconds: number;
}

export type BatchJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type BatchUrlStatus = 'queued' | 'in_progress' | 'completed' | 'failed' | 'skipped' | 'cancelled';

export interface BatchUrlResult {
  id: string;
  linkedin_url: string;
  status: BatchUrlStatus;
  skip_reason: 'duplicate' | 'quota_exceeded' | 'invalid_url' | null;
  prospect_id: string | null;
  prospect_name: string | null;
  prospect_company: string | null;
  enrichment_matched: boolean | null;
  error_message: string | null;
}

export interface BatchJobResponse {
  batch_job_id: string;
  status: BatchJobStatus;
  total_urls: number;
  completed: number;
  failed: number;
  skipped: number;
  queued: number;
  cancelled: number;
  urls: BatchUrlResult[];
}

// ─── Usage ────────────────────────────────────────────────────────────────────

export interface UsageResponse {
  plan: 'starter' | 'pro' | 'business';
  prospects_used: number;
  prospects_limit: number;
  messages_used: number;
  messages_limit: number;
  period_end: string;
  days_remaining: number;
}

// ─── Billing ──────────────────────────────────────────────────────────────────

export interface BillingCheckoutRequest {
  plan_id: 'starter' | 'pro' | 'business';
  billing_period: 'monthly' | 'annual';
}

export interface BillingCheckoutResponse {
  checkout_url: string;
}

// ─── Follow-ups ───────────────────────────────────────────────────────────────

export interface FollowupResponse {
  id: string;
  prospect_id: string;
  prospect_name: string;
  prospect_company: string | null;
  due_at: string;
  note: string | null;
  completed_at: string | null;
}

export interface CreateFollowupRequest {
  prospect_id: string;
  due_at: string;
  note?: string;
}

export interface UpdateFollowupRequest {
  due_at?: string;
  note?: string;
  completed_at?: string | null;
}

// ─── Extension ────────────────────────────────────────────────────────────────

export interface ExtensionSyncResponse {
  plan: 'starter' | 'pro' | 'business';
  prospects_used: number;
  prospects_limit: number;
  messages_used: number;
  messages_limit: number;
  period_end: string;
  recent_prospects: Array<{
    id: string;
    full_name: string;
    company_name: string | null;
    status: ProspectStatus;
    opportunity_score: number | null;
  }>;
}

export interface ExtensionCheckResponse {
  has_recent_research: boolean;
  prospect_id?: string;
  prospect_name?: string;
  researched_at?: string;
  opportunity_score?: number | null;
  enrichment_confidence?: EnrichmentConfidence;
}

export interface ExtensionAuthRequest {
  email: string;
  password: string;
}

export interface ExtensionAuthResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user_id: string;
}

export interface ExtensionRefreshRequest {
  refresh_token: string;
}

// ─── Error handling ───────────────────────────────────────────────────────────

export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'USAGE_LIMIT_EXCEEDED'
  | 'VALIDATION_ERROR'
  | 'RESEARCH_INSUFFICIENT_DATA'
  | 'AI_SERVICE_UNAVAILABLE'
  | 'RESEARCH_SERVICE_UNAVAILABLE'
  | 'ENRICHMENT_SERVICE_UNAVAILABLE'
  | 'INVALID_LINKEDIN_URL'
  | 'BATCH_TOO_LARGE'
  | 'RATE_LIMIT_EXCEEDED'
  | 'INTERNAL_ERROR';

export interface ApiError {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
}
