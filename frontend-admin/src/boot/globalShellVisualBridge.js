import '../styles/GlobalShellPremium.css';

const SIDEBAR_CLASS = 'aa-shell-v2-sidebar';
const BRAND_CLASS = 'aa-shell-v2-brand';
const NAV_CLASS = 'aa-shell-v2-nav';
const FOOTER_CLASS = 'aa-shell-v2-footer';
const ACTIVE_CLASS = 'aa-shell-v2-link-active';

const LOCATION_EVENT =
  'aa:shell-locationchange';

let animationFrame = 0;
let mutationObserver = null;
let resizeObserver = null;
let observedSidebar = null;

function isVisible(element) {
  if (!element) {
    return false;
  }

  const style =
    window.getComputedStyle(element);

  const rect =
    element.getBoundingClientRect();

  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    Number(style.opacity || 1) > 0 &&
    rect.width > 0 &&
    rect.height > 0
  );
}

function normalizePath(rawValue) {
  let value = String(rawValue || '/')
    .split('?')[0]
    .split('#')[0]
    .trim();

  if (!value.startsWith('/')) {
    value = `/${value}`;
  }

  value = value.replace(/\/{2,}/g, '/');

  if (value.length > 1) {
    value = value.replace(/\/+$/, '');
  }

  return value || '/';
}

function elementPath(element) {
  const rawValue =
    element.getAttribute('href') ||
    element.getAttribute('data-href') ||
    element.getAttribute('data-to');

  if (!rawValue) {
    return null;
  }

  if (
    rawValue.startsWith('#') ||
    rawValue.startsWith('javascript:')
  ) {
    return null;
  }

  try {
    const url = new URL(
      rawValue,
      window.location.origin
    );

    if (
      url.origin !== window.location.origin
    ) {
      return null;
    }

    return normalizePath(url.pathname);
  } catch {
    return null;
  }
}

function routeMatches(
  currentPath,
  candidatePath
) {
  if (candidatePath === '/') {
    return currentPath === '/';
  }

  if (currentPath === candidatePath) {
    return true;
  }

  return currentPath.startsWith(
    `${candidatePath}/`
  );
}

function clearActiveState(navigation) {
  if (!navigation) {
    return;
  }

  navigation
    .querySelectorAll(
      `.${ACTIVE_CLASS}`
    )
    .forEach((element) => {
      element.classList.remove(
        ACTIVE_CLASS
      );

      element.removeAttribute(
        'data-aa-shell-route-active'
      );
    });
}

function applyActiveRoute(navigation) {
  if (!navigation) {
    return;
  }

  clearActiveState(navigation);

  const currentPath = normalizePath(
    window.location.pathname
  );

  const candidates = Array.from(
    navigation.querySelectorAll(
      [
        'a[href]',
        '[role="link"][href]',
        'button[data-href]',
        'button[data-to]',
      ].join(',')
    )
  )
    .map((element) => ({
      element,
      path: elementPath(element),
    }))
    .filter((item) => {
      return (
        item.path &&
        routeMatches(
          currentPath,
          item.path
        )
      );
    })
    .sort((first, second) => {
      return (
        second.path.length -
        first.path.length
      );
    });

  const selected = candidates[0];

  if (selected) {
    selected.element.classList.add(
      ACTIVE_CLASS
    );

    selected.element.setAttribute(
      'data-aa-shell-route-active',
      'true'
    );
  }

  document.body.setAttribute(
    'data-aa-shell-current-path',
    currentPath
  );
}

function findSidebar() {
  const viewportHeight =
    window.innerHeight;

  const selector = [
    '.aa-shell-sidebar',
    '.aa-sidebar',
    '[data-aa-sidebar]',
    '[class*="sidebar"]',
    '[class*="Sidebar"]',
    'aside',
    'nav',
  ].join(',');

  let bestElement = null;
  let bestScore = -1;

  document
    .querySelectorAll(selector)
    .forEach((element) => {
      if (
        !isVisible(element) ||
        element.closest(
          '[data-aa-inbox-version]'
        )
      ) {
        return;
      }

      const rect =
        element.getBoundingClientRect();

      const interactiveCount =
        element.querySelectorAll(
          'a, button'
        ).length;

      const validPosition =
        rect.left >= -4 &&
        rect.left <= 8;

      const validWidth =
        rect.width >= 52 &&
        rect.width <= 420;

      const validHeight =
        rect.height >=
        viewportHeight * 0.62;

      if (
        !validPosition ||
        !validWidth ||
        !validHeight ||
        interactiveCount < 4
      ) {
        return;
      }

      const score =
        rect.height * 2 +
        rect.width * 5 +
        interactiveCount * 20;

      if (score > bestScore) {
        bestElement = element;
        bestScore = score;
      }
    });

  return bestElement;
}

