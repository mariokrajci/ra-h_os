"use client";

import { useState } from 'react';
import { X } from 'lucide-react';
import { PaneHeaderProps } from './types';

export default function PaneHeader({
  slot,
  onCollapse,
  onSwapPanes,
  children
}: PaneHeaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragStart = (e: React.DragEvent) => {
    if (!slot) return;
    e.dataTransfer.setData('application/x-rah-pane', slot);
    e.dataTransfer.effectAllowed = 'move';
    setIsDragging(true);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('application/x-rah-pane')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const sourceSlot = e.dataTransfer.getData('application/x-rah-pane');
    if (sourceSlot && sourceSlot !== slot && onSwapPanes) {
      onSwapPanes();
    }
  };

  return (
    <div
      draggable={!!slot && !!onSwapPanes}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 12px',
        background: isDragOver ? 'var(--app-selected)' : 'transparent',
        minHeight: '44px',
        cursor: slot && onSwapPanes ? 'grab' : 'default',
        opacity: isDragging ? 0.5 : 1,
        borderRadius: isDragOver ? '6px' : '0',
        transition: 'background 0.15s ease',
      }}
    >
      {/* Children (tabs, etc.) - takes up available space */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0 }}>
        {children}
      </div>

      {/* Close button (when onCollapse is provided) */}
      {onCollapse && (
        <button
          onClick={onCollapse}
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            border: '1px solid var(--app-border)',
            background: 'var(--app-input)',
            color: 'var(--app-text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            flexShrink: 0,
          }}
          title="Close pane"
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--app-hover)';
            e.currentTarget.style.borderColor = 'var(--app-border)';
            e.currentTarget.style.color = 'var(--app-text)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--app-input)';
            e.currentTarget.style.borderColor = 'var(--app-border)';
            e.currentTarget.style.color = 'var(--app-text-muted)';
          }}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
