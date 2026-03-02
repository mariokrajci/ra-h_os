"use client";

import { BookOpen, Moon, Sun, X } from 'lucide-react';

interface BookReaderToolbarProps {
  title: string;
  subtitle?: string;
  percent: number;
  theme: 'warm' | 'dark';
  visible: boolean;
  onToggleTheme: () => void;
  onToggleNav: () => void;
  onClose: () => void;
}

export default function BookReaderToolbar({
  title,
  subtitle,
  percent,
  theme,
  visible,
  onToggleTheme,
  onToggleNav,
  onClose,
}: BookReaderToolbarProps) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        padding: '14px 18px',
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.72), rgba(0,0,0,0))',
        color: '#f5f5f5',
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        transition: 'opacity 200ms ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
        <button
          onClick={onToggleNav}
          style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}
          aria-label="Open reader navigation"
        >
          <BookOpen size={18} />
        </button>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {title}
          </div>
          {subtitle ? (
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.72)' }}>{subtitle}</div>
          ) : null}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.74)' }}>{Math.round(percent)}%</div>
        <button
          onClick={onToggleTheme}
          style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}
          aria-label="Toggle reader theme"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <button
          onClick={onClose}
          style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}
          aria-label="Close reader"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
