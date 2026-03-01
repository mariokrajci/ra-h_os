"use client";

import React from 'react';
import { ArrowRight, Trash2 } from 'lucide-react';
import { Annotation } from '@/types/database';

type AnnotationColor = Annotation['color'];

const COLOR_ACCENT: Record<AnnotationColor, { border: string; background: string; glow: string }> = {
  yellow: { border: '#f59e0b', background: 'rgba(245,158,11,0.12)', glow: 'rgba(245,158,11,0.18)' },
  red: { border: '#ef4444', background: 'rgba(239,68,68,0.12)', glow: 'rgba(239,68,68,0.18)' },
  blue: { border: '#3b82f6', background: 'rgba(59,130,246,0.12)', glow: 'rgba(59,130,246,0.18)' },
  green: { border: '#22c55e', background: 'rgba(34,197,94,0.12)', glow: 'rgba(34,197,94,0.18)' },
};

interface HighlightBlockProps {
  annotation: Annotation;
  onJumpToSource: (text: string, matchIndex: number) => void;
  onDelete: (id: number) => void;
}

export default function HighlightBlock({ annotation, onJumpToSource, onDelete }: HighlightBlockProps) {
  const accent = COLOR_ACCENT[annotation.color];

  return (
    <div
      data-highlight-block="compact"
      style={{
        borderLeft: `3px solid ${accent.border}`,
        background: accent.background,
        boxShadow: `inset 0 -1px 0 ${accent.glow}`,
        borderRadius: '0 4px 4px 0',
        padding: '8px 12px',
        margin: '8px 0',
      }}
    >
      <p style={{ margin: 0, color: '#d4d4d8', fontSize: '13px', lineHeight: 1.6, fontStyle: 'italic' }}>
        &quot;{annotation.text}&quot;
      </p>

      <div style={{ display: 'flex', gap: '8px', marginTop: '6px', alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => onJumpToSource(annotation.text, annotation.occurrence_index)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#666',
            fontSize: '11px',
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
            padding: 0,
          }}
        >
          <ArrowRight size={10} />
          Jump to source
        </button>
        <button
          type="button"
          aria-label="Delete highlight"
          onClick={() => onDelete(annotation.id)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#444',
            display: 'flex',
            alignItems: 'center',
            padding: 0,
          }}
        >
          <Trash2 size={10} />
        </button>
      </div>
    </div>
  );
}
