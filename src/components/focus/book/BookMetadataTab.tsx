import { Check, Loader, Pencil, RefreshCw, Save, X } from 'lucide-react';
import type { NodeMetadata } from '@/types/database';
import type { BookMatchCandidate } from '@/components/panes/library/bookMatch';

interface MetadataEditValue {
  title: string;
  author: string;
  isbn: string;
}

interface BookMetadataTabProps {
  metadata: NodeMetadata;
  editMode: boolean;
  saving: boolean;
  retrying: boolean;
  confirming: boolean;
  editValue: MetadataEditValue;
  candidates: BookMatchCandidate[];
  selectedCandidateIndex: number;
  onEditValueChange: (next: MetadataEditValue) => void;
  onSelectedCandidateChange: (index: number) => void;
  onRetry: () => void;
  onConfirmCandidate: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
}

export function BookMetadataTab({
  metadata,
  editMode,
  saving,
  retrying,
  confirming,
  editValue,
  candidates,
  selectedCandidateIndex,
  onEditValueChange,
  onSelectedCandidateChange,
  onRetry,
  onConfirmCandidate,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
}: BookMetadataTabProps) {
  const updateField = (field: keyof MetadataEditValue, value: string) => {
    onEditValueChange({ ...editValue, [field]: value });
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', overflow: 'auto', padding: '4px' }}>
      {!editMode && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={onRetry}
            disabled={retrying}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              fontSize: '10px',
              color: '#facc15',
              background: 'transparent',
              border: '1px solid #713f12',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            {retrying ? <Loader size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            Retry enrichment
          </button>
          {candidates.length > 0 && (
            <button
              onClick={onConfirmCandidate}
              disabled={confirming}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 8px',
                fontSize: '10px',
                color: '#22c55e',
                background: 'transparent',
                border: '1px solid #166534',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              {confirming ? <Loader size={12} className="animate-spin" /> : <Check size={12} />}
              Confirm candidate
            </button>
          )}
          <button
            onClick={onStartEdit}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              fontSize: '10px',
              color: '#888',
              background: 'transparent',
              border: '1px solid #2a2a2a',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            <Pencil size={12} />
            Edit
          </button>
        </div>
      )}

      {editMode ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '560px' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px', color: '#777' }}>
            Title
            <input
              value={editValue.title}
              onChange={(e) => updateField('title', e.target.value)}
              placeholder="Book title"
              style={{
                background: 'transparent',
                border: '1px solid #2a2a2a',
                borderRadius: '4px',
                color: '#ddd',
                fontSize: '12px',
                padding: '8px 10px',
                outline: 'none',
              }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px', color: '#777' }}>
            Author
            <input
              value={editValue.author}
              onChange={(e) => updateField('author', e.target.value)}
              placeholder="Author name"
              style={{
                background: 'transparent',
                border: '1px solid #2a2a2a',
                borderRadius: '4px',
                color: '#ddd',
                fontSize: '12px',
                padding: '8px 10px',
                outline: 'none',
              }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px', color: '#777' }}>
            ISBN
            <input
              value={editValue.isbn}
              onChange={(e) => updateField('isbn', e.target.value)}
              placeholder="ISBN-10 or ISBN-13"
              style={{
                background: 'transparent',
                border: '1px solid #2a2a2a',
                borderRadius: '4px',
                color: '#ddd',
                fontSize: '12px',
                padding: '8px 10px',
                outline: 'none',
              }}
            />
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              onClick={onCancelEdit}
              disabled={saving}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 12px',
                fontSize: '11px',
                color: '#888',
                background: 'transparent',
                border: '1px solid #2a2a2a',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              <X size={14} />
              Cancel
            </button>
            <button
              onClick={onSaveEdit}
              disabled={saving}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 12px',
                fontSize: '11px',
                color: '#000',
                background: '#22c55e',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              {saving ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
              Save
            </button>
          </div>
        </div>
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '10px',
            }}
          >
            <div style={{ border: '1px solid #1f1f1f', borderRadius: '6px', padding: '10px' }}>
              <div style={{ fontSize: '10px', color: '#666', marginBottom: '4px' }}>Enrichment status</div>
              <div style={{ fontSize: '13px', color: '#ddd' }}>{String(metadata.book_metadata_status || 'none')}</div>
              {typeof metadata.book_match_confidence === 'number' && (
                <div style={{ fontSize: '11px', color: '#777', marginTop: '4px' }}>
                  Confidence: {Math.round(metadata.book_match_confidence * 100)}%
                </div>
              )}
              {metadata.book_match_source && (
                <div style={{ fontSize: '11px', color: '#777', marginTop: '2px' }}>
                  Match source: {String(metadata.book_match_source)}
                </div>
              )}
            </div>
            <div style={{ border: '1px solid #1f1f1f', borderRadius: '6px', padding: '10px' }}>
              <div style={{ fontSize: '10px', color: '#666', marginBottom: '4px' }}>Cover</div>
              <div style={{ fontSize: '13px', color: '#ddd' }}>{String(metadata.cover_source || 'none')}</div>
              <div style={{ fontSize: '11px', color: '#777', marginTop: '4px' }}>
                Locked: {metadata.book_metadata_locked?.cover ? 'yes' : 'no'}
              </div>
              {typeof metadata.cover_url === 'string' && metadata.cover_url.trim().length > 0 && (
                <a
                  href={metadata.cover_url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: '#7dd3fc', fontSize: '11px', textDecoration: 'none' }}
                >
                  Open cover URL
                </a>
              )}
            </div>
          </div>

          <div style={{ border: '1px solid #1f1f1f', borderRadius: '6px', padding: '10px' }}>
            <div style={{ fontSize: '11px', color: '#888', marginBottom: '10px' }}>Book fields</div>
            <div style={{ display: 'grid', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                <span style={{ color: '#666', fontSize: '11px' }}>Title</span>
                <span style={{ color: '#ddd', fontSize: '12px' }}>{String(metadata.book_title || '—')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                <span style={{ color: '#666', fontSize: '11px' }}>Author</span>
                <span style={{ color: '#ddd', fontSize: '12px' }}>{String(metadata.book_author || '—')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                <span style={{ color: '#666', fontSize: '11px' }}>ISBN</span>
                <span style={{ color: '#ddd', fontSize: '12px' }}>{String(metadata.book_isbn || '—')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                <span style={{ color: '#666', fontSize: '11px' }}>Locks</span>
                <span style={{ color: '#aaa', fontSize: '11px' }}>
                  title:{metadata.book_metadata_locked?.title ? 'on' : 'off'} | author:{metadata.book_metadata_locked?.author ? 'on' : 'off'} | isbn:{metadata.book_metadata_locked?.isbn ? 'on' : 'off'} | cover:{metadata.book_metadata_locked?.cover ? 'on' : 'off'}
                </span>
              </div>
            </div>
          </div>

          {candidates.length > 0 && (
            <div style={{ border: '1px solid #1f1f1f', borderRadius: '6px', padding: '10px' }}>
              <div style={{ fontSize: '11px', color: '#888', marginBottom: '8px' }}>Candidates</div>
              <select
                value={selectedCandidateIndex}
                onChange={(e) => onSelectedCandidateChange(Number(e.target.value))}
                style={{
                  width: '100%',
                  background: '#111',
                  border: '1px solid #2a2a2a',
                  borderRadius: '4px',
                  color: '#ddd',
                  fontSize: '12px',
                  padding: '8px',
                  outline: 'none',
                }}
              >
                {candidates.map((candidate, index) => (
                  <option key={`${candidate.title}-${candidate.isbn || index}`} value={index}>
                    {candidate.title}{candidate.author ? ` — ${candidate.author}` : ''}{candidate.isbn ? ` (${candidate.isbn})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </>
      )}
    </div>
  );
}
