"use client";

import React from 'react';
import { Trash2, ArrowRight } from 'lucide-react';
import { Annotation } from '@/types/database';

type AnnotationColor = Annotation['color'];

const COLOR_BORDER: Record<AnnotationColor, string> = {
  yellow: '#f59e0b',
  red:    '#ef4444',
  blue:   '#3b82f6',
  green:  '#22c55e',
};

const COLOR_BG: Record<AnnotationColor, string> = {
  yellow: 'rgba(245,158,11,0.06)',
  red:    'rgba(239,68,68,0.06)',
  blue:   'rgba(59,130,246,0.06)',
  green:  'rgba(34,197,94,0.06)',
};

interface AnnotationBlockProps {
  annotation: Annotation;
  onJumpToSource: (text: string, matchIndex: number) => void;
  onDelete: (id: number) => void;
}

export default function AnnotationBlock({ annotation, onJumpToSource, onDelete }: AnnotationBlockProps) {
  const border = COLOR_BORDER[annotation.color];
  const bg     = COLOR_BG[annotation.color];

  return (
    <div
      data-annotation-block="full"
      style={{
        borderLeft: `3px solid ${border}`,
        background: bg,
        borderRadius: '0 4px 4px 0',
        padding: '8px 12px',
        margin: '8px 0',
      }}
    >
      <p style={{ margin: 0, color: '#ccc', fontSize: '13px', lineHeight: 1.6, fontStyle: 'italic' }}>
        &quot;{annotation.text}&quot;
      </p>

      {annotation.comment != null && annotation.comment.length > 0 && (
        <p style={{ margin: '6px 0 0', color: '#aaa', fontSize: '12px', lineHeight: 1.5 }}>
          {annotation.comment}
        </p>
      )}

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
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#aaa'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#666'; }}
        >
          <ArrowRight size={10} />
          Jump to source
        </button>
        <button
          type="button"
          aria-label="Delete annotation"
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
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#ef4444'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#444'; }}
        >
          <Trash2 size={10} />
        </button>
      </div>
    </div>
  );
}
