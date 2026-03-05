"use client";

import { useRef, useEffect, useState } from 'react';

interface LogGhostEntryProps {
  onCommit: (content: string) => void;
  autoFocus?: boolean;
}

export default function LogGhostEntry({ onCommit, autoFocus }: LogGhostEntryProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    if (autoFocus && divRef.current) {
      divRef.current.focus();
    }
  }, []); // only on mount

  const handleInput = () => {
    setIsEmpty((divRef.current?.textContent ?? '').trim() === '');
  };

  const commit = () => {
    const content = divRef.current?.textContent?.trim() ?? '';
    if (!content) return;
    onCommit(content);
    // Reset
    if (divRef.current) divRef.current.textContent = '';
    setIsEmpty(true);
  };

  const handleBlur = () => {
    commit();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      commit();
      // Keep focus on ghost for next entry
      divRef.current?.focus();
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      {isEmpty && (
        <span
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            color: '#333',
            fontSize: '13px',
            lineHeight: '1.6',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          Write something...
        </span>
      )}
      <div
        ref={divRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        style={{
          outline: 'none',
          fontSize: '13px',
          lineHeight: '1.6',
          color: '#ccc',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          minHeight: '22px',
        }}
      />
    </div>
  );
}
