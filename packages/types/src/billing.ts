export type PlanId = 'starter' | 'pro' | 'business';
export type SubscriptionStatus =
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'trialing'
  | 'paused';

export interface PlanConfig {
  id: PlanId;
  name: string;
  price_monthly_usd: number;
  price_annual_usd: number;
  prospects_per_month: number;
  messages_per_month: number;
  bulk_upload_enabled: boolean;
  max_batch_size: number;
}

export const PLAN_CONFIGS: Record<PlanId, PlanConfig> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    price_monthly_usd: 9,
    price_annual_usd: 86.4,
    prospects_per_month: 30,
    messages_per_month: 90,
    bulk_upload_enabled: false,
    max_batch_size: 0,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price_monthly_usd: 19,
    price_annual_usd: 182.4,
    prospects_per_month: 100,
    messages_per_month: 300,
    bulk_upload_enabled: true,
    max_batch_size: 50,
  },
  business: {
    id: 'business',
    name: 'Business',
    price_monthly_usd: 49,
    price_annual_usd: 470.4,
    prospects_per_month: 300,
    messages_per_month: 900,
    bulk_upload_enabled: true,
    max_batch_size: 100,
  },
};

export interface CreditLedgerEntry {
  user_id: string;
  amount: number; // positive = credit, negative = debit
  type: 'allocation' | 'consumption' | 'reservation' | 'release' | 'refund';
  reference_id?: string;
  created_at: string;
}

// ─── Economics validation ──────────────────────────────────────────────────────
// Target: max blended cost per completed report should leave ≥50% gross margin
// URL-based (PDL match, 75%): $0.182 PDL + $0.004 Serper + $0.025 AI = $0.211
// URL-based (PDL no-match):   $0.000 PDL + $0.004 Serper + $0.025 AI = $0.029
// Blended URL (75% match):                                              $0.166
// Manual only:                $0.000 PDL + $0.004 Serper + $0.025 AI = $0.029
// 50/50 URL/manual blended:                                             $0.097
//
// Starter  $9  / 30  credits = $0.30/credit. 50/50 blended COGS $0.097 → 68% margin
// Pro     $19  / 100 credits = $0.19/credit. 50/50 blended COGS $0.097 → 49% margin
// Business $49 / 300 credits = $0.163/credit. 50/50 blended COGS $0.097 → 40% margin
//
// 100% URL worst case:
// Starter  $9  / 30  credits = $0.30/credit. COGS $0.166 → 45% margin ✓
// Pro     $19  / 100 credits = $0.19/credit. COGS $0.166 → 13% margin ⚠
// Business $49 / 300 credits = $0.163/credit. COGS $0.166 → -2% margin ✗
//
// Cost optimization target: reduce blended AI cost from $0.025 to <$0.015 via
// haiku routing for simple tasks; cache hit savings of ~$0.03/repeat.

export const COST_TARGETS = {
  max_cost_per_report_url: 0.22,
  max_cost_per_report_manual: 0.04,
  target_cache_hit_rate: 0.15,
  pdl_cost_per_match: 0.28,
  serper_cost_per_query: 0.001,
  serper_queries_per_report: 4,
  paddle_fee_per_transaction: 0.50,
  paddle_percentage: 0.05,
};
