"use client";

import { useEffect, useState } from 'react';

import type { Node, NodeConnection } from '@/types/database';

interface NodeResponse {
  success: boolean;
  node?: Node;
}

interface EdgeResponse {
  success: boolean;
  data?: NodeConnection[];
}

export function useMobileNodeDetail(nodeId: number, refreshToken: number) {
  const [node, setNode] = useState<Node | null>(null);
  const [connections, setConnections] = useState<NodeConnection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (nodeId < 0) {
      setNode(null);
      setConnections([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadNode() {
      setLoading(true);
      try {
        const [nodeResponse, edgesResponse] = await Promise.all([
          fetch(`/api/nodes/${nodeId}`),
          fetch(`/api/nodes/${nodeId}/edges`),
        ]);

        const nodeJson = await nodeResponse.json() as NodeResponse;
        const edgeJson = await edgesResponse.json() as EdgeResponse;

        if (!cancelled) {
          setNode(nodeJson.success ? nodeJson.node ?? null : null);
          setConnections(edgeJson.success ? edgeJson.data ?? [] : []);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load mobile node detail:', error);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadNode();
    return () => {
      cancelled = true;
    };
  }, [nodeId, refreshToken]);

  return { node, connections, loading, setNode };
}
