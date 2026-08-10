/**
 * __AUTOATENDE_V4_R13C_INBOX_TEMPLATE_REAL_RENDER_BRIDGE__
 *
 * Bridge visual do Inbox:
 * - busca catálogo de templates no backend;
 * - encontra bolhas/lista com texto técnico "[Template enviado] ...";
 * - substitui por mensagem renderizada com BODY/FOOTER quando possível;
 * - aplica loading premium curto para evitar sensação de tela sendo construída aos poucos.
 */

const MARKER = "__AUTOATENDE_V4_R13C_INBOX_TEMPLATE_REAL_RENDER_BRIDGE__";
const AA_R13C_R1_NO_LOADING_OVERLAY = "__AUTOATENDE_V4_R13C_R1_REMOVE_INBOX_LOADING_OVERLAY__";

const CATALOG_ENDPOINTS = [
  "/api/inbox/template-render-catalog",
  "/api/inbox/template-catalog"
];

let catalogPromise = null;
let catalogCache = null;

function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function storageValues() {
  const values = [];

  try {
    for (const storage of [localStorage, sessionStorage]) {
      for (let i = 0; i < storage.length; i += 1) {
        const key = storage.key(i);
        const value = storage.getItem(key);
        if (value) values.push(value);
      }
    }
  } catch (_) {}

  return values;
}

function findAuthToken() {
  try {
    const values = storageValues();

    for (const value of values) {
      const jwt = String(value).match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
      if (jwt?.[0]) return jwt[0];
    }
  } catch (_) {}

  return null;
}

async function fetchJsonWithAuth(url) {
  const token = findAuthToken();

  const headers = {
    Accept: "application/json"
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method: "GET",
    headers,
    credentials: "include"
  });

  if (!response.ok) {
    throw new Error(`HTTP_${response.status}`);
  }

  return response.json();
}

async function loadCatalog() {
  if (catalogCache) return catalogCache;
  if (catalogPromise) return catalogPromise;

  catalogPromise = (async () => {
    for (const endpoint of CATALOG_ENDPOINTS) {
      try {
        const data = await fetchJsonWithAuth(endpoint);
        const templates = Array.isArray(data?.templates) ? data.templates : [];

        if (templates.length) {
          catalogCache = templates;
          return catalogCache;
        }
      } catch (_) {}
    }

    catalogCache = [];
    return catalogCache;
  })();

  return catalogPromise;
}

function isInboxPath() {
  return window.location.pathname === "/inbox" || window.location.pathname.startsWith("/inbox/");
}

function isTechnicalTemplateText(text) {
  const lower = normalize(text);

  return (
    lower.includes("[template enviado]") ||
    lower.includes("template enviado")
  );
}

function extractTemplateInfo(text) {
  const raw = String(text || "");
  const cleaned = raw
    .replace(/\[\s*template enviado\s*\]/gi, "")
    .replace(/template enviado/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  const nameMatch = cleaned.match(/([a-zA-Z0-9_]{4,})/);
  const languageMatch = cleaned.match(/\b([a-z]{2}_[A-Z]{2}|[a-z]{2}-[A-Z]{2})\b/);
  const dateSplit = cleaned.split(/\b\d{2}\/\d{2}\/\d{4}\b/)[0] || cleaned;

  const tokens = dateSplit
    .split(/[•|,;]+|\s+-\s+/)
    .map((item) => item.trim())
    .filter(Boolean);

  const name = nameMatch?.[1] || tokens[0] || "";
  const language = languageMatch?.[1] || "pt_BR";

  const ignored = new Set([
    normalize(name),
    normalize(language),
    "pt_br",
    "pt-br",
    "utility",
    "utility_auth",
    "marketing",
    "authentication",
    "auth",
    "br"
  ]);

  const params = [];

  for (const token of tokens) {
    const n = normalize(token);

    if (!n || ignored.has(n)) continue;
    if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(token)) continue;
    if (/^\d{1,2}:\d{2}/.test(token)) continue;
    if (/^[a-z0-9_]{8,}$/.test(n) && n.includes("_")) continue;

    params.push(token);
  }

  const afterCategoryMatch = cleaned.match(/\b(?:utility_auth|utility|marketing|authentication|auth)\b\s*[•|,;-]?\s*([^•|,;\n]+)?/i);

  if (afterCategoryMatch?.[1]) {
    const maybe = afterCategoryMatch[1].trim();

    if (
      maybe &&
      !params.includes(maybe) &&
      !/\d{2}\/\d{2}\/\d{4}/.test(maybe) &&
      !/^\d{1,2}:\d{2}/.test(maybe)
    ) {
      params.unshift(maybe);
    }
  }

  return {
    raw,
    cleaned,
    name,
    language,
    params: params.slice(0, 8)
  };
}

function findTemplate(catalog, info) {
  const targetName = normalize(info.name);
  const targetLang = normalize(info.language).replace("-", "_");

  if (!targetName) return null;

  return catalog.find((template) => {
    const name = normalize(template.name);
    const lang = normalize(template.language || "pt_BR").replace("-", "_");

    return name === targetName && (!targetLang || lang === targetLang);
  }) || catalog.find((template) => normalize(template.name) === targetName) || null;
}

