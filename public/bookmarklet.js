(function () {
  // Derive app base URL from this script's src (e.g. http://localhost:3000)
  var scriptSrc = document.currentScript && document.currentScript.src;
  var appUrl = scriptSrc
    ? scriptSrc.replace(/\/bookmarklet\.js.*$/, '')
    : 'http://localhost:3000';

  // Build payload
  var selection = window.getSelection ? window.getSelection().toString().trim() : '';
  var payload;

  if (selection) {
    var isChat = /chatgpt\.com|claude\.ai|gemini\.google\.com/i.test(window.location.hostname);
    payload = {
      input: selection,
      mode: isChat ? 'chat' : 'note',
      sourceUrl: window.location.href,
      sourceTitle: document.title || undefined,
    };
  } else {
    payload = { input: window.location.href };
  }

  // Toast helper
  function showToast(message, isError) {
    var existing = document.getElementById('__raos_toast__');
    if (existing) existing.remove();

    var toast = document.createElement('div');
    toast.id = '__raos_toast__';
    toast.textContent = message;
    toast.style.cssText = [
      'position:fixed',
      'bottom:24px',
      'right:24px',
      'z-index:2147483647',
      'padding:10px 18px',
      'border-radius:8px',
      'font-family:-apple-system,BlinkMacSystemFont,sans-serif',
      'font-size:14px',
      'font-weight:500',
      'color:#fff',
      'background:' + (isError ? '#e53e3e' : '#2d3748'),
      'box-shadow:0 4px 16px rgba(0,0,0,0.3)',
      'transition:opacity 0.3s',
      'opacity:1',
    ].join(';');

    document.body.appendChild(toast);
    setTimeout(function () {
      toast.style.opacity = '0';
      setTimeout(function () { toast.remove(); }, 300);
    }, 3000);
  }

  // Send
  fetch(appUrl + '/api/quick-add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      showToast('Saved to RA-OS');
    })
    .catch(function () {
      showToast('Failed to save — is the app running?', true);
    });
})();
