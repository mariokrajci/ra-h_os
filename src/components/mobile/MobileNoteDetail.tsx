"use client";

import { useEffect, useState } from 'react';

import MarkdownWithNodeTokens from '@/components/helpers/MarkdownWithNodeTokens';
import { useMobileNodeDetail } from './useMobileNodeDetail';

export default function MobileNoteDetail({
  nodeId,
  refreshToken,
  onBack,
  onOpenChild,
}: {
  nodeId: number;
  refreshToken: number;
  onBack: () => void;
  onOpenChild: (child: 'source' | 'metadata' | 'connections') => void;
}) {
  const { node, connections, loading, setNode } = useMobileNodeDetail(nodeId, refreshToken);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setNotesDraft(node?.notes ?? '');
  }, [node?.notes]);

  async function saveNotes() {
    setSaving(true);
    try {
      const response = await fetch(`/api/nodes/${nodeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notesDraft }),
      });
      const result = await response.json();
      if (result.success) {
        setNode(result.node);
        setEditingNotes(false);
      }
    } catch (error) {
      console.error('Failed to save notes:', error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--app-bg)', color: 'var(--app-text)', paddingBottom: '92px' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'color-mix(in srgb, var(--app-bg) 92%, transparent)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--app-border)', padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
          <button type="button" className="app-button app-button--ghost app-button--compact" onClick={onBack}>Back</button>
          <button
            type="button"
            className={`app-button app-button--compact${editingNotes ? ' app-button--accent' : ''}`}
            onClick={() => editingNotes ? void saveNotes() : setEditingNotes(true)}
            disabled={saving}
          >
            {editingNotes ? (saving ? 'Saving...' : 'Save') : 'Edit'}
          </button>
        </div>
      </div>

      {loading || !node ? (
        <div style={{ padding: '24px 16px', color: 'var(--app-text-muted)' }}>{loading ? 'Loading note...' : 'Note not found.'}</div>
      ) : (
        <div style={{ padding: '18px 16px 0' }}>
          <div style={{ fontSize: '28px', lineHeight: 1.15, fontWeight: 650 }}>{node.title || `Untitled #${node.id}`}</div>
          <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--app-text-subtle)' }}>Edited {new Date(node.updated_at).toLocaleString()}</div>

          {node.description ? (
            <div className="app-panel-elevated" style={{ borderRadius: '16px', padding: '14px', marginTop: '18px', fontSize: '14px', color: 'var(--app-text-muted)' }}>
              {node.description}
            </div>
          ) : null}

          <div className="app-panel" style={{ borderRadius: '18px', padding: '16px', marginTop: '18px' }}>
            {editingNotes ? (
              <textarea
                value={notesDraft}
                onChange={(event) => setNotesDraft(event.target.value)}
                className="app-input"
                style={{ minHeight: '240px', padding: '14px' }}
              />
            ) : node.notes?.trim() ? (
              <MarkdownWithNodeTokens content={node.notes} />
            ) : (
              <div style={{ color: 'var(--app-text-muted)' }}>No notes yet.</div>
            )}
          </div>

          <div style={{ display: 'grid', gap: '12px', marginTop: '18px' }}>
            <button
              type="button"
              className="app-panel-elevated"
              style={{ borderRadius: '16px', padding: '14px', textAlign: 'left', cursor: 'pointer' }}
              onClick={() => onOpenChild('connections')}
            >
              <div style={{ fontSize: '11px', color: 'var(--app-text-subtle)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Connections</div>
              <div style={{ marginTop: '10px', fontSize: '13px', color: 'var(--app-text-muted)' }}>
                {connections.length > 0 ? `${connections.length} related notes` : 'No related notes yet.'}
              </div>
            </button>
            <button
              type="button"
              className="app-panel-elevated"
              style={{ borderRadius: '16px', padding: '14px', textAlign: 'left', cursor: 'pointer' }}
              onClick={() => onOpenChild('metadata')}
            >
              <div style={{ fontSize: '11px', color: 'var(--app-text-subtle)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Metadata</div>
              <div style={{ marginTop: '10px', fontSize: '13px', color: 'var(--app-text-muted)' }}>
                {node.dimensions?.length ? `Tags: ${node.dimensions.join(', ')}` : 'No tags assigned.'}
              </div>
            </button>
            {node.chunk ? (
              <button
                type="button"
                className="app-panel-elevated"
                style={{ borderRadius: '16px', padding: '14px', textAlign: 'left', cursor: 'pointer' }}
                onClick={() => onOpenChild('source')}
              >
                <div style={{ fontSize: '11px', color: 'var(--app-text-subtle)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Source</div>
                <div style={{ marginTop: '10px', fontSize: '13px', color: 'var(--app-text-muted)', lineHeight: 1.5 }}>
                  {node.chunk.slice(0, 220)}{node.chunk.length > 220 ? '...' : ''}
                </div>
              </button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