function renderTextWithParams(text, params) {
  let rendered = String(text || "");

  params.forEach((param, index) => {
    const oneBased = index + 1;
    const replacement = String(param || "").trim();

    if (!replacement) return;

    rendered = rendered.replace(
      new RegExp(`\\{\\{\\s*${oneBased}\\s*\\}\\}`, "g"),
      replacement
    );
  });

  rendered = rendered.replace(/\{\{\s*\d+\s*\}\}/g, "—");

  return rendered;
}


// __AUTOATENDE_V4_R13C_R2A_FIX2_RESTORE_SAFE_TEMPLATE_CLEANING_JS__
// Trim seguro para prefixos técnicos sem reintroduzir literal CSS inválido no bundle.
function aaR13CFix2TrimTemplatePrefix(value) {
  const bullet = String.fromCharCode(8226);
  const pattern = new RegExp("^[\\-:" + bullet + "\\s]+");
  return String(value || "").replace(pattern, "").trim();
}

function buildRenderedMessage(template, info) {
  if (!template) {
    const clean = aaR13CFix2TrimTemplatePrefix(info?.cleaned || "");
    return clean ? `Template enviado: ${clean}` : "Template enviado ao cliente.";
  }

  const parts = [];

  if (template.header) {
    parts.push(renderTextWithParams(template.header, info.params));
  }

  if (template.body) {
    parts.push(renderTextWithParams(template.body, info.params));
  }

  if (template.footer) {
    parts.push(renderTextWithParams(template.footer, info.params));
  }

  const rendered = parts
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join("\n\n")
    .trim();

  if (rendered) return rendered;

  const clean = aaR13CFix2TrimTemplatePrefix(info?.cleaned || "");
  return clean ? `Template enviado: ${clean}` : "Template enviado ao cliente.";
}

function eligibleTextNodes(root) {
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const text = node.nodeValue || "";

        if (!isTechnicalTemplateText(text)) {
          return NodeFilter.FILTER_REJECT;
        }

        const parent = node.parentElement;

        if (!parent) return NodeFilter.FILTER_REJECT;
        if (parent.closest("script, style, textarea, input")) return NodeFilter.FILTER_REJECT;

        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  const nodes = [];
  let current;

  while ((current = walker.nextNode())) {
    nodes.push(current);
  }

  return nodes;
}

async function renderTechnicalTemplates() {
  if (!isInboxPath()) return;

  const catalog = await loadCatalog();
  const textNodes = eligibleTextNodes(document.body);

  for (const node of textNodes) {
    const original = node.nodeValue || "";

    if (!isTechnicalTemplateText(original)) continue;

    const parent = node.parentElement;

    if (parent?.dataset?.aaR13cRendered === "true") continue;

    const info = extractTemplateInfo(original);
    const template = findTemplate(catalog, info);
    const rendered = buildRenderedMessage(template, info);

    node.nodeValue = rendered;

    if (parent) {
      parent.dataset.aaR13cRendered = "true";
      parent.classList.add("aa-r13c-template-rendered-message");
      parent.setAttribute("title", "Template renderizado como mensagem enviada ao cliente");
    }
  }
}

function ensureLoadingShell() {
  // __AUTOATENDE_V4_R13C_R1_REMOVE_INBOX_LOADING_OVERLAY__
  // Loading overlay removido: a tela não deve exibir aviso "Preparando Inbox operacional".
  // Mantemos a função como no-op para preservar chamadas existentes sem crash.
  return;
}

function run() {
  if (!isInboxPath()) return;

  ensureLoadingShell();

  renderTechnicalTemplates().catch(() => {});
}

function install() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.__AUTOATENDE_R13C_INBOX_TEMPLATE_BRIDGE__) return;

  window.__AUTOATENDE_R13C_INBOX_TEMPLATE_BRIDGE__ = true;
  window.__AUTOATENDE_R13C_INBOX_TEMPLATE_BRIDGE_MARKER__ = MARKER;

  run();

  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function patchedPushState(...args) {
    const result = originalPushState.apply(this, args);
    setTimeout(run, 80);
    setTimeout(run, 450);
    return result;
  };

  history.replaceState = function patchedReplaceState(...args) {
    const result = originalReplaceState.apply(this, args);
    setTimeout(run, 80);
    setTimeout(run, 450);
    return result;
  };

  window.addEventListener("popstate", () => {
    setTimeout(run, 80);
    setTimeout(run, 450);
  });

  window.addEventListener("load", () => {
    setTimeout(run, 100);
    setTimeout(run, 700);
    setTimeout(run, 1600);
  });

  const observer = new MutationObserver(() => {
    if (!isInboxPath()) return;
    renderTechnicalTemplates().catch(() => {});
  });

  const start = () => {
    if (!document.body) return;

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });

    run();
    setTimeout(run, 500);
    setTimeout(run, 1400);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
}

install();

export { MARKER };
