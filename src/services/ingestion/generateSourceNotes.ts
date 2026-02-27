import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { getOpenAIChatModel } from '@/config/openaiModels';
import { logAiUsage, normalizeUsageFromAiSdk } from '@/services/analytics/usageLogger';

interface GenerateSourceNotesParams {
  title: string;
  sourceType: 'podcast' | 'website' | 'youtube' | 'pdf' | string;
  sourceText: string;
  metadata?: Record<string, unknown>;
}

const MIN_SOURCE_CHARS = 200;
const MAX_SOURCE_CHARS = 24000;

function buildPrompt({ title, sourceType, sourceText, metadata }: GenerateSourceNotesParams): string {
  const metaSummary = metadata
    ? Object.entries(metadata)
        .filter(([, value]) => typeof value === 'string' || typeof value === 'number')
        .slice(0, 8)
        .map(([key, value]) => `${key}: ${String(value)}`)
        .join('\n')
    : '';

  const excerpt = sourceText.length > MAX_SOURCE_CHARS
    ? `${sourceText.slice(0, MAX_SOURCE_CHARS / 2)}\n[...]\n${sourceText.slice(-MAX_SOURCE_CHARS / 2)}`
    : sourceText;

  return `Write editable working notes for a knowledge-base node.

Title: ${title}
Source type: ${sourceType}
${metaSummary ? `Metadata:\n${metaSummary}\n` : ''}
Use the full source below to produce a concise but information-dense synthesis.

Requirements:
1. Ground the notes in the provided source only.
2. Capture main claims, key takeaways, and any notable details.
3. Write in clean markdown with short sections and bullets where helpful.
4. Avoid filler, hype, and generic phrases.
5. Output notes only.

Source:
"""
${excerpt}
"""`;
}

export async function generateSourceNotes(params: GenerateSourceNotesParams): Promise<string | null> {
  const sourceText = params.sourceText.trim();
  if (sourceText.length < MIN_SOURCE_CHARS) {
    return null;
  }

  try {
    const response = await generateText({
      model: openai(getOpenAIChatModel()),
      prompt: buildPrompt({ ...params, sourceText }),
      maxOutputTokens: 900,
    });

    const usage = normalizeUsageFromAiSdk(response);
    if (usage) {
      logAiUsage({
        feature: 'source_notes_synthesis',
        provider: 'openai',
        modelId: getOpenAIChatModel(),
        usage,
        metadata: { sourceType: params.sourceType },
      });
    }

    const text = response.text?.trim() || '';
    return text || null;
  } catch {
    return null;
  }
}
