export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          avatar_url: string | null;
          onboarding_completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          avatar_url?: string | null;
          onboarding_completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          onboarding_completed_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      business_brains: {
        Row: {
          id: string;
          user_id: string;
          name: string | null;
          description: string | null;
          website_url: string | null;
          completeness_score: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name?: string | null;
          description?: string | null;
          website_url?: string | null;
          completeness_score?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string | null;
          description?: string | null;
          website_url?: string | null;
          completeness_score?: number;
          is_active?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      brain_facts: {
        Row: {
          id: string;
          brain_id: string;
          user_id: string;
          category: string;
          key: string;
          value: string;
          confidence: 'confirmed' | 'inferred';
          source: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          brain_id: string;
          user_id: string;
          category: string;
          key: string;
          value: string;
          confidence?: 'confirmed' | 'inferred';
          source?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          category?: string;
          key?: string;
          value?: string;
          confidence?: 'confirmed' | 'inferred';
          source?: string | null;
          is_active?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      plans: {
        Row: {
          id: string;
          name: string;
          price_monthly_usd: number;
          price_annual_usd: number | null;
          prospects_per_month: number;
          messages_per_month: number;
          bulk_upload_enabled: boolean;
          max_batch_size: number;
          paddle_product_id: string | null;
          paddle_price_id_monthly: string | null;
          paddle_price_id_annual: string | null;
          is_active: boolean;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          plan_id: string;
          status: 'active' | 'past_due' | 'canceled' | 'trialing' | 'paused';
          paddle_subscription_id: string | null;
          paddle_customer_id: string | null;
          current_period_start: string;
          current_period_end: string;
          cancel_at_period_end: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          plan_id: string;
          status?: 'active' | 'past_due' | 'canceled' | 'trialing' | 'paused';
          paddle_subscription_id?: string | null;
          paddle_customer_id?: string | null;
          current_period_start: string;
          current_period_end: string;
          cancel_at_period_end?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          plan_id?: string;
          status?: 'active' | 'past_due' | 'canceled' | 'trialing' | 'paused';
          paddle_subscription_id?: string | null;
          paddle_customer_id?: string | null;
          current_period_start?: string;
          current_period_end?: string;
          cancel_at_period_end?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      usage_records: {
        Row: {
          id: string;
          user_id: string;
          subscription_id: string;
          period_start: string;
          period_end: string;
          prospect_research_used: number;
          prospect_research_limit: number;
          messages_generated_used: number;
          messages_generated_limit: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          subscription_id: string;
          period_start: string;
          period_end: string;
          prospect_research_used?: number;
          prospect_research_limit?: number;
          messages_generated_used?: number;
          messages_generated_limit?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          prospect_research_used?: number;
          prospect_research_limit?: number;
          messages_generated_used?: number;
          messages_generated_limit?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      prospects: {
        Row: {
          id: string;
          user_id: string;
          full_name: string;
          company_name: string | null;
          professional_title: string | null;
          linkedin_url: string | null;
          company_website: string | null;
          user_provided_bio: string | null;
          status: 'new' | 'researched' | 'ready' | 'sent' | 'replied' | 'not_interested' | 'converted';
          connection_status: 'connected' | 'not_connected' | 'pending' | 'replied' | null;
          last_activity_at: string | null;
          next_followup_at: string | null;
          archived_at: string | null;
          notes: string | null;
          tags: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          full_name: string;
          company_name?: string | null;
          professional_title?: string | null;
          linkedin_url?: string | null;
          company_website?: string | null;
          user_provided_bio?: string | null;
          status?: 'new' | 'researched' | 'ready' | 'sent' | 'replied' | 'not_interested' | 'converted';
          connection_status?: 'connected' | 'not_connected' | 'pending' | 'replied' | null;
          last_activity_at?: string | null;
          next_followup_at?: string | null;
          archived_at?: string | null;
          notes?: string | null;
          tags?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          full_name?: string;
          company_name?: string | null;
          professional_title?: string | null;
          linkedin_url?: string | null;
          company_website?: string | null;
          user_provided_bio?: string | null;
          status?: 'new' | 'researched' | 'ready' | 'sent' | 'replied' | 'not_interested' | 'converted';
          connection_status?: 'connected' | 'not_connected' | 'pending' | 'replied' | null;
          last_activity_at?: string | null;
          next_followup_at?: string | null;
          archived_at?: string | null;
          notes?: string | null;
          tags?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      research_records: {
        Row: {
          id: string;
          prospect_id: string;
          user_id: string;
          status: 'pending' | 'running' | 'completed' | 'failed';
          input_mode: 'linkedin_url' | 'manual' | 'bulk';
          linkedin_url: string | null;
          enrichment_provider: string | null;
          enrichment_matched: boolean | null;
          enrichment_confidence: 'enriched' | 'web_only' | 'limited' | null;
          enrichment_data: Json | null;
          professional_summary: string | null;
          company_summary: string | null;
          recent_developments: Json | null;
          potential_signals: Json | null;
          confidence: 'high' | 'medium' | 'low' | null;
          gaps: Json | null;
          sources: Json | null;
          raw_ai_response: Json | null;
          cost_usd: number | null;
          tokens_used: number | null;
          cached: boolean;
          expires_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          prospect_id: string;
          user_id: string;
          status?: 'pending' | 'running' | 'completed' | 'failed';
          input_mode: 'linkedin_url' | 'manual' | 'bulk';
          linkedin_url?: string | null;
          enrichment_provider?: string | null;
          enrichment_matched?: boolean | null;
          enrichment_confidence?: 'enriched' | 'web_only' | 'limited' | null;
          enrichment_data?: Json | null;
          professional_summary?: string | null;
          company_summary?: string | null;
          recent_developments?: Json | null;
          potential_signals?: Json | null;
          confidence?: 'high' | 'medium' | 'low' | null;
          gaps?: Json | null;
          sources?: Json | null;
          raw_ai_response?: Json | null;
          cost_usd?: number | null;
          tokens_used?: number | null;
          cached?: boolean;
          expires_at?: string | null;
          created_at?: string;
        };
        Update: {
          status?: 'pending' | 'running' | 'completed' | 'failed';
          enrichment_provider?: string | null;
          enrichment_matched?: boolean | null;
          enrichment_confidence?: 'enriched' | 'web_only' | 'limited' | null;
          enrichment_data?: Json | null;
          professional_summary?: string | null;
          company_summary?: string | null;
          recent_developments?: Json | null;
          potential_signals?: Json | null;
          confidence?: 'high' | 'medium' | 'low' | null;
          gaps?: Json | null;
          sources?: Json | null;
          raw_ai_response?: Json | null;
          cost_usd?: number | null;
          tokens_used?: number | null;
          cached?: boolean;
          expires_at?: string | null;
        };
        Relationships: [];
      };
      opportunity_analyses: {
        Row: {
          id: string;
          prospect_id: string;
          user_id: string;
          research_id: string;
          overall_score: number;
          relevance_score: number;
          signal_score: number;
          fit_score: number;
          timing_score: number;
          primary_opportunity: string;
          supporting_evidence: Json;
          weak_points: Json;
          recommended_angle: string;
          score_explanation: string;
          cost_usd: number;
          tokens_used: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          prospect_id: string;
          user_id: string;
          research_id: string;
          overall_score: number;
          relevance_score: number;
          signal_score: number;
          fit_score: number;
          timing_score: number;
          primary_opportunity: string;
          supporting_evidence: Json;
          weak_points: Json;
          recommended_angle: string;
          score_explanation: string;
          cost_usd: number;
          tokens_used: number;
          created_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      generated_messages: {
        Row: {
          id: string;
          prospect_id: string;
          user_id: string;
          opportunity_id: string;
          message_type: 'linkedin_connection_request' | 'linkedin_direct_message' | 'cold_email' | 'short_intro' | 'followup_no_response' | 'followup_after_reply';
          subject: string | null;
          body: string;
          version: number;
          parent_id: string | null;
          modification_type: string | null;
          character_count: number;
          is_saved: boolean;
          copied_at: string | null;
          sent_at: string | null;
          cost_usd: number;
          tokens_used: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          prospect_id: string;
          user_id: string;
          opportunity_id: string;
          message_type: 'linkedin_connection_request' | 'linkedin_direct_message' | 'cold_email' | 'short_intro' | 'followup_no_response' | 'followup_after_reply';
          subject?: string | null;
          body: string;
          version?: number;
          parent_id?: string | null;
          modification_type?: string | null;
          character_count: number;
          is_saved?: boolean;
          copied_at?: string | null;
          sent_at?: string | null;
          cost_usd: number;
          tokens_used: number;
          created_at?: string;
        };
        Update: {
          is_saved?: boolean;
          copied_at?: string | null;
          sent_at?: string | null;
        };
        Relationships: [];
      };
      followups: {
        Row: {
          id: string;
          prospect_id: string;
          user_id: string;
          due_at: string;
          note: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          prospect_id: string;
          user_id: string;
          due_at: string;
          note?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          due_at?: string;
          note?: string | null;
          completed_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "followups_prospect_id_fkey";
            columns: ["prospect_id"];
            isOneToOne: false;
            referencedRelation: "prospects";
            referencedColumns: ["id"];
          },
        ];
      };
      batch_jobs: {
        Row: {
          id: string;
          user_id: string;
          name: string | null;
          status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
          total_urls: number;
          queued_count: number;
          completed_count: number;
          failed_count: number;
          skipped_count: number;
          cancelled_count: number;
          completed_urls: number;
          usage_reserved: number;
          usage_consumed: number;
          inngest_event_id: string | null;
          started_at: string | null;
          completed_at: string | null;
          cancelled_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name?: string | null;
          status?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
          total_urls: number;
          queued_count?: number;
          completed_count?: number;
          failed_count?: number;
          skipped_count?: number;
          cancelled_count?: number;
          completed_urls?: number;
          usage_reserved?: number;
          usage_consumed?: number;
          inngest_event_id?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          cancelled_at?: string | null;
          created_at?: string;
        };
        Update: {
          name?: string | null;
          status?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
          queued_count?: number;
          completed_count?: number;
          failed_count?: number;
          skipped_count?: number;
          cancelled_count?: number;
          completed_urls?: number;
          usage_reserved?: number;
          usage_consumed?: number;
          inngest_event_id?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          cancelled_at?: string | null;
        };
        Relationships: [];
      };
      batch_urls: {
        Row: {
          id: string;
          batch_job_id: string;
          user_id: string;
          url: string;
          linkedin_url: string;
          normalized_url: string;
          status: 'queued' | 'in_progress' | 'completed' | 'failed' | 'skipped' | 'cancelled';
          skip_reason: 'duplicate' | 'quota_exceeded' | 'invalid_url' | null;
          prospect_id: string | null;
          error_message: string | null;
          processing_started_at: string | null;
          processing_completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          batch_job_id: string;
          user_id: string;
          url?: string;
          linkedin_url: string;
          normalized_url: string;
          status?: 'queued' | 'in_progress' | 'completed' | 'failed' | 'skipped' | 'cancelled';
          skip_reason?: 'duplicate' | 'quota_exceeded' | 'invalid_url' | null;
          prospect_id?: string | null;
          error_message?: string | null;
          processing_started_at?: string | null;
          processing_completed_at?: string | null;
          created_at?: string;
        };
        Update: {
          status?: 'queued' | 'in_progress' | 'completed' | 'failed' | 'skipped' | 'cancelled';
          skip_reason?: 'duplicate' | 'quota_exceeded' | 'invalid_url' | null;
          prospect_id?: string | null;
          error_message?: string | null;
          processing_started_at?: string | null;
          processing_completed_at?: string | null;
        };
        Relationships: [];
      };
      ai_cost_records: {
        Row: {
          id: string;
          user_id: string;
          prospect_id: string | null;
          batch_job_id: string | null;
          operation: 'brain_extraction' | 'research_synthesis' | 'opportunity_analysis' | 'message_generation';
          model: string;
          input_tokens: number;
          output_tokens: number;
          cost_usd: number;
          enrichment_provider: string | null;
          enrichment_matched: boolean | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          prospect_id?: string | null;
          batch_job_id?: string | null;
          operation: 'brain_extraction' | 'research_synthesis' | 'opportunity_analysis' | 'message_generation';
          model: string;
          input_tokens: number;
          output_tokens: number;
          cost_usd: number;
          enrichment_provider?: string | null;
          enrichment_matched?: boolean | null;
          created_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      webhook_events: {
        Row: {
          id: string;
          provider: 'paddle' | 'inngest';
          event_id: string;
          event_type: string;
          payload: Json;
          processed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          provider: 'paddle' | 'inngest';
          event_id: string;
          event_type: string;
          payload: Json;
          processed_at?: string | null;
          created_at?: string;
        };
        Update: {
          processed_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      increment_usage_if_allowed: {
        Args: { p_user_id: string; p_prospects?: number; p_messages?: number };
        Returns: string;
      };
      release_usage: {
        Args: { p_user_id: string; p_prospects?: number; p_messages?: number };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
  };
}

// Convenience row types
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

export type BusinessBrain = Database['public']['Tables']['business_brains']['Row'];
export type BusinessBrainInsert = Database['public']['Tables']['business_brains']['Insert'];
export type BusinessBrainUpdate = Database['public']['Tables']['business_brains']['Update'];

export type BrainFact = Database['public']['Tables']['brain_facts']['Row'];
export type BrainFactInsert = Database['public']['Tables']['brain_facts']['Insert'];
export type BrainFactUpdate = Database['public']['Tables']['brain_facts']['Update'];

export type Plan = Database['public']['Tables']['plans']['Row'];

export type Subscription = Database['public']['Tables']['subscriptions']['Row'];
export type SubscriptionInsert = Database['public']['Tables']['subscriptions']['Insert'];
export type SubscriptionUpdate = Database['public']['Tables']['subscriptions']['Update'];

export type UsageRecord = Database['public']['Tables']['usage_records']['Row'];
export type UsageRecordInsert = Database['public']['Tables']['usage_records']['Insert'];
export type UsageRecordUpdate = Database['public']['Tables']['usage_records']['Update'];

export type Prospect = Database['public']['Tables']['prospects']['Row'];
export type ProspectInsert = Database['public']['Tables']['prospects']['Insert'];
export type ProspectUpdate = Database['public']['Tables']['prospects']['Update'];

export type ResearchRecord = Database['public']['Tables']['research_records']['Row'];
export type ResearchRecordInsert = Database['public']['Tables']['research_records']['Insert'];
export type ResearchRecordUpdate = Database['public']['Tables']['research_records']['Update'];

export type OpportunityAnalysis = Database['public']['Tables']['opportunity_analyses']['Row'];
export type OpportunityAnalysisInsert = Database['public']['Tables']['opportunity_analyses']['Insert'];

export type GeneratedMessage = Database['public']['Tables']['generated_messages']['Row'];
export type GeneratedMessageInsert = Database['public']['Tables']['generated_messages']['Insert'];
export type GeneratedMessageUpdate = Database['public']['Tables']['generated_messages']['Update'];

export type Followup = Database['public']['Tables']['followups']['Row'];
export type FollowupInsert = Database['public']['Tables']['followups']['Insert'];
export type FollowupUpdate = Database['public']['Tables']['followups']['Update'];

export type BatchJob = Database['public']['Tables']['batch_jobs']['Row'];
export type BatchJobInsert = Database['public']['Tables']['batch_jobs']['Insert'];
export type BatchJobUpdate = Database['public']['Tables']['batch_jobs']['Update'];

export type BatchUrl = Database['public']['Tables']['batch_urls']['Row'];
export type BatchUrlInsert = Database['public']['Tables']['batch_urls']['Insert'];
export type BatchUrlUpdate = Database['public']['Tables']['batch_urls']['Update'];

export type AiCostRecord = Database['public']['Tables']['ai_cost_records']['Row'];
export type AiCostRecordInsert = Database['public']['Tables']['ai_cost_records']['Insert'];

export type WebhookEvent = Database['public']['Tables']['webhook_events']['Row'];
export type WebhookEventInsert = Database['public']['Tables']['webhook_events']['Insert'];
