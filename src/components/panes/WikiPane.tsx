'use client';

import { useCallback, useEffect, useState } from 'react';
import PaneHeader from './PaneHeader';
import type { BasePaneProps } from './types';
import WikiSidebar from '@/components/wiki/WikiSidebar';
import WikiGenerateButton from '@/components/wiki/WikiGenerateButton';
import WikiSubtopicView from '@/components/wiki/WikiSubtopicView';
import WikiArticleView from '@/components/wiki/WikiArticleView';

interface SubtopicItem {
  id: number;
  title: string;
  node_count: number;
  article_status: string;
}

interface TopicItem {
  id: number;
  title: string;
  children: SubtopicItem[];
}

interface SubtopicData {
  id: number;
  title: string;
  summary: string | null;
  article: string | null;
  article_status: string;
  article_generated_at: string | null;
  generated_at: string | null;
  nodes: Array<{ id: number; title: string; description?: string; role?: 'derived' | 'source' | 'unknown' }>;
  citations: Array<{
    id: number;
    title: string;
    description?: string;
    connection_count_to_subtopic: number;
    last_edge_created_at: string | null;
  }>;
}

interface WikiPaneProps extends BasePaneProps {
  onNodeClick: (nodeId: number) => void;
}

export default function WikiPane({
  slot,
  onCollapse,
  onSwapPanes,
  onNodeClick,
}: WikiPaneProps) {
  const [topics, setTopics] = useState<TopicItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [subtopic, setSubtopic] = useState<SubtopicData | null>(null);
  const [showArticle, setShowArticle] = useState(false);
  const [loading, setLoading] = useState(false);

  const [fetchError, setFetchError] = useState('');

  const fetchTopics = useCallback(async () => {
    try {
      const res = await fetch('/api/wiki/topics');
      const json = await res.json();
      if (json.success) {
        setTopics(json.data || []);
        // Auto-select first subtopic only when nothing is selected yet
        setSelectedId((prev) => {
          if (!prev && json.data?.[0]?.children?.[0]) {
            return json.data[0].children[0].id;
          }
          return prev;
        });
      }
    } catch {
      setFetchError('Failed to load wiki topics.');
    }
  }, []); // no deps — selectedId checked via functional setState

  useEffect(() => {
    fetchTopics();
  }, [fetchTopics]);

  useEffect(() => {
    if (!selectedId) return;

    setLoading(true);
    setShowArticle(false);

    fetch(`/api/wiki/${selectedId}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setSubtopic(json.data);
          if (json.data.article_status === 'ready' && json.data.article) {
            setShowArticle(true);
          }
        } else {
          setFetchError('Failed to load subtopic.');
        }
      })
      .catch(() => setFetchError('Failed to load subtopic.'))
      .finally(() => setLoading(false));
  }, [selectedId]);

  const parentTopic = topics.find((topic) => topic.children.some((child) => child.id === selectedId));
  const breadcrumb = parentTopic && subtopic ? `${parentTopic.title} / ${subtopic.title}` : undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'transparent', overflow: 'hidden' }}>
      <PaneHeader slot={slot} onCollapse={onCollapse} onSwapPanes={onSwapPanes}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: '#d5d5d5', fontSize: 13, fontWeight: 600 }}>Wiki</span>
          <WikiGenerateButton onComplete={fetchTopics} />
        </div>
      </PaneHeader>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ width: 240, borderRight: '1px solid #222', overflowY: 'auto', flexShrink: 0 }}>
          <WikiSidebar topics={topics} selectedId={selectedId} onSelect={setSelectedId} />
        </div>

        <div style={{ flex: 1, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ color: '#8a8a8a', fontSize: 12, padding: 24 }}>Loading...</div>
          ) : subtopic && showArticle && subtopic.article ? (
            <WikiArticleView
              title={subtopic.title}
              article={subtopic.article}
              breadcrumb={breadcrumb}
              generatedAt={subtopic.article_generated_at}
              onBack={() => setShowArticle(false)}
            />
          ) : subtopic ? (
            <WikiSubtopicView
              id={subtopic.id}
              title={subtopic.title}
              summary={subtopic.summary}
              articleStatus={subtopic.article_status}
              nodes={subtopic.nodes}
              citations={subtopic.citations || []}
              breadcrumb={breadcrumb}
              generatedAt={subtopic.generated_at}
              onNodeClick={onNodeClick}
              onArticleReady={(article, articleGeneratedAt) => {
                setSubtopic((prev) => prev
                  ? {
                    ...prev,
                    article,
                    article_status: 'ready',
                    article_generated_at: articleGeneratedAt,
                  }
                  : prev);
                setShowArticle(true);
              }}
            />
          ) : fetchError ? (
            <div style={{ color: '#ef4444', fontSize: 12, padding: 24 }}>{fetchError}</div>
          ) : (
            <div style={{ color: '#8a8a8a', fontSize: 12, padding: 24 }}>
              Select a topic from the sidebar, or refresh to build wiki.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
