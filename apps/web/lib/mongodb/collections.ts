import { type Collection, type Document, ObjectId } from 'mongodb';
import { getDb } from '../mongodb';

// Convert MongoDB _id to string id for API responses
export function toId<T extends Document>(doc: T): T & { id: string } {
  const { _id, ...rest } = doc;
  return { ...rest, id: (_id as ObjectId).toString() } as T & { id: string };
}

export function toIds<T extends Document>(docs: T[]): Array<T & { id: string }> {
  return docs.map(toId);
}

export async function col<T extends Document = Document>(name: string): Promise<Collection<T>> {
  const db = await getDb();
  return db.collection<T>(name);
}

export async function users() { return col('users'); }
export async function accounts() { return col('accounts'); }
export async function sessions() { return col('sessions'); }
export async function verificationTokens() { return col('verification_tokens'); }
export async function businessBrains() { return col('business_brains'); }
export async function brainFacts() { return col('brain_facts'); }
export async function plans() { return col('plans'); }
export async function subscriptions() { return col('subscriptions'); }
export async function usageRecords() { return col('usage_records'); }
export async function prospects() { return col('prospects'); }
export async function researchRecords() { return col('research_records'); }
export async function opportunityAnalyses() { return col('opportunity_analyses'); }
export async function generatedMessages() { return col('generated_messages'); }
export async function followups() { return col('followups'); }
export async function batchJobs() { return col('batch_jobs'); }
export async function batchUrls() { return col('batch_urls'); }
export async function aiCostRecords() { return col('ai_cost_records'); }
export async function webhookEvents() { return col('webhook_events'); }
export async function extensionSessions() { return col('extension_sessions'); }
export async function passwordResetTokens() { return col('password_reset_tokens'); }
