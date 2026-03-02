import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { getOpenAIChatModel } from '@/config/openaiModels';
import { logAiUsage, normalizeUsageFromAiSdk } from '@/services/analytics/usageLogger';
import { extractPdfPrioritySections } from './pdfSections';

interface GenerateSourceNotesParams {
  title: string;
  sourceType: 'podcast' | 'website' | 'youtube' | 'pdf' | string;
  sourceText: string;
  metadata?: Record<string, unknown>;
}

const MIN_SOURCE_CHARS = 200;
const MAX_SOURCE_CHARS = 24000;
const PDF_SECTION_TRIGGER_CHARS = 100000;

export interface SourceNotesInputResult {
  sourceExcerpt: string;
  strategy: 'full' | 'truncated' | 'pdf_sections' | 'book_sections';
  sectionTitles?: string[];
}

export function buildSourceNotesInput({
  sourceType,
  sourceText,
}: GenerateSourceNotesParams): SourceNotesInputResult {
  if (sourceType === 'pdf' && sourceText.length > PDF_SECTION_TRIGGER_CHARS) {
    const extractedSections = extractPdfPrioritySections(sourceText);
    if (extractedSections.strategy === 'sections' || extractedSections.strategy === 'book_sections') {
      return {
        sourceExcerpt: extractedSections.text,
        strategy: extractedSections.strategy === 'book_sections' ? 'book_sections' : 'pdf_sections',
        sectionTitles: extractedSections.sectionTitles,
      };
    }
  }

  if (sourceText.length > MAX_SOURCE_CHARS) {
    return {
      sourceExcerpt: `${sourceText.slice(0, MAX_SOURCE_CHARS / 2)}\n[...]\n${sourceText.slice(-MAX_SOURCE_CHARS / 2)}`,
      strategy: 'truncated',
    };
  }

  return {
    sourceExcerpt: sourceText,
    strategy: 'full',
  };
}

function buildPrompt({ title, sourceType, sourceText, metadata }: GenerateSourceNotesParams): string {
  const metaSummary = metadata
    ? Object.entries(metadata)
        .filter(([, value]) => typeof value === 'string' || typeof value === 'number')
        .slice(0, 8)
        .map(([key, value]) => `${key}: ${String(value)}`)
        .join('\n')
    : '';

  const { sourceExcerpt } = buildSourceNotesInput({ sourceType, sourceText });

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
${sourceExcerpt}
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
