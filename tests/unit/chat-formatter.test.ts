import { describe, expect, it } from 'vitest';

import { parseChatTurns } from '@/components/focus/source/formatters/ChatFormatter';

describe('parseChatTurns', () => {
  it('parses markdown-labeled chat turns and trims wrappers', () => {
    const content = [
      '**You:** Hello there',
      '',
      '**ChatGPT:** Hi! How can I help?',
      '',
      '**You:** Compare A vs B',
    ].join('\n');

    const turns = parseChatTurns(content);
    expect(turns).toHaveLength(3);
    expect(turns[0]).toMatchObject({ role: 'you', text: 'Hello there' });
    expect(turns[1]).toMatchObject({ role: 'assistant', text: 'Hi! How can I help?' });
    expect(turns[2]).toMatchObject({ role: 'you', text: 'Compare A vs B' });
  });

  it('supports plain labels without markdown asterisks', () => {
    const turns = parseChatTurns('You: First line\nChatGPT: Second line');
    expect(turns).toHaveLength(2);
    expect(turns[0]).toMatchObject({ role: 'you', text: 'First line' });
    expect(turns[1]).toMatchObject({ role: 'assistant', text: 'Second line' });
  });
});
