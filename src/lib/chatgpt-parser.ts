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
  current_node?: string | null;
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
  const path: string[] = [];

  if (data.current_node && nodes[data.current_node]) {
    const visited = new Set<string>();
    let cursor: string | null = data.current_node;
    while (cursor && nodes[cursor] && !visited.has(cursor)) {
      path.push(cursor);
      visited.add(cursor);
      cursor = nodes[cursor].parent ?? null;
    }
    path.reverse();
  } else {
    const visited = new Set<string>();
    let cursor: string | null = rootId;
    while (cursor && nodes[cursor] && !visited.has(cursor)) {
      path.push(cursor);
      visited.add(cursor);
      cursor = nodes[cursor]?.children?.[0] ?? null;
    }
  }

  for (const nodeId of path) {
    const node: ChatGPTNode = nodes[nodeId];
    const msg = node?.message;
    const isHidden = msg?.metadata?.is_visually_hidden_from_conversation;
    const role = msg?.author?.role;

    if (msg && !isHidden && (role === 'user' || role === 'assistant')) {
      const parts = msg.content?.parts ?? [];
      const text = parts
        .filter((p) => typeof p === 'string')
        .join('')
        .replace(/cite[\uE000-\uF8FF]*(turn\d+[a-z]+\d+[\uE000-\uF8FF]*)+/g, '')
        .replace(/[\uE000-\uF8FF]+/g, '')
        .trim();
      if (text) {
        const label = role === 'user' ? '**You:**' : '**ChatGPT:**';
        messages.push(`${label} ${text}`);
      }
    }
  }

  return messages.length > 0 ? messages.join('\n\n') : null;
}
