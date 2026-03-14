"use client";

import QuickAddInput from '@/components/agents/QuickAddInput';

export default function MobileCaptureScreen({
  onBack,
  onSubmit,
}: {
  onBack: () => void;
  onSubmit: (payload: {
    input: string;
    mode: 'link' | 'note' | 'chat';
    description?: string;
    bookSelection?: {
      title: string;
      author?: string;
      isbn?: string;
      cover_url?: string;
      publisher?: string;
      first_published_year?: number;
      page_count?: number;
    };
  }) => Promise<void>;
}) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--app-bg)', color: 'var(--app-text)', padding: '14px 16px 92px' }}>
      <button type="button" className="app-button app-button--ghost app-button--compact" onClick={onBack}>Back</button>
      <div style={{ marginTop: '18px', fontSize: '28px', fontWeight: 650 }}>Capture</div>
      <div style={{ marginTop: '8px', color: 'var(--app-text-muted)', fontSize: '14px' }}>
        Paste a link, write a note, or drop a PDF/EPUB.
      </div>
      <div style={{ marginTop: '18px' }}>
        <QuickAddInput isOpen onClose={onBack} onSubmit={onSubmit} />
      </div>
    </div>
  );
}
