// Caches text selection before ChatGPT's blur handler clears it.
(function () {
  if (window.__raos_selection_listener_installed) return;
  window.__raos_selection_listener_installed = true;
  window.__raos_lastSelection = '';

  document.addEventListener('mousedown', function () {
    window.__raos_lastSelection = '';
  });

  document.addEventListener('selectionchange', function () {
    var text = window.getSelection ? window.getSelection().toString().trim() : '';
    if (text) window.__raos_lastSelection = text;
  });

  window.addEventListener('blur', function () {
    window.__raos_lastSelection = '';
  });

  window.addEventListener('pagehide', function () {
    window.__raos_lastSelection = '';
  });

  window.addEventListener('beforeunload', function () {
    window.__raos_lastSelection = '';
  });
})();
