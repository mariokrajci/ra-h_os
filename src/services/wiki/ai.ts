import OpenAI from 'openai';
import type { Node } from '@/types/database';
import { getOpenAIChatModel } from '@/config/openaiModels';
import { logAiUsage, normalizeUsageFromOpenAI } from '@/services/analytics/usageLogger';

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }
  return new OpenAI({ apiKey });
}

export interface DimensionGroup {
  topic: string;
  dimensions: string[];
}

export async function groupDimensionsIntoTopics(dimensions: string[]): Promise<DimensionGroup[]> {
  if (dimensions.length === 0) return [];
  const openai = getOpenAIClient();

  const response = await openai.chat.completions.create({
    model: getOpenAIChatModel(),
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'user',
        content: [
          'Group these dimension tags into 3 to 6 broad topics.',
          'Every dimension must appear exactly once.',
          'Return JSON as {"groups":[{"topic":"...","dimensions":["..."]}]}.',
          `Dimensions: ${dimensions.join(', ')}`,
        ].join('\n\n'),
      },
    ],
  });
  const groupingUsage = normalizeUsageFromOpenAI(response.usage);
  if (groupingUsage) {
    logAiUsage({
      feature: 'wiki_group_dimensions',
      provider: 'openai',
      modelId: getOpenAIChatModel(),
      usage: groupingUsage,
      metadata: { dimensionCount: dimensions.length },
    });
  }

  // response_format: json_object guarantees valid JSON — parse directly
  const raw = response.choices[0]?.message?.content ?? '{}';
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [{ topic: 'Knowledge', dimensions }];
  }

  const groups: DimensionGroup[] = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed.groups)
      ? parsed.groups
      : [];

  if (!groups.length) return [{ topic: 'Knowledge', dimensions }];

  const seen = new Set<string>();
  const normalized: DimensionGroup[] = groups
    .map((g) => ({
      topic: typeof g.topic === 'string' && g.topic.trim() ? g.topic.trim() : 'Topic',
      dimensions: Array.isArray(g.dimensions)
        ? g.dimensions.filter((d: unknown): d is string => typeof d === 'string' && dimensions.includes(d))
        : [],
    }))
    .filter((g) => g.dimensions.length > 0)
    .map((g) => {
      const uniqueDims = g.dimensions.filter((d) => {
        if (seen.has(d)) return false;
        seen.add(d);
        return true;
      });
      return { ...g, dimensions: uniqueDims };
    })
    .filter((g) => g.dimensions.length > 0);

  const missing = dimensions.filter((d) => !seen.has(d));
  if (missing.length > 0) {
    normalized.push({ topic: 'Misc', dimensions: missing });
  }

  return normalized.length ? normalized : [{ topic: 'Knowledge', dimensions }];
}

export async function summarizeDimension(
  dimensionName: string,
  nodes: Node[]
): Promise<{ summary: string; tokensUsed: number }> {
  const openai = getOpenAIClient();
  const nodeList = nodes
    .slice(0, 25)
    .map((node) => `- ${node.title}${node.description ? `: ${node.description}` : ''}`)
    .join('\n');

  const response = await openai.chat.completions.create({
    model: getOpenAIChatModel(),
    temperature: 0.3,
    max_tokens: 220,
    messages: [
      {
        role: 'user',
        content: [
          `Write a concise 3-5 sentence summary of the "${dimensionName}" subtopic.`,
          'Be specific and actionable. Avoid generic phrasing.',
          'Source nodes:',
          nodeList || '- No nodes',
        ].join('\n\n'),
      },
    ],
  });
  const summaryUsage = normalizeUsageFromOpenAI(response.usage);
  if (summaryUsage) {
    logAiUsage({
      feature: 'wiki_summarize_dimension',
      provider: 'openai',
      modelId: getOpenAIChatModel(),
      usage: summaryUsage,
      metadata: { dimensionName, nodeCount: nodes.length },
    });
  }

  return {
    summary: (response.choices[0]?.message?.content || '').trim(),
    tokensUsed: response.usage?.total_tokens ?? 0,
  };
}

export async function synthesizeFullArticle(
  subtopicTitle: string,
  nodes: Node[]
): Promise<{ article: string; tokensUsed: number }> {
  const openai = getOpenAIClient();
  const nodeContext = nodes
    .slice(0, 20)
    .map((node) => [
      `### ${node.title}`,
      node.description || '',
      node.notes ? `Notes: ${node.notes}` : '',
    ].filter(Boolean).join('\n'))
    .join('\n\n');

  const response = await openai.chat.completions.create({
    model: getOpenAIChatModel(),
    temperature: 0.5,
    max_tokens: 1500,
    messages: [
      {
        role: 'user',
        content: [
          `Write a comprehensive wiki article about "${subtopicTitle}".`,
          'Use markdown with an intro and meaningful ## sections.',
          'Integrate ideas instead of listing nodes.',
          'Knowledge nodes:',
          nodeContext || 'No source nodes provided.',
        ].join('\n\n'),
      },
    ],
  });
  const articleUsage = normalizeUsageFromOpenAI(response.usage);
  if (articleUsage) {
    logAiUsage({
      feature: 'wiki_synthesize_article',
      provider: 'openai',
      modelId: getOpenAIChatModel(),
      usage: articleUsage,
      metadata: { subtopicTitle, nodeCount: nodes.length },
    });
  }

  return {
    article: response.choices[0]?.message?.content || '',
    tokensUsed: response.usage?.total_tokens ?? 0,
  };
}