function regionCandidates(sidebar) {
  const sidebarRect =
    sidebar.getBoundingClientRect();

  return Array.from(
    new Set([
      ...Array.from(sidebar.children),
      ...Array.from(
        sidebar.querySelectorAll(
          [
            'header',
            'footer',
            'nav',
            'section',
            'div',
            '[role="navigation"]',
          ].join(',')
        )
      ),
    ])
  ).filter((element) => {
    if (!isVisible(element)) {
      return false;
    }

    const rect =
      element.getBoundingClientRect();

    return (
      rect.width >=
        sidebarRect.width * 0.68 &&
      rect.width <=
        sidebarRect.width + 6
    );
  });
}

function findRegions(sidebar) {
  const sidebarRect =
    sidebar.getBoundingClientRect();

  const candidates =
    regionCandidates(sidebar);

  const navigation =
    sidebar.querySelector(
      'nav, [role="navigation"]'
    ) ||
    candidates
      .filter((element) => {
        const rect =
          element.getBoundingClientRect();

        return (
          rect.top >
            sidebarRect.top + 40 &&
          rect.bottom <
            sidebarRect.bottom - 40
        );
      })
      .sort((first, second) => {
        const firstCount =
          first.querySelectorAll(
            'a, button'
          ).length;

        const secondCount =
          second.querySelectorAll(
            'a, button'
          ).length;

        return secondCount - firstCount;
      })[0] ||
    null;

  const brand =
    candidates
      .filter((element) => {
        const rect =
          element.getBoundingClientRect();

        return (
          Math.abs(
            rect.top - sidebarRect.top
          ) <= 10 &&
          rect.height >= 44 &&
          rect.height <= 150
        );
      })
      .sort((first, second) => {
        return (
          second.getBoundingClientRect()
            .height -
          first.getBoundingClientRect()
            .height
        );
      })[0] ||
    null;

  const footer =
    candidates
      .filter((element) => {
        const rect =
          element.getBoundingClientRect();

        return (
          Math.abs(
            rect.bottom -
            sidebarRect.bottom
          ) <= 10 &&
          rect.height >= 44 &&
          rect.height <= 150
        );
      })
      .sort((first, second) => {
        return (
          second.getBoundingClientRect()
            .height -
          first.getBoundingClientRect()
            .height
        );
      })[0] ||
    null;

  return {
    navigation,
    brand,
    footer,
  };
}

function clamp(value, min, max) {
  return Math.min(
    max,
    Math.max(min, value)
  );
}

function publishGeometry(
  sidebar,
  navigation,
  brand,
  footer
) {
  const sidebarRect =
    sidebar.getBoundingClientRect();

  let headerHeight = 68;
  let footerHeight = 76;

  /*
   * A linha superior real é prioritariamente
   * o início do contêiner de navegação.
   */
  if (navigation) {
    const navigationRect =
      navigation.getBoundingClientRect();

    const measured =
      navigationRect.top -
      sidebarRect.top;

    if (measured >= 48) {
      headerHeight = measured;
    }
  } else if (brand) {
    const brandRect =
      brand.getBoundingClientRect();

    headerHeight =
      brandRect.bottom -
      sidebarRect.top;
  }

  /*
   * A linha inferior real é o início do
   * contêiner que contém o botão Sair.
   */
  if (footer) {
    const footerRect =
      footer.getBoundingClientRect();

    footerHeight =
      sidebarRect.bottom -
      footerRect.top;
  }

  headerHeight = Math.round(
    clamp(headerHeight, 58, 130)
  );

  footerHeight = Math.round(
    clamp(footerHeight, 62, 140)
  );

  const values = {
    '--aa-shell-measured-header-height':
      `${headerHeight}px`,

    '--aa-shell-measured-footer-height':
      `${footerHeight}px`,
  };

  Object.entries(values).forEach(
    ([property, value]) => {
      document.documentElement
        .style
        .setProperty(property, value);

      document.body
        .style
        .setProperty(property, value);
    }
  );
}

