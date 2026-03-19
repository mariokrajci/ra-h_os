const DEFAULT_APP_URL = 'http://192.168.0.100:3001';
const DEBUG = false;

function debugLog(...args) {
  if (DEBUG) console.log(...args);
}

const DEFAULT_SETTINGS = {
  appUrl: DEFAULT_APP_URL,
  blockedDomains: [],
  allowlistMode: false,
  allowedDomains: [],
  confirmBeforeSend: false,
  extensionToken: '',
};

async function loadSettings() {
  try {
    const stored = await chrome.storage.local.get([
      'blockedDomains',
      'allowlistMode',
      'allowedDomains',
      'confirmBeforeSend',
      'extensionToken',
      'appUrl',
    ]);
    return {
      appUrl: typeof stored.appUrl === 'string' && stored.appUrl.trim() ? stored.appUrl.trim() : DEFAULT_SETTINGS.appUrl,
      blockedDomains: Array.isArray(stored.blockedDomains) ? stored.blockedDomains : DEFAULT_SETTINGS.blockedDomains,
      allowlistMode: stored.allowlistMode === true,
      allowedDomains: Array.isArray(stored.allowedDomains) ? stored.allowedDomains : DEFAULT_SETTINGS.allowedDomains,
      confirmBeforeSend: stored.confirmBeforeSend === true,
      extensionToken: typeof stored.extensionToken === 'string' ? stored.extensionToken : DEFAULT_SETTINGS.extensionToken,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function normalizeDomain(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0];
}

function domainMatches(hostname, pattern) {
  const cleanPattern = normalizeDomain(pattern);
  if (!cleanPattern) return false;
  return hostname === cleanPattern || hostname.endsWith(`.${cleanPattern}`);
}

function isDomainAllowed(url, settings) {
  try {
    const parsed = new URL(url);
    const hostname = normalizeDomain(parsed.hostname);
    if (!hostname) return false;
    if (settings.blockedDomains.some((entry) => domainMatches(hostname, entry))) return false;
    if (settings.allowlistMode) {
      return settings.allowedDomains.some((entry) => domainMatches(hostname, entry));
    }
    return true;
  } catch {
    return false;
  }
}

function isInsecureRemoteAppUrl(url) {
  try {
    const parsed = new URL(url);
    const isLocalHost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || /^192\.168\./.test(parsed.hostname);
    return parsed.protocol === 'http:' && !isLocalHost;
  } catch {
    return false;
  }
}

async function clearSelectionCache(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: () => {
        window.__raos_lastSelection = '';
      },
    });
  } catch {
    // ignore
  }
}

async function requestSendConfirmation(tabId, targetUrl) {
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: (url) => window.confirm(`Send captured content to RA-OS?\n\nSource: ${url}`),
      args: [targetUrl || 'unknown'],
    });
    return result === true;
  } catch {
    return false;
  }
}

