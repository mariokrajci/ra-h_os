"use client";

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface Flag { name: string; color: string; }

interface FlagPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFlagSelect: (flag: string) => void;
  availableFlags: Flag[];
  assignedFlags: string[];
}

export default function FlagPickerModal({
  isOpen,
  onClose,
  onFlagSelect,
  availableFlags,
  assignedFlags,
}: FlagPickerModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const unassigned = availableFlags.filter(f => !assignedFlags.includes(f.name));

  const modalContent = (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex', justifyContent: 'center',
        paddingTop: '15vh', zIndex: 9999,
        animation: 'backdropIn 200ms ease-out',
      }}
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '400px',
          animation: 'containerIn 200ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div style={{
          background: '#141414', border: '1px solid #262626',
          borderRadius: '16px', overflow: 'hidden',
          boxShadow: '0 0 0 1px rgba(255,255,255,0.04), 0 24px 48px -12px rgba(0,0,0,0.6)',
        }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #1f1f1f' }}>
            <span style={{ color: '#737373', fontSize: '13px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Add Flag
            </span>
            <kbd
              onClick={onClose}
              style={{
                float: 'right', display: 'inline-flex', alignItems: 'center',
                padding: '3px 8px', background: '#262626', borderRadius: '6px',
                fontSize: '11px', color: '#737373', border: '1px solid #333', cursor: 'pointer',
              }}
            >
              esc
            </kbd>
          </div>

          {unassigned.length === 0 ? (
            <div style={{ padding: '24px 20px', color: '#525252', fontSize: '14px', textAlign: 'center' }}>
              {availableFlags.length === 0
                ? <>No flags defined yet.<br />Create them in Settings → Flags.</>
                : 'All flags already assigned.'}
            </div>
          ) : (
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {unassigned.map(flag => (
                <button
                  key={flag.name}
                  onClick={() => { onFlagSelect(flag.name); onClose(); }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '14px 20px', background: 'transparent', border: 'none',
                    borderBottom: '1px solid #1f1f1f', color: '#e5e5e5',
                    fontSize: '15px', cursor: 'pointer', textAlign: 'left',
                    fontFamily: 'inherit', transition: 'background 100ms ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#1a1a1a'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: flag.color, flexShrink: 0 }} />
                  {flag.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes backdropIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes containerIn {
          from { opacity: 0; transform: scale(0.96) translateY(-8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );

  return typeof window !== 'undefined' ? createPortal(modalContent, document.body) : null;
}