function clearShellMarks(sidebar) {
  if (!sidebar) {
    return;
  }

  sidebar.classList.remove(
    SIDEBAR_CLASS
  );

  sidebar
    .querySelectorAll(
      [
        `.${BRAND_CLASS}`,
        `.${NAV_CLASS}`,
        `.${FOOTER_CLASS}`,
        `.${ACTIVE_CLASS}`,
      ].join(',')
    )
    .forEach((element) => {
      element.classList.remove(
        BRAND_CLASS,
        NAV_CLASS,
        FOOTER_CLASS,
        ACTIVE_CLASS
      );

      element.removeAttribute(
        'data-aa-shell-route-active'
      );
    });
}

function applyShellState() {
  const sidebar = findSidebar();

  document
    .querySelectorAll(
      `.${SIDEBAR_CLASS}`
    )
    .forEach((element) => {
      if (element !== sidebar) {
        clearShellMarks(element);
      }
    });

  if (!sidebar) {
    return;
  }

  sidebar.classList.add(
    SIDEBAR_CLASS
  );

  sidebar
    .querySelectorAll(
      [
        `.${BRAND_CLASS}`,
        `.${NAV_CLASS}`,
        `.${FOOTER_CLASS}`,
      ].join(',')
    )
    .forEach((element) => {
      element.classList.remove(
        BRAND_CLASS,
        NAV_CLASS,
        FOOTER_CLASS
      );
    });

  const {
    navigation,
    brand,
    footer,
  } = findRegions(sidebar);

  brand?.classList.add(
    BRAND_CLASS
  );

  navigation?.classList.add(
    NAV_CLASS
  );

  footer?.classList.add(
    FOOTER_CLASS
  );

  applyActiveRoute(navigation);

  publishGeometry(
    sidebar,
    navigation,
    brand,
    footer
  );

  if (
    resizeObserver &&
    observedSidebar !== sidebar
  ) {
    resizeObserver.disconnect();
    resizeObserver.observe(sidebar);
    observedSidebar = sidebar;
  }
}

function scheduleApply() {
  window.cancelAnimationFrame(
    animationFrame
  );

  animationFrame =
    window.requestAnimationFrame(
      applyShellState
    );
}

function scheduleAfterNavigation() {
  scheduleApply();

  window.setTimeout(
    scheduleApply,
    0
  );

  window.setTimeout(
    scheduleApply,
    80
  );

  window.setTimeout(
    scheduleApply,
    250
  );
}

function patchHistory() {
  if (
    window.__AA_SHELL_HISTORY_V4__
  ) {
    return;
  }

  window.__AA_SHELL_HISTORY_V4__ = true;

  [
    'pushState',
    'replaceState',
  ].forEach((methodName) => {
    const original =
      window.history[methodName];

    window.history[methodName] =
      function (...args) {
        const result =
          original.apply(this, args);

        window.dispatchEvent(
          new Event(LOCATION_EVENT)
        );

        return result;
      };
  });
}

function startBridge() {
  if (
    window.__AA_GLOBAL_SHELL_V4__
  ) {
    scheduleAfterNavigation();
    return;
  }

  window.__AA_GLOBAL_SHELL_V4__ = true;

  document.body.classList.add(
    'aa-shell-v2-active'
  );

  patchHistory();

  resizeObserver =
    typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(scheduleApply)
      : null;

  mutationObserver =
    new MutationObserver(scheduleApply);

  mutationObserver.observe(
    document.body,
    {
      childList: true,
      subtree: true,
    }
  );

  window.addEventListener(
    'resize',
    scheduleApply
  );

  window.addEventListener(
    'popstate',
    scheduleAfterNavigation
  );

  window.addEventListener(
    LOCATION_EVENT,
    scheduleAfterNavigation
  );

  scheduleAfterNavigation();
}

if (
  document.readyState === 'loading'
) {
  document.addEventListener(
    'DOMContentLoaded',
    startBridge,
    { once: true }
  );
} else {
  startBridge();
}
