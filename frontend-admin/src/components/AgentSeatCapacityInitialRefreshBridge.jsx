import { useEffect, useRef } from "react";

/**
 * __AUTOATENDE_V4_R12B_R8D_SAFE_CAPACITY_INITIAL_AUTO_REFRESH__
 *
 * Corrige a race inicial do painel "Capacidade de usuários internos"
 * sem alterar backend, sem mexer em token manualmente e sem manipular
 * a lógica principal do componente.
 *
 * Quando o painel renderiza o erro inicial de consulta, este bridge
 * aguarda a sessão estabilizar e aciona o botão "Atualizar" do próprio
 * painel algumas vezes, de forma silenciosa e limitada.
 */

const MARKER = "__AUTOATENDE_V4_R12B_R8D_SAFE_CAPACITY_INITIAL_AUTO_REFRESH__";

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function visibleText(node) {
  return normalize(node?.innerText || node?.textContent || "");
}

function findCapacityRoot() {
  const candidates = Array.from(document.querySelectorAll("section, article, div"))
    .filter((node) => {
      const text = visibleText(node);

      return (
        text.includes("capacidade de usuarios internos") &&
        text.includes("limite do plano")
      );
    })
    .sort((a, b) => visibleText(a).length - visibleText(b).length);

  return candidates[0] || null;
}

function hasCapacityError(root) {
  const text = visibleText(root);

  return (
    text.includes("nao foi possivel consultar o limite de usuarios") ||
    text.includes("não foi possível consultar o limite de usuários")
  );
}

function hasHealthyCapacity(root) {
  const text = visibleText(root);

  return (
    text.includes("business") &&
    text.includes("usuarios usados") &&
    text.includes("limite") &&
    text.includes("disponiveis") &&
    !hasCapacityError(root)
  );
}

function findRefreshButton(root) {
  if (!root) return null;

  return Array.from(root.querySelectorAll("button, a, [role='button']"))
    .find((node) => visibleText(node).includes("atualizar")) || null;
}

function softenErrorText(root) {
  if (!root) return;

  const nodes = Array.from(root.querySelectorAll("div, p, span"))
    .filter((node) => {
      const text = visibleText(node);

      return (
        text.includes("nao foi possivel consultar o limite de usuarios") ||
        text.includes("não foi possível consultar o limite de usuários")
      );
    })
    .sort((a, b) => visibleText(a).length - visibleText(b).length);

  const target = nodes[0];

  if (!target) return;

  target.dataset.aaR12b8dOriginalText = target.textContent || "";
  target.textContent = "Atualizando limite do plano...";
}

export default function AgentSeatCapacityInitialRefreshBridge() {
  const attemptsRef = useRef(0);
  const timerRef = useRef(null);
  const observerRef = useRef(null);

  useEffect(() => {
    const clearTimer = () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const tryRefresh = () => {
      const root = findCapacityRoot();

      if (!root) return;

      if (hasHealthyCapacity(root)) {
        attemptsRef.current = 0;
        clearTimer();
        return;
      }

      if (!hasCapacityError(root)) return;

      if (attemptsRef.current >= 6) return;

      const button = findRefreshButton(root);

      if (!button) return;

      attemptsRef.current += 1;

      softenErrorText(root);

      const delays = [650, 1100, 1700, 2600, 3800, 5200];
      const delay = delays[attemptsRef.current - 1] || 5200;

      clearTimer();

      timerRef.current = window.setTimeout(() => {
        try {
          button.click();

          window.dispatchEvent(
            new CustomEvent("autoatende:agent-seat-capacity-auto-refresh", {
              detail: {
                marker: MARKER,
                attempt: attemptsRef.current
              }
            })
          );
        } catch (_) {}
      }, delay);
    };

    const scheduleCheck = () => {
      window.requestAnimationFrame(() => {
        tryRefresh();
      });
    };

    const bootTimers = [
      window.setTimeout(scheduleCheck, 250),
      window.setTimeout(scheduleCheck, 800),
      window.setTimeout(scheduleCheck, 1500),
      window.setTimeout(scheduleCheck, 2800),
      window.setTimeout(scheduleCheck, 4500)
    ];

    observerRef.current = new MutationObserver(scheduleCheck);
    observerRef.current.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });

    window.addEventListener("focus", scheduleCheck);
    window.addEventListener("visibilitychange", scheduleCheck);

    scheduleCheck();

    return () => {
      clearTimer();

      bootTimers.forEach((timer) => window.clearTimeout(timer));

      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }

      window.removeEventListener("focus", scheduleCheck);
      window.removeEventListener("visibilitychange", scheduleCheck);
    };
  }, []);

  return null;
}
