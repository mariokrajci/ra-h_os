"use client";

import { useRef, useState } from 'react';
import { ChevronLeft } from 'lucide-react';

type CaptureMode = 'note' | 'link';

export default function MobileCaptureScreen({
  onBack,
  onSubmit,
  animation,
}: {
  onBack: () => void;
  onSubmit: (payload: {
    input: string;
    mode: 'link' | 'note' | 'chat';
    description?: string;
  }) => Promise<void>;
  animation: string | undefined;
}) {
  const [mode, setMode] = useState<CaptureMode>('note');
  const [noteText, setNoteText] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkDesc, setLinkDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const canSubmit = mode === 'note' ? noteText.trim().length > 0 : linkUrl.trim().length > 0;

  async function handleSubmit() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(
        mode === 'note'
          ? { input: noteText.trim(), mode: 'note' }
          : { input: linkUrl.trim(), mode: 'link', description: linkDesc.trim() || undefined }
      );
    } finally {
      setSubmitting(false);
    }
  }

  function growTextarea(el: HTMLTextAreaElement) {
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--app-bg)', color: 'var(--app-text)', animation }}>
      {/* Header */}
      <div style={{
        background: 'color-mix(in srgb, var(--app-bg) 88%, transparent)',
        backdropFilter: 'blur(16px)',
        borderBottom: '0.5px solid var(--app-border)',
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        minHeight: '52px',
      }}>
        <button
          type="button"
          className="app-button app-button--ghost app-button--compact"
          style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '6px 8px 6px 4px', flexShrink: 0 }}
          onClick={onBack}
        >
          <ChevronLeft size={18} />
          Notes
        </button>

        {/* Mode toggle tabs */}
        <div style={{ display: 'flex', gap: '20px', flex: 1, justifyContent: 'center' }}>
          {(['note', 'link'] as CaptureMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              style={{
                fontSize: '15px',
                fontWeight: mode === m ? 600 : 400,
                color: mode === m ? 'var(--app-text)' : 'var(--app-text-muted)',
                background: 'transparent',
                border: 'none',
                borderBottom: mode === m ? '2px solid var(--toolbar-accent)' : '2px solid transparent',
                padding: '4px 0',
                cursor: 'pointer',
                transition: 'color 0.15s, border-color 0.15s',
                textTransform: 'capitalize',
              }}
            >
              {m}
            </button>
          ))}
        </div>

        {/* Spacer */}
        <div style={{ width: '72px' }} />
      </div>

      {/* Form */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px', paddingBottom: '120px' }}>
        {mode === 'note' ? (
          <textarea
            ref={textareaRef}
            autoFocus
            value={noteText}
            onChange={(e) => {
              setNoteText(e.target.value);
              growTextarea(e.target);
            }}
            placeholder="Write a note…"
            style={{
              width: '100%',
              minHeight: '200px',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: '18px',
              lineHeight: 1.7,
              color: 'var(--app-text)',
              resize: 'none',
              fontFamily: 'ui-sans-serif, -apple-system, system-ui, sans-serif',
            }}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <input
              autoFocus
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="Paste a link…"
              className="app-input"
              style={{ padding: '14px 16px', fontSize: '16px' }}
            />
            <textarea
              value={linkDesc}
              onChange={(e) => setLinkDesc(e.target.value)}
              placeholder="Description (optional)"
              className="app-input"
              style={{ padding: '14px 16px', fontSize: '15px', minHeight: '100px', resize: 'none' }}
            />
          </div>
        )}
      </div>

      {/* Submit button — fixed above safe area */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '12px 16px calc(24px + env(safe-area-inset-bottom))',
        background: 'color-mix(in srgb, var(--app-bg) 92%, transparent)',
        backdropFilter: 'blur(16px)',
        borderTop: '0.5px solid var(--app-border)',
      }}>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          style={{
            width: '100%',
            height: '52px',
            borderRadius: '999px',
            background: canSubmit ? 'var(--toolbar-accent)' : 'var(--app-panel)',
            color: canSubmit ? '#fff' : 'var(--app-text-muted)',
            border: 'none',
            fontSize: '16px',
            fontWeight: 600,
            cursor: canSubmit ? 'pointer' : 'default',
            transition: 'background 0.15s, color 0.15s',
            fontFamily: 'ui-sans-serif, -apple-system, system-ui, sans-serif',
          }}
        >
          {submitting ? 'Saving…' : mode === 'note' ? 'Save note' : 'Save link'}
        </button>
      </div>
    </div>
  );
}
