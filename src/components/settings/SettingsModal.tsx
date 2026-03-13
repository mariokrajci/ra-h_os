"use client";

import React, { useEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import LogsViewer from './LogsViewer';
import ToolsViewer from './ToolsViewer';
import ApiKeysViewer from './ApiKeysViewer';
import DatabaseViewer from './DatabaseViewer';
import ExternalAgentsPanel from './ExternalAgentsPanel';
import ContextViewer from './ContextViewer';
import SkillsViewer from './GuidesViewer';
import { useAppTheme } from '@/components/theme/AppThemeProvider';
import type { ThemeMode } from '@/components/theme/themeState';

export type SettingsTab =
  | 'logs'
  | 'tools'
  | 'guides'
  | 'apikeys'
  | 'database'
  | 'context'
  | 'agents'
  | 'preferences';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: SettingsTab;
}

type TabType = SettingsTab;

const THEME_OPTIONS: ThemeMode[] = ['system', 'light', 'dark'];

function formatThemeLabel(mode: ThemeMode): string {
  return mode.charAt(0).toUpperCase() + mode.slice(1);
}

export default function SettingsModal({ isOpen, onClose, initialTab }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('logs');
  const { mode, resolvedTheme, setMode } = useAppTheme();

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !initialTab) return;
    setActiveTab(initialTab);
  }, [initialTab, isOpen]);

  if (!isOpen) return null;

  const navItemStyle = (tab: TabType): CSSProperties => ({
    padding: '12px 24px',
    fontSize: '14px',
    color: activeTab === tab ? 'var(--app-text)' : 'var(--app-text-muted)',
    background: activeTab === tab ? 'var(--app-selected)' : 'transparent',
    borderLeft: activeTab === tab ? '3px solid var(--toolbar-accent)' : '3px solid transparent',
    cursor: 'pointer',
    transition: 'all 0.2s',
  });

  const preferencesContent = (
    <div
      style={{
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        maxWidth: '560px',
      }}
    >
      <div>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--app-text-subtle)',
            marginBottom: '8px',
          }}
        >
          Appearance
        </div>
        <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--app-text)', marginBottom: '6px' }}>
          Theme
        </div>
        <div style={{ fontSize: '14px', color: 'var(--app-text-muted)', lineHeight: 1.6 }}>
          Choose how the app looks. System follows your operating system preference automatically.
        </div>
      </div>

      <div
        style={{
          padding: '20px',
          borderRadius: '16px',
          background: 'var(--app-panel-elevated)',
          border: '1px solid var(--app-border)',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        <div style={{ fontSize: '14px', color: 'var(--app-text)' }}>
          Current: {formatThemeLabel(mode)} ({resolvedTheme})
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          {THEME_OPTIONS.map((option) => {
            const isSelected = mode === option;

            return (
              <button
                key={option}
                onClick={() => setMode(option)}
                style={{
                  borderRadius: '999px',
                  border: isSelected ? '1px solid var(--toolbar-accent)' : '1px solid var(--app-border)',
                  background: isSelected ? 'var(--app-selected)' : 'transparent',
                  color: isSelected ? 'var(--app-text)' : 'var(--app-text-muted)',
                  padding: '10px 16px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                {formatThemeLabel(option)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  const modalContent = (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'var(--app-overlay)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '80vw',
          height: '85vh',
          background: 'var(--app-panel)',
          border: '1px solid var(--app-border)',
          borderRadius: '8px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.28)',
          display: 'flex',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            width: '20%',
            background: 'var(--app-toolbar)',
            borderRight: '1px solid var(--app-border)',
            display: 'flex',
            flexDirection: 'column',
            padding: '24px 0',
          }}
        >
          <div
            style={{
              padding: '0 24px',
              marginBottom: '24px',
              fontSize: '18px',
              fontWeight: '600',
              color: 'var(--app-text)',
            }}
          >
            Settings
          </div>

          <nav>
            <div onClick={() => setActiveTab('logs')} style={navItemStyle('logs')}>
              Logs
            </div>
            <div onClick={() => setActiveTab('tools')} style={navItemStyle('tools')}>
              Tools
            </div>
            <div onClick={() => setActiveTab('guides')} style={navItemStyle('guides')}>
              Skills
            </div>
            <div onClick={() => setActiveTab('apikeys')} style={navItemStyle('apikeys')}>
              API Keys
            </div>
            <div onClick={() => setActiveTab('database')} style={navItemStyle('database')}>
              Database
            </div>
            <div onClick={() => setActiveTab('context')} style={navItemStyle('context')}>
              Context
            </div>
            <div onClick={() => setActiveTab('agents')} style={navItemStyle('agents')}>
              External Agents
            </div>
            <div onClick={() => setActiveTab('preferences')} style={navItemStyle('preferences')}>
              Preferences
            </div>
            <div
              style={{
                padding: '12px 24px',
                fontSize: '14px',
                color: 'var(--app-text-muted)',
                opacity: 0.4,
                cursor: 'not-allowed',
              }}
            >
              Backups
            </div>
          </nav>

          <div
            style={{
              marginTop: 'auto',
              padding: '24px',
              borderTop: '1px solid var(--app-border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div
              style={{
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--app-text-subtle)',
              }}
            >
              Local Mode
            </div>
            <p
              style={{
                fontSize: '13px',
                color: 'var(--app-text-muted)',
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              This open-source build runs entirely on your machine. Add keys via the API Keys tab to unlock every agent.
            </p>
          </div>
        </div>

        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--app-panel)',
          }}
        >
          <div
            style={{
              padding: '16px 24px',
              borderBottom: '1px solid var(--app-border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: '16px',
                fontWeight: '600',
                color: 'var(--app-text)',
              }}
            >
              {activeTab === 'logs' && 'System Logs'}
              {activeTab === 'tools' && 'Tools'}
              {activeTab === 'guides' && 'Skills'}
              {activeTab === 'apikeys' && 'API Keys'}
              {activeTab === 'database' && 'Knowledge Database'}
              {activeTab === 'context' && 'Auto-Context'}
              {activeTab === 'agents' && 'External Agents'}
              {activeTab === 'preferences' && 'Preferences'}
            </h2>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--app-text-muted)',
                cursor: 'pointer',
                fontSize: '24px',
                lineHeight: 1,
                padding: '4px 8px',
                transition: 'color 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--app-text)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--app-text-muted)';
              }}
              title="Close (ESC)"
            >
              ×
            </button>
          </div>

          <div style={{ flex: 1, overflow: 'hidden' }}>
            {activeTab === 'logs' && <LogsViewer key={isOpen ? 'open' : 'closed'} />}
            {activeTab === 'tools' && <ToolsViewer />}
            {activeTab === 'guides' && <SkillsViewer />}
            {activeTab === 'apikeys' && <ApiKeysViewer />}
            {activeTab === 'database' && <DatabaseViewer />}
            {activeTab === 'context' && <ContextViewer />}
            {activeTab === 'agents' && <ExternalAgentsPanel />}
            {activeTab === 'preferences' && preferencesContent}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
