import { useEffect } from "react";

/**
 * __AUTOATENDE_V4_R12B_R6_CAPACITY_SEPARATE_CARD_ORGANIZER__
 *
 * Limpa resumo redundante e separa visualmente:
 * Agentes de Atendimento/tabela em um bloco.
 * Capacidade de usuários internos em outro bloco abaixo.
 */

const MARKER = "__AUTOATENDE_V4_R12B_R6_CAPACITY_SEPARATE_CARD_ORGANIZER__";

const SUMMARY_TERMS = [
  "resumo operacional leve",
  "indicadores rápidos da operação humana",
  "supervisão administrativa com atualização isolada",
  "conversas totais",
  "humanas",
  "atribuídas",
  "sem responsável",
  "última atualização",
  "atualizar resumo"
];

const KEEP_TERMS = [
  "capacidade de usuários internos",
  "capacidade de agentes",
  "limite do plano",
  "agentes de atendimento",
  "crie usuários internos"
];

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAny(text, terms) {
  const normalized = normalize(text);
  return terms.some((term) => normalized.includes(normalize(term)));
}

function shouldHideNode(node) {
  if (!node || node.classList?.contains("aa-agent-seat-status-r12b2")) return false;

  const text = node.textContent || "";

  if (!hasAny(text, SUMMARY_TERMS)) return false;
  if (hasAny(text, KEEP_TERMS)) return false;

  return true;
}

function findSettingsRoot() {
  return (
    document.querySelector(".aa-settings-clean-first-r11b2") ||
    document.querySelector("[data-marker*='settings']") ||
    document.body
  );
}

function cleanupSummary() {
  const root = findSettingsRoot();
  if (!root) return;

  const candidates = root.querySelectorAll("section, article, header, div");

  candidates.forEach((node) => {
    if (!shouldHideNode(node)) return;

    const containsSeat = Boolean(node.querySelector?.(".aa-agent-seat-status-r12b2"));
    const containsAgents = hasAny(node.textContent || "", ["agentes de atendimento"]);
    const isRootLike = node === root || node.children.length > 12;

    if (containsSeat || containsAgents || isRootLike) return;

    node.classList.add("aa-settings-r12b3-hide-ops-summary");
    node.setAttribute("data-autoatende-hidden-by", MARKER);
  });
}

function findAgentsAndCapacityWrapper(root, capacity) {
  let current = capacity.parentElement;

  while (current && current !== root && current !== document.body) {
    const text = normalize(current.textContent || "");

    const hasAgents =
      text.includes("agentes de atendimento") &&
      (text.includes("excluir") || text.includes("adicionar agente") || text.includes("@"));

    const hasCapacity =
      text.includes("capacidade de usuarios internos") ||
      text.includes("capacidade de agentes");

    if (hasAgents && hasCapacity && current.children.length <= 20) {
      return current;
    }

    current = current.parentElement;
  }

  return null;
}

function moveCapacityOutsideAgentsCard() {
  const root = findSettingsRoot();
  if (!root) return;

  const capacity = root.querySelector(".aa-agent-seat-status-r12b2");
  if (!capacity) return;

  const wrapper = findAgentsAndCapacityWrapper(root, capacity);

  if (!wrapper) {
    capacity.classList.add("aa-agent-seat-status-r12b6-standalone");
    capacity.setAttribute("data-autoatende-position", "standalone");
    return;
  }

  if (wrapper.nextElementSibling !== capacity) {
    wrapper.insertAdjacentElement("afterend", capacity);
  }

  capacity.classList.add("aa-agent-seat-status-r12b6-standalone");
  capacity.setAttribute("data-autoatende-position", "separate-card-after-agents");
}

function applyAll() {
  cleanupSummary();
  moveCapacityOutsideAgentsCard();
}

export default function SettingsOpsSummaryCleaner() {
  useEffect(() => {
    applyAll();

    const timers = [
      window.setTimeout(applyAll, 80),
      window.setTimeout(applyAll, 220),
      window.setTimeout(applyAll, 550),
      window.setTimeout(applyAll, 1100),
      window.setTimeout(applyAll, 2200)
    ];

    const observer = new MutationObserver(() => {
      window.requestAnimationFrame(applyAll);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      observer.disconnect();
    };
  }, []);

  return null;
}
