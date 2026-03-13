"use client";

import { useState, useEffect } from 'react';
import { ArrowLeft, Lock, Trash2 } from 'lucide-react';
import MarkdownWithNodeTokens from '@/components/helpers/MarkdownWithNodeTokens';
import PaneHeader from './PaneHeader';
import type { BasePaneProps } from './types';

interface GuideMeta {
  name: string;
  description: string;
  immutable: boolean;
}

interface Guide extends GuideMeta {
  content: string;
}

export default function GuidesPane({
  slot,
  onCollapse,
  onSwapPanes,
  tabBar,
}: BasePaneProps) {
  const [guides, setGuides] = useState<GuideMeta[]>([]);
  const [selectedGuide, setSelectedGuide] = useState<Guide | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetchGuides();

    const handleGuideUpdated = () => { fetchGuides(); };
    window.addEventListener('guides:updated', handleGuideUpdated);
    return () => window.removeEventListener('guides:updated', handleGuideUpdated);
  }, []);

  const fetchGuides = async () => {
    try {
      const res = await fetch('/api/guides');
      const data = await res.json();
      if (data.success) {
        setGuides(data.data);
      }
    } catch (err) {
      console.error('[GuidesPane] Failed to fetch guides:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectGuide = async (name: string) => {
    try {
      const res = await fetch(`/api/guides/${encodeURIComponent(name)}`);
      const data = await res.json();
      if (data.success) {
        setSelectedGuide(data.data);
      }
    } catch (err) {
      console.error('[GuidesPane] Failed to fetch guide:', err);
    }
  };

  const handleDeleteGuide = async (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete guide "${name}"?`)) return;

    setDeleting(name);
    try {
      const res = await fetch(`/api/guides/${encodeURIComponent(name)}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchGuides();
        if (selectedGuide?.name === name) {
          setSelectedGuide(null);
        }
      }
    } catch (err) {
      console.error('[GuidesPane] Failed to delete guide:', err);
    } finally {
      setDeleting(null);
    }
  };

  const handleBack = () => {
    setSelectedGuide(null);
  };

  const systemGuides = guides.filter(g => g.immutable);
  const userGuides = guides.filter(g => !g.immutable);

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'transparent',
      overflow: 'hidden',
    }}>
      <PaneHeader slot={slot} onCollapse={onCollapse} onSwapPanes={onSwapPanes} tabBar={tabBar}>
        {selectedGuide ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handleBack}
              className="app-button app-button--ghost app-button--compact app-button--icon"
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '4px',
              }}
            >
              <ArrowLeft size={16} />
            </button>
            <span style={{ color: 'var(--app-text)', fontSize: '13px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
              {selectedGuide.immutable && <Lock size={12} style={{ color: '#22c55e' }} />}
              {selectedGuide.name}
            </span>
          </div>
        ) : (
          <span style={{ color: 'var(--app-text-muted)', fontSize: '11px' }}>
            {userGuides.length} of 10 custom guides
          </span>
        )}
      </PaneHeader>

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '12px' }}>
        {loading ? (
          <div style={{ color: 'var(--app-text-muted)', fontSize: '13px', textAlign: 'center', paddingTop: '24px' }}>
            Loading...
          </div>
        ) : selectedGuide ? (
          <div className="guide-content app-prose" style={{ fontSize: '13px', lineHeight: '1.6' }}>
            <MarkdownWithNodeTokens content={selectedGuide.content} />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {guides.length === 0 ? (
              <div style={{ color: 'var(--app-text-muted)', fontSize: '13px', textAlign: 'center', paddingTop: '24px' }}>
                No guides found
              </div>
            ) : (
              <>
                {systemGuides.length > 0 && (
                  <div style={{ color: 'var(--app-text-subtle)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '4px 0' }}>
                    System Guides
                  </div>
                )}
                {systemGuides.map((guide) => (
                  <GuideCard
                    key={guide.name}
                    guide={guide}
                    onSelect={handleSelectGuide}
                    onDelete={handleDeleteGuide}
                    deleting={deleting}
                  />
                ))}
                {userGuides.length > 0 && (
                  <div style={{ color: 'var(--app-text-subtle)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '8px 0 4px 0' }}>
                    Custom Guides
                  </div>
                )}
                {userGuides.map((guide) => (
                  <GuideCard
                    key={guide.name}
                    guide={guide}
                    onSelect={handleSelectGuide}
                    onDelete={handleDeleteGuide}
                    deleting={deleting}
                  />
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function GuideCard({
  guide,
  onSelect,
  onDelete,
  deleting,
}: {
  guide: GuideMeta;
  onSelect: (name: string) => void;
  onDelete: (name: string, e: React.MouseEvent) => void;
  deleting: string | null;
}) {
  return (
    <button
      onClick={() => onSelect(guide.name)}
      className="app-button app-panel-elevated"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '12px',
        borderRadius: '8px',
        textAlign: 'left',
      }}
    >
      {guide.immutable && (
        <Lock size={12} style={{ color: '#22c55e', flexShrink: 0 }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ color: 'var(--app-text)', fontSize: '13px', fontWeight: 500 }}>
          {guide.name}
        </span>
        <span style={{ color: 'var(--app-text-muted)', fontSize: '12px', lineHeight: '1.4', display: 'block', marginTop: '2px' }}>
          {guide.description}
        </span>
      </div>
      {!guide.immutable && (
        <button
          onClick={(e) => onDelete(guide.name, e)}
          disabled={deleting === guide.name}
          className="app-button app-button--ghost app-button--compact app-button--icon app-button--danger"
          style={{
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0,
            opacity: deleting === guide.name ? 0.3 : 1,
          }}
        >
          <Trash2 size={14} />
        </button>
      )}
    </button>
  );
}
