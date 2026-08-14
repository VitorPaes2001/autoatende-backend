/**
 * __AUTOATENDE_V4_R12D_A1_SHOW_AGENT_TEMPORARY_PASSWORD_AFTER_CREATE__
 *
 * Mostra a senha temporária retornada pela API após criação de agente.
 * Não armazena a senha permanentemente.
 * Não altera backend, banco, auth ou endpoints.
 */

(function installAgentCreateResultBridge() {
  const MARKER = "__AUTOATENDE_V4_R12D_A1_SHOW_AGENT_TEMPORARY_PASSWORD_AFTER_CREATE__";

  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.__AUTOATENDE_R12D_A1_AGENT_CREATE_RESULT_BRIDGE__ === true) return;

  window.__AUTOATENDE_R12D_A1_AGENT_CREATE_RESULT_BRIDGE__ = true;

  const PASSWORD_KEYS = new Set([
    "temporarypassword",
    "temppassword",
    "initialpassword",
    "generatedpassword",
    "plainpassword",
    "password",
    "senha",
    "senhatemporaria",
    "senha_temporaria",
    "senha_provisoria",
    "temporary_password",
    "temp_password",
    "initial_password",
    "generated_password",
    "plain_password"
  ]);

  const AGENT_KEYS = new Set([
    "agent",
    "agente",
    "user",
    "usuario",
    "createduser",
    "createdagent",
    "newagent",
    "profile"
  ]);

  function normalize(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9_]/g, "");
  }

  function isAgentCreateRequest(input, init) {
    try {
      const url = typeof input === "string"
        ? input
        : input && input.url
          ? input.url
          : "";

      const method = String(
        (init && init.method) ||
        (input && input.method) ||
        "GET"
      ).toUpperCase();

      if (method !== "POST") return false;

      const lower = String(url || "").toLowerCase();

      const looksLikeAgentEndpoint =
        lower.includes("/api/users/agents") ||
        lower.includes("/users/agents") ||
        lower.includes("/api/agents") ||
        lower.includes("/agents");

      const notSeatStatus =
        !lower.includes("seat-status") &&
        !lower.includes("capacity") &&
        !lower.includes("status");

      return looksLikeAgentEndpoint && notSeatStatus;
    } catch (_) {
      return false;
    }
  }

  function deepFindPassword(input, depth = 0) {
    if (!input || depth > 6) return "";

    if (typeof input === "string") {
      const match =
        input.match(/senha\s*(tempor[aá]ria|provis[oó]ria)?\s*[:=-]\s*([^\s<>"']{4,80})/i) ||
        input.match(/temporary\s*password\s*[:=-]\s*([^\s<>"']{4,80})/i);

      if (match) {
        return match[2] || match[1] || "";
      }

      return "";
    }

    if (typeof input !== "object") return "";

    for (const [key, value] of Object.entries(input)) {
      const normalizedKey = normalize(key);

      if (PASSWORD_KEYS.has(normalizedKey)) {
        if (typeof value === "string" || typeof value === "number") {
          const password = String(value || "").trim();

          if (password.length >= 4 && password.length <= 120) {
            return password;
          }
        }
      }
    }

    for (const value of Object.values(input)) {
      const found = deepFindPassword(value, depth + 1);
      if (found) return found;
    }

    return "";
  }

  function deepFindAgent(input, depth = 0) {
    if (!input || depth > 5 || typeof input !== "object") return {};

    const direct = {};

    for (const [key, value] of Object.entries(input)) {
      const normalizedKey = normalize(key);

      if (["name", "nome", "fullname", "displayname"].includes(normalizedKey)) {
        if (typeof value === "string") direct.name = value;
      }

      if (["email", "mail"].includes(normalizedKey)) {
        if (typeof value === "string") direct.email = value;
      }
    }

    if (direct.name || direct.email) return direct;

    for (const [key, value] of Object.entries(input)) {
      const normalizedKey = normalize(key);

      if (AGENT_KEYS.has(normalizedKey) && value && typeof value === "object") {
        const nested = deepFindAgent(value, depth + 1);
        if (nested.name || nested.email) return nested;
      }
    }

    for (const value of Object.values(input)) {
      if (value && typeof value === "object") {
        const nested = deepFindAgent(value, depth + 1);
        if (nested.name || nested.email) return nested;
      }
    }

    return {};
  }

  function extractError(input) {
    if (!input) return "";

    if (typeof input === "string") {
      return input.slice(0, 260);
    }

    if (typeof input !== "object") return "";

    const keys = ["error", "message", "detail", "details", "reason"];

    for (const key of keys) {
      if (typeof input[key] === "string" && input[key].trim()) {
        return input[key].trim().slice(0, 260);
      }
    }

    return "";
  }

  function ensureStyle() {
    const styleId = "aa-r12d-a1-agent-create-result-style";

    if (document.getElementById(styleId)) return;

    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      [data-aa-r12d-a1-overlay="true"] {
        position: fixed;
        inset: 0;
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        background: rgba(0, 10, 8, 0.74);
        backdrop-filter: blur(10px);
      }

      [data-aa-r12d-a1-modal="true"] {
        width: min(520px, calc(100vw - 40px));
        border: 1px solid rgba(52, 211, 153, 0.25);
        background: linear-gradient(180deg, rgba(3, 19, 17, 0.98), rgba(1, 10, 9, 0.98));
        color: rgba(236, 253, 245, 0.96);
        border-radius: 18px;
        box-shadow: 0 28px 90px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.05);
        overflow: hidden;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      [data-aa-r12d-a1-head="true"] {
        padding: 20px 22px 16px;
        border-bottom: 1px solid rgba(148, 163, 184, 0.12);
      }

      [data-aa-r12d-a1-title="true"] {
        margin: 0;
        font-size: 18px;
        line-height: 1.2;
        font-weight: 900;
        letter-spacing: -0.02em;
      }

      [data-aa-r12d-a1-subtitle="true"] {
        margin: 8px 0 0;
        color: rgba(167, 243, 208, 0.72);
        font-size: 13px;
        line-height: 1.45;
        font-weight: 650;
      }

      [data-aa-r12d-a1-body="true"] {
        padding: 18px 22px 22px;
      }

      [data-aa-r12d-a1-box="true"] {
        border: 1px solid rgba(52, 211, 153, 0.22);
        background: rgba(1, 24, 18, 0.72);
        border-radius: 14px;
        padding: 14px 15px;
        margin-bottom: 14px;
      }

      [data-aa-r12d-a1-label="true"] {
        display: block;
        color: rgba(167, 243, 208, 0.64);
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        font-weight: 900;
        margin-bottom: 8px;
      }

      [data-aa-r12d-a1-password="true"] {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 12px 13px;
        border: 1px solid rgba(52, 211, 153, 0.24);
        background: rgba(0, 0, 0, 0.22);
        border-radius: 12px;
        font: 900 18px/1.2 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        color: rgba(240, 253, 244, 0.98);
        word-break: break-all;
      }

      [data-aa-r12d-a1-note="true"] {
        margin: 12px 0 0;
        color: rgba(204, 251, 241, 0.72);
        font-size: 12px;
        line-height: 1.45;
      }

      [data-aa-r12d-a1-actions="true"] {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        margin-top: 18px;
      }

      [data-aa-r12d-a1-btn="true"] {
        min-height: 40px;
        padding: 0 16px;
        border-radius: 12px;
        border: 1px solid rgba(52, 211, 153, 0.24);
        background: rgba(1, 24, 18, 0.72);
        color: rgba(236, 253, 245, 0.96);
        font-weight: 850;
        cursor: pointer;
      }

      [data-aa-r12d-a1-btn-primary="true"] {
        border-color: rgba(16, 185, 129, 0.62);
        background: linear-gradient(180deg, rgba(16, 185, 129, 0.95), rgba(5, 150, 105, 0.92));
        color: white;
      }

      [data-aa-r12d-a1-alert="true"] {
        border: 1px solid rgba(245, 158, 11, 0.34);
        background: rgba(69, 41, 8, 0.34);
        color: rgba(254, 243, 199, 0.95);
        border-radius: 14px;
        padding: 14px 15px;
        font-size: 13px;
        line-height: 1.45;
        font-weight: 750;
      }
    `;

    document.head.appendChild(style);
  }

  async function copyText(text, button) {
    try {
      await navigator.clipboard.writeText(text);
      if (button) {
        const old = button.textContent;
        button.textContent = "Copiado";
        window.setTimeout(() => {
          button.textContent = old;
        }, 1600);
      }
    } catch (_) {
      const input = document.createElement("textarea");
      input.value = text;
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }
  }

  function closeExisting() {
    document.querySelectorAll("[data-aa-r12d-a1-overlay='true']").forEach((node) => node.remove());
  }

  function showModal(payload) {
    ensureStyle();
    closeExisting();

    const overlay = document.createElement("div");
    overlay.dataset.aaR12dA1Overlay = "true";

    const modal = document.createElement("div");
    modal.dataset.aaR12dA1Modal = "true";

    const head = document.createElement("div");
    head.dataset.aaR12dA1Head = "true";

    const title = document.createElement("h2");
    title.dataset.aaR12dA1Title = "true";
    title.textContent = payload.ok
      ? "Agente criado com sucesso"
      : "Não foi possível concluir a criação";

    const subtitle = document.createElement("p");
    subtitle.dataset.aaR12dA1Subtitle = "true";
    subtitle.textContent = payload.ok
      ? "Copie a senha temporária e envie ao agente. Ela deve ser alterada no primeiro acesso."
      : "Revise a mensagem abaixo antes de tentar novamente.";

    head.appendChild(title);
    head.appendChild(subtitle);

    const body = document.createElement("div");
    body.dataset.aaR12dA1Body = "true";

    if (payload.ok && payload.password) {
      const agentBox = document.createElement("div");
      agentBox.dataset.aaR12dA1Box = "true";

      const agentLabel = document.createElement("span");
      agentLabel.dataset.aaR12dA1Label = "true";
      agentLabel.textContent = "Agente";

      const agentInfo = document.createElement("div");
      agentInfo.textContent = [payload.agent?.name, payload.agent?.email].filter(Boolean).join(" • ") || "Novo agente";

      agentBox.appendChild(agentLabel);
      agentBox.appendChild(agentInfo);

      const passwordBox = document.createElement("div");
      passwordBox.dataset.aaR12dA1Box = "true";

      const passwordLabel = document.createElement("span");
      passwordLabel.dataset.aaR12dA1Label = "true";
      passwordLabel.textContent = "Senha temporária";

      const passwordLine = document.createElement("div");
      passwordLine.dataset.aaR12dA1Password = "true";

      const passwordText = document.createElement("span");
      passwordText.textContent = payload.password;

      const copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.dataset.aaR12dA1Btn = "true";
      copyBtn.dataset.aaR12dA1BtnPrimary = "true";
      copyBtn.textContent = "Copiar";
      copyBtn.addEventListener("click", () => copyText(payload.password, copyBtn));

      passwordLine.appendChild(passwordText);
      passwordLine.appendChild(copyBtn);

      const note = document.createElement("p");
      note.dataset.aaR12dA1Note = "true";
      note.textContent = "Por segurança, essa senha não deve ficar exposta permanentemente na tela de agentes.";

      passwordBox.appendChild(passwordLabel);
      passwordBox.appendChild(passwordLine);
      passwordBox.appendChild(note);

      body.appendChild(agentBox);
      body.appendChild(passwordBox);
    } else if (payload.ok && !payload.password) {
      const alert = document.createElement("div");
      alert.dataset.aaR12dA1Alert = "true";
      alert.textContent = "O agente foi criado, mas a API não retornou uma senha temporária para exibição. O próximo ajuste precisa ser no backend: retornar a senha temporária somente no momento da criação.";
      body.appendChild(alert);
    } else {
      const alert = document.createElement("div");
      alert.dataset.aaR12dA1Alert = "true";
      alert.textContent = payload.error || "A criação não foi concluída. Verifique nome, e-mail, limite do plano e permissões.";
      body.appendChild(alert);
    }

    const actions = document.createElement("div");
    actions.dataset.aaR12dA1Actions = "true";

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.dataset.aaR12dA1Btn = "true";
    closeBtn.textContent = "Fechar";
    closeBtn.addEventListener("click", closeExisting);

    actions.appendChild(closeBtn);
    body.appendChild(actions);

    modal.appendChild(head);
    modal.appendChild(body);
    overlay.appendChild(modal);

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) closeExisting();
    });

    document.body.appendChild(overlay);
  }

  async function parseResponse(response) {
    try {
      const clone = response.clone();
      const contentType = clone.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        return await clone.json();
      }

      const text = await clone.text();

      try {
        return JSON.parse(text);
      } catch (_) {
        return text;
      }
    } catch (_) {
      return null;
    }
  }

  const originalFetch = window.fetch;

  window.fetch = async function patchedAgentCreateFetch(input, init) {
    const shouldObserve = isAgentCreateRequest(input, init);

    const response = await originalFetch.apply(this, arguments);

    if (!shouldObserve) {
      return response;
    }

    try {
      const payload = await parseResponse(response);
      const password = deepFindPassword(payload);
      const agent = deepFindAgent(payload);
      const error = extractError(payload);

      window.__AUTOATENDE_R12D_A1_LAST_AGENT_CREATE_RESPONSE__ = {
        marker: MARKER,
        at: new Date().toISOString(),
        status: response.status,
        ok: response.ok,
        hasPassword: Boolean(password),
        agent,
        raw: payload
      };

      if (response.ok) {
        window.setTimeout(() => {
          showModal({
            ok: true,
            password,
            agent
          });
        }, 350);
      } else {
        window.setTimeout(() => {
          showModal({
            ok: false,
            error
          });
        }, 350);
      }
    } catch (_) {}

    return response;
  };
})();
