"use client";

import { useState, useEffect } from 'react';
import { Trash2, Plus } from 'lucide-react';

const PRESET_COLORS = ['#6b7280', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];

interface Flag { name: string; color: string; created_at: string; }

export default function FlagsViewer() {
  const [flags, setFlags] = useState<Flag[]>([]);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#6b7280');
  const [loading, setLoading] = useState(false);

  const fetchFlags = async () => {
    const res = await fetch('/api/flags');
    const data = await res.json();
    if (data.success) setFlags(data.flags);
  };

  useEffect(() => { fetchFlags(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setLoading(true);
    await fetch('/api/flags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), color: newColor }),
    });
    setNewName('');
    setNewColor('#6b7280');
    await fetchFlags();
    setLoading(false);
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`Remove flag "${name}" from all nodes?`)) return;
    await fetch(`/api/flags/${encodeURIComponent(name)}`, { method: 'DELETE' });
    await fetchFlags();
  };

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ fontSize: '12px', color: 'var(--app-text-muted)' }}>
        Flags are workflow labels you assign to nodes — separate from dimensions. Use them to track status like &quot;to-read&quot; or &quot;active&quot;.
      </div>

      {/* Existing flags */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {flags.length === 0 && (
          <div style={{ fontSize: '12px', color: 'var(--app-text-subtle)', padding: '8px 0' }}>No flags defined yet.</div>
        )}
        {flags.map(flag => (
          <div key={flag.name} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '6px', background: 'var(--app-surface-subtle)' }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: flag.color, flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: '13px', color: 'var(--app-text)' }}>{flag.name}</span>
            <button
              onClick={() => handleDelete(flag.name)}
              className="app-button app-button--ghost app-button--compact"
              style={{ padding: '4px' }}
            >
              <Trash2 size={12} style={{ color: 'var(--app-text-subtle)' }} />
            </button>
          </div>
        ))}
      </div>

      {/* New flag form */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '8px', borderTop: '1px solid var(--app-border)' }}>
        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
          {PRESET_COLORS.map(c => (
            <button
              key={c}
              onClick={() => setNewColor(c)}
              style={{
                width: 16, height: 16, borderRadius: '50%', background: c, border: 'none', cursor: 'pointer',
                outline: newColor === c ? `2px solid var(--app-text)` : 'none', outlineOffset: '1px',
              }}
            />
          ))}
        </div>
        <input
          type="text"
          placeholder="Flag name…"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
          style={{
            flex: 1, padding: '6px 10px', fontSize: '12px', borderRadius: '4px',
            background: 'var(--app-input)', border: '1px solid var(--app-border)',
            color: 'var(--app-text)', outline: 'none',
          }}
        />
        <button
          onClick={handleCreate}
          disabled={!newName.trim() || loading}
          className="app-button app-button--compact"
          style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}
        >
          <Plus size={12} />
          Add
        </button>
      </div>
    </div>
  );
}
