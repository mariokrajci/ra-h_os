(async function init() {
  const appUrlInput = document.getElementById('appUrl');
  const tokenInput = document.getElementById('token');
  const pairingCodeInput = document.getElementById('pairingCode');
  const pairBtn = document.getElementById('pairBtn');
  const confirmBeforeSendInput = document.getElementById('confirmBeforeSend');
  const allowlistModeInput = document.getElementById('allowlistMode');
  const allowedDomainsInput = document.getElementById('allowedDomains');
  const blockedDomainsInput = document.getElementById('blockedDomains');
  const saveBtn = document.getElementById('saveBtn');
  const status = document.getElementById('status');
  const defaultAppUrl = 'http://localhost:3001';

  function toLines(value) {
    return String(value || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  }

  function fromLines(values) {
    return (Array.isArray(values) ? values : []).join('\n');
  }

  const stored = await chrome.storage.local.get([
    'appUrl',
    'extensionToken',
    'confirmBeforeSend',
    'allowlistMode',
    'allowedDomains',
    'blockedDomains',
  ]);

  appUrlInput.value = typeof stored.appUrl === 'string' && stored.appUrl.trim() ? stored.appUrl.trim() : defaultAppUrl;
  tokenInput.value = typeof stored.extensionToken === 'string' ? stored.extensionToken : '';
  confirmBeforeSendInput.checked = stored.confirmBeforeSend === true;
  allowlistModeInput.checked = stored.allowlistMode === true;
  allowedDomainsInput.value = fromLines(stored.allowedDomains);
  blockedDomainsInput.value = fromLines(stored.blockedDomains);

  saveBtn.addEventListener('click', async () => {
    await chrome.storage.local.set({
      appUrl: appUrlInput.value.trim() || defaultAppUrl,
      extensionToken: tokenInput.value.trim(),
      confirmBeforeSend: confirmBeforeSendInput.checked,
      allowlistMode: allowlistModeInput.checked,
      allowedDomains: toLines(allowedDomainsInput.value),
      blockedDomains: toLines(blockedDomainsInput.value),
    });
    status.textContent = 'Saved';
    setTimeout(() => {
      status.textContent = '';
    }, 1200);
  });

  pairBtn.addEventListener('click', async () => {
    const pairingCode = String(pairingCodeInput.value || '').trim();
    if (!pairingCode) {
      status.textContent = 'Enter a pairing code first';
      return;
    }
    const appUrl = appUrlInput.value.trim() || defaultAppUrl;
    status.textContent = 'Pairing...';
    try {
      const response = await fetch(appUrl.replace(/\/$/, '') + '/api/bookmarklet/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pairingCode }),
      });
      const result = await response.json();
      if (!response.ok || !result.success || typeof result.token !== 'string') {
        throw new Error(result.error || 'Pairing failed');
      }
      tokenInput.value = result.token;
      await chrome.storage.local.set({
        appUrl,
        extensionToken: result.token,
      });
      pairingCodeInput.value = '';
      status.textContent = 'Paired successfully';
    } catch (error) {
      status.textContent = (error && error.message) ? error.message : 'Pairing failed';
    }
    setTimeout(() => {
      status.textContent = '';
    }, 1800);
  });
})();