// Fetch ChatGPT conversation via internal API (same-origin, runs in tab context).
// selectionText: raw selected text string to filter messages by, or null for all.
async function fetchChatGPTConversation(selectionText) {
  const log = (...args) => {
    try {
      // This function runs in page context via executeScript; avoid external references.
      if (typeof console !== 'undefined' && console?.log) console.log(...args);
    } catch {
      // noop
    }
  };

  const match = window.location.pathname.match(/\/c\/([a-f0-9-]+)/i);
  if (!match) {
    console.error('[RA-OS] Could not extract conversation ID from URL:', window.location.pathname);
    return null;
  }

  const conversationId = match[1];
  log('[RA-OS] Fetching conversation:', conversationId, '| selectionText length:', selectionText ? selectionText.length : 0);

  try {
    const session = await fetch('/api/auth/session').then((r) => r.json());
    if (!session.accessToken) {
      console.error('[RA-OS] No access token in session');
      return null;
    }

    const res = await fetch(`/backend-api/conversation/${conversationId}`, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${session.accessToken}`,
      },
    });

    log('[RA-OS] API response status:', res.status);
    if (!res.ok) {
      console.error('[RA-OS] API request failed with status:', res.status);
      return null;
    }

    const data = await res.json();
    if (!data.mapping) {
      console.error('[RA-OS] No mapping in response. Keys:', Object.keys(data));
      return null;
    }

    const nodes = data.mapping;
    log('[RA-OS] Mapping has', Object.keys(nodes).length, 'nodes');

    const rootId = Object.keys(nodes).find((id) => {
      const parent = nodes[id].parent;
      return !parent || !nodes[parent];
    });

    if (!rootId) {
      console.error('[RA-OS] Could not find root node');
      return null;
    }

    // Strip markdown formatting for plain-text comparison against DOM selection
    function stripMarkdown(text) {
      return text
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/_([^_]+)_/g, '$1')
        .replace(/#{1,6} /g, '')
        .trim();
    }

    function normalizeComparable(text) {
      return String(text || '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
    }

    function buildConversationPath() {
      const currentNodeId = typeof data.current_node === 'string' ? data.current_node : null;
      if (currentNodeId && nodes[currentNodeId]) {
        const byParent = [];
        const seen = new Set();
        let cursor = currentNodeId;
        while (cursor && nodes[cursor] && !seen.has(cursor)) {
          byParent.push(cursor);
          seen.add(cursor);
          cursor = nodes[cursor].parent || null;
        }
        return byParent.reverse();
      }

      // Fallback for older response shapes without current_node:
      // walk first-child chain from the detected root.
      const chain = [];
      const seen = new Set();
      let cursor = rootId;
      while (cursor && nodes[cursor] && !seen.has(cursor)) {
        chain.push(cursor);
        seen.add(cursor);
        cursor = nodes[cursor].children?.[0] || null;
      }
      return chain;
    }

    // NOTE: parsing logic is mirrored in src/lib/chatgpt-parser.ts — keep in sync
    const messages = [];
    const path = buildConversationPath();
    const selLower = selectionText ? selectionText.toLowerCase() : null;
    const selNormalized = selectionText ? normalizeComparable(selectionText) : '';

    for (const nodeId of path) {
      const node = nodes[nodeId];
      const msg = node?.message;
      const isHidden = msg?.metadata?.is_visually_hidden_from_conversation;
      const role = msg?.author?.role;

      if (msg && !isHidden && (role === 'user' || role === 'assistant')) {
        const parts = msg.content?.parts ?? [];
        const text = parts
          .filter((p) => typeof p === 'string')
          .join('')
          .replace(/cite[\uE000-\uF8FF]*(turn\d+[a-z]+\d+[\uE000-\uF8FF]*)+/g, '')
          .replace(/[\uE000-\uF8FF]+/g, '')
          .trim();

        // If filtering by selection: check if any 40-char chunk of this message appears in the selection
        let include = true;
        if (selLower && text) {
          const plain = stripMarkdown(text);
          const plainLower = plain.toLowerCase();
          const plainNormalized = normalizeComparable(plain);
          const chunk = 40;
          include = false;

          // For shorter messages/selections, direct containment checks are more reliable.
          if (plainLower.length < chunk || selLower.length < chunk) {
            include = selLower.includes(plainLower)
              || plainLower.includes(selLower)
              || selNormalized.includes(plainNormalized)
              || plainNormalized.includes(selNormalized);
          } else {
            // Sample probes across the message at regular intervals
            for (let i = 0; i <= plainLower.length - chunk; i += chunk) {
              if (selLower.includes(plainLower.slice(i, i + chunk))) { include = true; break; }
            }
            // Strongly prefer beginning-of-message probe to anchor on the selected variant.
            if (!include) {
              include = selLower.includes(plainLower.slice(0, chunk));
            }
            // Also try the last chunk in case message length isn't a multiple of chunk
            if (!include && plainLower.length >= chunk) {
              include = selLower.includes(plainLower.slice(-chunk));
            }
          }
        }

        if (include && text) {
          const label = role === 'user' ? '**You:**' : '**ChatGPT:**';
          messages.push(`${label} ${text}`);
        }
      }

    }

    log('[RA-OS] Extracted', messages.length, 'messages');
    return messages.length > 0 ? messages.join('\n\n') : null;
  } catch (err) {
    console.error('[RA-OS] Fetch error:', err);
    return null;
  }
}

// Fallback extraction from rendered ChatGPT DOM when internal API is unavailable.
function fetchChatGPTConversationFromDOM() {
  try {
    const nodes = Array.from(document.querySelectorAll('[data-message-author-role]'));
    if (!nodes.length) return null;

    const messages = [];
    for (const node of nodes) {
      const role = (node.getAttribute('data-message-author-role') || '').toLowerCase();
      if (role !== 'user' && role !== 'assistant') continue;
      const text = (node.innerText || '').trim();
      if (!text) continue;
      const label = role === 'user' ? '**You:**' : '**ChatGPT:**';
      messages.push(`${label} ${text}`);
    }

    return messages.length > 0 ? messages.join('\n\n') : null;
  } catch {
    return null;
  }
}

async function injectSelectionCache(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      files: ['content.js'],
    });
  } catch (_) {
    // Tab may not support scripting (chrome://, file://, etc.)
  }
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  // Phase 1 hardening: on-demand injection only on explicit user action.
  await injectSelectionCache(tab.id);
  const settings = await loadSettings();
  const targetUrl = tab.url || '';
  if (!isDomainAllowed(targetUrl, settings)) {
    await showToast(tab.id, 'Capture blocked for this domain by extension settings', true);
    return;
  }
  if (settings.confirmBeforeSend) {
    const confirmed = await requestSendConfirmation(tab.id, targetUrl);
    if (!confirmed) {
      await showToast(tab.id, 'Send cancelled', false);
      return;
    }
  }

  const appUrl = (settings.appUrl || DEFAULT_APP_URL).replace(/\/$/, '');
  if (isInsecureRemoteAppUrl(appUrl)) {
    await showToast(tab.id, 'Warning: RA-OS app URL is HTTP on remote host', true);
  }
  const isChatGPT = tab.url && /chatgpt\.com\/c\//i.test(tab.url);
  debugLog('[RA-OS] Tab URL:', tab.url, '| isChatGPT:', isChatGPT);

  let payload;
  let mode;

  if (isChatGPT) {
    // Read cached selection state (captured before ChatGPT's blur handler clears it)
    let cacheResult;
    try {
      cacheResult = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: 'MAIN',
        func: () => {
          const sel = (window.__raos_lastSelection || '').trim();
          return { hasSelection: !!sel, selectionText: sel || null };
        },
      });
    } catch (err) {
      console.error('[RA-OS] executeScript failed:', err);
      return;
    }

    const { hasSelection, selectionText } = cacheResult[0].result;
    debugLog('[RA-OS] hasSelection:', hasSelection, '| selectionText length:', selectionText ? selectionText.length : 0);

    // Always use the API for proper formatting — filter by selection text if applicable
    let conversation = null;
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: 'MAIN',
        func: fetchChatGPTConversation,
        args: [hasSelection ? selectionText : null],
      });
      conversation = results[0].result;
    } catch (err) {
      console.error('[RA-OS] executeScript failed:', err);
    }

    if (!conversation) {
      if (hasSelection && selectionText) {
        console.warn('[RA-OS] ChatGPT API returned null — falling back to raw selection');
        mode = 'fallback-selection';
        payload = { input: selectionText, mode: 'chat', append: true, sourceUrl: tab.url, sourceTitle: tab.title || '' };
      } else {
        console.warn('[RA-OS] ChatGPT API returned null — trying DOM fallback');
        try {
          const domResults = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            world: 'MAIN',
            func: fetchChatGPTConversationFromDOM,
          });
          const domConversation = domResults?.[0]?.result || null;
          if (domConversation) {
            mode = 'chatgpt-dom-fallback';
            payload = { input: domConversation, mode: 'chat', sourceUrl: tab.url, sourceTitle: tab.title || '' };
          }
        } catch (domErr) {
          console.error('[RA-OS] DOM fallback failed:', domErr);
        }

        if (!payload) {
          console.warn('[RA-OS] ChatGPT DOM fallback also failed — nothing to save');
          await showToast(tab.id, 'Nothing to save — ChatGPT export unavailable', true);
          return;
        }
      }
    }

    if (!payload && hasSelection) {
      mode = 'chatgpt-selection';
      payload = { input: conversation, mode: 'chat', append: true, sourceUrl: tab.url, sourceTitle: tab.title || '' };
    } else if (!payload) {
      mode = 'chatgpt-api';
      payload = { input: conversation, mode: 'chat', sourceUrl: tab.url, sourceTitle: tab.title || '' };
    }
  } else {
    // Non-ChatGPT: selection as note or save URL
    let selectionResult;
    try {
      selectionResult = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: 'MAIN',
        func: () => ({
          selection: (window.__raos_lastSelection || window.getSelection?.()?.toString() || '').trim(),
          url: window.location.href,
          title: document.title || '',
        }),
      });
    } catch (err) {
      console.error('[RA-OS] executeScript failed:', err);
      return;
    }

    const { selection, url, title } = selectionResult[0].result;

    if (selection) {
      mode = 'selection';
      payload = { input: selection, mode: 'note', sourceUrl: url, sourceTitle: title };
    } else {
      mode = 'url';
      payload = { input: url };
    }
  }

  debugLog('[RA-OS] Sending payload via mode:', mode, '| input length:', payload.input?.length);

  let success = false;
  try {
    const res = await fetch(`${appUrl}/api/quick-add`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(settings.extensionToken ? { 'X-RAOS-Extension-Token': settings.extensionToken } : {}),
      },
      body: JSON.stringify(payload),
    });
    success = res.ok;
    if (!res.ok) console.error('[RA-OS] quick-add failed with status:', res.status);
  } catch (err) {
    console.error('[RA-OS] quick-add fetch error:', err);
  } finally {
    await clearSelectionCache(tab.id);
  }

  const successMessage = mode === 'chatgpt-dom-fallback'
    ? 'Saved to RA-OS (ChatGPT API unavailable; used page fallback)'
    : mode === 'fallback-selection'
      ? 'Saved to RA-OS (ChatGPT API unavailable; saved selection)'
      : 'Saved to RA-OS';
  await showToast(tab.id, success ? successMessage : 'Failed to save — is the app running?', !success);
});

async function showToast(tabId, message, isError) {
  await chrome.scripting.executeScript({
    target: { tabId },
    func: (msg, err) => {
      const existing = document.getElementById('__raos_toast__');
      if (existing) existing.remove();
      const toast = document.createElement('div');
      toast.id = '__raos_toast__';
      toast.textContent = msg;
      toast.style.cssText = [
        'position:fixed', 'bottom:24px', 'right:24px', 'z-index:2147483647',
        'padding:10px 18px', 'border-radius:8px',
        'font-family:-apple-system,BlinkMacSystemFont,sans-serif',
        'font-size:14px', 'font-weight:500', 'color:#fff',
        'background:' + (err ? '#e53e3e' : '#2d3748'),
        'box-shadow:0 4px 16px rgba(0,0,0,0.3)', 'transition:opacity 0.3s', 'opacity:1',
      ].join(';');
      document.body.appendChild(toast);
      setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
    },
    args: [message, isError],
  });
}
