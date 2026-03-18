import { describe, expect, it } from 'vitest';
import { parseChatGPTConversation, type ChatGPTConversation } from '@/lib/chatgpt-parser';

// Minimal fixture based on real ChatGPT API response structure (backend-api/conversation/{id})
// If this test breaks, ChatGPT likely changed their internal API structure.
const FIXTURE: ChatGPTConversation = {
  title: 'Test conversation',
  mapping: {
    // Root node — no message, no parent
    'root': {
      id: 'root',
      parent: null,
      children: ['system-msg'],
      message: null,
    },
    // Hidden system message (user profile) — should be skipped
    'system-msg': {
      id: 'system-msg',
      parent: 'root',
      children: ['user-1'],
      message: {
        author: { role: 'user', metadata: {} },
        content: { content_type: 'user_editable_context', parts: [] },
        metadata: { is_visually_hidden_from_conversation: true },
      },
    },
    // First visible user message
    'user-1': {
      id: 'user-1',
      parent: 'system-msg',
      children: ['assistant-1'],
      message: {
        author: { role: 'user', metadata: {} },
        content: { content_type: 'text', parts: ['What is an heirloom variety?'] },
        metadata: { is_visually_hidden_from_conversation: false },
      },
    },
    // Assistant response
    'assistant-1': {
      id: 'assistant-1',
      parent: 'user-1',
      children: ['user-2'],
      message: {
        author: { role: 'assistant', metadata: {} },
        content: { content_type: 'text', parts: ['An heirloom variety is an older plant cultivar valued for unique traits.'] },
        metadata: {},
      },
    },
    // Second user message
    'user-2': {
      id: 'user-2',
      parent: 'assistant-1',
      children: [],
      message: {
        author: { role: 'user', metadata: {} },
        content: { content_type: 'text', parts: ['How do they differ from hybrids?'] },
        metadata: {},
      },
    },
  },
};

describe('parseChatGPTConversation', () => {
  it('extracts messages in order with speaker labels', () => {
    const result = parseChatGPTConversation(FIXTURE);
    expect(result).toBe(
      '**You:** What is an heirloom variety?\n\n' +
      '**ChatGPT:** An heirloom variety is an older plant cultivar valued for unique traits.\n\n' +
      '**You:** How do they differ from hybrids?'
    );
  });

  it('skips hidden system messages', () => {
    const result = parseChatGPTConversation(FIXTURE);
    expect(result).not.toContain('user_editable_context');
    expect(result).not.toContain('user profile');
  });

  it('returns null when mapping is missing', () => {
    expect(parseChatGPTConversation({} as ChatGPTConversation)).toBeNull();
  });

  it('returns null when all messages are hidden or empty', () => {
    const emptyFixture: ChatGPTConversation = {
      mapping: {
        'root': { id: 'root', parent: null, children: ['hidden'], message: null },
        'hidden': {
          id: 'hidden', parent: 'root', children: [],
          message: {
            author: { role: 'user', metadata: {} },
            content: { content_type: 'text', parts: ['hidden'] },
            metadata: { is_visually_hidden_from_conversation: true },
          },
        },
      },
    };
    expect(parseChatGPTConversation(emptyFixture)).toBeNull();
  });

  it('strips citation artifacts from assistant messages', () => {
    const fixture: ChatGPTConversation = {
      mapping: {
        'root': { id: 'root', parent: null, children: ['msg'], message: null },
        'msg': {
          id: 'msg', parent: 'root', children: [],
          message: {
            author: { role: 'assistant', metadata: {} },
            content: { content_type: 'text', parts: ['Many definitions use **50 to 100 years old**. cite\uE202turn893384search0turn893384search2turn949549view4turn949549view1'] },
            metadata: {},
          },
        },
      },
    };
    expect(parseChatGPTConversation(fixture)).toBe('**ChatGPT:** Many definitions use **50 to 100 years old**.');
  });

  it('handles messages with multiple content parts', () => {
    const fixture: ChatGPTConversation = {
      mapping: {
        'root': { id: 'root', parent: null, children: ['msg'], message: null },
        'msg': {
          id: 'msg', parent: 'root', children: [],
          message: {
            author: { role: 'user', metadata: {} },
            content: { content_type: 'text', parts: ['Hello ', 'world'] },
            metadata: {},
          },
        },
      },
    };
    expect(parseChatGPTConversation(fixture)).toBe('**You:** Hello world');
  });

  it('prefers the currently selected branch when current_node is present', () => {
    const fixture: ChatGPTConversation = {
      current_node: 'assistant-v2',
      mapping: {
        root: { id: 'root', parent: null, children: ['user-1'], message: null },
        'user-1': {
          id: 'user-1',
          parent: 'root',
          children: ['assistant-v1', 'assistant-v2'],
          message: {
            author: { role: 'user', metadata: {} },
            content: { content_type: 'text', parts: ['Please revise this answer.'] },
            metadata: {},
          },
        },
        'assistant-v1': {
          id: 'assistant-v1',
          parent: 'user-1',
          children: [],
          message: {
            author: { role: 'assistant', metadata: {} },
            content: { content_type: 'text', parts: ['Old answer variant.'] },
            metadata: {},
          },
        },
        'assistant-v2': {
          id: 'assistant-v2',
          parent: 'user-1',
          children: [],
          message: {
            author: { role: 'assistant', metadata: {} },
            content: { content_type: 'text', parts: ['New answer variant.'] },
            metadata: {},
          },
        },
      },
    };

    expect(parseChatGPTConversation(fixture)).toBe(
      '**You:** Please revise this answer.\n\n**ChatGPT:** New answer variant.'
    );
  });
});
