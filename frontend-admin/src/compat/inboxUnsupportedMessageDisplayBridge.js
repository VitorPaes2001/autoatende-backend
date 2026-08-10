/**
 * __AUTOATENDE_INBOX_UNSUPPORTED_DISPLAY_BRIDGE_V1__
 *
 * Corrige visualmente mensagens antigas salvas como [unsupported].
 * Não altera banco. Não interfere em mensagens novas corretamente normalizadas.
 */
(function installInboxUnsupportedMessageDisplayBridge() {
  const MARKER = "__AUTOATENDE_INBOX_UNSUPPORTED_DISPLAY_BRIDGE_V1__";

  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.__AUTOATENDE_INBOX_UNSUPPORTED_DISPLAY_BRIDGE_V1__) return;

  window.__AUTOATENDE_INBOX_UNSUPPORTED_DISPLAY_BRIDGE_V1__ = {
    marker: MARKER,
    installedAt: new Date().toISOString(),
    replacements: 0,
  };

  function isInboxLikeRoute() {
    const path = String(window.location.pathname || "");
    return path === "/inbox" || path === "/attendance" || path.includes("inbox");
  }

  function normalizeText(value) {
    return String(value || "").trim().toLowerCase();
  }

  function shouldReplace(value) {
    const text = normalizeText(value);
    return text === "[unsupported]" || text === "unsupported";
  }

  function replaceTextNodes(root) {
    if (!isInboxLikeRoute()) return;
    if (!root) root = document.body;
    if (!root) return;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];

    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (shouldReplace(node.nodeValue)) nodes.push(node);
    }

    for (const node of nodes) {
      node.nodeValue = "Mensagem recebida";
      window.__AUTOATENDE_INBOX_UNSUPPORTED_DISPLAY_BRIDGE_V1__.replacements += 1;
    }

    const elements = root.querySelectorAll ? root.querySelectorAll("*") : [];
    for (const el of elements) {
      if (!el || !el.childNodes || el.childNodes.length !== 1) continue;
      if (shouldReplace(el.textContent)) {
        el.textContent = "Mensagem recebida";
        window.__AUTOATENDE_INBOX_UNSUPPORTED_DISPLAY_BRIDGE_V1__.replacements += 1;
      }
    }
  }

  const run = () => {
    try {
      replaceTextNodes(document.body);
    } catch (_) {}
  };

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes || []) {
        if (node && node.nodeType === 1) replaceTextNodes(node);
        if (node && node.nodeType === 3 && shouldReplace(node.nodeValue)) {
          node.nodeValue = "Mensagem recebida";
          window.__AUTOATENDE_INBOX_UNSUPPORTED_DISPLAY_BRIDGE_V1__.replacements += 1;
        }
      }
    }
  });

  function start() {
    run();
    try {
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    } catch (_) {}
    setInterval(run, 1600);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
