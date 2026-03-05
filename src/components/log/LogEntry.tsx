"use client";

import { useState, useRef, useEffect } from 'react';
import { LogEntry as LogEntryType } from '@/types/database';
import { ArrowUpRight, Trash2 } from 'lucide-react';

interface LogEntryProps {
  entry: LogEntryType;
  onSave: (id: number, content: string) => void;
  onDelete: (id: number) => void;
  onPromote: (id: number) => void;
  onEnterAtEnd: (afterId: number) => void;
  onNodeOpen?: (nodeId: number) => void;
  autoFocus?: boolean;
}

export default function LogEntry({
  entry,
  onSave,
  onDelete,
  onPromote,
  onEnterAtEnd,
  onNodeOpen,
  autoFocus,
}: LogEntryProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (divRef.current && divRef.current !== document.activeElement) {
      divRef.current.textContent = entry.content;
    }
  }, [entry.content]);

  useEffect(() => {
    if (autoFocus && divRef.current) {
      divRef.current.focus();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBlur = () => {
    const current = divRef.current?.textContent ?? '';
    if (current !== entry.content) {
      onSave(entry.id, current);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      const el = divRef.current;
      if (!el) return;
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      const endRange = document.createRange();
      endRange.selectNodeContents(el);
      endRange.collapse(false);
      const isAtEnd = range.compareBoundaryPoints(Range.END_TO_END, endRange) >= 0;
      if (isAtEnd) {
        e.preventDefault();
        onSave(entry.id, el.textContent ?? '');
        onEnterAtEnd(entry.id);
      }
    }
  };

  if (entry.promoted_node_id) {
    return (
      <div
        style={{
          padding: '4px 0',
          color: '#555',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <span style={{ textDecoration: 'line-through', whiteSpace: 'pre-wrap' }}>
          {entry.content.split('\n')[0].replace(/^[-*+]\s+/, '').slice(0, 60)}
        </span>
        <button
          onClick={() => onNodeOpen?.(entry.promoted_node_id!)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#22c55e', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '2px',
          }}
        >
          <ArrowUpRight size={12} /> promoted
        </button>
      </div>
    );
  }

  return (
    <div
      style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', gap: '8px' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        ref={divRef}
        contentEditable
        suppressContentEditableWarning
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        style={{
          flex: 1,
          outline: 'none',
          fontSize: '13px',
          lineHeight: '1.6',
          color: '#ccc',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          padding: '2px 0',
          minHeight: '20px',
        }}
      />
      <div
        style={{
          display: 'flex',
          gap: '4px',
          paddingTop: '2px',
          flexShrink: 0,
          opacity: hovered ? 1 : 0,
          transition: 'opacity 0.1s',
        }}
      >
        <button
          onClick={() => onPromote(entry.id)}
          title="Promote to node"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: '2px' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#22c55e')}
          onMouseLeave={e => (e.currentTarget.style.color = '#555')}
        >
          <ArrowUpRight size={14} />
        </button>
        <button
          onClick={() => onDelete(entry.id)}
          title="Delete"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: '2px' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
          onMouseLeave={e => (e.currentTarget.style.color = '#555')}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
