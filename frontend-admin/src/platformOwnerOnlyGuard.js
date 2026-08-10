/**
 * __AUTOATENDE_STRIPE_PHASE2R_D4B_PLATFORM_OWNER_ONLY_FRONTEND_GUARD__
 *
 * Guard visual/UX para páginas internas da operação AutoAtendeAI:
 * - /leads
 * - /provisionamento
 *
 * Segurança real fica no backend.
 * Este arquivo impede exposição acidental no menu e bloqueia acesso direto por URL no frontend.
 *
 * Authority for sensitive APIs remains the server-issued non-PII platform claim.
 */

const MARKER = '__AUTOATENDE_STRIPE_PHASE2R_D4B_PLATFORM_OWNER_ONLY_FRONTEND_GUARD__';
const PLATFORM_ONLY_PATHS = ['/leads', '/provisionamento'];

function normalize(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * UX reflection only: the backend independently verifies this server-issued
 * non-PII claim for every sensitive platform-owner API request.
 * Do not use email, tenant identity, user_metadata, browser storage, or
 * client-provided role aliases as platform-owner authority here.
 */
function authoritativePlatformRoleFromAuthBinding() {
  const binding = window.__AUTOATENDE_AUTH__;
  const user =
    binding?.user ||
    binding?.currentUser ||
    binding?.session?.user ||
    binding?.currentSession?.user ||
    null;

  return user?.app_metadata?.platform_role || null;
}

function isPlatformOwnerClient() {
  return authoritativePlatformRoleFromAuthBinding() === 'platform_owner';
}

function currentPath() {
  return window.location.pathname || '/';
}

function pathOnly(value) {
  try {
    const url = new URL(value, window.location.origin);
    return url.pathname || '/';
  } catch {
    return String(value || '/').split('?')[0].split('#')[0] || '/';
  }
}

function isPlatformOnlyPath(path) {
  const current = pathOnly(path).replace(/\/+$/, '') || '/';

  return PLATFORM_ONLY_PATHS.some((base) => {
    const normalizedBase = base.replace(/\/+$/, '') || '/';
    return current === normalizedBase || current.startsWith(`${normalizedBase}/`);
  });
}

function hideElement(element) {
  if (!element || element === document.body || element === document.documentElement) return;

  const target =
    element.closest('a') ||
    element.closest('button') ||
    element.closest('li') ||
    element.closest('[role="menuitem"]') ||
    element.closest('[data-sidebar-item]') ||
    element;

  if (!target || target === document.body || target === document.documentElement) return;

  target.setAttribute('data-aa-platform-owner-hidden', 'true');
  target.setAttribute('data-aa-platform-owner-marker', MARKER);
  target.style.display = 'none';
}

function hideInternalMenuItems() {
  if (isPlatformOwnerClient()) {
    document.documentElement.setAttribute('data-aa-platform-owner', 'true');
    document.body && document.body.setAttribute('data-aa-platform-owner', 'true');
    return;
  }

  document.documentElement.setAttribute('data-aa-platform-owner', 'false');
  document.body && document.body.setAttribute('data-aa-platform-owner', 'false');

  const selectors = [
    'a[href]',
    'button',
    '[role="menuitem"]',
    'nav a',
    'nav button',
    'aside a',
    'aside button',
    '[role="navigation"] a',
    '[role="navigation"] button',
  ];

  document.querySelectorAll(selectors.join(',')).forEach((element) => {
    const href = element.getAttribute && element.getAttribute('href');
    const text = normalize(element.innerText || element.textContent || '');
    const title = normalize(element.getAttribute && element.getAttribute('title'));
    const aria = normalize(element.getAttribute && element.getAttribute('aria-label'));

    const hrefIsInternal = href && isPlatformOnlyPath(href);
    const textIsInternal =
      text === 'leads' ||
      text.includes('provisionamento') ||
      title.includes('provisionamento') ||
      aria.includes('provisionamento');

    if (hrefIsInternal || textIsInternal) {
      hideElement(element);
    }
  });
}

function enforceRouteAccess() {
  if (!isPlatformOnlyPath(currentPath())) return;

  if (isPlatformOwnerClient()) {
    document.documentElement.setAttribute('data-aa-platform-route-allowed', 'true');
    return;
  }

  document.documentElement.setAttribute('data-aa-platform-route-allowed', 'false');
  window.location.replace('/dashboard');
}

function runGuard() {
  try {
    hideInternalMenuItems();
    enforceRouteAccess();
  } catch (error) {
    console.warn(`[${MARKER}] guard_error`, error);
  }
}

function install() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__AUTOATENDE_PHASE2R_D4B_PLATFORM_OWNER_GUARD_INSTALLED__) {
    runGuard();
    return;
  }

  window.__AUTOATENDE_PHASE2R_D4B_PLATFORM_OWNER_GUARD_INSTALLED__ = true;
  window.__AUTOATENDE_PHASE2R_D4B_PLATFORM_OWNER_GUARD_MARKER__ = MARKER;

  runGuard();

  window.addEventListener('load', runGuard, { passive: true });
  window.addEventListener('focus', runGuard, { passive: true });
  window.addEventListener('popstate', runGuard, { passive: true });
  window.addEventListener('hashchange', runGuard, { passive: true });

  const originalPushState = window.history.pushState;
  const originalReplaceState = window.history.replaceState;

  window.history.pushState = function patchedPushState(...args) {
    const result = originalPushState.apply(this, args);
    setTimeout(runGuard, 0);
    setTimeout(runGuard, 120);
    setTimeout(runGuard, 500);
    return result;
  };

  window.history.replaceState = function patchedReplaceState(...args) {
    const result = originalReplaceState.apply(this, args);
    setTimeout(runGuard, 0);
    setTimeout(runGuard, 120);
    setTimeout(runGuard, 500);
    return result;
  };

  const observer = new MutationObserver(() => runGuard());

  const startObserver = () => {
    if (!document.body) return;
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['href', 'aria-label', 'title', 'class'],
    });
    runGuard();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObserver, { once: true });
  } else {
    startObserver();
  }

  setTimeout(runGuard, 100);
  setTimeout(runGuard, 400);
  setTimeout(runGuard, 900);
  setTimeout(runGuard, 1800);
}

install();

export {
  MARKER,
  isPlatformOwnerClient,
  isPlatformOnlyPath,
};
