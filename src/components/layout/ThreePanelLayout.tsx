"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import SettingsModal, { SettingsTab } from '../settings/SettingsModal';
import SearchModal from '../nodes/SearchModal';
import DocsModal from '../docs/DocsModal';
import { Node } from '@/types/database';
import { usePersistentState } from '@/hooks/usePersistentState';
import { useAppShell } from './AppShellProvider';
// ChatMessage import removed - chat disabled in rah-light

// Stub type for delegation (delegation system removed in rah-light)
type AgentDelegation = {
  id: number;
  sessionId: string;
  task: string;
  context: string[];
  status: 'queued' | 'in_progress' | 'completed' | 'failed';
  summary?: string | null;
  agentType: string;
  createdAt: string;
  updatedAt: string;
};

// Layout components
import LeftToolbar from './LeftToolbar';
import SplitHandle from './SplitHandle';
import { getSplitPaneBasis } from './splitPaneLayout';

// Pane components (ChatPane removed in rah-light, GuidesPane moved to settings)
import { NodePane, DimensionsPane, MapPane, ViewsPane, TablePane, WikiPane, LibraryPane, LogPane } from '../panes';
import QuickAddInput from '../agents/QuickAddInput';
import type { PaneType, SlotState, PaneAction } from '../panes/types';
import type { ReaderFormatValue } from '@/lib/readerFormat';

