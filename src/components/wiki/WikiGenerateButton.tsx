'use client';

import { useState } from 'react';

interface Props {
  onComplete: () => void;
}

export default function WikiGenerateButton({ onComplete }: Props) {
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState('');
  const [cost, setCost] = useState<number | null>(null);

  const run = async () => {
    setRunning(true);
    setMessage('Starting...');
    setCost(null);

    try {
      const res = await fetch('/api/wiki/generate', { method: 'POST' });
      const body = res.body;
      if (!body) {
        throw new Error('No response stream');
      }

      const reader = body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const event of events) {
          const line = event
            .split('\n')
            .find((candidate) => candidate.startsWith('data: '));
          if (!line) continue;

          let data: any;
          try {
            data = JSON.parse(line.slice(6));
          } catch {
            continue; // skip malformed SSE lines
          }

          if (data.stage === 'complete') {
            setCost(typeof data.costUsd === 'number' ? data.costUsd : null);
            setMessage(`Done: ${data.summariesRegenerated || 0} summaries updated`);
            onComplete();
          } else if (data.stage === 'error') {
            setMessage(data.message || 'Generation failed');
          } else if (typeof data.message === 'string') {
            setMessage(data.message);
          }
        }
      }
    } catch (error: any) {
      setMessage(error?.message || 'Generation failed');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button
        onClick={run}
        disabled={running}
        className="app-button app-button--secondary app-button--compact"
        style={{ fontSize: 12 }}
      >
        {running ? 'Refreshing...' : 'Refresh Wiki'}
      </button>
      {message ? (
        <span style={{ fontSize: 12, color: 'var(--app-text-muted)' }}>
          {message}
          {cost !== null ? ` | $${cost.toFixed(4)}` : ''}
        </span>
      ) : null}
    </div>
  );
}
