"use client";

import React, { useState, useEffect, useMemo, useRef, type DragEvent } from 'react';
import { Eye, Trash2, Link, Loader, Database, RefreshCw, Pencil, X, Save, Plus, BookOpen, ExternalLink, Sparkles } from 'lucide-react';
import { parseAndRenderContent } from '@/components/helpers/NodeLabelRenderer';
import MarkdownWithNodeTokens from '@/components/helpers/MarkdownWithNodeTokens';
import AnnotationToolbar, { AnnotationColor } from '@/components/annotations/AnnotationToolbar';
import FormattingToolbar from '@/components/focus/FormattingToolbar';
import { parseNodeMarkers } from '@/tools/infrastructure/nodeFormatter';
import { Node, NodeConnection, Chunk, Annotation } from '@/types/database';
import DimensionTags from './dimensions/DimensionTags';
import { getNodeIcon } from '@/utils/nodeIcons';
import { useDimensionIcons } from '@/context/DimensionIconsContext';
import ConfirmDialog from '../common/ConfirmDialog';
import { SourceReader } from './source';
import { BookReader, type ReaderAnnotationInput } from './reader';
import { FOCUS_PANEL_BODY_TEXT_STYLE, FOCUS_PANEL_BODY_TEXTAREA_STYLE } from './focusPanelStyles';
import { getQuotaWarningMessage, isInsufficientQuotaError } from '@/services/embedding/errors';
import { getNodeNotesStatus, getNodeSourceStatus } from './nodeIngestionStatus';
import { applyBookMatchCandidate, getBookMatchCandidates } from '@/components/panes/library/bookMatch';
import { BookMetadataTab } from './book/BookMetadataTab';
import { stripLeadingDuplicateTitle } from './contentNormalization';

interface PopularDimension {
  dimension: string;
  count: number;
  isPriority: boolean;
}

interface DimensionsResponse {
  success: boolean;
  data: PopularDimension[];
}

interface NodeSearchResult {
  id: number;
  title: string;
  dimensions?: string[];
}

interface EdgeProposalResult {
  sourceNodeId: number;
  targetNodeId: number;
  targetNodeTitle: string;
  reason: string;
  matchedText: string;
}

interface FocusPanelProps {
  openTabs: number[];
  activeTab: number | null;
  onTabSelect: (nodeId: number) => void;
  onNodeClick?: (nodeId: number) => void;
  onTabClose: (nodeId: number) => void;
  refreshTrigger?: number;
  onReorderTabs?: (fromIndex: number, toIndex: number) => void;
  onOpenInOtherSlot?: (nodeId: number) => void;
  hideTabBar?: boolean;
  onTextSelect?: (nodeId: number, nodeTitle: string, text: string) => void;
  highlightedPassage?: { nodeId: number; selectedText: string } | null;
}

interface IngestionResult {
  success?: boolean;
  error?: string;
  errorCode?: string;
  node_embedding?: { status?: string };
  chunk_embeddings?: { status?: string; chunks_created?: number };
}

