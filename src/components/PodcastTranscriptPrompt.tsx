'use client';

import { useState, useEffect } from 'react';

interface Props {
  nodeId: number;
  audioUrl?: string;
  durationMinutes?: number;
  onTranscriptStarted?: () => void;
}

export function PodcastTranscriptPrompt({ nodeId, audioUrl, durationMinutes, onTranscriptStarted }: Props) {
  const [loading, setLoading] = useState<'local' | 'api' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<'whisper-small' | 'whisper-medium'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('podcast_whisper_model') as 'whisper-small' | 'whisper-medium') || 'whisper-small';
    }
    return 'whisper-small';
  });
  const [hasOpenAIKey, setHasOpenAIKey] = useState(false);

  useEffect(() => {
    fetch('/api/health')
      .then(res => res.json())
      .then(data => {
        setHasOpenAIKey(data.aiFeatures?.startsWith('enabled') ?? false);
      })
      .catch(() => setHasOpenAIKey(false));
  }, []);

  const hasAudio = !!audioUrl;
  const estimatedCost = durationMinutes ? `~$${(durationMinutes * 0.006).toFixed(2)}` : null;
  const isSpotifyAudio = audioUrl?.includes('scdn.co') || audioUrl?.includes('spotify');

  function handleModelChange(newModel: 'whisper-small' | 'whisper-medium') {
    setModel(newModel);
    localStorage.setItem('podcast_whisper_model', newModel);
  }

  async function triggerASR(method: 'local' | 'api') {
    setLoading(method);
    setError(null);
    try {
      const res = await fetch(`/api/nodes/${nodeId}/podcast-transcript`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method, model }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed: ${res.status}`);
      }
      onTranscriptStarted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(null);
    }
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm space-y-3">
      <p className="text-amber-800 font-medium">No transcript found for this episode.</p>

      {!hasAudio && (
        <p className="text-amber-700 text-xs">
          No audio URL found — transcription is not available for this episode.
        </p>
      )}

      {hasAudio && isSpotifyAudio && (
        <p className="text-amber-700 text-xs">
          Spotify audio streams are DRM-protected and cannot be downloaded for transcription.
        </p>
      )}

      {hasAudio && !isSpotifyAudio && (
        <>
          <div className="flex items-center gap-2 text-xs text-amber-700">
            <span>Local model:</span>
            <select
              value={model}
              onChange={e => handleModelChange(e.target.value as 'whisper-small' | 'whisper-medium')}
              className="border border-amber-300 rounded px-1 py-0.5 bg-white text-amber-800"
            >
              <option value="whisper-small">whisper-small (~150 MB)</option>
              <option value="whisper-medium">whisper-medium (~300 MB, better accuracy)</option>
            </select>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => triggerASR('local')}
              disabled={loading !== null}
              className="px-3 py-1.5 rounded bg-amber-600 text-white text-xs font-medium hover:bg-amber-700 disabled:opacity-50"
            >
              {loading === 'local' ? 'Transcribing\u2026' : 'Transcribe free'}
            </button>

            {hasOpenAIKey && estimatedCost && (
              <button
                onClick={() => triggerASR('api')}
                disabled={loading !== null}
                className="px-3 py-1.5 rounded border border-amber-600 text-amber-700 text-xs font-medium hover:bg-amber-100 disabled:opacity-50"
              >
                {loading === 'api' ? 'Sending to API\u2026' : `Use OpenAI API ${estimatedCost}`}
              </button>
            )}
          </div>
        </>
      )}

      {error && <p className="text-red-600 text-xs">{error}</p>}
    </div>
  );
}
