import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getNodeByIdMock,
  updateNodeMock,
  generateSourceNotesMock,
  buildSourceNotesInputMock,
} = vi.hoisted(() => ({
  getNodeByIdMock: vi.fn(),
  updateNodeMock: vi.fn(),
  generateSourceNotesMock: vi.fn(),
  buildSourceNotesInputMock: vi.fn(),
}));

vi.mock('@/services/database', () => ({
  nodeService: {
    getNodeById: getNodeByIdMock,
    updateNode: updateNodeMock,
  },
}));

vi.mock('@/services/ingestion/generateSourceNotes', () => ({
  generateSourceNotes: generateSourceNotesMock,
  buildSourceNotesInput: buildSourceNotesInputMock,
}));

import { POST } from '../../app/api/nodes/[id]/generate-notes-from-source/route';

describe('POST /api/nodes/[id]/generate-notes-from-source', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildSourceNotesInputMock.mockReturnValue({ sourceExcerpt: 'excerpt', strategy: 'full', sectionTitles: undefined });
  });

  it('returns 400 when source content is missing', async () => {
    getNodeByIdMock.mockResolvedValue({
      id: 12,
      title: 'Promptfoo',
      chunk: '',
      metadata: { source: 'website' },
    });

    const response = await POST(new Request('http://localhost') as any, { params: Promise.resolve({ id: '12' }) });
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain('Source content is required');
    expect(generateSourceNotesMock).not.toHaveBeenCalled();
  });

  it('generates notes from source and updates the node', async () => {
    getNodeByIdMock.mockResolvedValue({
      id: 12,
      title: 'Promptfoo',
      chunk: '# Promptfoo\n\nPrompt testing and evals',
      metadata: { source: 'website', site_name: 'GitHub' },
    });
    generateSourceNotesMock.mockResolvedValue('## Summary\n\n- Promptfoo helps test prompts.');
    updateNodeMock.mockResolvedValue({
      id: 12,
      title: 'Promptfoo',
      chunk: '# Promptfoo\n\nPrompt testing and evals',
      notes: '## Summary\n\n- Promptfoo helps test prompts.',
      metadata: { source: 'website', notes_status: 'available', notes_generation_strategy: 'full' },
    });

    const response = await POST(new Request('http://localhost') as any, { params: Promise.resolve({ id: '12' }) });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(generateSourceNotesMock).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Promptfoo',
      sourceType: 'website',
      sourceText: '# Promptfoo\n\nPrompt testing and evals',
    }));
    expect(updateNodeMock).toHaveBeenCalledWith(12, expect.objectContaining({
      notes: '## Summary\n\n- Promptfoo helps test prompts.',
      metadata: expect.objectContaining({
        source: 'website',
        notes_status: 'available',
        notes_generation_strategy: 'full',
      }),
    }));
    expect(json.success).toBe(true);
    expect(json.node.notes).toContain('Promptfoo helps test prompts');
  });
});
