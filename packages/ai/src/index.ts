export { createAIClient, getAnthropicClient, MODELS, calculateCost, safeParseJson } from './client';
export type { AIClient, AICompleteParams, AICompleteResult, ModelId } from './client';

// High-level AI functions (use getAnthropicClient singleton internally)
export { synthesizeResearch } from './research-synthesis';
export { scoreOpportunity } from './opportunity-scoring';
export { extractBrainFacts } from './brain-extraction';
export { validateBrain } from './brain-validation';
export { generateMessage, rewriteMessage } from './outreach-generation';

// Prompt builders (for custom usage)
export { buildBrainExtractionPrompt } from './prompts/brain-extraction';
export type { BrainExtractionInput } from './prompts/brain-extraction';
export { buildResearchSynthesisPrompt } from './prompts/research-synthesis';
export { buildOpportunityScoringPrompt } from './prompts/opportunity-scoring';
export type { OpportunityScoringInput } from './prompts/opportunity-scoring';
export { buildMessageGenerationPrompt } from './prompts/message-generation';
export type { MessageGenerationInput } from './prompts/message-generation';
