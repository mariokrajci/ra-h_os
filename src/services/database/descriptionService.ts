import { openai as openaiProvider } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { hasValidOpenAiKey } from '../storage/apiKeys';
import { getOpenAIChatModel } from '@/config/openaiModels';
import { logAiUsage, normalizeUsageFromAiSdk } from '@/services/analytics/usageLogger';

export interface DescriptionInput {
  title: string;
  notes?: string;
  link?: string;
  metadata?: {
    source?: string;
    channel_name?: string;
    author?: string;
    site_name?: string;
  };
  dimensions?: string[];
}

export function clampDescription(value: string, limit = 280): string {
  const trimmed = value.trim();
  if (trimmed.length <= limit) return trimmed;

  const budget = Math.max(1, limit - 1);
  const slice = trimmed.slice(0, budget);
  const lastWhitespace = slice.search(/\s+\S*$/);
  const boundary = lastWhitespace > 0 ? slice.slice(0, lastWhitespace).trimEnd() : slice.trimEnd();

  return `${boundary}…`;
}

// Re-export for backwards compatibility — canonical source is ../storage/apiKeys
export { hasValidOpenAiKey } from '../storage/apiKeys';

/**
 * Generate a simple fallback description without AI.
 * Used when no API key is available or for simple inputs.
 */
export function generateFallbackDescription(input: DescriptionInput): string {
  const { title, metadata, dimensions } = input;

  // Build a contextual fallback
  const parts: string[] = [];

  if (metadata?.author || metadata?.channel_name) {
    parts.push(`By ${metadata.author || metadata.channel_name}`);
  }

  if (dimensions?.length) {
    parts.push(`in ${dimensions.slice(0, 2).join(', ')}`);
  }

  if (parts.length > 0) {
    return clampDescription(`${parts.join(' — ')}: ${title}`, 280);
  }

  return clampDescription(title, 280);
}

/**
 * Generate a 280-character description for a knowledge node.
 * Contextually grounded - adapts to node type (person, concept, article, etc.)
 *
 * IMPORTANT: Returns fallback immediately if no valid API key is configured.
 * This prevents slow node creation (9-13s timeout) when OpenAI is unavailable.
 */
export async function generateDescription(input: DescriptionInput): Promise<string> {
  // Fast path: skip AI if no valid API key
  if (!hasValidOpenAiKey()) {
    console.log(`[DescriptionService] No valid OpenAI key, using fallback for: "${input.title}"`);
    return generateFallbackDescription(input);
  }

  // Fast path: skip AI for very short inputs (likely just notes)
  if (!input.notes && !input.link && input.title.length < 30) {
    console.log(`[DescriptionService] Short input, using fallback for: "${input.title}"`);
    return generateFallbackDescription(input);
  }

  try {
    const prompt = buildDescriptionPrompt(input);

    console.log(`[DescriptionService] Generating description for: "${input.title}"`);

    const response = await generateText({
      model: openaiProvider(getOpenAIChatModel()),
      prompt,
      maxOutputTokens: 100,
      temperature: 0.3,
    });
    const usage = normalizeUsageFromAiSdk(response);
    if (usage) {
      logAiUsage({
        feature: 'node_description',
        provider: 'openai',
        modelId: getOpenAIChatModel(),
        usage,
      });
    }

    const description = response.text.trim();

    // Ensure within character limit
    const finalDescription = clampDescription(description, 280);

    console.log(`[DescriptionService] Generated: "${finalDescription}"`);

    return finalDescription;
  } catch (error) {
    console.error('[DescriptionService] Error generating description:', error);
    // Return a fallback description
    return generateFallbackDescription(input);
  }
}

function buildDescriptionPrompt(input: DescriptionInput): string {
  const normalizedSource = (input.metadata?.source || '').toLowerCase();
  const url = typeof input.link === 'string' ? input.link.trim() : '';

  // Best-effort creator hint from structured metadata (when available),
  // but never assume a particular extraction source (YouTube vs paper vs website vs note).
  const creatorHint =
    input.metadata?.author?.trim() ||
    input.metadata?.channel_name?.trim() ||
    '';

  // Best-effort publisher / container hint (less ideal than a true author, but better than nothing).
  const publisherHint = input.metadata?.site_name?.trim() || '';

  const likelyExternal =
    Boolean(url) ||
    normalizedSource.includes('youtube') ||
    normalizedSource.includes('extract') ||
    normalizedSource.includes('paper') ||
    normalizedSource.includes('pdf') ||
    normalizedSource.includes('website');

  const likelyUserAuthored =
    !likelyExternal &&
    (normalizedSource.includes('quick-add-note') ||
      normalizedSource.includes('quick-add-chat') ||
      normalizedSource.includes('note') ||
      normalizedSource.length === 0);

  const lines: string[] = [`Title: ${input.title}`];

  if (input.link) lines.push(`URL: ${input.link}`);
  if (input.dimensions?.length) lines.push(`Dimensions: ${input.dimensions.join(', ')}`);
  if (input.metadata?.channel_name) lines.push(`Channel: ${input.metadata.channel_name}`);
  if (input.metadata?.author) lines.push(`Author: ${input.metadata.author}`);
  if (input.metadata?.site_name) lines.push(`Site: ${input.metadata.site_name}`);
  if (creatorHint) lines.push(`Creator hint: ${creatorHint}`);
  if (publisherHint) lines.push(`Publisher hint: ${publisherHint}`);
  lines.push(`Likely user-authored: ${likelyUserAuthored ? 'yes' : 'no'}`);

  const contentPreview = input.notes?.slice(0, 800) || '';
  if (contentPreview) lines.push(`Notes: ${contentPreview}${input.notes && input.notes.length > 800 ? '...' : ''}`);

  return `Write a description for this knowledge node. Max 280 characters.

Say WHAT this literally is and WHY it matters. Be concrete and specific — like you're telling a friend what this thing is in one breath.

RULES:
1) Name the format only when it adds meaning: "Podcast episode where…", "Blog post arguing…", "Your note on…", "Research paper showing…", "Idea that…"
2) Name people by role — channel/host is the creator, title figures are guests/subjects. Use the Creator hint if available.
3) State the actual claim, finding, or insight from the content — not a vague summary of the topic.
4) End with why it's interesting or important — one concrete phrase.
5) ABSOLUTELY FORBIDDEN — these words will be rejected: "discusses", "explores", "examines", "talks about", "is about", "delves into", "emphasizing the need for". State things directly instead.
6) Do NOT waste characters on container labels like "GitHub repository for", "website for", or "PDF about" unless they are genuinely needed for disambiguation.

GOOD: "Karpathy blog post — AI agents make software fluid, ripping functionality from repos instead of taking dependencies. Signals the end of monolithic libraries."
GOOD: "Dwarkesh Patel interview with Anthropic CEO Dario Amodei — argues we're nearing the end of exponential AI scaling. Key signal for what comes next."
GOOD: "Your note — morning optimism consistently reverses to evening pessimism. Not energy — the belief itself flips. Pattern worth tracking."
BAD: "By Dario Amodei — discusses reaching the limits of exponential growth in AI, emphasizing the need for a critical perspective on future advancements."
BAD: "This article explores ideas about how software is changing."
BAD: "GitHub repository for Promptfoo — a tool for prompt management."

Return ONLY the description text. Nothing else.

${lines.join('\n')}`;
}

export const descriptionService = {
  generateDescription
};
