'use client';

import { useState } from 'react';

interface Subtopic {
  id: number;
  title: string;
  node_count: number;
  article_status: string;
}

interface Topic {
  id: number;
  title: string;
  children: Subtopic[];
}

interface Props {
  topics: Topic[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

export default function WikiSidebar({ topics, selectedId, onSelect }: Props) {
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

  const toggle = (topicId: number) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(topicId)) next.delete(topicId);
      else next.add(topicId);
      return next;
    });
  };

  if (!topics.length) {
    return (
      <div style={{ padding: 14, color: '#8a8a8a', fontSize: 12 }}>
        No wiki yet. Refresh to build.
      </div>
    );
  }

  return (
    <nav style={{ height: '100%', overflowY: 'auto', padding: '8px 0' }}>
      {topics.map((topic) => (
        <div key={topic.id}>
          <button
            onClick={() => toggle(topic.id)}
            style={{
              width: '100%',
              textAlign: 'left',
              background: 'none',
              border: 'none',
              color: '#8a8a8a',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.04em',
              padding: '4px 14px',
              cursor: 'pointer',
            }}
          >
            {collapsed.has(topic.id) ? '+' : '-'} {topic.title}
          </button>

          {!collapsed.has(topic.id) && topic.children.map((subtopic) => (
            <button
              key={subtopic.id}
              onClick={() => onSelect(subtopic.id)}
              style={{
                width: '100%',
                textAlign: 'left',
                background: selectedId === subtopic.id ? '#1d1d1d' : 'none',
                border: 'none',
                color: selectedId === subtopic.id ? '#e5e5e5' : '#b8b8b8',
                fontSize: 13,
                padding: '6px 14px 6px 24px',
                cursor: 'pointer',
              }}
            >
              {subtopic.title}
              <span style={{ marginLeft: 6, fontSize: 11, color: '#7a7a7a' }}>
                {subtopic.node_count}
              </span>
              {subtopic.article_status === 'ready' ? (
                <span style={{ marginLeft: 4, fontSize: 10, color: '#7a7a7a' }}>*</span>
              ) : null}
            </button>
          ))}
        </div>
      ))}
    </nav>
  );
}
