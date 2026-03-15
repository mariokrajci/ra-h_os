export interface ChatGPTMessage {
  author: { role: string; metadata?: Record<string, unknown>; name?: string | null };
  content: { content_type: string; parts?: unknown[] };
  metadata?: { is_visually_hidden_from_conversation?: boolean };
}

export interface ChatGPTNode {
  id: string;
  parent: string | null;
  children: string[];
  message: ChatGPTMessage | null;
}

export interface ChatGPTConversation {
  mapping: Record<string, ChatGPTNode>;
  title?: string;
}

export function parseChatGPTConversation(data: ChatGPTConversation): string | null {
  if (!data?.mapping) return null;

  const nodes = data.mapping;

  const rootId = Object.keys(nodes).find((id) => {
    const parent = nodes[id].parent;
    return !parent || !nodes[parent];
  });
  if (!rootId) return null;

  const messages: string[] = [];
  const visited = new Set<string>();
  let currentId: string | null = rootId;

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const node: ChatGPTNode = nodes[currentId];
    const msg = node?.message;
    const isHidden = msg?.metadata?.is_visually_hidden_from_conversation;
    const role = msg?.author?.role;

    if (msg && !isHidden && (role === 'user' || role === 'assistant')) {
      const parts = msg.content?.parts ?? [];
      const text = parts
        .filter((p) => typeof p === 'string')
        .join('')
        .replace(/cite(turn\d+search\d+)+/g, '')
        .trim();
      if (text) {
        const label = role === 'user' ? '**You:**' : '**ChatGPT:**';
        messages.push(`${label} ${text}`);
      }
    }

    currentId = node?.children?.[0] ?? null;
  }

  return messages.length > 0 ? messages.join('\n\n') : null;
}