export default function FocusPanel({ openTabs, activeTab, onTabSelect, onNodeClick, onTabClose, refreshTrigger, onOpenInOtherSlot, hideTabBar, onTextSelect, highlightedPassage }: FocusPanelProps) {
  const { dimensionIcons } = useDimensionIcons();
  const [nodesData, setNodesData] = useState<Record<number, Node>>({});

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tabId: number } | null>(null); 
  const [loadingNodes, setLoadingNodes] = useState<Set<number>>(new Set());
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const [editingNodeId, setEditingNodeId] = useState<number | null>(null);
  const [savingField, setSavingField] = useState<string | null>(null);
  const [embeddingNode, setEmbeddingNode] = useState<number | null>(null);
  const [showReembedPrompt, setShowReembedPrompt] = useState<number | null>(null);
  const [priorityDimensions, setPriorityDimensions] = useState<string[]>([]);
  
  const activeNodeId = activeTab;
  const currentNode = activeNodeId !== null ? nodesData[activeNodeId] : undefined;
  const notesIngestionStatus = getNodeNotesStatus(currentNode?.metadata);
  const sourceIngestionStatus = getNodeSourceStatus(currentNode?.metadata);
  const normalizedNotesContent = useMemo(
    () => stripLeadingDuplicateTitle(currentNode?.notes || '', currentNode?.title),
    [currentNode?.notes, currentNode?.title]
  );
  const normalizedSourceContent = useMemo(
    () => stripLeadingDuplicateTitle(currentNode?.chunk || '', currentNode?.title),
    [currentNode?.chunk, currentNode?.title]
  );

  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null);

  const renderPendingState = (status: { kind: 'processing' | 'error' | 'idle'; message: string }) => (
    <div
      style={{
        color: status.kind === 'error' ? '#a66' : '#777',
        fontSize: '12px',
        padding: '12px',
        minHeight: '200px',
        border: `1px dashed ${status.kind === 'error' ? '#382222' : '#1f2a1f'}`,
        borderRadius: '4px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        flex: 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {status.kind === 'processing' ? <Loader size={14} className="animate-spin" /> : null}
        <span>{status.message}</span>
      </div>
    </div>
  );

  // Auto-hide re-embed prompt after a few seconds
  useEffect(() => {
    if (showReembedPrompt !== null) {
      const timeout = setTimeout(() => setShowReembedPrompt(null), 4000);
      return () => clearTimeout(timeout);
    }
  }, [showReembedPrompt]);

  // Close context menu when clicking outside
  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = () => setContextMenu(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu]);

  // Edges state management (following same patterns as nodes)
  const [edgesData, setEdgesData] = useState<{ [key: number]: NodeConnection[] }>({});
  const [loadingEdges, setLoadingEdges] = useState<Set<number>>(new Set());
  const [edgeProposalsData, setEdgeProposalsData] = useState<Record<number, EdgeProposalResult[]>>({});
  const [loadingEdgeProposals, setLoadingEdgeProposals] = useState<Set<number>>(new Set());
  const [edgeProposalActionKey, setEdgeProposalActionKey] = useState<string | null>(null);
  const [addingEdge, setAddingEdge] = useState<number | null>(null);
  const [nodeSearchQuery, setNodeSearchQuery] = useState('');
  const [nodeSearchSuggestions, setNodeSearchSuggestions] = useState<NodeSearchResult[]>([]);
  const [selectedSearchIndex, setSelectedSearchIndex] = useState(0);
  const [edgeExplanation, setEdgeExplanation] = useState('');
  const [pendingEdgeTarget, setPendingEdgeTarget] = useState<{ id: number; title: string } | null>(null);
  const [deletingEdge, setDeletingEdge] = useState<number | null>(null);
  const [edgeEditingId, setEdgeEditingId] = useState<number | null>(null);
  const [edgeEditingValue, setEdgeEditingValue] = useState<string>('');
  const [edgeSavingId, setEdgeSavingId] = useState<number | null>(null);
  const [deletingNode, setDeletingNode] = useState<number | null>(null);
  const [pendingDeleteNodeId, setPendingDeleteNodeId] = useState<number | null>(null);
  
  // Chunk content toggle state - default to expanded (true)
  const [chunkExpanded, setChunkExpanded] = useState<{ [key: number]: boolean }>({});
  
  // Edges expand/collapse state
  // edgesExpanded removed — all connections shown in Edges tab
  
  // Connections section collapsed state (default closed)
  const [edgeSearchOpen, setEdgeSearchOpen] = useState(false);
  
  // Description regeneration state
  const [regeneratingDescription, setRegeneratingDescription] = useState<number | null>(null);

  // Content tab state: 'notes', 'edges', 'source', or 'metadata'
  const [activeContentTab, setActiveContentTab] = useState<'notes' | 'edges' | 'source' | 'metadata'>('notes');

  // Desc (description) edit mode state
  const [descEditMode, setDescEditMode] = useState(false);
  const [descEditValue, setDescEditValue] = useState('');
  const [descSaving, setDescSaving] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);

  // Notes edit mode state (separate from inline editing)
  const [notesEditMode, setNotesEditMode] = useState(false);
  const [notesEditValue, setNotesEditValue] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);
  const notesTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Source (chunk) edit mode
  const [sourceEditMode, setSourceEditMode] = useState(false);
  const [sourceEditValue, setSourceEditValue] = useState('');
  const [sourceSaving, setSourceSaving] = useState(false);
  const [metadataEditMode, setMetadataEditMode] = useState(false);
  const [metadataSaving, setMetadataSaving] = useState(false);
  const [metadataRetrying, setMetadataRetrying] = useState(false);
  const [metadataConfirming, setMetadataConfirming] = useState(false);
  const [metadataEditValue, setMetadataEditValue] = useState({ title: '', author: '', isbn: '' });
  const [selectedMetadataCandidateIndex, setSelectedMetadataCandidateIndex] = useState(0);

  // Source reader mode: 'raw' (monospace) or 'reader' (formatted typography)
  const [sourceReaderMode, setSourceReaderMode] = useState<'raw' | 'reader'>('reader');

  const currentMetadata = currentNode?.metadata ?? {};
  const isBookNode = useMemo(() => {
    if (!currentNode) return false;
    const metadata = currentNode.metadata;
    if (!metadata) return false;
    if (metadata.content_kind === 'book') return true;
    if (metadata.file_type === 'pdf' || metadata.file_type === 'epub') return true;
    if (metadata.book_title || metadata.book_author || metadata.book_isbn || metadata.book_metadata_status || metadata.cover_url) return true;
    return false;
  }, [currentNode]);
  const metadataCandidates = useMemo(
    () => getBookMatchCandidates(currentNode?.metadata),
    [currentNode?.metadata],
  );

  // Embedded chunks state (actual chunks from chunks table)
  const [chunksData, setChunksData] = useState<Record<number, Chunk[]>>({});
  const [loadingChunks, setLoadingChunks] = useState<Set<number>>(new Set());
  const [chunksExpanded, setChunksExpanded] = useState<Record<number, boolean>>({});

  // Annotations state
  const [annotationsData, setAnnotationsData] = useState<Record<number, Annotation[]>>({});
  const [pendingAnnotation, setPendingAnnotation] = useState<{
    text: string;
    charOffset: number;
    position: { x: number; y: number };
  } | null>(null);
  const [readerNodeId, setReaderNodeId] = useState<number | null>(null);

  // Transient jump-to-source highlight (clears after 3s)
  const [localHighlight, setLocalHighlight] = useState<{
    text: string;
    matchIndex: number;
  } | null>(null);

  // Helper: preview edge type based on heuristics (mirrors backend logic)
  const previewEdgeType = (explanation: string): { type: string; label: string } | null => {
    const norm = (explanation || '').trim().toLowerCase();
    if (!norm) return null;

    const startsWithAny = (prefixes: string[]) => prefixes.some((p) => norm.startsWith(p));

    if (startsWithAny(['created by', 'made by', 'authored by', 'written by', 'founded by'])) {
      return { type: 'created_by', label: 'created by' };
    }
    if (startsWithAny(['part of', 'episode of', 'belongs to', 'in the series', 'in this series'])) {
      return { type: 'part_of', label: 'part of' };
    }
    if (startsWithAny(['features', 'mentions', 'hosted by', 'guest:', 'host:'])) {
      return { type: 'part_of', label: 'part of' };
    }
    if (startsWithAny(['came from', 'inspired by', 'derived from', 'from'])) {
      return { type: 'source_of', label: 'source of' };
    }
    if (startsWithAny(['related to', 'related'])) {
      return { type: 'related_to', label: 'related to' };
    }
    // No heuristic match - will be AI-inferred
    return { type: 'inferred', label: 'will be inferred' };
  };

  // Fetch priority dimensions on mount
  useEffect(() => {
    fetchPriorityDimensions();
  }, []);

  // Generate node search suggestions
  useEffect(() => {
    if (!nodeSearchQuery.trim() || !activeTab) {
      setNodeSearchSuggestions([]);
      return;
    }

    const fetchNodeSearchSuggestions = async () => {
      try {
        const response = await fetch(`/api/nodes/search?q=${encodeURIComponent(nodeSearchQuery)}&limit=10`);
        const result = await response.json();
        
        if (result.success) {
          const nodeSuggestions: NodeSearchResult[] = result.data
            .filter((node: any) => node.id !== activeTab) // Exclude current node
            .map((node: any) => ({
              id: node.id,
              title: node.title,
              dimensions: node.dimensions || []
            }));
          
          setNodeSearchSuggestions(nodeSuggestions);
          setSelectedSearchIndex(0);
        }
      } catch (error) {
        console.error('Error fetching node search suggestions:', error);
        setNodeSearchSuggestions([]);
      }
    };

    const timeoutId = setTimeout(fetchNodeSearchSuggestions, 200);
    return () => clearTimeout(timeoutId);
  }, [nodeSearchQuery, activeTab]);

  // Fetch node data when new tabs are opened
  useEffect(() => {
    openTabs.forEach((tabId) => {
      if (!nodesData[tabId] && !loadingNodes.has(tabId)) {
        fetchNodeData(tabId);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openTabs]);

  useEffect(() => {
    openTabs.forEach((tabId) => {
      if (nodesData[tabId] && !edgesData[tabId] && !loadingEdges.has(tabId)) {
        fetchEdgesData(tabId);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openTabs, nodesData, edgesData]);


  // Refresh data when SSE events trigger updates
  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger > 0 && activeTab) {
      fetchNodeData(activeTab);
      fetchEdgesData(activeTab);
      setAnnotationsData({});
    }
  }, [refreshTrigger, activeTab]);

  // Fetch annotations for the active node (cache by nodeId)
  useEffect(() => {
    if (activeNodeId === null) return;
    if (annotationsData[activeNodeId]) return;

    const fetchAnnotations = async () => {
      try {
        const res = await fetch(`/api/annotations?nodeId=${activeNodeId}`);
        const json = await res.json();
        if (json.success) {
          setAnnotationsData(prev => ({ ...prev, [activeNodeId!]: json.data }));
        }
      } catch (e) {
        console.error('Failed to fetch annotations:', e);
      }
    };

    fetchAnnotations();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNodeId]);

  useEffect(() => {
    if (activeNodeId === null) return;
    if (edgeProposalsData[activeNodeId] || loadingEdgeProposals.has(activeNodeId)) return;
    fetchEdgeProposalsData(activeNodeId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNodeId, edgeProposalsData, loadingEdgeProposals]);

  // Clear editing state when switching nodes
  useEffect(() => {
    // Clear all edit modes when switching to a different node
    setEditingField(null);
    setEditingValue('');
    setEditingNodeId(null);
    // Also clear notes/desc/source edit modes
    setNotesEditMode(false);
    setNotesEditValue('');
    setDescEditMode(false);
    setDescEditValue('');
    setDescExpanded(false);
    setSourceEditMode(false);
    setSourceEditValue('');
    setMetadataEditMode(false);
    setMetadataEditValue({ title: '', author: '', isbn: '' });
    setSelectedMetadataCandidateIndex(0);
  }, [activeTab]);

  useEffect(() => {
    if (activeContentTab === 'metadata' && !isBookNode) {
      setActiveContentTab('notes');
    }
  }, [activeContentTab, isBookNode]);

  useEffect(() => {
    if (selectedMetadataCandidateIndex >= metadataCandidates.length) {
      setSelectedMetadataCandidateIndex(0);
    }
  }, [selectedMetadataCandidateIndex, metadataCandidates.length]);

  const fetchPriorityDimensions = async () => {
    try {
      const response = await fetch('/api/dimensions/popular');
      const payload = (await response.json()) as DimensionsResponse;
      if (payload?.success && Array.isArray(payload.data)) {
        const priority = payload.data.filter((d) => d.isPriority).map((d) => d.dimension);
        setPriorityDimensions(priority);
      }
    } catch (error) {
      console.error('Error fetching priority dimensions:', error);
    }
  };

  const fetchNodeData = async (id: number) => {
    setLoadingNodes(prev => new Set(prev).add(id));
    // First try to fetch as a node
    try {
      const nodeResponse = await fetch(`/api/nodes/${id}`);
      if (nodeResponse.ok) {
        const data = await nodeResponse.json();
        if (data.node) {
          setNodesData(prev => ({ ...prev, [id]: data.node }));
          setLoadingNodes(prev => {
            const newSet = new Set(prev);
            newSet.delete(id);
            return newSet;
          });
          return;
        }
      }
    } catch (error) {
      console.warn(`Failed to fetch node ${id}:`, error);
    }
    setLoadingNodes(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  };


  const fetchEdgesData = async (nodeId: number) => {
    setLoadingEdges(prev => new Set(prev).add(nodeId));
    try {
      const response = await fetch(`/api/nodes/${nodeId}/edges`);
      const data = await response.json();
      if (data.success && data.data) {
        setEdgesData(prev => ({ ...prev, [nodeId]: data.data }));
      }
    } catch (error) {
      console.error(`Error fetching edges for node ${nodeId}:`, error);
    } finally {
      setLoadingEdges(prev => {
        const newSet = new Set(prev);
        newSet.delete(nodeId);
        return newSet;
      });
    }
  };

  const fetchEdgeProposalsData = async (nodeId: number) => {
    setLoadingEdgeProposals(prev => new Set(prev).add(nodeId));
    try {
      const response = await fetch(`/api/nodes/${nodeId}/edge-proposals`);
      const data = await response.json();
      if (response.ok && data.success && Array.isArray(data.data)) {
        setEdgeProposalsData(prev => ({ ...prev, [nodeId]: data.data }));
      }
    } catch (error) {
      console.error(`Error fetching edge proposals for node ${nodeId}:`, error);
    } finally {
      setLoadingEdgeProposals(prev => {
        const next = new Set(prev);
        next.delete(nodeId);
        return next;
      });
    }
  };

  const updateProposalsForNode = (nodeId: number, updater: (current: EdgeProposalResult[]) => EdgeProposalResult[]) => {
    setEdgeProposalsData(prev => ({
      ...prev,
      [nodeId]: updater(prev[nodeId] || []),
    }));
  };

  const approveEdgeProposal = async (proposal: EdgeProposalResult) => {
    const actionKey = `${proposal.sourceNodeId}:${proposal.targetNodeId}:approve`;
    const previous = edgeProposalsData[proposal.sourceNodeId] || [];
    updateProposalsForNode(proposal.sourceNodeId, current =>
      current.filter(item => item.targetNodeId !== proposal.targetNodeId)
    );
    setEdgeProposalActionKey(actionKey);

    try {
      const response = await fetch('/api/edges', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from_node_id: proposal.sourceNodeId,
          to_node_id: proposal.targetNodeId,
          source: 'user',
          explanation: '',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create edge from proposal');
      }

      await fetchEdgesData(proposal.sourceNodeId);
    } catch (error) {
      console.error('Error approving edge proposal:', error);
      setEdgeProposalsData(prev => ({ ...prev, [proposal.sourceNodeId]: previous }));
    } finally {
      setEdgeProposalActionKey(current => current === actionKey ? null : current);
    }
  };

  const dismissEdgeProposal = async (proposal: EdgeProposalResult) => {
    const actionKey = `${proposal.sourceNodeId}:${proposal.targetNodeId}:dismiss`;
    const previous = edgeProposalsData[proposal.sourceNodeId] || [];
    updateProposalsForNode(proposal.sourceNodeId, current =>
      current.filter(item => item.targetNodeId !== proposal.targetNodeId)
    );
    setEdgeProposalActionKey(actionKey);

    try {
      const response = await fetch(`/api/nodes/${proposal.sourceNodeId}/edge-proposals/dismiss`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          target_node_id: proposal.targetNodeId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to dismiss edge proposal');
      }
    } catch (error) {
      console.error('Error dismissing edge proposal:', error);
      setEdgeProposalsData(prev => ({ ...prev, [proposal.sourceNodeId]: previous }));
    } finally {
      setEdgeProposalActionKey(current => current === actionKey ? null : current);
    }
  };

  // Fetch embedded chunks for a node
  const fetchChunksData = async (nodeId: number) => {
    if (loadingChunks.has(nodeId)) return;
    setLoadingChunks(prev => new Set(prev).add(nodeId));
    try {
      const response = await fetch(`/api/nodes/${nodeId}/chunks`);
      const data = await response.json();
      if (data.success && data.chunks) {
        setChunksData(prev => ({ ...prev, [nodeId]: data.chunks }));
      }
    } catch (error) {
      console.error(`Error fetching chunks for node ${nodeId}:`, error);
    } finally {
      setLoadingChunks(prev => {
        const newSet = new Set(prev);
        newSet.delete(nodeId);
        return newSet;
      });
    }
  };

  // Fetch chunks when switching to Source tab
  useEffect(() => {
    if (activeContentTab === 'source' && activeTab && !chunksData[activeTab] && !loadingChunks.has(activeTab)) {
      fetchChunksData(activeTab);
    }
  }, [activeContentTab, activeTab]);

  const truncateTitle = (title: string, maxLength: number = 20) => {
    if (title.length <= maxLength) return title;
    return title.substring(0, maxLength) + '...';
  };

  // Focus input when editing starts
  useEffect(() => {
    if (editingField && inputRef.current) {
      inputRef.current.focus();
      if (inputRef.current instanceof HTMLInputElement || inputRef.current instanceof HTMLTextAreaElement) {
        inputRef.current.select();
      }
    }
  }, [editingField]);

  const startEdit = (field: string, currentValue: string) => {
    if (savingField) return; // Don't start edit if currently saving
    setEditingField(field);
    setEditingValue(currentValue || '');
    if (activeNodeId !== null) setEditingNodeId(activeNodeId);
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditingValue('');
    setEditingNodeId(null);
  };

  const saveField = async () => {
    const nodeId = editingNodeId ?? activeNodeId;
    if (!nodeId || !editingField) return;
    // Validate required fields
    if (editingField === 'title' && !editingValue.trim()) {
      alert('Title cannot be empty');
      return;
    }

    setSavingField(editingField);
    try {
      const updateData: Record<string, string> = {};

      if (editingField === 'notes') {
        updateData.content = editingValue;
      } else {
        updateData[editingField] = editingValue;
      }

      const response = await fetch(`/api/nodes/${nodeId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        throw new Error('Failed to save');
      }

      const result = await response.json();
      if (result.node) {
        setNodesData(prev => ({ ...prev, [nodeId]: result.node }));
      }

      // Safety net: ensure edges exist for any tokens present in saved content
      if (editingField === 'notes' && typeof editingValue === 'string') {
        try {
          const tokens = parseNodeMarkers(editingValue);
          const uniqueTargets = Array.from(new Set(tokens.map(t => t.id))).filter(id => id !== nodeId);
          await Promise.allSettled(uniqueTargets.map(async (toId) => {
            await fetch('/api/edges', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                from_node_id: nodeId,
                to_node_id: toId,
                source: 'user',
                explanation: 'Referenced via @ mention'
              })
            });
          }));
          // Refresh edges after ensuring
          await fetchEdgesData(nodeId);
        } catch (e) {
          console.warn('Failed to ensure edges from tokens:', e);
        }
      }
      
      setEditingField(null);
      setEditingValue('');
      setEditingNodeId(null);
    } catch (error) {
      console.error('Error saving field:', error);
      alert('Failed to save changes. Please try again.');
    } finally {
      setSavingField(null);
    }
  };

  // Explicit content saver to avoid stale state reads (used after @mention insert)
  const saveContentExplicit = async (contentValue: string, nodeId: number) => {
    if (!nodeId) return;
    setSavingField('content');
    try {
      const response = await fetch(`/api/nodes/${nodeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: contentValue }),
      });
      if (!response.ok) throw new Error('Failed to save');
      const result = await response.json();
      if (result.node) {
        setNodesData(prev => ({ ...prev, [nodeId]: result.node }));
      }
      // Safety net: ensure edges for tokens in this specific content
      try {
        const tokens = parseNodeMarkers(contentValue);
        const uniqueTargets = Array.from(new Set(tokens.map(t => t.id))).filter(id => id !== nodeId);
        await Promise.allSettled(uniqueTargets.map(async (toId) => {
          await fetch('/api/edges', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from_node_id: nodeId,
              to_node_id: toId,
              source: 'user',
              explanation: 'Referenced via @ mention'
            })
          });
        }));
        await fetchEdgesData(nodeId);
      } catch (e) {
        console.warn('Failed to ensure edges from tokens (explicit save):', e);
      }
      // Exit edit mode
      setEditingField(null);
      setEditingValue('');
    } catch (e) {
      console.error('Error saving content (explicit):', e);
      alert('Failed to save changes. Please try again.');
    } finally {
      setSavingField(null);
    }
  };

  // Save desc (description) with explicit Save button
  const saveDesc = async () => {
    if (!activeTab) return;
    setDescSaving(true);
    try {
      const response = await fetch(`/api/nodes/${activeTab}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: descEditValue }),
      });
      if (!response.ok) throw new Error('Failed to save');
      const result = await response.json();
      if (result.node) {
        setNodesData(prev => ({ ...prev, [activeTab]: result.node }));
      }
      setDescEditMode(false);
      setDescEditValue('');
    } catch (e) {
      console.error('Error saving description:', e);
      alert('Failed to save description. Please try again.');
    } finally {
      setDescSaving(false);
    }
  };

  // Cancel desc editing
  const cancelDescEdit = () => {
    setDescEditMode(false);
    setDescEditValue('');
  };

  // Start editing desc
  const startDescEdit = () => {
    if (!activeTab || !nodesData[activeTab]) return;
    setDescEditValue(nodesData[activeTab].description || '');
    setDescEditMode(true);
  };

  // Sync description to source (chunk) and re-embed
  const runIngestion = async (nodeId: number): Promise<{ ok: boolean; message?: string; result?: IngestionResult }> => {
    const response = await fetch('/api/ingestion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodeId }),
    });

    const result: IngestionResult = await response.json();
    const quotaError = result.errorCode === 'INSUFFICIENT_QUOTA' || isInsufficientQuotaError(result.error);
    if (quotaError) {
      return { ok: false, message: getQuotaWarningMessage(), result };
    }

    if (!response.ok || !result.success) {
      return { ok: false, message: result.error || 'Failed to embed content', result };
    }

    return { ok: true, result };
  };

  const syncDescToSource = async () => {
    if (!activeTab) return;
    setDescSaving(true);
    try {
      // Save description to chunk field
      const response = await fetch(`/api/nodes/${activeTab}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chunk: descEditValue }),
      });
      if (!response.ok) throw new Error('Failed to sync');
      const result = await response.json();
      if (result.node) {
        setNodesData(prev => ({ ...prev, [activeTab]: result.node }));
      }

      const ingestion = await runIngestion(activeTab);

      // Refresh chunks data
      fetchChunksData(activeTab);

      if (!ingestion.ok) {
        alert(ingestion.message || 'Description synced, but embedding did not complete.');
        return;
      }

      alert('Description synced to source and re-embedded successfully.');
    } catch (e) {
      console.error('Error syncing description to source:', e);
      alert('Failed to sync to source. Please try again.');
    } finally {
      setDescSaving(false);
    }
  };

  // Save notes (content) with explicit Save button
  const saveNotes = async () => {
    if (!activeTab) return;
    setNotesSaving(true);
    try {
      const response = await fetch(`/api/nodes/${activeTab}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notesEditValue }),
      });
      if (!response.ok) throw new Error('Failed to save');
      const result = await response.json();
      if (result.node) {
        setNodesData(prev => ({ ...prev, [activeTab]: result.node }));
      }
      // Invalidate annotations cache so it re-fetches on next render
      // (user may have hand-edited annotation tokens in the notes editor)
      setAnnotationsData(prev => {
        const next = { ...prev };
        delete next[activeTab];
        return next;
      });
      // Ensure edges for any node tokens
      try {
        const tokens = parseNodeMarkers(notesEditValue);
        const uniqueTargets = Array.from(new Set(tokens.map(t => t.id))).filter(id => id !== activeTab);
        await Promise.allSettled(uniqueTargets.map(async (toId) => {
          await fetch('/api/edges', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from_node_id: activeTab,
              to_node_id: toId,
              source: 'user',
              explanation: 'Referenced via @ mention'
            })
          });
        }));
        await fetchEdgesData(activeTab);
      } catch (e) {
        console.warn('Failed to ensure edges from tokens:', e);
      }
      setNotesEditMode(false);
      setNotesEditValue('');
    } catch (e) {
      console.error('Error saving notes:', e);
      alert('Failed to save notes. Please try again.');
    } finally {
      setNotesSaving(false);
    }
  };

  const createAnnotationForNode = async (nodeId: number, annotation: ReaderAnnotationInput) => {
    try {
      const res = await fetch('/api/annotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          node_id: nodeId,
          text: annotation.text,
          color: annotation.color,
          comment: annotation.comment,
          start_offset: annotation.start_offset,
          source_mode: annotation.source_mode,
          anchor: annotation.anchor,
          fallback_context: annotation.fallback_context,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      const newAnnotation: Annotation = json.annotation;

      setAnnotationsData(prev => ({
        ...prev,
        [nodeId]: [...(prev[nodeId] ?? []), newAnnotation],
      }));

      setNodesData(prev => ({
        ...prev,
        [nodeId]: {
          ...prev[nodeId],
          notes: json.annotation?.id
            ? `${prev[nodeId]?.notes ?? ''}\n\n[[annotation:${newAnnotation.id}]] ${annotation.text}${annotation.comment ? ` (${annotation.comment})` : ''}`
            : prev[nodeId]?.notes,
        },
      }));
    } catch (e) {
      console.error('Failed to create annotation:', e);
      alert('Failed to save annotation.');
    }
  };

  const createAnnotation = async (color: AnnotationColor, comment?: string) => {
    if (!activeNodeId || !pendingAnnotation) return;
    await createAnnotationForNode(activeNodeId, {
      text: pendingAnnotation.text,
      color,
      comment,
      start_offset: pendingAnnotation.charOffset,
      source_mode: 'text',
    });
  };

  const updateReaderProgress = async (
    nodeId: number,
    progress: NonNullable<Node['metadata']>['reading_progress'],
  ) => {
    try {
      const response = await fetch(`/api/nodes/${nodeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metadata: { reading_progress: progress },
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update reading progress: ${response.status}`);
      }

      setNodesData((prev) => ({
        ...prev,
        [nodeId]: {
          ...prev[nodeId],
          metadata: {
            ...(prev[nodeId]?.metadata ?? {}),
            reading_progress: progress,
          },
        },
      }));
    } catch (error) {
      console.error('Failed to update reader progress:', error);
    }
  };

  const deleteAnnotation = async (annotationId: number) => {
    if (!activeNodeId) return;
    try {
      const res = await fetch(`/api/annotations/${annotationId}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      setAnnotationsData(prev => ({
        ...prev,
        [activeNodeId]: (prev[activeNodeId] ?? []).filter(a => a.id !== annotationId),
      }));

      setNodesData(prev => {
        const current = prev[activeNodeId];
        if (!current?.notes) return prev;
        const cleaned = current.notes
          .replace(new RegExp(`\\n{0,2}\\[\\[annotation:${annotationId}\\]\\]`, 'g'), '')
          .trimEnd();
        return { ...prev, [activeNodeId]: { ...current, notes: cleaned } };
      });
    } catch (e) {
      console.error('Failed to delete annotation:', e);
      alert('Failed to delete annotation.');
    }
  };

  const handleJumpToSource = (text: string, matchIndex: number) => {
    setActiveContentTab('source');
    setLocalHighlight({ text, matchIndex });
    setTimeout(() => setLocalHighlight(null), 3000);
  };

  // Cancel notes editing
  const cancelNotesEdit = () => {
    setNotesEditMode(false);
    setNotesEditValue('');
  };

  // Start editing notes
  const startNotesEdit = () => {
    if (!activeTab || !nodesData[activeTab]) return;
    setNotesEditValue(nodesData[activeTab].notes || '');
    setNotesEditMode(true);
  };

  // Save source (chunk) with explicit Save button
  const saveSource = async () => {
    if (!activeTab) return;
    setSourceSaving(true);
    try {
      const response = await fetch(`/api/nodes/${activeTab}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chunk: sourceEditValue }),
      });
      if (!response.ok) throw new Error('Failed to save');
      const result = await response.json();
      if (result.node) {
        setNodesData(prev => ({ ...prev, [activeTab]: result.node }));
      }
      setSourceEditMode(false);
      setSourceEditValue('');
    } catch (e) {
      console.error('Error saving source:', e);
      alert('Failed to save source. Please try again.');
    } finally {
      setSourceSaving(false);
    }
  };

  // Cancel source editing
  const cancelSourceEdit = () => {
    setSourceEditMode(false);
    setSourceEditValue('');
  };

  // Start editing source
  const startSourceEdit = () => {
    if (!activeTab || !nodesData[activeTab]) return;
    setSourceEditValue(nodesData[activeTab].chunk || '');
    setSourceEditMode(true);
  };

  const startMetadataEdit = () => {
    if (!activeTab || !nodesData[activeTab]) return;
    const metadata = nodesData[activeTab].metadata ?? {};
    setMetadataEditValue({
      title: typeof metadata.book_title === 'string' ? metadata.book_title : '',
      author: typeof metadata.book_author === 'string' ? metadata.book_author : '',
      isbn: typeof metadata.book_isbn === 'string' ? metadata.book_isbn : '',
    });
    setMetadataEditMode(true);
  };

  const cancelMetadataEdit = () => {
    setMetadataEditMode(false);
    setMetadataEditValue({ title: '', author: '', isbn: '' });
  };

  const saveMetadataFields = async () => {
    if (!activeTab || !nodesData[activeTab]) return;
    setMetadataSaving(true);
    try {
      const existing = nodesData[activeTab].metadata ?? {};
      const nextMetadata = {
        ...existing,
        content_kind: 'book' as const,
        book_title: metadataEditValue.title.trim() || undefined,
        book_author: metadataEditValue.author.trim() || undefined,
        book_isbn: metadataEditValue.isbn.trim() || undefined,
        book_metadata_locked: {
          ...(existing.book_metadata_locked ?? {}),
          title: true,
          author: true,
          isbn: true,
        },
      };

      const response = await fetch(`/api/nodes/${activeTab}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metadata: nextMetadata }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to save metadata');
      }

      if (result.node) {
        setNodesData((prev) => ({ ...prev, [activeTab]: result.node }));
      }

      setMetadataEditMode(false);
      setMetadataEditValue({ title: '', author: '', isbn: '' });
    } catch (error) {
      console.error('Failed to save metadata fields:', error);
      alert('Failed to save book metadata.');
    } finally {
      setMetadataSaving(false);
    }
  };

  const retryMetadataEnrichment = async () => {
    if (!activeTab || !nodesData[activeTab]) return;
    setMetadataRetrying(true);
    try {
      const response = await fetch(`/api/nodes/${activeTab}/enrich-book`, { method: 'POST' });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to retry enrichment');
      }

      setNodesData((prev) => ({
        ...prev,
        [activeTab]: {
          ...prev[activeTab],
          metadata: {
            ...(prev[activeTab].metadata ?? {}),
            content_kind: 'book',
            book_metadata_status: 'pending',
          },
        },
      }));
    } catch (error) {
      console.error('Failed to retry enrichment:', error);
      alert('Failed to queue metadata retry.');
    } finally {
      setMetadataRetrying(false);
    }
  };

  const confirmMetadataCandidate = async () => {
    if (!activeTab || !nodesData[activeTab]) return;
    const candidate = metadataCandidates[selectedMetadataCandidateIndex];
    if (!candidate) {
      alert('No candidate selected.');
      return;
    }

    setMetadataConfirming(true);
    try {
      const metadata = nodesData[activeTab].metadata ?? {};
      const nextMetadata = applyBookMatchCandidate(metadata, candidate);

      const response = await fetch(`/api/nodes/${activeTab}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metadata: nextMetadata }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to confirm candidate');
      }

      if (result.node) {
        setNodesData((prev) => ({ ...prev, [activeTab]: result.node }));
      } else {
        setNodesData((prev) => ({
          ...prev,
          [activeTab]: {
            ...prev[activeTab],
            metadata: nextMetadata,
          },
        }));
      }
      setSelectedMetadataCandidateIndex(0);
    } catch (error) {
      console.error('Failed to confirm candidate:', error);
      alert('Failed to confirm metadata candidate.');
    } finally {
      setMetadataConfirming(false);
    }
  };

  // Sync Notes content to Source (with confirmation)
  const [showSyncConfirm, setShowSyncConfirm] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Create linked note state
  const [creatingNote, setCreatingNote] = useState(false);
  const [generatingNotesFromSource, setGeneratingNotesFromSource] = useState(false);

  const generateNotesFromSource = async () => {
    if (!activeTab || !nodesData[activeTab]?.chunk?.trim()) return;
    setGeneratingNotesFromSource(true);
    try {
      const response = await fetch(`/api/nodes/${activeTab}/generate-notes-from-source`, {
        method: 'POST',
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success || !result?.node) {
        throw new Error(result?.error || 'Failed to generate notes from source');
      }
      setNodesData(prev => ({ ...prev, [activeTab]: result.node }));
      setActiveContentTab('notes');
    } catch (error) {
      console.error('Failed to generate notes from source:', error);
      alert(error instanceof Error ? error.message : 'Failed to generate notes from source.');
    } finally {
      setGeneratingNotesFromSource(false);
    }
  };

  const syncToSource = async () => {
    if (!activeTab) return;
    setSyncing(true);
    setShowSyncConfirm(false);
    try {
      // First, save notes content to chunk field
      const response = await fetch(`/api/nodes/${activeTab}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chunk: notesEditValue }),
      });
      if (!response.ok) throw new Error('Failed to sync');
      const result = await response.json();
      if (result.node) {
        setNodesData(prev => ({ ...prev, [activeTab]: result.node }));
      }

      const ingestion = await runIngestion(activeTab);

      // Refresh chunks data
      fetchChunksData(activeTab);

      if (!ingestion.ok) {
        alert(ingestion.message || 'Content synced, but embedding did not complete.');
        return;
      }

      // Stay in edit mode but show success
      alert('Content synced to source and re-embedded successfully.');
    } catch (e) {
      console.error('Error syncing to source:', e);
      alert('Failed to sync to source. Please try again.');
    } finally {
      setSyncing(false);
    }
  };

  // Create a new linked note from current node
  const createLinkedNote = async () => {
    if (!activeTab || !nodesData[activeTab]) return;
    setCreatingNote(true);

    const sourceNodeId = activeTab;
    const currentNode = nodesData[sourceNodeId];
    let newNodeId: number | null = null;

    try {
      const noteTitle = `New Node from ${currentNode.title}`;
      const noteDescription = `New node - ideas or insights from ${currentNode.title}`;

      // Create the new node
      const createResponse = await fetch('/api/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: noteTitle,
          type: 'note',
          content: '',
          description: noteDescription,
          dimensions: currentNode.dimensions || []
        }),
      });

      if (!createResponse.ok) throw new Error('Failed to create note');
      const createResult = await createResponse.json();
      newNodeId = createResult.data?.id || createResult.node?.id || createResult.id;

      if (!newNodeId) throw new Error('No node ID returned');

      // Create edge from new note to source node
      const edgeResponse = await fetch('/api/edges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_node_id: newNodeId,
          to_node_id: sourceNodeId,
          source: 'user',
          explanation: `Ideas or insights from "${currentNode.title}"`
        }),
      });

      if (!edgeResponse.ok) {
        console.warn('Edge creation failed but note was created');
      }

      // Open the new note in focus
      if (onTabSelect && newNodeId) {
        onTabSelect(newNodeId);
      }
    } catch (e) {
      console.error('Error creating linked note:', e);
      // If node was created but something else failed, still open it
      if (newNodeId && onTabSelect) {
        onTabSelect(newNodeId);
      } else {
        alert('Failed to create note. Please try again.');
      }
    } finally {
      setCreatingNote(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      saveField();
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  };

  const handleBlur = () => {
    // If mention is active, defer saving slightly to avoid race with selection
    const attemptSave = () => {
      if (editingField) {
        saveField();
      }
    };
    if (mentionActive) {
      setTimeout(() => {
        if (!mentionActive) attemptSave();
      }, 220);
      return;
    }
    // Small delay to allow for clicking inline buttons
    setTimeout(attemptSave, 150);
  };

  // Regenerate description for a node
  const regenerateDescription = async (nodeId: number) => {
    setRegeneratingDescription(nodeId);
    try {
      const response = await fetch(`/api/nodes/${nodeId}/regenerate-description`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error('Failed to regenerate description');
      }

      const result = await response.json();
      if (result.node) {
        setNodesData(prev => ({ ...prev, [nodeId]: result.node }));
      }
    } catch (error) {
      console.error('Error regenerating description:', error);
      alert('Failed to regenerate description. Please try again.');
    } finally {
      setRegeneratingDescription(null);
    }
  };

  // --- @mention state ---
  const [mentionActive, setMentionActive] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionResults, setMentionResults] = useState<NodeSearchResult[]>([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  const mentionTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetMention = () => {
    setMentionActive(false);
    setMentionQuery('');
    setMentionResults([]);
    setMentionIndex(0);
  };

  const findAtTrigger = (text: string, caret: number): { atIndex: number; query: string } | null => {
    // Find last '@' before caret that is at start or preceded by whitespace
    for (let i = caret - 1; i >= 0; i--) {
      const ch = text[i];
      if (ch === '@') {
        const prev = i === 0 ? ' ' : text[i - 1];
        if (/\s/.test(prev)) {
          const span = text.slice(i + 1, caret);
          // Stop if span contains disallowed characters (newline or punctuation other than - _ .)
          if (/[^A-Za-z0-9 _\-.]/.test(span)) return null;
          return { atIndex: i, query: span };
        }
        // If '@' is not preceded by whitespace, keep scanning left
      }
      // Stop scanning back on whitespace/newline to avoid spanning words
      if (ch === '\n') break;
    }
    return null;
  };

  const runMentionSearch = async (query: string) => {
    if (!activeTab) return;
    if (query.trim().length < 2) {
      setMentionResults([]);
      return;
    }
    try {
      const resp = await fetch(`/api/nodes/search?q=${encodeURIComponent(query)}&limit=10`);
      const payload = (await resp.json()) as { success: boolean; data: NodeSearchResult[] };
      if (payload?.success && Array.isArray(payload.data)) {
        const filtered = payload.data
          .filter((n) => n.id !== activeTab)
          .map((n) => ({ ...n, dimensions: n.dimensions ?? [] }));
        setMentionResults(filtered);
        setMentionIndex(0);
      }
    } catch (error) {
      console.warn('mention search failed:', error);
      setMentionResults([]);
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setEditingValue(val);

    // Detect @mention
    const caret = e.target.selectionStart || val.length;
    const trig = findAtTrigger(val, caret);
    if (trig) {
      setMentionActive(true);
      setMentionQuery(trig.query);
      if (mentionTimeout.current) clearTimeout(mentionTimeout.current);
      mentionTimeout.current = setTimeout(() => runMentionSearch(trig.query), 280);
    } else if (mentionActive) {
      // Exit mention mode if trigger no longer valid
      resetMention();
    }
  };

  const replaceMentionWithToken = async (nodeId: number, title: string) => {
    if (!inputRef.current || !(inputRef.current instanceof HTMLTextAreaElement)) return;
    if (activeNodeId === null) return;
    const ta = inputRef.current as HTMLTextAreaElement;
    const sourceNodeId = activeNodeId!;
    const text = editingValue;
    const caret = ta.selectionStart || text.length;
    let trig = findAtTrigger(text, caret);
    if (!trig) {
      // Fallback: try to locate the last occurrence of the current mention token
      if (mentionQuery && mentionQuery.length > 0) {
        const needle = '@' + mentionQuery;
        const idx = text.lastIndexOf(needle);
        if (idx !== -1) {
          trig = { atIndex: idx, query: mentionQuery };
        }
      }
      if (!trig) return;
    }
    // Build quote-safe token
    const quoteTitleForToken = (t: string): string => {
      if (t.includes('"')) {
        // Wrap with single quotes; normalize inner straight single quotes
        const norm = t.replace(/'/g, '’');
        return `'${norm}'`;
      }
      // Wrap with double quotes; keep title as-is (no straight doubles inside)
      return `"${t}"`;
    };
    const token = `[NODE:${nodeId}:${quoteTitleForToken(title)}]`;
    const before = text.slice(0, trig.atIndex);
    const after = text.slice(trig.atIndex + 1 + trig.query.length); // skip '@' and query
    const newVal = before + token + after;
    setEditingValue(newVal);
    // Restore caret after token
    const newCaret = (before + token).length;
    requestAnimationFrame(() => {
      ta.selectionStart = ta.selectionEnd = newCaret;
      ta.focus();
    });

    // Create edge (idempotent server-side)
    if (sourceNodeId) {
      try {
        await fetch('/api/edges', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from_node_id: sourceNodeId,
            to_node_id: nodeId,
            source: 'user',
              explanation: 'Referenced via @ mention'
          })
        });
      } catch (e) {
        console.warn('edge create failed for mention:', e);
      }
    }

    resetMention();

    // Persist content immediately to avoid losing the token on refresh/navigation
    try {
      await saveContentExplicit(newVal, sourceNodeId);
    } catch (e) {
      console.warn('auto-save after mention failed:', e);
    }
  };

  // Handle @mention selection in the Notes tab
  const handleNotesMentionSelect = async (nodeId: number, title: string) => {
    if (!notesTextareaRef.current || activeNodeId === null) return;
    const ta = notesTextareaRef.current;
    const sourceNodeId = activeNodeId;
    const text = notesEditValue;
    const caret = ta.selectionStart || text.length;
    let trig = findAtTrigger(text, caret);
    if (!trig) {
      // Fallback: try to locate the last occurrence of the current mention token
      if (mentionQuery && mentionQuery.length > 0) {
        const needle = '@' + mentionQuery;
        const idx = text.lastIndexOf(needle);
        if (idx !== -1) {
          trig = { atIndex: idx, query: mentionQuery };
        }
      }
      if (!trig) return;
    }
    // Build quote-safe token
    const quoteTitleForToken = (t: string): string => {
      if (t.includes('"')) {
        const norm = t.replace(/'/g, '\u2019'); // curly right single quote
        return `'${norm}'`;
      }
      return `"${t}"`;
    };
    const token = `[NODE:${nodeId}:${quoteTitleForToken(title)}]`;
    const before = text.slice(0, trig.atIndex);
    const after = text.slice(trig.atIndex + 1 + trig.query.length);
    const newVal = before + token + after;
    setNotesEditValue(newVal);
    // Restore caret after token
    const newCaret = (before + token).length;
    requestAnimationFrame(() => {
      ta.selectionStart = ta.selectionEnd = newCaret;
      ta.focus();
    });

    // Create edge
    if (sourceNodeId) {
      try {
        await fetch('/api/edges', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from_node_id: sourceNodeId,
            to_node_id: nodeId,
            source: 'user',
            explanation: 'Referenced via @ mention'
          })
        });
        // Refresh edges for the current node
        fetchEdgesData(sourceNodeId);
      } catch (e) {
        console.warn('edge create failed for notes mention:', e);
      }
    }

    resetMention();
  };

  const embedContent = async (nodeId: number) => {
    const node = nodesData[nodeId];
    const hasNotes = node?.notes?.trim();
    const hasChunk = node?.chunk?.trim();
    // If chunk is empty but content exists, auto-populate chunk from content
    if (!hasChunk && hasNotes) {
      try {
        const response = await fetch(`/api/nodes/${nodeId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chunk: hasNotes })
        });
        
        if (response.ok) {
          const result = await response.json();
          if (result.node) {
            setNodesData(prev => ({ ...prev, [nodeId]: result.node }));
          }
        }
      } catch (error) {
        console.error('Failed to auto-populate chunk for embedding:', error);
        return;
      }
    }
    // If neither content nor chunk exist, require content
    if (!hasNotes && !hasChunk) {
      startEdit('content', '');
      return;
    }
    setEmbeddingNode(nodeId);
    try {
      const ingestion = await runIngestion(nodeId);
      const result = ingestion.result || {};
      if (!ingestion.ok) {
        alert(ingestion.message || 'Embedding could not be completed.');
        await fetchNodeData(nodeId);
        return;
      }

      // Show result details
      const nodeStatus = result.node_embedding?.status;
      const chunkStatus = result.chunk_embeddings?.status;
      const chunksCreated = result.chunk_embeddings?.chunks_created || 0;
      
      let message = 'Embedding complete:\n';
      if (nodeStatus === 'completed') message += '✓ Node metadata embedded\n';
      if (chunkStatus === 'completed') message += `✓ ${chunksCreated} chunks embedded\n`;
      if (chunkStatus === 'skipped') message += '• No chunk content to embed\n';
      
      console.log(message.trim());

      // Refresh node data to get updated status
      await fetchNodeData(nodeId);
      
    } catch (error) {
      console.warn('Error embedding content:', error);
      alert(`Failed to embed content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setEmbeddingNode(null);
    }
  };


  // Edge management functions (following same patterns as node functions)

  const handleEdgeNodeSelect = async (targetNodeId: number, _targetNodeTitle?: string) => {
    // Immediately create edge - backend auto-infers explanation and type
    await createEdgeAuto(targetNodeId);
  };

  // Handle node search keyboard navigation
  const handleNodeSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSearchIndex(prev => Math.min(prev + 1, nodeSearchSuggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSearchIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && nodeSearchSuggestions[selectedSearchIndex]) {
      e.preventDefault();
      handleSelectNodeSuggestion(nodeSearchSuggestions[selectedSearchIndex]);
    }
  };

  const handleSelectNodeSuggestion = async (suggestion: NodeSearchResult) => {
    // Immediately create edge - backend auto-infers explanation and type
    await createEdgeAuto(suggestion.id);
    setNodeSearchSuggestions([]);
    setNodeSearchQuery('');
  };

  // Auto-create edge - backend handles explanation generation and type inference
  const createEdgeAuto = async (targetNodeId: number) => {
    if (activeNodeId === null) return;
    try {
      const response = await fetch('/api/edges', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from_node_id: activeNodeId,
          to_node_id: targetNodeId,
          source: 'user',
          explanation: '' // Empty - backend will auto-generate
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create edge');
      }

      // Refresh edges data
      await fetchEdgesData(activeNodeId);

      // Reset state
      setAddingEdge(null);
      setEdgeExplanation('');
      setPendingEdgeTarget(null);
      setEdgeSearchOpen(false);

    } catch (error) {
      console.error('Error creating edge:', error);
      alert('Failed to create edge. Please try again.');
    }
  };

  // Legacy function for manual explanation (kept for compatibility)
  const createEdgeWithExplanation = async (targetNodeId: number, explanation: string) => {
    if (activeNodeId === null) return;
    try {
      const response = await fetch('/api/edges', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from_node_id: activeNodeId,
          to_node_id: targetNodeId,
          source: 'user',
          explanation: explanation || '' // Backend handles empty
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create edge');
      }

      // Refresh edges data
      await fetchEdgesData(activeNodeId);

      // Reset state
      setAddingEdge(null);
      setEdgeExplanation('');
      setPendingEdgeTarget(null);
      setNodeSearchQuery('');
      setNodeSearchSuggestions([]);
      setEdgeSearchOpen(false);

    } catch (error) {
      console.error('Error creating edge:', error);
      alert('Failed to create edge. Please try again.');
    }
  };

  const startEditEdgeExplanation = (edgeId: number, currentExplanation: string | undefined) => {
    if (edgeSavingId) return;
    setEdgeEditingId(edgeId);
    setEdgeEditingValue(currentExplanation || '');
  };

  const cancelEditEdgeExplanation = () => {
    setEdgeEditingId(null);
    setEdgeEditingValue('');
  };

  const saveEdgeExplanation = async (
    edgeId: number,
    currentContext: Record<string, unknown> | null | undefined
  ) => {
    if (activeNodeId === null) return;
    setEdgeSavingId(edgeId);
    try {
      const newContext: Record<string, unknown> = {
        ...(currentContext ?? {}),
        explanation: edgeEditingValue
      };
      const response = await fetch(`/api/edges/${edgeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: newContext })
      });
      if (!response.ok) throw new Error('Failed to update edge');
      await fetchEdgesData(activeNodeId);
      setEdgeEditingId(null);
      setEdgeEditingValue('');
    } catch (e) {
      console.error('Failed updating edge explanation:', e);
      alert('Failed to update edge explanation');
    } finally {
      setEdgeSavingId(null);
    }
  };

  const deleteEdge = async (edgeId: number) => {
    if (activeNodeId === null) return;
    setDeletingEdge(edgeId);
    try {
      const response = await fetch(`/api/edges/${edgeId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete edge');
      }

      await fetchEdgesData(activeNodeId);
      
    } catch (error) {
      console.error('Error deleting edge:', error);
      alert('Failed to delete edge. Please try again.');
    } finally {
      setDeletingEdge(null);
    }
  };

  const renderConnectionsBody = () => {
    if (!activeTab) {
      return <div style={{ color: 'var(--app-text-muted)', fontSize: '12px' }}>Open a node to manage connections.</div>;
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {loadingEdgeProposals.has(activeTab) && !edgeProposalsData[activeTab] && (
          <div style={{ marginBottom: '12px', fontSize: '11px', color: 'var(--app-text-subtle)' }}>
            Loading suggestions...
          </div>
        )}

        {(edgeProposalsData[activeTab] || []).length > 0 && (
          <div className="app-panel-elevated" style={{
            marginBottom: '16px',
            padding: '12px',
            borderRadius: '8px',
          }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--toolbar-accent)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Suggested connections
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {(edgeProposalsData[activeTab] || []).map((proposal) => {
                const approveKey = `${proposal.sourceNodeId}:${proposal.targetNodeId}:approve`;
                const dismissKey = `${proposal.sourceNodeId}:${proposal.targetNodeId}:dismiss`;
                const isBusy = edgeProposalActionKey === approveKey || edgeProposalActionKey === dismissKey;

                return (
                  <div
                    key={`${proposal.sourceNodeId}-${proposal.targetNodeId}`}
                    className="app-panel"
                    style={{
                      borderRadius: '6px',
                      padding: '10px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '6px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--app-text)' }}>{proposal.targetNodeTitle}</div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => approveEdgeProposal(proposal)}
                          disabled={isBusy}
                          className="app-button app-button--compact"
                          style={{
                            padding: '4px 10px',
                            borderRadius: '4px',
                            background: 'var(--toolbar-accent)',
                            borderColor: 'var(--app-accent-border)',
                            color: 'var(--app-accent-contrast)',
                            fontSize: '10px',
                            fontWeight: 700,
                            cursor: isBusy ? 'not-allowed' : 'pointer',
                          }}
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => dismissEdgeProposal(proposal)}
                          disabled={isBusy}
                          className="app-button app-button--secondary app-button--compact"
                          style={{
                            padding: '4px 10px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: 600,
                            cursor: isBusy ? 'not-allowed' : 'pointer',
                          }}
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--app-text-muted)' }}>{proposal.reason}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Search Section — only visible when toggled */}
        {edgeSearchOpen && (
          <div style={{ marginBottom: '12px', position: 'relative' }}>
            <input
              className="app-input"
              type="text"
              autoFocus
              value={nodeSearchQuery}
              onChange={(e) => setNodeSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  setEdgeSearchOpen(false);
                  setNodeSearchQuery('');
                  setNodeSearchSuggestions([]);
                } else {
                  handleNodeSearchKeyDown(e);
                }
              }}
              placeholder="Search for a node to connect..."
              style={{
                width: '100%',
                borderRadius: '6px',
                padding: '8px 12px',
                fontSize: '12px',
                fontFamily: 'inherit',
                outline: 'none',
              }}
            />
            {/* Search Suggestions */}
            {nodeSearchSuggestions.length > 0 && (
              <div className="app-panel-elevated" style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: '4px',
                borderRadius: '8px',
                maxHeight: '200px',
                overflowY: 'auto',
                zIndex: 10,
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
              }}>
                {nodeSearchSuggestions.map((suggestion, index) => (
                  <div
                    key={suggestion.id}
                    onClick={() => handleSelectNodeSuggestion(suggestion)}
                    style={{
                      padding: '10px 14px',
                      cursor: 'pointer',
                      borderBottom: index < nodeSearchSuggestions.length - 1 ? '1px solid var(--app-hairline)' : 'none',
                      background: index === selectedSearchIndex ? 'var(--app-hover)' : 'transparent',
                      transition: 'background 100ms ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px'
                    }}
                    onMouseEnter={(e) => {
                      if (index !== selectedSearchIndex) {
                        e.currentTarget.style.background = 'var(--app-hover)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (index !== selectedSearchIndex) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                  >
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '9px',
                      fontWeight: 600,
                      color: 'var(--app-accent-contrast)',
                      background: 'var(--toolbar-accent)',
                      padding: '3px 6px',
                      borderRadius: '6px',
                      minWidth: '24px',
                      textAlign: 'center',
                      flexShrink: 0,
                      fontFamily: "'SF Mono', 'Fira Code', monospace"
                    }}>
                      {suggestion.id}
                    </span>
                    <span style={{
                      fontSize: '13px',
                      color: 'var(--app-text)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1
                    }}>
                      {suggestion.title}
                    </span>
                    {index === selectedSearchIndex && (
                      <span style={{ color: 'var(--app-text-subtle)', fontSize: '13px' }}>↵</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Connections List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loadingEdges.has(activeTab) ? (
            <div style={{ color: 'var(--app-text-subtle)', fontSize: '12px', fontStyle: 'italic', padding: '16px 0', textAlign: 'center' }}>Loading connections…</div>
          ) : (() => {
            const list = edgesData[activeTab] || [];
            if (list.length === 0) {
              return <div style={{ color: 'var(--app-text-subtle)', fontSize: '12px', fontStyle: 'italic', padding: '16px 0', textAlign: 'center' }}>No connections yet.</div>;
            }
            return (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {list.map((connection) => (
                  <div
                    key={connection.id}
                    style={{
                      padding: '6px 0',
                      borderBottom: '1px solid var(--app-hairline)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                      minWidth: 0,
                    }}
                  >
                    {/* Row 1: arrow + ID + icon + title + delete */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                      <span style={{
                        fontSize: '11px',
                        color: connection.edge.from_node_id === activeTab ? 'var(--toolbar-accent)' : 'var(--app-warning-text)',
                        fontWeight: 600,
                        width: '14px',
                        textAlign: 'center',
                        flexShrink: 0,
                      }}>
                        {connection.edge.from_node_id === activeTab ? '→' : '←'}
                      </span>
                      <span style={{
                        fontSize: '9px',
                        fontWeight: 700,
                        color: 'var(--app-accent-contrast)',
                        background: 'var(--toolbar-accent)',
                        padding: '1px 5px',
                        borderRadius: '4px',
                        flexShrink: 0,
                        fontFamily: "'SF Mono', 'Fira Code', monospace",
                      }}>
                        {connection.connected_node.id}
                      </span>
                      <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                        {getNodeIcon(connection.connected_node, dimensionIcons, 12)}
                      </span>
                      <span
                        onClick={() => onNodeClick?.(connection.connected_node.id)}
                        style={{
                          fontSize: '12px',
                          color: 'var(--app-text)',
                          fontWeight: 500,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          flex: 1,
                          minWidth: 0,
                          cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--toolbar-accent)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--app-text)'; }}
                      >
                        {connection.connected_node.title}
                      </span>
                      <button
                        onClick={() => deleteEdge(connection.edge.id)}
                        disabled={deletingEdge === connection.edge.id}
                        className="app-button app-button--ghost app-button--compact app-button--danger"
                        style={{
                          fontSize: '14px',
                          cursor: deletingEdge === connection.edge.id ? 'not-allowed' : 'pointer',
                          padding: '0 2px',
                          flexShrink: 0,
                          lineHeight: 1,
                        }}
                      >
                        {deletingEdge === connection.edge.id ? '...' : '×'}
                      </button>
                    </div>
                    {/* Row 2: type chip + explanation (compact, single line) */}
                    {edgeEditingId === connection.edge.id ? (
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center', paddingLeft: '20px' }}>
                        <input
                          className="app-input"
                          value={edgeEditingValue}
                          onChange={(e) => setEdgeEditingValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              saveEdgeExplanation(connection.edge.id, connection.edge.context);
                            } else if (e.key === 'Escape') {
                              e.preventDefault();
                              cancelEditEdgeExplanation();
                            }
                          }}
                          style={{
                            flex: 1,
                            fontSize: '11px',
                            borderRadius: '4px',
                            padding: '3px 6px',
                            outline: 'none',
                            fontFamily: 'inherit',
                            minWidth: 0,
                          }}
                          placeholder="Add explanation…"
                          autoFocus
                        />
                        <button
                          onClick={() => saveEdgeExplanation(connection.edge.id, connection.edge.context)}
                          disabled={edgeSavingId === connection.edge.id}
                          className="app-button app-button--compact"
                          style={{
                            fontSize: '10px',
                            color: 'var(--app-accent-contrast)',
                            background: 'var(--toolbar-accent)',
                            borderColor: 'var(--app-accent-border)',
                            borderRadius: '4px',
                            padding: '3px 8px',
                            cursor: edgeSavingId === connection.edge.id ? 'not-allowed' : 'pointer',
                            fontWeight: 600,
                            flexShrink: 0,
                          }}
                        >
                          {edgeSavingId === connection.edge.id ? '...' : 'Save'}
                        </button>
                        <button
                          onClick={cancelEditEdgeExplanation}
                          className="app-button app-button--ghost app-button--compact"
                          style={{
                            fontSize: '10px',
                            padding: '3px 4px',
                            flexShrink: 0,
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div
                        onClick={() => startEditEdgeExplanation(connection.edge.id, connection.edge.context?.explanation)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          paddingLeft: '20px',
                          cursor: 'pointer',
                          minWidth: 0,
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.8'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
                      >
                        {typeof connection.edge.context?.type === 'string' && (
                          <span className="app-badge" style={{
                            fontSize: '9px',
                            padding: '1px 5px',
                            borderRadius: '999px',
                            flexShrink: 0,
                            whiteSpace: 'nowrap',
                          }}>
                            {String(connection.edge.context.type).replace(/_/g, ' ')}
                          </span>
                        )}
                        <span
                          style={{
                            fontSize: '11px',
                            color: connection.edge.context?.explanation ? 'var(--app-text-muted)' : 'var(--app-text-subtle)',
                            fontStyle: connection.edge.context?.explanation ? 'normal' : 'italic',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            flex: 1,
                            minWidth: 0,
                          }}
                          title={String(connection.edge.context?.explanation || '')}
                        >
                          {(connection.edge.context?.explanation as string) || 'Add explanation...'}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </div>
    );
  };

  const handleConfirmNodeDelete = () => {
    if (pendingDeleteNodeId === null) return;
    executeDeleteNode(pendingDeleteNodeId);
    setPendingDeleteNodeId(null);
  };

  const handleCancelNodeDelete = () => {
    setPendingDeleteNodeId(null);
  };

  const executeDeleteNode = async (nodeId: number) => {
    setDeletingNode(nodeId);
    try {
      const response = await fetch(`/api/nodes/${nodeId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete node');
      }

      onTabClose(nodeId);
      setNodesData(prev => {
        const newData = { ...prev };
        delete newData[nodeId];
        return newData;
      });
      
    } catch (error) {
      console.error('Error deleting node:', error);
      alert('Failed to delete node. Please try again.');
    } finally {
      setDeletingNode(null);
    }
  };

  const confirmDeleteNode = (nodeId: number) => {
    setPendingDeleteNodeId(nodeId);
  };

  return (
    <>
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'transparent' }}>
      {/* Tab Bar - hidden when rendered from NodePane which has its own tab bar */}
      {!hideTabBar && (
        <div className="app-toolbar-surface" style={{
          display: 'flex',
          borderBottom: '1px solid var(--app-border)',
          flexShrink: 0,
          overflowX: 'auto',
          overflowY: 'hidden'
        }}>
          {openTabs.length === 0 ? (
            <div style={{
              padding: '10px 16px',
              fontSize: '12px',
              color: 'var(--app-text-muted)'
            }}>
              No tabs open
            </div>
          ) : (
            openTabs.map((tabId) => {
              const node = nodesData[tabId];
              const isActive = activeTab === tabId;
              const label = node ? truncateTitle(node.title || 'Untitled') : 'Loading...';

              return (
                <div
                  key={tabId}
                  draggable
                  onDragStart={(e) => {
                    const title = node?.title || 'Untitled';
                    e.dataTransfer.effectAllowed = 'copyMove';
                    e.dataTransfer.setData('application/x-rah-tab', JSON.stringify({ id: tabId, title }));
                    e.dataTransfer.setData('text/plain', `[NODE:${tabId}:"${title}"]`);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenu({ x: e.clientX, y: e.clientY, tabId });
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    borderRight: '1px solid var(--app-border)',
                    background: isActive ? 'var(--app-panel)' : 'transparent',
                    borderBottom: isActive ? '2px solid var(--toolbar-accent)' : 'none',
                    paddingBottom: isActive ? '0' : '2px',
                    minWidth: '120px',
                    maxWidth: '200px',
                    cursor: 'grab'
                  }}
                >
                  <button
                    onClick={() => onTabSelect(tabId)}
                    className="app-button app-button--ghost"
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      fontSize: '12px',
                      fontFamily: 'inherit',
                      color: isActive ? 'var(--app-text)' : 'var(--app-text-muted)',
                      background: 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {label}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onTabClose(tabId);
                    }}
                    className="app-button app-button--ghost app-button--compact"
                    style={{
                      padding: '4px 8px',
                      fontSize: '14px',
                      cursor: 'pointer',
                      transition: 'color 0.2s'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--app-text)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--app-text-muted)'; }}
                  >
                    ×
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Content Area */}
      <div style={{ 
        flex: 1, 
        overflow: 'auto',
        padding: '20px',
        position: 'relative'
      }}>
        {!activeTab ? (
          <div style={{
            color: 'var(--app-text-muted)',
            fontSize: '13px',
            textAlign: 'center',
            marginTop: '40px'
          }}>
            Select a node from the left panel to view details
          </div>
        ) : loadingNodes.has(activeTab) ? (
          <div style={{
            color: 'var(--app-text-muted)',
            fontSize: '13px'
          }}>
            Loading...
          </div>
        ) : !currentNode ? (
          <div style={{ color: 'var(--app-text-muted)', fontSize: '13px' }}>Node not found.</div>
        ) : nodesData[activeTab] ? (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* URL Row - Above Title */}
            {/* Node utility row */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              marginBottom: '8px',
              paddingLeft: '4px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flex: 1,
                minWidth: 0
              }}>
                {/* Node ID - Draggable */}
                <span
                  draggable
                  onDragStart={(e: DragEvent<HTMLSpanElement>) => {
                    const title = nodesData[activeTab]?.title || 'Untitled';
                    e.dataTransfer.effectAllowed = 'copyMove';
                    e.dataTransfer.setData('application/x-rah-node', JSON.stringify({ id: activeTab, title }));
                    e.dataTransfer.setData('application/node-info', JSON.stringify({ id: activeTab, title, dimensions: nodesData[activeTab]?.dimensions || [] }));
                    e.dataTransfer.setData('text/plain', `[NODE:${activeTab}:"${title}"]`);
                  }}
                  style={{
                    display: 'inline-block',
                    background: 'var(--toolbar-accent)',
                    color: 'var(--app-accent-contrast)',
                    fontSize: '10px',
                    fontWeight: 600,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    flexShrink: 0,
                    cursor: 'grab'
                  }}
                  title="Drag to chat to reference this node"
                >
                  {activeTab}
                </span>

                {nodesData[activeTab] && (
                  <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center', color: 'var(--app-text-subtle)' }}>
                    {getNodeIcon(nodesData[activeTab], dimensionIcons, 16)}
                  </span>
                )}

                {/* Embedding status - only show when embedding or error */}
                {(() => {
                  const node = nodesData[activeTab];
                  const chunkStatus = node?.chunk_status ?? null;

                  if (embeddingNode === activeTab || chunkStatus === 'chunking') {
                    return (
                      <Loader size={12} className="animate-spin" style={{ color: '#facc15', flexShrink: 0 }} />
                    );
                  }

                  if (chunkStatus === 'error') {
                    return (
                      <button
                        onClick={() => embedContent(activeTab)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '2px 6px',
                          fontSize: '10px',
                          color: '#ef4444',
                          background: 'transparent',
                          border: '1px solid #7f1d1d',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          flexShrink: 0
                        }}
                        title="Embedding failed - click to retry"
                      >
                        <Database size={10} />
                        Retry
                      </button>
                    );
                  }

                  return null;
                })()}

                <div style={{ flex: 1, minWidth: 0 }}>
                  {editingField === 'link' ? (
                    <input
                      ref={inputRef as React.RefObject<HTMLInputElement>}
                      type="url"
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      onBlur={handleBlur}
                      disabled={savingField === 'link'}
                      style={{
                        color: 'var(--app-info-text)',
                        fontSize: '11px',
                        background: 'transparent',
                        border: '1px solid var(--app-border)',
                        borderRadius: '4px',
                        padding: '4px 6px',
                        fontFamily: 'inherit',
                        width: '100%',
                        outline: 'none'
                      }}
                      placeholder="Enter URL..."
                    />
                  ) : nodesData[activeTab].link ? (
                    <a
                      href={nodesData[activeTab].link}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => {
                        if (e.metaKey || e.ctrlKey) {
                          e.preventDefault();
                          startEdit('link', nodesData[activeTab].link || '');
                        }
                      }}
                      style={{
                        color: 'var(--app-text-muted)',
                        textDecoration: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '11px',
                        minWidth: 0,
                        whiteSpace: 'nowrap',
                      }}
                      title={`${nodesData[activeTab].link} (Cmd+Click to edit)`}
                    >
                      <ExternalLink size={10} style={{ flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {(() => { try { return new URL(nodesData[activeTab].link!).hostname; } catch { return nodesData[activeTab].link; } })()}
                      </span>
                    </a>
                  ) : null}
                </div>
              </div>

              {/* Delete Button */}
              <button
                onClick={() => confirmDeleteNode(activeTab)}
                disabled={deletingNode === activeTab}
                style={{
                  width: '28px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: deletingNode === activeTab ? 'var(--app-danger-text)' : 'var(--app-text-subtle)',
                  background: 'transparent',
                  border: '1px solid var(--app-border)',
                  borderRadius: '6px',
                  cursor: deletingNode === activeTab ? 'wait' : 'pointer',
                  transition: 'all 0.2s',
                  flexShrink: 0,
                  marginTop: '-12px',
                  marginRight: '-8px',
                }}
                onMouseEnter={(e) => {
                  if (deletingNode !== activeTab) {
                    e.currentTarget.style.color = '#dc2626';
                    e.currentTarget.style.borderColor = '#dc2626';
                    e.currentTarget.style.background = 'rgba(220, 38, 38, 0.1)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (deletingNode !== activeTab) {
                    e.currentTarget.style.color = 'var(--app-text-subtle)';
                    e.currentTarget.style.borderColor = 'var(--app-border)';
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
                title="Delete node"
              >
                {deletingNode === activeTab ? '...' : <Trash2 size={12} />}
              </button>
            </div>

            {/* Title row */}
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              marginBottom: '8px'
            }}>
              {editingField === 'title' ? (
                <input
                  ref={inputRef as React.RefObject<HTMLInputElement>}
                  type="text"
                  value={editingValue}
                  onChange={(e) => setEditingValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={handleBlur}
                  disabled={savingField === 'title'}
                  style={{
                    fontSize: '20px',
                    fontWeight: 'bold',
                    color: 'var(--app-text)',
                    background: 'transparent',
                    border: '1px solid var(--app-border)',
                    borderRadius: '0',
                    padding: '4px 8px',
                    fontFamily: 'inherit',
                    flex: 1,
                    outline: 'none'
                  }}
                  placeholder="Enter title..."
                />
              ) : (
                <h1
                  onClick={() => startEdit('title', nodesData[activeTab].title || '')}
                  style={{
                    fontSize: '20px',
                    fontWeight: 'bold',
                    color: 'var(--app-text)',
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    padding: '4px 8px',
                    margin: '0',
                    borderRadius: '0',
                    background: 'transparent',
                    border: '1px solid transparent',
                    transition: 'border-color 0.2s',
                    flex: 1,
                    minWidth: 0,
                    whiteSpace: 'normal',
                    wordBreak: 'break-word',
                    overflowWrap: 'anywhere',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--app-border)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'transparent';
                  }}
                  title={nodesData[activeTab].title || 'Untitled'}
                >
                  {nodesData[activeTab].title || 'Untitled'}
                  {savingField === 'title' && <span style={{ color: 'var(--app-text-subtle)', fontSize: '10px', marginLeft: '6px' }}>saving...</span>}
                </h1>
              )}
            </div>

            {/* Dimensions Section */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{
                overflowX: 'auto',
                overflowY: 'visible',
                position: 'relative'
              }}>
                <DimensionTags
                dimensions={nodesData[activeTab].dimensions || []}
                priorityDimensions={priorityDimensions}
                onUpdate={async (newDimensions) => {
                  try {
                    const response = await fetch(`/api/nodes/${activeTab}`, {
                      method: 'PUT',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({ dimensions: newDimensions }),
                    });

                    if (!response.ok) {
                      throw new Error('Failed to save');
                    }

                    const result = await response.json();
                    if (result.node) {
                      setNodesData(prev => ({ ...prev, [activeTab]: result.node }));
                    }
                  } catch (error) {
                    console.error('Error saving dimensions:', error);
                    alert('Failed to save dimensions. Please try again.');
                  }
                }}
                onPriorityToggle={async (dimension) => {
                  try {
                    const response = await fetch('/api/dimensions/popular', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({ dimension }),
                    });

                    if (!response.ok) {
                      throw new Error('Failed to toggle priority');
                    }

                    // Refresh priority dimensions list
                    await fetchPriorityDimensions();
                  } catch (error) {
                    console.error('Error toggling priority:', error);
                    alert('Failed to toggle priority. Please try again.');
                  }
                }}
                disabled={false}
              />
              </div>
            </div>

            {/* Notes | Connections | Source Tabs */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              {/* Tab Bar */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0',
                marginBottom: '12px',
                borderBottom: '1px solid var(--app-border)'
              }}>
                <button
                  onClick={() => { setActiveContentTab('notes'); setDescEditMode(false); setSourceEditMode(false); setMetadataEditMode(false); setPendingAnnotation(null); }}
                  className={`app-tab${activeContentTab === 'notes' ? ' is-active' : ''}`}
                  style={{
                    padding: '8px 16px',
                    fontSize: '11px',
                    fontWeight: activeContentTab === 'notes' ? 600 : 400,
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    marginBottom: '-1px'
                  }}
                >
                  Notes
                </button>
                <button
                  onClick={() => { setActiveContentTab('edges'); setDescEditMode(false); setNotesEditMode(false); setSourceEditMode(false); setMetadataEditMode(false); setPendingAnnotation(null); }}
                  className={`app-tab${activeContentTab === 'edges' ? ' is-active' : ''}`}
                  style={{
                    padding: '8px 16px',
                    fontSize: '11px',
                    fontWeight: activeContentTab === 'edges' ? 600 : 400,
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    marginBottom: '-1px'
                  }}
                >
                  Connections{activeTab && edgesData[activeTab]?.length ? ` (${edgesData[activeTab].length})` : ''}
                </button>
                <button
                  onClick={() => { setActiveContentTab('source'); setDescEditMode(false); setNotesEditMode(false); setMetadataEditMode(false); setEdgeSearchOpen(false); setPendingAnnotation(null); }}
                  className={`app-tab${activeContentTab === 'source' ? ' is-active' : ''}`}
                  style={{
                    padding: '8px 16px',
                    fontSize: '11px',
                    fontWeight: activeContentTab === 'source' ? 600 : 400,
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    marginBottom: '-1px'
                  }}
                >
                  Source
                </button>
                {isBookNode && (
                  <button
                    onClick={() => { setActiveContentTab('metadata'); setDescEditMode(false); setNotesEditMode(false); setSourceEditMode(false); setPendingAnnotation(null); }}
                    className={`app-tab${activeContentTab === 'metadata' ? ' is-active' : ''}`}
                    style={{
                      padding: '8px 16px',
                      fontSize: '11px',
                      fontWeight: activeContentTab === 'metadata' ? 600 : 400,
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      marginBottom: '-1px'
                    }}
                  >
                    Metadata
                  </button>
                )}
                <div style={{ flex: 1 }} />
                {/* Action buttons for Notes tab */}
                {activeContentTab === 'notes' && !notesEditMode && (
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
                    <button
                      onClick={startNotesEdit}
                      className="app-button app-button--secondary app-button--compact app-button--icon"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 8px',
                        fontSize: '10px',
                        borderRadius: '4px',
                      }}
                      title="Edit notes"
                    >
                      <Pencil size={12} />
                      Edit
                    </button>
                  </div>
                )}
                {/* Formatting toolbar for Notes edit mode - inline */}
                {activeContentTab === 'notes' && notesEditMode && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <FormattingToolbar
                      textareaRef={notesTextareaRef}
                      value={notesEditValue}
                      onChange={setNotesEditValue}
                      inline
                    />
                  </div>
                )}
                {/* Action button for Edges tab */}
                {activeContentTab === 'edges' && (
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
                    <button
                      onClick={() => {
                        setEdgeSearchOpen(!edgeSearchOpen);
                        if (edgeSearchOpen) {
                          setNodeSearchQuery('');
                          setNodeSearchSuggestions([]);
                        }
                      }}
                      className={`app-button app-button--accent app-button--compact app-button--icon${edgeSearchOpen ? ' is-active' : ''}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 8px',
                        fontSize: '10px',
                        borderRadius: '4px',
                        fontWeight: 600,
                      }}
                    >
                      <Plus size={12} />
                      {edgeSearchOpen ? 'Cancel' : 'Create'}
                    </button>
                  </div>
                )}
              </div>

              {/* Notes Tab Content */}
              {activeContentTab === 'notes' && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  {/* Description preview — compact, above notes body */}
                  {descEditMode ? (
                    <div style={{ marginBottom: '12px', flexShrink: 0 }}>
                      <div style={{
                        fontSize: '11px', color: '#f59e0b',
                        marginBottom: '6px', padding: '5px 8px',
                        background: '#1a1500', borderRadius: '4px', border: '1px solid #3d3500'
                      }}>
                        Used as context for AI. 280 chars or less.
                      </div>
                      <div style={{ position: 'relative' }}>
                        <textarea
                          value={descEditValue}
                          onChange={(e) => setDescEditValue(e.target.value.slice(0, 280))}
                          onKeyDown={(e) => { if (e.key === 'Escape') cancelDescEdit(); }}
                          disabled={descSaving}
                          style={{ ...FOCUS_PANEL_BODY_TEXTAREA_STYLE, minHeight: '72px', width: '100%', paddingBottom: '22px' }}
                          placeholder="Brief description (max 280 chars)..."
                          maxLength={280}
                          autoFocus
                        />
                        <span style={{
                          position: 'absolute', bottom: '8px', right: '10px',
                          fontSize: '10px', color: descEditValue.length >= 260 ? '#f59e0b' : '#555'
                        }}>
                          {descEditValue.length}/280
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                        <button
                          onClick={syncDescToSource}
                          disabled={descSaving}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '4px',
                            padding: '4px 8px', fontSize: '10px', color: '#f59e0b',
                            background: 'transparent', border: '1px solid #3d3500', borderRadius: '4px', cursor: 'pointer'
                          }}
                          title="Copy description to source and re-embed"
                        >
                          {descSaving ? <Loader size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                          Sync to Source
                        </button>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            onClick={cancelDescEdit}
                            disabled={descSaving}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '3px',
                              padding: '4px 10px', fontSize: '11px', color: '#888',
                              background: 'transparent', border: '1px solid #2a2a2a', borderRadius: '4px', cursor: 'pointer'
                            }}
                          >
                            <X size={11} /> Cancel
                          </button>
                          <button
                            onClick={saveDesc}
                            disabled={descSaving}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '3px',
                              padding: '4px 10px', fontSize: '11px', color: '#000',
                              background: '#22c55e', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600
                            }}
                          >
                            {descSaving ? <Loader size={11} className="animate-spin" /> : <Save size={11} />}
                            Save
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : nodesData[activeTab]?.description ? (() => {
                    const desc = nodesData[activeTab].description!;
                    const PREVIEW_LEN = 120;
                    const isLong = desc.length > PREVIEW_LEN;
                    const displayText = isLong && !descExpanded
                      ? desc.slice(0, PREVIEW_LEN).trimEnd() + '…'
                      : desc;
                    return (
                      <div style={{
                        marginBottom: '12px', flexShrink: 0,
                        fontSize: '12px', color: 'var(--app-text-muted)', lineHeight: 1.5,
                        padding: '6px 8px', borderRadius: '4px',
                        background: 'var(--app-panel)', border: '1px solid var(--app-border)',
                      }}>
                        {displayText}
                        <span style={{ marginLeft: '4px', whiteSpace: 'nowrap' }}>
                          {isLong && (
                            <button
                              onClick={() => setDescExpanded(v => !v)}
                              style={{ background: 'none', border: 'none', padding: 0, fontSize: '11px', color: 'var(--toolbar-accent)', cursor: 'pointer', fontWeight: 500 }}
                            >
                              {descExpanded ? 'Show less' : 'Show more'}
                            </button>
                          )}
                          <button
                            onClick={startDescEdit}
                            style={{ background: 'none', border: 'none', padding: '0 0 0 8px', fontSize: '11px', color: 'var(--app-text-subtle)', cursor: 'pointer' }}
                          >
                            Edit
                          </button>
                        </span>
                      </div>
                    );
                  })() : null}

                  {notesEditMode ? (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      {/* Editor */}
                      <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <textarea
                          ref={notesTextareaRef}
                          value={notesEditValue}
                          onChange={(e) => {
                            const val = e.target.value;
                            setNotesEditValue(val);
                            // Detect @mention
                            const caret = e.target.selectionStart || val.length;
                            const trig = findAtTrigger(val, caret);
                            if (trig) {
                              setMentionActive(true);
                              setMentionQuery(trig.query);
                              if (mentionTimeout.current) clearTimeout(mentionTimeout.current);
                              mentionTimeout.current = setTimeout(() => runMentionSearch(trig.query), 280);
                            } else if (mentionActive) {
                              resetMention();
                            }
                          }}
                          onKeyDown={(e) => {
                            // @mention navigation
                            if (mentionActive && mentionResults.length > 0) {
                              if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                setMentionIndex(i => Math.min(i + 1, mentionResults.length - 1));
                                return;
                              }
                              if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                setMentionIndex(i => Math.max(i - 1, 0));
                                return;
                              }
                              if (e.key === 'Enter' && mentionResults[mentionIndex]) {
                                e.preventDefault();
                                handleNotesMentionSelect(mentionResults[mentionIndex].id, mentionResults[mentionIndex].title);
                                return;
                              }
                              if (e.key === 'Escape') {
                                e.preventDefault();
                                resetMention();
                                return;
                              }
                            }
                            if (e.key === 'Escape') {
                              cancelNotesEdit();
                            }
                          }}
                          disabled={notesSaving}
                          style={{
                            ...FOCUS_PANEL_BODY_TEXTAREA_STYLE,
                            flex: 1,
                            minHeight: '200px',
                          }}
                          placeholder="Start writing... Use @ to mention nodes, and Markdown for formatting."
                        />
                        {/* @mention dropdown */}
                        {mentionActive && (
                          <div style={{
                            position: 'absolute',
                            top: '50px',
                            left: '12px',
                            background: '#1a1a1a',
                            border: '1px solid #333',
                            borderRadius: '6px',
                            zIndex: 1000,
                            maxHeight: '200px',
                            overflowY: 'auto',
                            minWidth: '300px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                          }}>
                            {mentionQuery.trim().length < 2 ? (
                              <div style={{ padding: '8px 12px', fontSize: '12px', color: '#666' }}>
                                Type at least 2 characters to search...
                              </div>
                            ) : mentionResults.length === 0 ? (
                              <div style={{ padding: '8px 12px', fontSize: '12px', color: '#666' }}>
                                No nodes found
                              </div>
                            ) : (
                              mentionResults.map((n, idx) => (
                                <div
                                  key={n.id}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    handleNotesMentionSelect(n.id, n.title);
                                  }}
                                  onMouseEnter={() => setMentionIndex(idx)}
                                  style={{
                                    padding: '8px 12px',
                                    fontSize: '13px',
                                    color: '#ddd',
                                    cursor: 'pointer',
                                    background: idx === mentionIndex ? '#252525' : 'transparent',
                                    borderBottom: idx < mentionResults.length - 1 ? '1px solid #2a2a2a' : 'none'
                                  }}
                                >
                                  <span style={{ color: '#22c55e', marginRight: '8px', fontWeight: 600 }}>{n.id}</span>
                                  <span>{n.title.length > 50 ? n.title.slice(0, 50) + '…' : n.title}</span>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                      {/* Save/Cancel/Sync buttons */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: '12px'
                      }}>
                        {/* Sync to Source button - left side */}
                        <div>
                          {nodesData[activeTab]?.notes && (
                            <button
                              onClick={() => setShowSyncConfirm(true)}
                              disabled={notesSaving || syncing}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '6px 10px',
                                fontSize: '10px',
                                color: '#f59e0b',
                                background: 'transparent',
                                border: '1px solid #3d3500',
                                borderRadius: '4px',
                                cursor: 'pointer'
                              }}
                              title="Copy notes to source and re-embed"
                            >
                              {syncing ? <Loader size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                              Sync to Source
                            </button>
                          )}
                        </div>
                        {/* Save/Cancel - right side */}
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={cancelNotesEdit}
                            disabled={notesSaving || syncing}
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
                              cursor: 'pointer'
                            }}
                          >
                            <X size={14} />
                            Cancel
                          </button>
                          <button
                            onClick={saveNotes}
                            disabled={notesSaving || syncing}
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
                              fontWeight: 600
                            }}
                          >
                            {notesSaving ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
                            Save
                          </button>
                        </div>
                      </div>
                      {/* Sync confirmation dialog */}
                      {showSyncConfirm && (
                        <div style={{
                          marginTop: '12px',
                          padding: '12px',
                          background: '#1a1500',
                          border: '1px solid #3d3500',
                          borderRadius: '4px'
                        }}>
                          <div style={{ fontSize: '12px', color: '#f59e0b', marginBottom: '8px' }}>
                            This will overwrite your source content and update what search uses.
                          </div>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => setShowSyncConfirm(false)}
                              style={{
                                padding: '4px 10px',
                                fontSize: '11px',
                                color: '#888',
                                background: 'transparent',
                                border: '1px solid #2a2a2a',
                                borderRadius: '4px',
                                cursor: 'pointer'
                              }}
                            >
                              Cancel
                            </button>
                            <button
                              onClick={syncToSource}
                              style={{
                                padding: '4px 10px',
                                fontSize: '11px',
                                color: '#000',
                                background: '#f59e0b',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: 600
                              }}
                            >
                              Sync Now
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : nodesData[activeTab]?.notes ? (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
                      <div
                        style={{
                          ...FOCUS_PANEL_BODY_TEXT_STYLE,
                          padding: '4px',
                          flex: 1,
                        }}
                      >
                        <MarkdownWithNodeTokens
                          content={normalizedNotesContent}
                          onNodeClick={onNodeClick || onTabSelect}
                          annotations={activeNodeId !== null && annotationsData[activeNodeId]
                            ? Object.fromEntries(annotationsData[activeNodeId].map(a => [a.id, a]))
                            : {}}
                          onJumpToSource={handleJumpToSource}
                          onDeleteAnnotation={deleteAnnotation}
                        />
                      </div>
                      <div style={{ padding: '16px 4px 4px', borderTop: '1px solid var(--app-border)', marginTop: '12px' }}>
                        <button
                          onClick={createLinkedNote}
                          disabled={creatingNote}
                          className="app-button app-button--secondary app-button--compact app-button--icon"
                          style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px', fontSize: '11px', borderRadius: '4px' }}
                          title="Create a new linked node"
                        >
                          {creatingNote ? <Loader size={12} className="animate-spin" /> : <Plus size={12} />}
                          Create related node
                        </button>
                      </div>
                    </div>
                  ) : notesIngestionStatus ? (
                    renderPendingState(notesIngestionStatus)
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0', padding: '8px 4px' }}>

                      {/* Group 1: Notes actions */}
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', padding: '8px 0' }}>
                        <button
                          onClick={startNotesEdit}
                          className="app-button app-button--compact"
                          style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 500 }}
                        >
                          <Pencil size={12} />
                          Write notes
                        </button>
                        {nodesData[activeTab]?.chunk && (
                          <button
                            onClick={generateNotesFromSource}
                            disabled={generatingNotesFromSource}
                            className="app-button app-button--secondary app-button--compact"
                            style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 500 }}
                          >
                            {generatingNotesFromSource ? <Loader size={12} className="animate-spin" /> : <Sparkles size={12} />}
                            {generatingNotesFromSource ? 'Generating…' : 'Generate notes'}
                          </button>
                        )}
                      </div>

                      {/* Divider */}
                      {nodesData[activeTab]?.chunk && (
                        <div style={{ width: '100%', height: '1px', background: 'var(--app-border)' }} />
                      )}

                      {/* Group 2: Source action (conditional) */}
                      {nodesData[activeTab]?.chunk && (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
                          <button
                            onClick={() => setActiveContentTab('source')}
                            className="app-button app-button--secondary app-button--compact"
                            style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 500 }}
                          >
                            <BookOpen size={12} />
                            View source
                          </button>
                        </div>
                      )}

                      {/* Divider */}
                      <div style={{ width: '100%', height: '1px', background: 'var(--app-border)' }} />

                      {/* Group 3: Graph action */}
                      <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
                        <button
                          onClick={createLinkedNote}
                          disabled={creatingNote}
                          className="app-button app-button--secondary app-button--compact"
                          style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 500 }}
                        >
                          {creatingNote ? <Loader size={12} className="animate-spin" /> : <Link size={12} />}
                          New linked node
                        </button>
                      </div>

                    </div>
                  )}
                </div>
              )}

              {/* Edges Tab Content */}
              {activeContentTab === 'edges' && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
                  {renderConnectionsBody()}
                </div>
              )}

              {/* Source Tab Content */}
              {activeContentTab === 'source' && (
                <div
                  data-source-container
                  style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
                >
                  {sourceEditMode ? (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <div style={{
                        fontSize: '11px',
                        color: 'var(--app-text)',
                        marginBottom: '8px',
                        padding: '8px',
                        background: 'color-mix(in srgb, var(--app-panel) 84%, #f59e0b 16%)',
                        borderRadius: '4px',
                        border: '1px solid color-mix(in srgb, var(--app-border) 70%, #f59e0b 30%)'
                      }}>
                        Editing source changes what search uses. This is the raw content that gets embedded.
                      </div>
                      <textarea
                        value={sourceEditValue}
                        onChange={(e) => setSourceEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            cancelSourceEdit();
                          }
                        }}
                        disabled={sourceSaving}
                        style={{
                          ...FOCUS_PANEL_BODY_TEXTAREA_STYLE,
                          flex: 1,
                          minHeight: '200px',
                          fontSize: '13px',
                          lineHeight: '1.65',
                          fontFamily: 'ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, \"Liberation Mono\", monospace',
                        }}
                        placeholder="Add source content for embedding..."
                      />
                      <div style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: '8px',
                        marginTop: '12px'
                      }}>
                        <button
                          onClick={cancelSourceEdit}
                          disabled={sourceSaving}
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
                            cursor: 'pointer'
                          }}
                        >
                          <X size={14} />
                          Cancel
                        </button>
                        <button
                          onClick={saveSource}
                          disabled={sourceSaving}
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
                            fontWeight: 600
                          }}
                        >
                          {sourceSaving ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                      {/* Mode toggle and edit button */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '8px',
                        flexShrink: 0,
                      }}>
                        {/* Raw / Reader toggle */}
                        <div style={{
                          display: 'flex',
                          background: 'var(--app-surface-subtle)',
                          borderRadius: '4px',
                          border: '1px solid var(--app-border)',
                          overflow: 'hidden',
                        }}>
                          <button
                            onClick={() => setSourceReaderMode('raw')}
                            className={`app-button app-button--secondary app-button--compact${sourceReaderMode === 'raw' ? ' is-active' : ''}`}
                            style={{
                              padding: '4px 10px',
                              fontSize: '10px',
                              fontWeight: 500,
                              border: 'none',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            Raw
                          </button>
                          <button
                            onClick={() => setSourceReaderMode('reader')}
                            className={`app-button app-button--secondary app-button--compact${sourceReaderMode === 'reader' ? ' is-active' : ''}`}
                            style={{
                              padding: '4px 10px',
                              fontSize: '10px',
                              fontWeight: 500,
                              border: 'none',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            Reader
                          </button>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {activeTab !== null && nodesData[activeTab] && (
                            <button
                              onClick={() => setReaderNodeId(activeTab)}
                              className="app-button app-button--accent app-button--compact app-button--icon"
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 8px',
                                fontSize: '10px',
                                borderRadius: '4px',
                              }}
                            >
                              <BookOpen size={10} />
                              Open in Reader
                            </button>
                          )}

                          <button
                            onClick={startSourceEdit}
                            className="app-button app-button--secondary app-button--compact app-button--icon"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '4px 8px',
                              fontSize: '10px',
                              borderRadius: '4px',
                            }}
                          >
                            <Pencil size={10} />
                            Edit
                          </button>
                        </div>
                      </div>

                      {/* Content display */}
                      <div style={{ flex: 1, overflow: 'auto' }}>
                        {nodesData[activeTab]?.chunk ? (
                          sourceReaderMode === 'reader' ? (
                            <SourceReader
                              content={nodesData[activeTab].chunk}
                              nodeTitle={nodesData[activeTab]?.title || undefined}
                              onTextSelect={onTextSelect ? (text) => onTextSelect(activeTab, nodesData[activeTab]?.title || 'Untitled', text) : undefined}
                              onSourceSelect={(selection) => {
                                setPendingAnnotation({
                                  text: selection.text,
                                  charOffset: selection.start,
                                  position: {
                                    x: selection.rect.left + selection.rect.width / 2,
                                    y: selection.rect.top,
                                  },
                                });
                              }}
                              annotations={activeNodeId !== null ? (annotationsData[activeNodeId] ?? []) : []}
                              highlightedText={localHighlight?.text ?? (highlightedPassage?.nodeId === activeTab ? highlightedPassage.selectedText : null)}
                              highlightMatchIndex={localHighlight?.matchIndex ?? 0}
                            />
                          ) : (
                            <div
                              style={{
                                color: 'var(--app-text)',
                                fontSize: '12px',
                                lineHeight: '1.5',
                                padding: '12px',
                                background: 'var(--app-panel)',
                                border: '1px solid var(--app-border)',
                                borderRadius: '4px',
                                fontFamily: 'monospace',
                                whiteSpace: 'pre-wrap',
                                minHeight: '100%',
                              }}
                            >
                              {normalizedSourceContent}
                            </div>
                          )
                        ) : sourceIngestionStatus ? (
                          renderPendingState(sourceIngestionStatus)
                        ) : (
                          <div
                            onClick={startSourceEdit}
                            style={{
                              color: 'var(--app-text-subtle)',
                              fontSize: '12px',
                              fontStyle: 'italic',
                              cursor: 'pointer',
                              padding: '12px',
                              border: '1px dashed var(--app-border)',
                              borderRadius: '4px',
                              textAlign: 'center',
                              height: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            No source content. Click to add.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Metadata Tab Content */}
              {activeContentTab === 'metadata' && (
                <BookMetadataTab
                  nodeId={activeTab}
                  metadata={currentMetadata}
                  editMode={metadataEditMode}
                  saving={metadataSaving}
                  retrying={metadataRetrying}
                  confirming={metadataConfirming}
                  editValue={metadataEditValue}
                  candidates={metadataCandidates}
                  selectedCandidateIndex={selectedMetadataCandidateIndex}
                  onEditValueChange={setMetadataEditValue}
                  onSelectedCandidateChange={setSelectedMetadataCandidateIndex}
                  onRetry={retryMetadataEnrichment}
                  onConfirmCandidate={confirmMetadataCandidate}
                  onStartEdit={startMetadataEdit}
                  onCancelEdit={cancelMetadataEdit}
                  onSaveEdit={saveMetadataFields}
                />
              )}
            </div>
          </div>
        ) : (
          <div style={{
            color: '#666',
            fontSize: '13px'
          }}>
            Node not found
          </div>
        )}
      </div>
    </div>
    {pendingAnnotation && activeContentTab === 'source' && (
      <AnnotationToolbar
        position={pendingAnnotation.position}
        onAnnotate={(color, comment) => {
          createAnnotation(color, comment);
          // Toolbar calls onDismiss after onAnnotate — let onDismiss handle cleanup
        }}
        onDismiss={() => {
          setPendingAnnotation(null);
          window.getSelection()?.removeAllRanges();
        }}
      />
    )}
    <ConfirmDialog
      open={pendingDeleteNodeId !== null}
      title="Delete this node?"
      message="This will permanently remove the node and its data."
      confirmLabel="Delete"
      onConfirm={handleConfirmNodeDelete}
      onCancel={handleCancelNodeDelete}
    />
    {readerNodeId !== null && nodesData[readerNodeId] && (
      <BookReader
        nodeId={readerNodeId}
        title={nodesData[readerNodeId].title}
        content={nodesData[readerNodeId].chunk || ''}
        link={nodesData[readerNodeId].link}
        metadata={nodesData[readerNodeId].metadata}
        annotations={annotationsData[readerNodeId] ?? []}
        onClose={() => setReaderNodeId(null)}
        onProgressUpdate={(progress) => {
          if (progress) {
            updateReaderProgress(readerNodeId, progress);
          }
        }}
        onCreateAnnotation={(annotation) => createAnnotationForNode(readerNodeId, annotation)}
      />
    )}
    {/* Tab Context Menu */}
    {contextMenu && (
      <div
        style={{
          position: 'fixed',
          top: contextMenu.y,
          left: contextMenu.x,
          background: '#1a1a1a',
          border: '1px solid #2a2a2a',
          borderRadius: '6px',
          padding: '4px',
          zIndex: 9999,
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          minWidth: '160px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {onOpenInOtherSlot && (
          <button
            onClick={() => {
              onOpenInOtherSlot(contextMenu.tabId);
              setContextMenu(null);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              padding: '8px 12px',
              background: 'transparent',
              border: 'none',
              borderRadius: '4px',
              color: '#ccc',
              fontSize: '12px',
              cursor: 'pointer',
              textAlign: 'left',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#2a2a2a';
              e.currentTarget.style.color = '#fff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#ccc';
            }}
          >
            <span style={{ fontSize: '14px' }}>↗</span>
            Open in other panel
          </button>
        )}
        <button
          onClick={() => {
            onTabClose(contextMenu.tabId);
            setContextMenu(null);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            width: '100%',
            padding: '8px 12px',
            background: 'transparent',
            border: 'none',
            borderRadius: '4px',
            color: '#ccc',
            fontSize: '12px',
            cursor: 'pointer',
            textAlign: 'left',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#2a2a2a';
            e.currentTarget.style.color = '#fff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = '#ccc';
          }}
        >
          <span style={{ fontSize: '14px' }}>×</span>
          Close tab
        </button>
      </div>
    )}

  </>
  );
}
