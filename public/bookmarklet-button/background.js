const APP_URL = 'http://192.168.0.100:3001';

// Fetch full ChatGPT conversation via internal API (same-origin, runs in tab context)
async function fetchChatGPTConversation() {
  const match = window.location.pathname.match(/\/c\/([a-f0-9-]+)/i);
  if (!match) {
    console.error('[RA-OS] Could not extract conversation ID from URL:', window.location.pathname);
    return null;
  }

  const conversationId = match[1];
  console.log('[RA-OS] Fetching conversation:', conversationId);

  try {
    // Step 1: get access token from NextAuth session
    const session = await fetch('/api/auth/session').then((r) => r.json());
    if (!session.accessToken) {
      console.error('[RA-OS] No access token in session');
      return null;
    }

    // Step 2: fetch conversation with token
    const res = await fetch(`/backend-api/conversation/${conversationId}`, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${session.accessToken}`,
      },
    });

    console.log('[RA-OS] API response status:', res.status);
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
    console.log('[RA-OS] Mapping has', Object.keys(nodes).length, 'nodes');

    // Find root: node whose parent is null or not in the mapping
    const rootId = Object.keys(nodes).find((id) => {
      const parent = nodes[id].parent;
      return !parent || !nodes[parent];
    });

    if (!rootId) {
      console.error('[RA-OS] Could not find root node');
      return null;
    }

    // Walk children to build ordered message list
    // NOTE: parsing logic is mirrored in src/lib/chatgpt-parser.ts — keep in sync
    const messages = [];
    const visited = new Set();
    let currentId = rootId;

    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const node = nodes[currentId];
      const msg = node?.message;

      const isHidden = msg?.metadata?.is_visually_hidden_from_conversation;
      const role = msg?.author?.role;

      if (msg && !isHidden && (role === 'user' || role === 'assistant')) {
        const parts = msg.content?.parts ?? [];
        const text = parts.filter((p) => typeof p === 'string').join('').trim();
        if (text) {
          const label = role === 'user' ? '**You:**' : '**ChatGPT:**';
          messages.push(`${label} ${text}`);
        }
      }

      currentId = node?.children?.[0] ?? null;
    }

    console.log('[RA-OS] Extracted', messages.length, 'messages');
    return messages.length > 0 ? messages.join('\n\n') : null;
  } catch (err) {
    console.error('[RA-OS] Fetch error:', err);
    return null;
  }
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;

  const isChatGPT = tab.url && /chatgpt\.com\/c\//i.test(tab.url);
  console.log('[RA-OS] Tab URL:', tab.url, '| isChatGPT:', isChatGPT);

  let results;
  try {
    if (isChatGPT) {
      results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: 'MAIN',
        func: fetchChatGPTConversation,
      });
    } else {
      results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const selection = window.getSelection ? window.getSelection().toString().trim() : '';
          const isChat = /claude\.ai|gemini\.google\.com/i.test(window.location.hostname);
          return { selection, url: window.location.href, title: document.title || '', isChat };
        },
      });
    }
  } catch (err) {
    console.error('[RA-OS] executeScript failed:', err);
    return;
  }

  let payload;
  let mode;

  if (isChatGPT) {
    const conversation = results[0].result;
    if (!conversation) {
      console.warn('[RA-OS] ChatGPT API returned null — falling back to text selection');
      const fallback = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => ({
          selection: window.getSelection ? window.getSelection().toString().trim() : '',
          url: window.location.href,
          title: document.title || '',
        }),
      });
      const { selection, url, title } = fallback[0].result;
      if (!selection) {
        console.warn('[RA-OS] No selection either — nothing to save');
        await showToast(tab.id, 'Nothing to save — no selection and API unavailable', true);
        return;
      }
      mode = 'fallback-selection';
      payload = { input: selection, mode: 'chat', sourceUrl: url, sourceTitle: title };
    } else {
      mode = 'chatgpt-api';
      payload = { input: conversation, mode: 'chat', sourceUrl: tab.url, sourceTitle: tab.title || '' };
    }
  } else {
    const { selection, url, title, isChat } = results[0].result;
    mode = selection ? 'selection' : 'url';
    payload = selection
      ? { input: selection, mode: isChat ? 'chat' : 'note', sourceUrl: url, sourceTitle: title }
      : { input: url };
  }

  console.log('[RA-OS] Sending payload via mode:', mode, '| input length:', payload.input?.length);

  let success = false;
  try {
    const res = await fetch(`${APP_URL}/api/quick-add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    success = res.ok;
    if (!res.ok) console.error('[RA-OS] quick-add failed with status:', res.status);
  } catch (err) {
    console.error('[RA-OS] quick-add fetch error:', err);
  }

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (ok) => {
      const existing = document.getElementById('__raos_toast__');
      if (existing) existing.remove();
      const toast = document.createElement('div');
      toast.id = '__raos_toast__';
      toast.textContent = ok ? 'Saved to RA-OS' : 'Failed to save — is the app running?';
      toast.style.cssText = [
        'position:fixed', 'bottom:24px', 'right:24px', 'z-index:2147483647',
        'padding:10px 18px', 'border-radius:8px',
        'font-family:-apple-system,BlinkMacSystemFont,sans-serif',
        'font-size:14px', 'font-weight:500', 'color:#fff',
        'background:' + (ok ? '#2d3748' : '#e53e3e'),
        'box-shadow:0 4px 16px rgba(0,0,0,0.3)', 'transition:opacity 0.3s', 'opacity:1',
      ].join(';');
      document.body.appendChild(toast);
      setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
    },
    args: [success],
  });
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
