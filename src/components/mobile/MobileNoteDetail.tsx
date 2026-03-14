"use client";

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft } from 'lucide-react';

import MarkdownWithNodeTokens from '@/components/helpers/MarkdownWithNodeTokens';
import { useMobileNodeDetail } from './useMobileNodeDetail';

function formatMobileDate(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value));
}

export default function MobileNoteDetail({
  nodeId,
  refreshToken,
  navDirection,
  onBack,
  onOpenChild,
  onOpenNode,
  animation,
}: {
  nodeId: number;
  refreshToken: number;
  navDirection: 'forward' | 'backward' | 'none';
  onBack: () => void;
  onOpenChild: (child: 'source' | 'metadata' | 'connections') => void;
  onOpenNode: (nodeId: number) => void;
  animation: string | undefined;
}) {
  const { node, connections, loading, setNode } = useMobileNodeDetail(nodeId, refreshToken);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [generatingFromSource, setGeneratingFromSource] = useState(false);
  const [showHeaderTitle, setShowHeaderTitle] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setNotesDraft(node?.notes ?? '');
  }, [node?.notes]);

  // Auto-focus textarea when entering edit mode
  useEffect(() => {
    if (editingNotes) {
      textareaRef.current?.focus();
    }
  }, [editingNotes]);

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    setShowHeaderTitle(e.currentTarget.scrollTop > 52);
  }

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

  async function generateNotesFromSource() {
    if (!node?.chunk?.trim()) return;
    setGeneratingFromSource(true);
    try {
      const response = await fetch(`/api/nodes/${nodeId}/generate-notes-from-source`, {
        method: 'POST',
      });
      const result = await response.json();
      if (result.success && result.node) {
        setNode(result.node);
      } else {
        throw new Error(result.error || 'Failed to generate notes from source');
      }
    } catch (error) {
      console.error('Failed to generate notes from source:', error);
    } finally {
      setGeneratingFromSource(false);
    }
  }

  // Suppress unused variable warning — navDirection is available for future use
  void navDirection;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--app-bg)', color: 'var(--app-text)', animation }}>
      {/* Sticky header */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        background: 'color-mix(in srgb, var(--app-bg) 88%, transparent)',
        backdropFilter: 'blur(16px)',
        borderBottom: showHeaderTitle ? '0.5px solid var(--app-border)' : '0.5px solid transparent',
        transition: 'border-color 0.15s',
        padding: '14px 16px',
        minHeight: '52px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '12px',
      }}>
        <button
          type="button"
          className="app-button app-button--ghost app-button--compact"
          style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '6px 8px 6px 4px' }}
          onClick={onBack}
        >
          <ChevronLeft size={18} />
          Notes
        </button>

        <div style={{
          fontSize: '15px',
          fontWeight: 600,
          opacity: showHeaderTitle ? 1 : 0,
          transition: 'opacity 0.18s ease',
          flex: 1,
          textAlign: 'center',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontFamily: 'ui-sans-serif, -apple-system, system-ui, sans-serif',
        }}>
          {node?.title || ''}
        </div>

        <button
          type="button"
          className={`app-button app-button--compact${editingNotes ? ' app-button--accent' : ''}`}
          onClick={() => editingNotes ? void saveNotes() : setEditingNotes(true)}
          disabled={saving}
        >
          {editingNotes ? (saving ? 'Saving…' : 'Save') : 'Edit'}
        </button>
      </div>

      {/* Scrollable content */}
      <div
        onScroll={handleScroll}
        style={{ flex: 1, overflowY: 'auto', paddingBottom: '100px' }}
      >
        {loading || !node ? (
          <div style={{ padding: '24px 16px', color: 'var(--app-text-muted)' }}>
            {loading ? 'Loading…' : 'Note not found.'}
          </div>
        ) : (
          <div style={{ padding: '20px 16px 0' }}>
            {/* Hero title */}
            <h1 style={{
              fontSize: '30px',
              lineHeight: 1.15,
              fontWeight: 700,
              letterSpacing: '-0.3px',
              fontFamily: 'ui-sans-serif, -apple-system, system-ui, sans-serif',
            }}>
              {node.title || `Untitled #${node.id}`}
            </h1>

            <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--app-text-subtle)' }}>
              Edited {formatMobileDate(node.updated_at)}
            </div>

            {/* Description */}
            {node.description && (() => {
              const PREVIEW_LENGTH = 120;
              const isLong = node.description.length > PREVIEW_LENGTH;
              const displayText = isLong && !showFullDescription
                ? node.description.slice(0, PREVIEW_LENGTH).trimEnd() + '…'
                : node.description;
              return (
                <div style={{
                  marginTop: '18px',
                  fontSize: '15px',
                  color: 'var(--app-text-muted)',
                  lineHeight: 1.6,
                  padding: '14px 16px',
                  background: 'var(--app-panel)',
                  borderRadius: '14px',
                  border: '0.5px solid var(--app-border)',
                }}>
                  {displayText}
                  {isLong && (
                    <button
                      type="button"
                      onClick={() => setShowFullDescription((v) => !v)}
                      style={{ marginLeft: '6px', background: 'none', border: 'none', padding: 0, fontSize: '13px', color: 'var(--toolbar-accent)', cursor: 'pointer', fontWeight: 500 }}
                    >
                      {showFullDescription ? 'Show less' : 'Show more'}
                    </button>
                  )}
                </div>
              );
            })()}

            {/* Notes content */}
            <div style={{
              marginTop: '20px',
              fontSize: '16px',
              lineHeight: 1.75,
              color: 'var(--app-text)',
            }}>
              {editingNotes ? (
                <textarea
                  ref={textareaRef}
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  className="app-input"
                  style={{
                    minHeight: '240px',
                    padding: '14px',
                    fontSize: '16px',
                    lineHeight: 1.75,
                    width: '100%',
                  }}
                />
              ) : node.notes?.trim() ? (
                <MarkdownWithNodeTokens content={node.notes} />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '4px' }}>
                  <button
                    type="button"
                    className="app-button"
                    style={{ padding: '12px 16px', borderRadius: '12px', textAlign: 'left', fontSize: '15px', fontWeight: 500 }}
                    onClick={() => setEditingNotes(true)}
                  >
                    Write notes
                  </button>
                  {node.chunk && (
                    <button
                      type="button"
                      className="app-button app-button--ghost"
                      style={{ padding: '12px 16px', borderRadius: '12px', textAlign: 'left', fontSize: '15px', fontWeight: 500 }}
                      onClick={() => onOpenChild('source')}
                    >
                      View source
                    </button>
                  )}
                  {node.chunk && (
                    <button
                      type="button"
                      className="app-button app-button--ghost"
                      style={{ padding: '12px 16px', borderRadius: '12px', textAlign: 'left', fontSize: '15px', fontWeight: 500 }}
                      disabled={generatingFromSource}
                      onClick={() => void generateNotesFromSource()}
                    >
                      {generatingFromSource ? 'Generating notes…' : 'Generate notes from source'}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Flush child sections */}
            <div style={{ marginTop: '32px', borderTop: '0.5px solid var(--app-border)' }}>
              <button
                type="button"
                onClick={() => onOpenChild('connections')}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '16px 0',
                  borderBottom: '0.5px solid var(--app-border)',
                  background: 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '5px',
                }}
              >
                <div style={{ fontSize: '11px', color: 'var(--app-text-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Connections
                </div>
                <div style={{ fontSize: '14px', color: 'var(--app-text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{connections.length > 0 ? `${connections.length} related notes` : 'No related notes yet'}</span>
                  <ChevronLeft size={16} style={{ transform: 'rotate(180deg)', opacity: 0.4 }} />
                </div>
              </button>

              <button
                type="button"
                onClick={() => onOpenChild('metadata')}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '16px 0',
                  borderBottom: node.chunk ? '0.5px solid var(--app-border)' : 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '5px',
                }}
              >
                <div style={{ fontSize: '11px', color: 'var(--app-text-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Metadata
                </div>
                <div style={{ fontSize: '14px', color: 'var(--app-text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{node.dimensions?.length ? `${node.dimensions.length} tags` : 'No tags assigned'}</span>
                  <ChevronLeft size={16} style={{ transform: 'rotate(180deg)', opacity: 0.4 }} />
                </div>
              </button>

              {node.chunk && (
                <button
                  type="button"
                  onClick={() => onOpenChild('source')}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '16px 0',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '5px',
                  }}
                >
                  <div style={{ fontSize: '11px', color: 'var(--app-text-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Source
                  </div>
                  <div style={{ fontSize: '14px', color: 'var(--app-text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '8px' }}>
                      {node.chunk.slice(0, 60)}…
                    </span>
                    <ChevronLeft size={16} style={{ transform: 'rotate(180deg)', opacity: 0.4 }} />
                  </div>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
