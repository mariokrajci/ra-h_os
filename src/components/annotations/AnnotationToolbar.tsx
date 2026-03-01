"use client";

import { useState, useEffect, useRef } from 'react';
import { MessageSquare, X } from 'lucide-react';

export type AnnotationColor = 'yellow' | 'red' | 'blue' | 'green';

interface AnnotationToolbarProps {
  position: { x: number; y: number };
  onAnnotate: (color: AnnotationColor, comment?: string) => void;
  onDismiss: () => void;
}

const COLOR_MAP: Record<AnnotationColor, string> = {
  yellow: '#f59e0b',
  red:    '#ef4444',
  blue:   '#3b82f6',
  green:  '#22c55e',
};

export default function AnnotationToolbar({ position, onAnnotate, onDismiss }: AnnotationToolbarProps) {
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState('');
  const [pendingColor, setPendingColor] = useState<AnnotationColor>('yellow');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showComment) inputRef.current?.focus();
  }, [showComment]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onDismiss]);

  const handleColorClick = (color: AnnotationColor) => {
    onAnnotate(color);
    onDismiss();
  };

  const handleCommentSubmit = () => {
    onAnnotate(pendingColor, comment.trim() || undefined);
    onDismiss();
  };

  const style: React.CSSProperties = {
    position: 'fixed',
    top: position.y,
    left: position.x,
    zIndex: 9999,
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '6px',
    padding: '6px 8px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
    transform: 'translateX(-50%) translateY(-110%)',
  };

  return (
    <div style={style}>
      {!showComment ? (
        <>
          {(Object.entries(COLOR_MAP) as [AnnotationColor, string][]).map(([color, hex]) => (
            <button
              key={color}
              title={color}
              onClick={() => handleColorClick(color)}
              style={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: hex,
                border: '2px solid transparent',
                cursor: 'pointer',
                padding: 0,
                transition: 'transform 0.1s',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.2)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
            />
          ))}
          <div style={{ width: 1, height: 16, background: '#333', margin: '0 2px' }} />
          <button
            title="Add comment"
            onClick={() => setShowComment(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', display: 'flex', alignItems: 'center', padding: '2px' }}
          >
            <MessageSquare size={14} />
          </button>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '4px' }}>
            {(Object.keys(COLOR_MAP) as AnnotationColor[]).map((color) => (
              <button
                key={color}
                onClick={() => setPendingColor(color)}
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: COLOR_MAP[color],
                  border: pendingColor === color ? '2px solid #fff' : '2px solid transparent',
                  cursor: 'pointer',
                  padding: 0,
                }}
              />
            ))}
          </div>
          <input
            ref={inputRef}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCommentSubmit();
              if (e.key === 'Escape') onDismiss();
            }}
            placeholder="Add comment… (Enter to save)"
            style={{
              background: '#111',
              border: '1px solid #333',
              borderRadius: '4px',
              color: '#e5e5e5',
              fontSize: '12px',
              padding: '3px 8px',
              width: '200px',
              outline: 'none',
            }}
          />
          <button
            onClick={handleCommentSubmit}
            style={{ background: '#22c55e', color: '#000', border: 'none', borderRadius: '4px', padding: '3px 8px', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}
          >
            Save
          </button>
          <button
            onClick={onDismiss}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666', display: 'flex', alignItems: 'center' }}
          >
            <X size={12} />
          </button>
        </>
      )}
    </div>
  );
}
