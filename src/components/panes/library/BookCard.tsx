"use client";

import { useState } from 'react';
import type { Node } from '@/types/database';
import ProgressRing from './ProgressRing';
import { getBookStatusHint } from './bookStatus';
import { getBookMatchCandidates, type BookMatchCandidate } from './bookMatch';

interface BookCardProps {
  node: Node;
  onOpen: (node: Node) => void;
  onConfirmMatch?: (node: Node, candidate: BookMatchCandidate) => Promise<void> | void;
  onRetryMetadata?: (node: Node) => Promise<void> | void;
}

function gradientForTitle(title: string): string {
  let hash = 0;
  for (let i = 0; i < title.length; i += 1) {
    hash = ((hash << 5) - hash) + title.charCodeAt(i);
    hash |= 0;
  }
  const a = Math.abs(hash) % 360;
  const b = (a + 48) % 360;
  return `linear-gradient(135deg, hsl(${a} 55% 42%), hsl(${b} 45% 24%))`;
}

function resolveCoverSrc(node: Node): string | null {
  const coverUrl = node.metadata?.cover_url;
  if (!coverUrl) return null;
  if (/^https?:\/\//i.test(coverUrl)) return `/api/nodes/${node.id}/cover`;
  return coverUrl;
}

export default function BookCard({ node, onOpen, onConfirmMatch, onRetryMetadata }: BookCardProps) {
  const [imgError, setImgError] = useState(false);
  const title = node.metadata?.book_title || node.title;
  const author = node.metadata?.book_author;
  const cover = !imgError ? resolveCoverSrc(node) : null;
  const percent = node.metadata?.reading_progress?.percent ?? 0;
  const statusHint = getBookStatusHint(node.metadata);
  const candidates = getBookMatchCandidates(node.metadata);
  const [selectedCandidateIndex, setSelectedCandidateIndex] = useState(0);
  const selectedCandidate = candidates[selectedCandidateIndex] || candidates[0] || null;

  return (
    <button
      onClick={() => onOpen(node)}
      className="app-button app-button--ghost"
      style={{
        textAlign: 'left',
        padding: 0,
        width: '100%',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div
          style={{
            width: '100%',
            aspectRatio: '2 / 3',
            borderRadius: '8px',
            overflow: 'hidden',
            boxShadow: '0 10px 28px rgba(0,0,0,0.25)',
            background: gradientForTitle(title),
          }}
        >
          {cover ? (
            <img
              src={cover}
              alt={title}
              onError={() => setImgError(true)}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div style={{ padding: '18px', color: 'rgba(255,255,255,0.92)', fontSize: '14px', lineHeight: 1.35 }}>
              {title}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--app-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {title}
            </div>
            {author ? (
              <div style={{ fontSize: '11px', color: 'var(--app-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {author}
              </div>
            ) : null}
            {statusHint ? (
              <div
                style={{
                  marginTop: '4px',
                  fontSize: '10px',
                  color: statusHint.tone === 'warning' ? 'var(--app-warning-text)' : 'var(--app-text-subtle)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title={statusHint.label}
              >
                {statusHint.label}
              </div>
            ) : null}
            {statusHint?.label === 'Confirm book match' && selectedCandidate && onConfirmMatch ? (
              <div style={{ marginTop: '6px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                {candidates.length > 1 ? (
                  <select
                    value={String(selectedCandidateIndex)}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => setSelectedCandidateIndex(Number(event.target.value))}
                    className="app-input"
                    style={{
                      flex: 1,
                      minWidth: 0,
                      borderRadius: '6px',
                      fontSize: '10px',
                      padding: '2px 4px',
                    }}
                  >
                    {candidates.map((candidate, index) => (
                      <option key={`${candidate.title}-${index}`} value={index}>
                        {candidate.title}
                      </option>
                    ))}
                  </select>
                ) : null}
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    onConfirmMatch(node, selectedCandidate);
                  }}
                  className="app-button app-button--compact"
                  style={{
                    background: 'var(--app-warning-bg)',
                    borderColor: 'var(--app-warning-border)',
                    color: 'var(--app-warning-text)',
                    borderRadius: '6px',
                    padding: '2px 6px',
                    fontSize: '10px',
                  }}
                >
                  Confirm
                </button>
              </div>
            ) : null}
            {statusHint?.label === 'Add author/ISBN to improve match' && onRetryMetadata ? (
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  onRetryMetadata(node);
                }}
                className="app-button app-button--compact"
                style={{
                  marginTop: '6px',
                  background: 'var(--app-surface-subtle)',
                  borderColor: 'var(--app-border)',
                  color: 'var(--app-text-muted)',
                  borderRadius: '6px',
                  padding: '2px 6px',
                  fontSize: '10px',
                }}
              >
                Retry
              </button>
            ) : null}
          </div>
          <ProgressRing percent={percent} />
        </div>
      </div>
    </button>
  );
}
