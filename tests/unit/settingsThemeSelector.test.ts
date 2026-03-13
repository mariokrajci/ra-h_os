// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/settings/LogsViewer', () => ({
  default: () => React.createElement('div', null, 'Logs Viewer'),
}));
vi.mock('@/components/settings/ToolsViewer', () => ({
  default: () => React.createElement('div', null, 'Tools Viewer'),
}));
vi.mock('@/components/settings/ApiKeysViewer', () => ({
  default: () => React.createElement('div', null, 'API Keys Viewer'),
}));
vi.mock('@/components/settings/DatabaseViewer', () => ({
  default: () => React.createElement('div', null, 'Database Viewer'),
}));
vi.mock('@/components/settings/ExternalAgentsPanel', () => ({
  default: () => React.createElement('div', null, 'External Agents Viewer'),
}));
vi.mock('@/components/settings/ContextViewer', () => ({
  default: () => React.createElement('div', null, 'Context Viewer'),
}));
vi.mock('@/components/settings/GuidesViewer', () => ({
  default: () => React.createElement('div', null, 'Skills Viewer'),
}));

import SettingsModal from '@/components/settings/SettingsModal';
import { AppThemeProvider } from '@/components/theme/AppThemeProvider';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('Settings theme selector', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('renders theme controls inside the preferences tab and updates the selected mode', async () => {
    const root = createRoot(container);
    const onClose = vi.fn();

    await act(async () => {
      root.render(
        React.createElement(
          AppThemeProvider,
          null,
          React.createElement(SettingsModal, {
            isOpen: true,
            onClose,
          }),
        ),
      );
    });

    expect(document.body.textContent).toContain('Preferences');
    expect(document.body.textContent).not.toContain('Current: System (dark)');

    const preferencesNav = Array.from(document.querySelectorAll('div')).find(
      (node) => node.textContent === 'Preferences',
    );

    expect(preferencesNav).toBeTruthy();

    await act(async () => {
      preferencesNav?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(document.body.textContent).toContain('Appearance');
    expect(document.body.textContent).toContain('Theme');
    expect(document.body.textContent).toContain('System');
    expect(document.body.textContent).toContain('Light');
    expect(document.body.textContent).toContain('Dark');

    const lightButton = Array.from(document.querySelectorAll('button')).find(
      (button) => button.textContent === 'Light',
    );

    expect(lightButton).toBeTruthy();

    await act(async () => {
      lightButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem('ui.theme.mode')).toBe(JSON.stringify('light'));

    await act(async () => {
      root.unmount();
    });
  });
});