export default function ThreePanelLayout() {
  // Container ref for resize calculations
  const containerRef = useRef<HTMLDivElement>(null);

  // Slot states - the core of the flexible pane system
  // Default: Feed on left, closed on right (chat removed in rah-light)
  const [slotA, setSlotA] = usePersistentState<SlotState | null>('ui.slotA.v4', {
    type: 'views',
  });

  // SlotB can be null (closed) or a SlotState
  // Default: closed (chat removed in rah-light)
  const [slotB, setSlotB] = usePersistentState<SlotState | null>('ui.slotB.v4', null);

  // SlotB width as percentage (when open)
  const [slotBWidth, setSlotBWidth] = usePersistentState<number>('ui.slotBWidth', 50);

  // Migration: if a slot was persisted with type 'guides' or 'skills', reset it
  useEffect(() => {
    if (slotA && (((slotA.type as string) === 'guides') || ((slotA.type as string) === 'skills'))) {
      setSlotA({ type: 'views' });
    }
    if (slotB && (((slotB.type as string) === 'guides') || ((slotB.type as string) === 'skills'))) {
      setSlotB(null);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Track which pane is active (last interacted with)
  const [activePane, setActivePane] = useState<'A' | 'B'>('A');

  // Settings modal state
  const [showSettings, setShowSettings] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<SettingsTab>();
  const [showDocs, setShowDocs] = useState(false);
  const handleCloseSettings = useCallback(() => {
    setShowSettings(false);
    setSettingsInitialTab(undefined);
  }, []);

  // Search modal state
  const [showSearchModal, setShowSearchModal] = useState(false);

  // Add Stuff modal state
  const [showAddStuff, setShowAddStuff] = useState(false);

  // Track selected nodes (for context)
  const [selectedNodes, setSelectedNodes] = useState<Set<number>>(new Set<number>());

  // Open tabs data (full node objects for context)
  const [openTabsData, setOpenTabsData] = useState<Node[]>([]);

  // Active dimension tracking
  const [activeDimension, setActiveDimension] = usePersistentState<string | null>('ui.focus.activeDimension', null);

  // Delegations state (deprecated - kept for component compatibility)
  const [delegationsMap] = useState<Record<string, AgentDelegation>>({});
  const delegations = useMemo(() => Object.values(delegationsMap), [delegationsMap]);

  // Source awareness - highlighted passage context
  const [highlightedPassage, setHighlightedPassage] = useState<{
    nodeId: number;
    nodeTitle: string;
    selectedText: string;
  } | null>(null);

  const {
    refreshState,
    pendingNodes,
    dismissPendingNode,
    setOpenTabs,
    submitQuickAdd,
    refreshAll,
    openLogEntry,
    consumeOpenLogEntry,
  } = useAppShell();

  // Ref to get current openTabs value in SSE handler
  const openTabsRef = useRef<number[]>([]);

  // Get open tabs from the slot that has nodes
  // Memoize to prevent infinite re-renders
  const { openTabs, activeTab } = useMemo(() => {
    const slotAHasNodes = slotA?.type === 'node';
    const slotBHasNodes = slotB?.type === 'node';

    // Use Slot A if it has nodes
    if (slotAHasNodes && slotA) {
      return {
        openTabs: slotA.nodeTabs ?? [],
        activeTab: slotA.activeNodeTab ?? null,
      };
    }

    // Fallback: use Slot B if it has nodes
    if (slotBHasNodes && slotB) {
      return {
        openTabs: slotB.nodeTabs ?? [],
        activeTab: slotB.activeNodeTab ?? null,
      };
    }

    return { openTabs: [], activeTab: null };
  }, [slotA, slotB]);

  // Fetch full node data for open tabs
  const fetchOpenTabsData = async (tabIds: number[]) => {
    if (tabIds.length === 0) {
      setOpenTabsData([]);
      return;
    }

    try {
      const nodePromises = tabIds.map(async (id) => {
        const response = await fetch(`/api/nodes/${id}`);
        if (response.ok) {
          const data = await response.json();
          return data.node as Node;
        }
        return null;
      });

      const nodes = await Promise.all(nodePromises);
      const validNodes = nodes.filter((node): node is Node => Boolean(node)).map(node => ({
        id: node.id,
        title: node.title,
        link: node.link,
        notes: node.notes,
        dimensions: node.dimensions,
        created_at: node.created_at,
        updated_at: node.updated_at,
        chunk_status: node.chunk_status,
        chunk: node.chunk,
        metadata: node.metadata,
      }));
      setOpenTabsData(validNodes);
    } catch (error) {
      console.error('Failed to fetch tab data:', error);
      setOpenTabsData([]);
    }
  };

  // Update tab data whenever openTabs changes or focus panel refreshes (use string key to prevent infinite loops)
  const openTabsKey = openTabs.join(',');
  useEffect(() => {
    openTabsRef.current = openTabs;
    setOpenTabs(openTabs);
    fetchOpenTabsData(openTabs);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openTabsKey, refreshState.focus, setOpenTabs]);

  // Delegations loading removed (delegation system removed in rah-light)

  // Refresh all panes
  const handleRefreshAll = useCallback(() => {
    refreshAll();
  }, [refreshAll]);

  // Keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K - open search modal
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearchModal(true);
      }
      // Cmd+\ - toggle second pane
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault();
        if (slotB) {
          setSlotB(null);
        } else {
          // Open with node pane by default (chat removed in rah-light)
          setSlotB({ type: 'node', nodeTabs: [], activeNodeTab: null });
        }
      }
      // Cmd+Shift+R - refresh all panes
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'r') {
        e.preventDefault();
        handleRefreshAll();
      }
      // Cmd+N - open Add Stuff modal
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        // Don't prevent default - browser may want this for new window
        // Only handle if we're focused in the app
        if (document.activeElement?.closest('[data-rah-app]')) {
          e.preventDefault();
          setShowAddStuff(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [slotB, setSlotB, handleRefreshAll]);

  useEffect(() => {
    if (!openLogEntry) return;
    setSlotA(prev => prev ? { ...prev, type: 'log' } : { type: 'log' });
    setActivePane('A');
    consumeOpenLogEntry();
  }, [consumeOpenLogEntry, openLogEntry, setSlotA]);

  useEffect(() => {
    const handler = (_e: Event) => {
      setSlotA(prev => prev ? { ...prev, type: 'log' } : { type: 'log' });
      setActivePane('A');
    };
    window.addEventListener('open-log-entry', handler);
    return () => window.removeEventListener('open-log-entry', handler);
  }, [setSlotA]);

  // Node tab management
  const handleNodeSelect = useCallback((nodeId: number, multiSelect: boolean) => {
    // If slotA is not a node pane (or doesn't exist), switch it to node
    if (!slotA || slotA.type !== 'node') {
      setSlotA({
        type: 'node',
        nodeTabs: [nodeId],
        activeNodeTab: nodeId,
      });
      setSelectedNodes(new Set([nodeId]));
      setActivePane('A');
      return;
    }

    if (multiSelect) {
      const newSelection = new Set(selectedNodes);
      if (newSelection.has(nodeId)) {
        newSelection.delete(nodeId);
      } else {
        newSelection.add(nodeId);
      }
      setSelectedNodes(newSelection);

      const newTabs = Array.from(newSelection);
      setSlotA(prev => prev ? ({
        ...prev,
        nodeTabs: newTabs,
        activeNodeTab: newTabs.length > 0 ? (prev.activeNodeTab || newTabs[0]) : null,
      }) : { type: 'node', nodeTabs: newTabs, activeNodeTab: newTabs[0] || null });
    } else {
      setSelectedNodes(new Set([nodeId]));

      const currentTabs = slotA.nodeTabs || [];
      const newTabs = currentTabs.includes(nodeId) ? currentTabs : [...currentTabs, nodeId];

      setSlotA(prev => prev ? ({
        ...prev,
        nodeTabs: newTabs,
        activeNodeTab: nodeId,
      }) : { type: 'node', nodeTabs: newTabs, activeNodeTab: nodeId });
    }
    setActivePane('A');
  }, [slotA, selectedNodes, setSlotA]);

  const handleTabSelect = useCallback((tabId: number) => {
    setSelectedNodes(new Set([tabId]));
    setSlotA(prev => prev ? ({
      ...prev,
      activeNodeTab: tabId,
    }) : { type: 'node', nodeTabs: [tabId], activeNodeTab: tabId });
    setActivePane('A');
  }, [setSlotA]);

  const handleCloseTab = useCallback((tabId: number) => {
    if (!slotA) return;
    const currentTabs = slotA.nodeTabs || [];
    const newTabs = currentTabs.filter(id => id !== tabId);

    let newActiveTab = slotA.activeNodeTab;
    if (slotA.activeNodeTab === tabId) {
      const currentIndex = currentTabs.indexOf(tabId);
      if (newTabs.length > 0) {
        const newIndex = Math.min(currentIndex, newTabs.length - 1);
        newActiveTab = newTabs[newIndex];
      } else {
        newActiveTab = null;
      }
    }

    setSlotA(prev => prev ? ({
      ...prev,
      nodeTabs: newTabs,
      activeNodeTab: newActiveTab,
    }) : null);

    const newSelection = new Set(selectedNodes);
    newSelection.delete(tabId);
    setSelectedNodes(newSelection);
  }, [slotA, selectedNodes, setSlotA]);

  const handleNodeCreated = useCallback((newNode: Node) => {
    setSelectedNodes(new Set([newNode.id]));

    // If slotA is node type, add to tabs
    if (slotA?.type === 'node') {
      const currentTabs = slotA.nodeTabs || [];
      if (!currentTabs.includes(newNode.id)) {
        setSlotA(prev => prev ? ({
          ...prev,
          nodeTabs: [...(prev.nodeTabs || []), newNode.id],
          activeNodeTab: newNode.id,
        }) : { type: 'node', nodeTabs: [newNode.id], activeNodeTab: newNode.id });
      }
    } else {
      // Switch slotA to node and open the new node
      setSlotA({
        type: 'node',
        nodeTabs: [newNode.id],
        activeNodeTab: newNode.id,
      });
    }
    setActivePane('A');
  }, [slotA, setSlotA]);

  const handleNodeDeleted = useCallback((nodeId: number) => {
    handleCloseTab(nodeId);
  }, [handleCloseTab]);

  const handleReorderTabs = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || !slotA) return;
    const currentTabs = slotA.nodeTabs || [];
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= currentTabs.length || toIndex >= currentTabs.length) {
      return;
    }
    const updated = [...currentTabs];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    setSlotA(prev => prev ? ({
      ...prev,
      nodeTabs: updated,
    }) : null);
  }, [slotA, setSlotA]);

  const handleFolderViewDataChanged = useCallback(() => {
    refreshAll();
  }, [refreshAll]);

  const handleNodeOpenFromDimensions = useCallback((nodeId: number) => {
    // Switch to node pane and open the node
    const currentTabs = slotA?.type === 'node' ? (slotA.nodeTabs || []) : [];
    const newTabs = currentTabs.includes(nodeId) ? currentTabs : [...currentTabs, nodeId];

    setSlotA({
      type: 'node',
      nodeTabs: newTabs,
      activeNodeTab: nodeId,
    });
    setSelectedNodes(new Set([nodeId]));
    setActivePane('A');
  }, [slotA, setSlotA]);

  // Handle pane type selection from toolbar
  const handlePaneTypeClick = useCallback((paneType: PaneType) => {
    // If no panes open → open in slot A
    if (!slotA) {
      setSlotA({ type: paneType });
      setActivePane('A');
      return;
    }

    // If only one pane open → open second pane with this type
    if (!slotB) {
      setSlotB({ type: paneType });
      setActivePane('B');
      return;
    }

    // Two panes open → replace the active pane
    if (activePane === 'A') {
      setSlotA(prev => prev ? ({
        ...prev,
        type: paneType,
      }) : { type: paneType });
    } else {
      setSlotB(prev => prev ? ({
        ...prev,
        type: paneType,
      }) : { type: paneType });
    }
  }, [activePane, slotA, slotB, setSlotA, setSlotB]);

  // Ensure the Feed pane is visible (for quick-add loading placeholders)
  const ensureFeedOpen = useCallback(() => {
    if (slotA?.type === 'views') return;
    if (slotB?.type === 'views') return;
    handlePaneTypeClick('views');
  }, [slotA, slotB, handlePaneTypeClick]);

  // Handle Quick Add submit (used by global Add Stuff modal)
  const handleQuickAddSubmit = useCallback(async ({
    input,
    mode,
    description,
    readerFormat,
    bookSelection,
  }: {
    input: string;
    mode: 'link' | 'note' | 'chat';
    description?: string;
    readerFormat?: ReaderFormatValue;
    bookSelection?: {
      title: string;
      author?: string;
      isbn?: string;
      cover_url?: string;
      publisher?: string;
      first_published_year?: number;
      page_count?: number;
    };
  }) => {
    try {
      await submitQuickAdd({ input, mode, description, readerFormat, bookSelection });

      // Ensure feed pane is visible
      ensureFeedOpen();

      // Close the modal on success
      setShowAddStuff(false);
    } catch (error) {
      console.error('[ThreePanelLayout] Quick Add error:', error);
    }
  }, [ensureFeedOpen, submitQuickAdd]);

  // Handle closing a pane
  const handleCloseSlotA = useCallback(() => {
    if (slotB) {
      // Move slot B to slot A position
      setSlotA(slotB);
      setSlotB(null);
    } else {
      // Close the only pane → empty state
      setSlotA(null);
    }
    setActivePane('A');
  }, [slotB, setSlotA, setSlotB]);

  const handleCloseSlotB = useCallback(() => {
    setSlotB(null);
    setActivePane('A');
  }, [setSlotB]);

  // Handle pane actions
  const handleSlotAAction = useCallback((action: PaneAction) => {
    switch (action.type) {
      case 'switch-pane-type':
        setSlotA(prev => ({
          ...prev,
          type: action.paneType,
        }));
        break;
      case 'open-node':
        handleNodeSelect(action.nodeId, false);
        break;
    }
  }, [handleNodeSelect, setSlotA]);

  const handleSlotBAction = useCallback((action: PaneAction) => {
    if (!slotB) return;
    switch (action.type) {
      case 'switch-pane-type':
        setSlotB(prev => prev ? ({
          ...prev,
          type: action.paneType,
        }) : null);
        break;
      case 'open-node':
        // Open node in slot B (if it's a node pane)
        if (slotB.type === 'node') {
          const currentTabs = slotB.nodeTabs || [];
          const newTabs = currentTabs.includes(action.nodeId) ? currentTabs : [...currentTabs, action.nodeId];
          setSlotB(prev => prev ? ({
            ...prev,
            nodeTabs: newTabs,
            activeNodeTab: action.nodeId,
          }) : null);
        } else {
          // Switch to node pane
          setSlotB({
            type: 'node',
            nodeTabs: [action.nodeId],
            activeNodeTab: action.nodeId,
          });
        }
        break;
    }
  }, [slotB, setSlotB]);

  // Open a node directly in Slot B (for Alt+Click)
  const handleNodeOpenInSlotB = useCallback((nodeId: number) => {
    // Open Slot B if closed
    if (!slotB) {
      setSlotB({
        type: 'node',
        nodeTabs: [nodeId],
        activeNodeTab: nodeId,
      });
      setActivePane('B');
      return;
    }

    // If Slot B is already a node pane, add to its tabs
    if (slotB.type === 'node') {
      const currentTabs = slotB.nodeTabs || [];
      const newTabs = currentTabs.includes(nodeId) ? currentTabs : [...currentTabs, nodeId];
      setSlotB(prev => prev ? ({
        ...prev,
        nodeTabs: newTabs,
        activeNodeTab: nodeId,
      }) : null);
    } else {
      // Switch Slot B to node pane
      setSlotB({
        type: 'node',
        nodeTabs: [nodeId],
        activeNodeTab: nodeId,
      });
    }
    setActivePane('B');
  }, [slotB, setSlotB]);

  // Open a node directly in Slot A (for "Open in other panel" from Slot B)
  const handleNodeOpenInSlotA = useCallback((nodeId: number) => {
    // If Slot A is already a node pane, add to its tabs
    if (slotA?.type === 'node') {
      const currentTabs = slotA.nodeTabs || [];
      const newTabs = currentTabs.includes(nodeId) ? currentTabs : [...currentTabs, nodeId];
      setSlotA(prev => prev ? ({
        ...prev,
        nodeTabs: newTabs,
        activeNodeTab: nodeId,
      }) : { type: 'node', nodeTabs: newTabs, activeNodeTab: nodeId });
    } else {
      // Switch Slot A to node pane
      setSlotA({
        type: 'node',
        nodeTabs: [nodeId],
        activeNodeTab: nodeId,
      });
    }
    setActivePane('A');
  }, [slotA, setSlotA]);

  // Handle search result selection
  const handleSearchNodeSelect = useCallback((nodeId: number) => {
    handleNodeSelect(nodeId, false);
    setShowSearchModal(false);
  }, [handleNodeSelect]);

  // Drag state for cross-slot tab dragging
  const [dragOverSlot, setDragOverSlot] = useState<'A' | 'B' | null>(null);

  const handleSlotDragOver = useCallback((e: React.DragEvent, slot: 'A' | 'B') => {
    // Check if this is a tab or node being dragged
    if (e.dataTransfer.types.includes('application/x-rah-tab') ||
        e.dataTransfer.types.includes('application/node-info')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setDragOverSlot(slot);
    }
  }, []);

  const handleSlotDragLeave = useCallback(() => {
    setDragOverSlot(null);
  }, []);

  const handleSlotDrop = useCallback((e: React.DragEvent, targetSlot: 'A' | 'B') => {
    setDragOverSlot(null);

    // Try tab data first, then node data from sidebar
    let tabData = e.dataTransfer.getData('application/x-rah-tab');
    if (!tabData) {
      tabData = e.dataTransfer.getData('application/node-info');
    }
    if (!tabData) return;

    try {
      const parsed = JSON.parse(tabData);
      const nodeId = parsed.id;
      const sourceSlot = parsed.sourceSlot;
      if (typeof nodeId !== 'number') return;

      // If dropping on the same slot, just select the tab
      if (sourceSlot && sourceSlot === targetSlot) {
        if (targetSlot === 'A') {
          setSlotA(prev => prev ? ({ ...prev, activeNodeTab: nodeId }) : { type: 'node', nodeTabs: [nodeId], activeNodeTab: nodeId });
        } else if (slotB) {
          setSlotB(prev => prev ? ({ ...prev, activeNodeTab: nodeId }) : null);
        }
        return;
      }

      // Remove from source slot (only if sourceSlot is specified)
      if (sourceSlot === 'A' && slotA?.type === 'node') {
        const currentTabs = slotA.nodeTabs || [];
        const newTabs = currentTabs.filter(id => id !== nodeId);
        let newActiveTab = slotA.activeNodeTab;
        if (slotA.activeNodeTab === nodeId) {
          const currentIndex = currentTabs.indexOf(nodeId);
          newActiveTab = newTabs.length > 0 ? newTabs[Math.min(currentIndex, newTabs.length - 1)] : null;
        }
        setSlotA(prev => prev ? ({
          ...prev,
          nodeTabs: newTabs,
          activeNodeTab: newActiveTab,
        }) : null);
      } else if (sourceSlot === 'B' && slotB?.type === 'node') {
        const currentTabs = slotB.nodeTabs || [];
        const newTabs = currentTabs.filter(id => id !== nodeId);
        let newActiveTab = slotB.activeNodeTab;
        if (slotB.activeNodeTab === nodeId) {
          const currentIndex = currentTabs.indexOf(nodeId);
          newActiveTab = newTabs.length > 0 ? newTabs[Math.min(currentIndex, newTabs.length - 1)] : null;
        }
        setSlotB(prev => prev ? ({
          ...prev,
          nodeTabs: newTabs,
          activeNodeTab: newActiveTab,
        }) : null);
      }

      // Add to target slot
      if (targetSlot === 'B') {
        // Open Slot B if closed
        if (!slotB) {
          setSlotB({
            type: 'node',
            nodeTabs: [nodeId],
            activeNodeTab: nodeId,
          });
        } else if (slotB.type === 'node') {
          const currentTabs = slotB.nodeTabs || [];
          if (!currentTabs.includes(nodeId)) {
            setSlotB(prev => prev ? ({
              ...prev,
              nodeTabs: [...(prev.nodeTabs || []), nodeId],
              activeNodeTab: nodeId,
            }) : null);
          } else {
            setSlotB(prev => prev ? ({ ...prev, activeNodeTab: nodeId }) : null);
          }
        } else {
          setSlotB({
            type: 'node',
            nodeTabs: [nodeId],
            activeNodeTab: nodeId,
          });
        }
        setActivePane('B');
      } else {
        // Drop on Slot A
        if (slotA?.type === 'node') {
          const currentTabs = slotA.nodeTabs || [];
          if (!currentTabs.includes(nodeId)) {
            setSlotA(prev => prev ? ({
              ...prev,
              nodeTabs: [...(prev.nodeTabs || []), nodeId],
              activeNodeTab: nodeId,
            }) : { type: 'node', nodeTabs: [nodeId], activeNodeTab: nodeId });
          } else {
            setSlotA(prev => prev ? ({ ...prev, activeNodeTab: nodeId }) : null);
          }
        } else {
          setSlotA({
            type: 'node',
            nodeTabs: [nodeId],
            activeNodeTab: nodeId,
          });
        }
        setActivePane('A');
      }
    } catch (err) {
      console.error('Failed to parse dropped tab data:', err);
    }
  }, [slotA, slotB, setSlotA, setSlotB]);

  // Split handle callbacks
  const handleOpenSecondPane = useCallback(() => {
    setSlotB({ type: 'node', nodeTabs: [], activeNodeTab: null }); // Default to node pane (chat removed in rah-light)
    setActivePane('B');
  }, [setSlotB]);

  const handleResizeSlotB = useCallback((newWidth: number) => {
    setSlotBWidth(newWidth);
  }, [setSlotBWidth]);

  const handleCloseSecondPane = useCallback(() => {
    setSlotB(null);
    setActivePane('A');
  }, [setSlotB]);

  // Swap panes (triggered by dragging pane header to other side)
  const handleSwapPanes = useCallback(() => {
    if (!slotB) return;
    const tempA = slotA;
    setSlotA(slotB);
    setSlotB(tempA);
  }, [slotA, slotB, setSlotA, setSlotB]);

  // Render a slot based on its state
  const renderSlot = (slot: 'A' | 'B', state: SlotState) => {
    const isActive = activePane === slot;
    // Always allow closing panes - shows empty state if all closed
    const onCollapse = slot === 'A' ? handleCloseSlotA : handleCloseSlotB;

    switch (state.type) {
      case 'node':
        return (
          <NodePane
            slot={slot}
            isActive={isActive}
            onPaneAction={slot === 'A' ? handleSlotAAction : handleSlotBAction}
            onCollapse={onCollapse}
            onSwapPanes={slotB ? handleSwapPanes : undefined}
            openTabs={state.nodeTabs || []}
            activeTab={state.activeNodeTab || null}
            onTabSelect={slot === 'A' ? handleTabSelect : (tabId) => {
              setSlotB(prev => prev ? ({ ...prev, activeNodeTab: tabId }) : null);
              setActivePane('B');
            }}
            onTabClose={slot === 'A' ? handleCloseTab : (tabId) => {
              if (!slotB) return;
              const currentTabs = state.nodeTabs || [];
              const newTabs = currentTabs.filter(id => id !== tabId);
              let newActiveTab = state.activeNodeTab;
              if (state.activeNodeTab === tabId) {
                const currentIndex = currentTabs.indexOf(tabId);
                newActiveTab = newTabs.length > 0 ? newTabs[Math.min(currentIndex, newTabs.length - 1)] : null;
              }
              setSlotB(prev => prev ? ({ ...prev, nodeTabs: newTabs, activeNodeTab: newActiveTab }) : null);
            }}
            onCloseAllTabs={slot === 'A' ? () => {
              setSlotA(prev => prev ? ({ ...prev, nodeTabs: [], activeNodeTab: null }) : { type: 'node', nodeTabs: [], activeNodeTab: null });
            } : () => {
              if (!slotB) return;
              setSlotB(prev => prev ? ({ ...prev, nodeTabs: [], activeNodeTab: null }) : null);
            }}
            onNodeClick={(nodeId) => {
              handleNodeSelect(nodeId, false);
              setActivePane(slot);
            }}
            onReorderTabs={slot === 'A' ? handleReorderTabs : undefined}
            refreshTrigger={refreshState.focus}
            onOpenInOtherSlot={slot === 'A' ? handleNodeOpenInSlotB : handleNodeOpenInSlotA}
            onTextSelect={(nodeId, nodeTitle, text) => {
              setHighlightedPassage({ nodeId, nodeTitle, selectedText: text });
            }}
            highlightedPassage={highlightedPassage}
          />
        );

      // case 'chat' removed in rah-light
      // case 'guides' removed — moved to settings modal

      case 'dimensions':
        return (
          <DimensionsPane
            slot={slot}
            isActive={isActive}
            onPaneAction={slot === 'A' ? handleSlotAAction : handleSlotBAction}
            onCollapse={onCollapse}
            onSwapPanes={slotB ? handleSwapPanes : undefined}
            onNodeOpen={handleNodeOpenFromDimensions}
            refreshToken={refreshState.folder}
            onDataChanged={handleFolderViewDataChanged}
            onDimensionSelect={setActiveDimension}
          />
        );

      case 'map':
        return (
          <MapPane
            slot={slot}
            isActive={isActive}
            onPaneAction={slot === 'A' ? handleSlotAAction : handleSlotBAction}
            onCollapse={onCollapse}
            onSwapPanes={slotB ? handleSwapPanes : undefined}
            onNodeClick={slot === 'A' ? handleNodeOpenInSlotB : handleNodeOpenInSlotA}
            activeTabId={activeTab}
          />
        );

      case 'views':
        return (
          <ViewsPane
            slot={slot}
            isActive={isActive}
            onPaneAction={slot === 'A' ? handleSlotAAction : handleSlotBAction}
            onCollapse={onCollapse}
            onSwapPanes={slotB ? handleSwapPanes : undefined}
            onNodeClick={(nodeId) => {
              handleNodeSelect(nodeId, false);
              setActivePane(slot);
            }}
            onNodeOpenInOtherPane={slot === 'A' ? handleNodeOpenInSlotB : handleNodeOpenInSlotA}
            refreshToken={refreshState.nodes}
            pendingNodes={pendingNodes}
            onDismissPending={dismissPendingNode}
          />
        );

      case 'table':
        return (
          <TablePane
            slot={slot}
            isActive={isActive}
            onPaneAction={slot === 'A' ? handleSlotAAction : handleSlotBAction}
            onCollapse={onCollapse}
            onSwapPanes={slotB ? handleSwapPanes : undefined}
            onNodeClick={(nodeId) => {
              handleNodeSelect(nodeId, false);
              setActivePane(slot);
            }}
            refreshToken={refreshState.nodes}
          />
        );

      case 'wiki':
        return (
          <WikiPane
            slot={slot}
            isActive={isActive}
            onPaneAction={slot === 'A' ? handleSlotAAction : handleSlotBAction}
            onCollapse={onCollapse}
            onSwapPanes={slotB ? handleSwapPanes : undefined}
            onNodeClick={(nodeId) => {
              handleNodeSelect(nodeId, false);
              setActivePane(slot);
            }}
          />
        );

      case 'library':
        return (
          <LibraryPane
            slot={slot}
            isActive={isActive}
            onPaneAction={slot === 'A' ? handleSlotAAction : handleSlotBAction}
            onCollapse={onCollapse}
            onSwapPanes={slotB ? handleSwapPanes : undefined}
            refreshToken={refreshState.nodes}
          />
        );

      case 'log':
        return (
          <LogPane
            slot={slot}
            isActive={isActive}
            onPaneAction={slot === 'A' ? handleSlotAAction : handleSlotBAction}
            onCollapse={onCollapse}
            onSwapPanes={slotB ? handleSwapPanes : undefined}
            onNodeOpen={(nodeId) => handleNodeOpenFromDimensions(nodeId)}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div
      ref={containerRef}
      data-rah-app
      style={{
        display: 'flex',
        height: '100vh',
        width: '100vw',
        background: 'var(--app-bg)',
        overflow: 'hidden'
      }}
    >
      {/* Left Toolbar */}
      <LeftToolbar
        onSearchClick={() => setShowSearchModal(true)}
        onAddStuffClick={() => setShowAddStuff(true)}
        onDocsClick={() => setShowDocs(true)}
        onSettingsClick={() => {
          setSettingsInitialTab(undefined);
          setShowSettings(true);
        }}
        onPaneTypeClick={handlePaneTypeClick}
        activePane={activePane}
        slotAType={slotA?.type ?? null}
        slotBType={slotB?.type ?? null}
        onRefreshClick={handleRefreshAll}
      />

      {/* Main content area */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          overflow: 'hidden',
          padding: '8px',
          gap: slotB ? '0' : '8px',
        }}
      >
        {/* Empty state - no panes open */}
        {!slotA && !slotB && (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#666',
              gap: '12px',
            }}
          >
            <div style={{ fontSize: '14px' }}>No panes open</div>
            <div style={{ fontSize: '12px', color: '#555' }}>
              Select a view from the toolbar to get started
            </div>
          </div>
        )}

        {/* Slot A - when open */}
        {/* When single pane (except map): centered with max-width */}
        {/* When split or map: full width */}
        {slotA && (
          <div
            onClick={() => setActivePane('A')}
            onDragOver={(e) => handleSlotDragOver(e, 'A')}
            onDragLeave={handleSlotDragLeave}
            onDrop={(e) => handleSlotDrop(e, 'A')}
            style={{
              flex: slotB ? `0 0 ${getSplitPaneBasis(100 - slotBWidth)}` : 1,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              // Center single pane (except map)
              ...((!slotB && slotA.type !== 'map' && slotA.type !== 'table' && slotA.type !== 'wiki') ? {
                maxWidth: '900px',
                margin: '0 auto',
                width: '100%',
              } : {}),
              background: 'var(--app-panel)',
              border: '1px solid var(--app-border)',
              borderRadius: '10px',
              outline: dragOverSlot === 'A' ? '2px dashed #22c55e' : 'none',
              outlineOffset: '-4px',
              transition: 'outline 0.15s ease',
            }}
          >
            {renderSlot('A', slotA)}
          </div>
        )}

        {/* Split Handle */}
        <SplitHandle
          isSecondPaneOpen={slotB !== null}
          onOpenSecondPane={handleOpenSecondPane}
          onResize={handleResizeSlotB}
          onCloseSecondPane={handleCloseSecondPane}
          containerRef={containerRef as React.RefObject<HTMLDivElement>}
          toolbarWidth={50}
        />

        {/* Slot B - only when open */}
        {slotB && (
          <div
            onClick={() => setActivePane('B')}
            onDragOver={(e) => handleSlotDragOver(e, 'B')}
            onDragLeave={handleSlotDragLeave}
            onDrop={(e) => handleSlotDrop(e, 'B')}
            style={{
              flex: `0 0 ${getSplitPaneBasis(slotBWidth)}`,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--app-panel)',
              border: '1px solid var(--app-border)',
              borderRadius: '10px',
              outline: dragOverSlot === 'B' ? '2px dashed #22c55e' : 'none',
              outlineOffset: '-4px',
              transition: 'outline 0.15s ease',
            }}
          >
            {renderSlot('B', slotB)}
          </div>
        )}
      </div>

      {/* Search Modal */}
      <SearchModal
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        onNodeSelect={handleSearchNodeSelect}
        existingFilters={[]}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettings}
        onClose={handleCloseSettings}
        initialTab={settingsInitialTab}
      />

      <DocsModal
        isOpen={showDocs}
        onClose={() => setShowDocs(false)}
      />

      {/* Add Stuff Modal */}
      <QuickAddInput
        isOpen={showAddStuff}
        onClose={() => setShowAddStuff(false)}
        onSubmit={handleQuickAddSubmit}
      />
    </div>
  );
}
