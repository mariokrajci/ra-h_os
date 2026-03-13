"use client";

import { useState } from 'react';
import {
  Search,
  Plus,
  RefreshCw,
  LayoutList,
  Map,
  Folder,
  Table2,
  BookOpen,
  Library,
  ScrollText,
  FileText,
  Settings,
} from 'lucide-react';
import type { PaneType } from '../panes/types';

interface LeftToolbarProps {
  onSearchClick: () => void;
  onAddStuffClick: () => void;
  onRefreshClick: () => void;
  onDocsClick: () => void;
  onSettingsClick: () => void;
  onPaneTypeClick: (paneType: PaneType) => void;
  activePane: 'A' | 'B';
  slotAType: PaneType | null;
  slotBType: PaneType | null;
}

// Map pane types to their icons (chat removed in rah-light, guides moved to settings)
const PANE_TYPE_ICONS: Record<string, typeof LayoutList> = {
  views: LayoutList,
  map: Map,
  dimensions: Folder,
  table: Table2,
  wiki: BookOpen,
  library: Library,
  log: ScrollText,
  skills: BookOpen,
};

const PANE_TYPE_LABELS: Record<string, string> = {
  views: 'Feed',
  map: 'Map',
  dimensions: 'Dimensions',
  table: 'Table',
  wiki: 'Wiki',
  library: 'Library',
  log: 'Log',
  skills: 'Skills',
};

// Pane types shown in the toolbar center section (skills is pinned above settings)
const TOOLBAR_PANE_TYPES: PaneType[] = ['views', 'map', 'dimensions', 'table', 'wiki', 'library', 'log'];

interface ToolbarButtonProps {
  icon: typeof Search;
  label: string;
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
  isActive?: boolean;
}

function ToolbarButton({ icon: Icon, label, shortcut, onClick, disabled, isActive }: ToolbarButtonProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={shortcut ? `${label} (${shortcut})` : label}
      style={{
        width: '36px',
        height: '36px',
        borderRadius: '8px',
        border: isActive ? '1px solid var(--app-toolbar-border)' : '1px solid transparent',
        background: isActive ? 'var(--app-selected)' : (isHovered ? 'var(--app-hover)' : 'transparent'),
        color: isActive ? 'var(--toolbar-accent)' : (isHovered ? 'var(--toolbar-icon)' : 'var(--toolbar-icon-muted)'),
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.15s ease',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Icon size={18} />
    </button>
  );
}

interface PaneTypeButtonProps {
  icon: typeof LayoutList;
  label: string;
  isOpen: boolean;
  isActivePane: boolean;
  onClick: () => void;
}

function PaneTypeButton({ icon: Icon, label, isOpen, isActivePane, onClick }: PaneTypeButtonProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Determine color: green if open, brighter if it's the active pane
  const getColor = () => {
    if (isOpen) {
      return isActivePane ? 'var(--toolbar-icon-active)' : 'var(--toolbar-accent)';
    }
    return isHovered ? 'var(--toolbar-icon)' : 'var(--toolbar-icon-muted)';
  };

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={label}
      style={{
        width: '36px',
        height: '36px',
        borderRadius: '8px',
        border: isOpen ? '1px solid var(--app-toolbar-border)' : '1px solid transparent',
        background: isOpen ? 'var(--app-selected)' : (isHovered ? 'var(--app-hover)' : 'transparent'),
        color: getColor(),
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.15s ease',
        position: 'relative',
      }}
    >
      <Icon size={18} />
      {/* Active pane indicator dot */}
      {isActivePane && isOpen && (
        <div
          style={{
            position: 'absolute',
            bottom: '4px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '4px',
            height: '4px',
            borderRadius: '50%',
            background: 'var(--toolbar-accent)',
          }}
        />
      )}
    </button>
  );
}

export default function LeftToolbar({
  onSearchClick,
  onAddStuffClick,
  onRefreshClick,
  onDocsClick,
  onSettingsClick,
  onPaneTypeClick,
  activePane,
  slotAType,
  slotBType,
}: LeftToolbarProps) {
  // Determine which pane types are currently open
  const openPaneTypes = new Set<PaneType>(
    [slotAType, slotBType].filter((t): t is PaneType => t !== null)
  );

  // Determine which pane type is in the active pane (null if pane is closed)
  const activePaneType = activePane === 'A' ? slotAType : slotBType;

  return (
    <div
      style={{
        width: '50px',
        height: '100%',
        background: 'var(--app-toolbar)',
        borderRight: '1px solid var(--app-toolbar-border)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '12px 0',
        flexShrink: 0,
      }}
    >
      {/* Top section - Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
        <ToolbarButton
          icon={Search}
          label="Search"
          shortcut="⌘K"
          onClick={onSearchClick}
        />
        <ToolbarButton
          icon={Plus}
          label="Add Stuff"
          onClick={onAddStuffClick}
        />
        <ToolbarButton
          icon={RefreshCw}
          label="Refresh"
          shortcut="⌘⇧R"
          onClick={onRefreshClick}
        />
      </div>

      {/* Middle section - Pane Types */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '4px',
          padding: '8px 0',
        }}
      >
        {TOOLBAR_PANE_TYPES.map((paneType) => {
          const Icon = PANE_TYPE_ICONS[paneType];
          const label = PANE_TYPE_LABELS[paneType];
          const isOpen = openPaneTypes.has(paneType);
          const isActivePane = activePaneType === paneType;

          return (
            <PaneTypeButton
              key={paneType}
              icon={Icon}
              label={label}
              isOpen={isOpen}
              isActivePane={isActivePane}
              onClick={() => onPaneTypeClick(paneType)}
            />
          );
        })}
      </div>

      {/* Bottom section - Docs + Settings */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
        <ToolbarButton
          icon={FileText}
          label="Docs"
          onClick={onDocsClick}
        />
        <ToolbarButton
          icon={Settings}
          label="Settings"
          onClick={onSettingsClick}
        />
      </div>
    </div>
  );
}
