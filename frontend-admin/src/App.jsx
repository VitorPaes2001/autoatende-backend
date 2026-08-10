/* __AUTOATENDE_V4_R29B_SAFE_DASHBOARD_NAV_PATCH_IF_EXACT_CANDIDATE__ */
import "./guards/inboxTemplateRenderAndLoadingBridge.js"; // __AUTOATENDE_V4_R13C_INBOX_TEMPLATE_REAL_RENDER_BRIDGE__
import "./guards/agentAdminSurfaceGuard.js"; // __AUTOATENDE_V4_R12D_B3R1_AGENT_SIDEBAR_STRONG_DETECTION__

// __AUTOATENDE_V4_R22A_B_R2_LAZY_LOAD_HEAVY_ROUTE_PAGES_NO_IMPORT_INSERT__
const Attendance = React.lazy(() => import('./pages/Attendance'));
const SettingsPage = React.lazy(() => import('./pages/SettingsPage'));
const BillingPage = React.lazy(() => import('./pages/BillingPage'));
const InboxPage = React.lazy(() => import('./pages/Inbox'));
const InboxLegacy = React.lazy(() => import('./pages/InboxLegacy'));
const InboxV2Preview = React.lazy(() => import('./pages/InboxV2Preview'));
const CompanyCommercialProfile = React.lazy(() => import('./pages/CompanyCommercialProfile'));
const AssistantPlayground = React.lazy(() => import('./pages/AssistantPlayground'));
const CommercialOnboardingWizard = React.lazy(() => import('./pages/CommercialOnboardingWizard'));
const AssistantCentral = React.lazy(() => import('./pages/AssistantCentral'));
const AssistantCentralProfessional = React.lazy(() => import('./pages/AssistantCentralProfessional'));
const AssistantPreviewProfessional = React.lazy(() => import('./pages/AssistantPreviewProfessional'));
const AcquisitionRecentPage = React.lazy(() => import('./pages/AcquisitionRecentPage'));
const WhatsAppTemplatesPage = React.lazy(() => import('./pages/WhatsAppTemplatesPage'));
const AcquisitionListPage = React.lazy(() => import('./pages/AcquisitionListPage'));
const AcquisitionBatchPage = React.lazy(() => import('./pages/AcquisitionBatchPage'));

const aaR22aRouteFallback = (
  <div
    aria-live="polite"
    style={{
      minHeight: '100vh',
      display: 'grid',
      placeItems: 'center',
      background: '#020617',
      color: '#e5e7eb',
      fontSize: 13,
      fontWeight: 700,
      letterSpacing: '0.02em',
    }}
  >
    Carregando...
  </div>
);
// END __AUTOATENDE_V4_R22A_B_R2_LAZY_LOAD_HEAVY_ROUTE_PAGES_NO_IMPORT_INSERT__
/* __AUTOATENDE_C6B_R1_ADMIN_SURFACE_HARDENING__ */
/* __AUTOATENDE_C6A_ROLE_GOVERNANCE_FOUNDATION__ */
import { useEffect } from 'react';
// __AUTOATENDE_C3C2B1_APP_ROUTE_WRAPPER__
// __AUTOATENDE_C3C2A_FRONTEND_REDIRECTS__
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import {LayoutDashboard, MessageSquare, Settings, LogOut, CreditCard, Inbox, Bell, UsersRound, ClipboardList} from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import { AuthProvider, useAuth } from './context/AuthContext';
import OnboardingModal from './components/OnboardingModal';
import UsageWarning from './components/UsageWarning';
import CompanyCommercialProfileQuickAccess from "./components/CompanyCommercialProfileQuickAccess";
const OpsSurfaceEntryPage = React.lazy(() => import('./pages/OpsSurfaceEntryPage'));
import brandThemeContract from './theme/brandThemeContract';
import brandMark from './assets/brand-mark.webp';

import RoleGuard from './components/auth/RoleGuard';
import { bootAcquisitionAttributionCapture } from './utils/acquisitionAttribution';
import PublicLeadCaptureBridge from './components/PublicLeadCaptureBridge';
import AdminPublicLeadsPage from './pages/AdminPublicLeadsPage';
import AdminProvisioningQueuePage from './pages/AdminProvisioningQueuePage';
import OperationalOnboardingPage from './pages/OperationalOnboardingPage.jsx'; // __AUTOATENDE_STRIPE_PHASE2R_D5B_OPERATIONAL_ONBOARDING_ROUTE__
import './guards/agentOperationalSurfaceGuard.js'; // __AUTOATENDE_V4_R13C_R3D_AGENT_MENU_DASHBOARD_ADMIN_CLEANUP__

import "./guards/agentCreateResultBridge.js"; // __AUTOATENDE_V4_R12D_A1_SHOW_AGENT_TEMPORARY_PASSWORD_AFTER_CREATE__

if (typeof window !== 'undefined') {
  try {
    bootAcquisitionAttributionCapture();
  } catch (error) {
    console.warn('[R10C] acquisition capture boot failed', error);
  }
}

// Layout Component
const Layout = ({ children }) => {
  const shellMarker = '__AUTOATENDE_R12A_PREMIUM_SHELL__';
  const location = useLocation();
  const isInboxRoute = location.pathname === '/inbox';
  const isInboxPreviewRoute =
    location.pathname === '/inbox-v2-preview';
  const isInboxWorkspaceRoute =
    isInboxRoute || isInboxPreviewRoute;
  const isAttendanceRoute =
    location.pathname === '/attendance';
  const shouldUseFloatingGlobalNotification =
    !isInboxWorkspaceRoute;
  const isOpsSettingsRoute = location.pathname.startsWith('/configuracoes/assistente-central')
    || location.pathname.startsWith('/configuracoes/teste-assistente')
    || location.pathname.startsWith('/configuracoes/perfil-comercial');

  const { signOut, user, session } = useAuth();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(() => {
    try {
      return window.localStorage.getItem('aa_sidebar_collapsed') === '1';
    } catch {
      return false;
    }
  });

  React.useEffect(() => {
    try {
      window.localStorage.setItem('aa_sidebar_collapsed', isSidebarCollapsed ? '1' : '0');
    } catch {}
  }, [isSidebarCollapsed]);

  
  const [notificationSummary, setNotificationSummary] = React.useState(null);
  const [isNotificationOpen, setIsNotificationOpen] = React.useState(false);
  const notificationPopoverRef = React.useRef(null);
  const notificationBellRef = React.useRef(null);
  const inboxNotificationBellRef = React.useRef(null);
  const humanAssignedNotificationCount = Number(notificationSummary?.counts?.human_assigned_count ?? 0);
  const recentHandoverNotificationCount = Number(
    notificationSummary?.counts?.recent_handover_count ??
      notificationSummary?.counts?.handover_count ??
      notificationSummary?.counts?.transferred_to_human_count ??
      0
  );
  const inboxNotificationCount = Math.max(
    humanAssignedNotificationCount,
    recentHandoverNotificationCount
  ); // __AUTOATENDE_V4_R5N_R16C_ACTIONABLE_ONLY_NOTIFICATION_BADGE__

  React.useEffect(() => {
    if (!session?.access_token) {
      setNotificationSummary(null);
      return;
    }

    let cancelled = false;

    const fetchNotificationSummary = async () => {
      try {
        const response = await fetch('/api/inbox/summary', {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        });

        if (!response.ok) {
          if (response.status === 401 && !cancelled) {
            setNotificationSummary(null);
          }
          return;
        }

        const payload = await response.json();
        if (!cancelled && payload?.ok) {
          setNotificationSummary(payload);
        }
      } catch (error) {
        console.warn('[V4_R4F] notification summary fetch failed', error);
      }
    };

    fetchNotificationSummary();
    const intervalId = window.setInterval(fetchNotificationSummary, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [session?.access_token]);

  React.useEffect(() => {
    setIsNotificationOpen(false);
  }, [location.pathname]);

  React.useEffect(() => {
    if (!isNotificationOpen) return;

    const handlePointerDown = (event) => {
      const target = event.target;
      if (notificationPopoverRef.current?.contains(target)) return;
      if (notificationBellRef.current?.contains(target)) return;
      if (inboxNotificationBellRef.current?.contains(target)) return;
      setIsNotificationOpen(false);
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsNotificationOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isNotificationOpen]);

  const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/attendance', icon: MessageSquare, label: 'Atendimento' },
    { path: '/inbox', icon: Inbox, label: 'Inbox' },
    { path: '/leads', icon: UsersRound, label: 'Leads' },
    { path: '/provisionamento', icon: ClipboardList, label: 'Provisionamento' },
    { path: '/billing', icon: CreditCard, label: 'Meu Plano' },
    { path: "/configuracoes/aquisicao", icon: Settings, label: "Disparos", matchPaths: ["/configuracoes/aquisicao", "/configuracoes/aquisicao-site", "/configuracoes/aquisicao/templates", "/configuracoes/aquisicao/lista", "/configuracoes/aquisicao/lote", "/configuracoes/templates-whatsapp"] },
        { path: '/settings', icon: Settings, label: 'Configurações', matchPaths: ['/settings', '/configuracoes/assistente-central', '/configuracoes/teste-assistente', '/configuracoes/perfil-comercial'] },
  ];

  const resolveShellTitle = (pathname) => {
    const matched = navItems.find((item) =>
      Array.isArray(item.matchPaths)
        ? item.matchPaths.some((candidate) => pathname.startsWith(candidate))
        : pathname === item.path
    );
    return matched?.label || 'Painel';
  };



  return (
    <div className={`aa-shell-root flex min-h-screen${isSidebarCollapsed ? " aa-shell-root--sidebar-collapsed" : ""}${isInboxRoute ? " aa-shell-root--inbox" : ""}${isInboxPreviewRoute ? " aa-shell-root--inbox-v2-preview" : ""}${isAttendanceRoute ? " aa-shell-root--attendance" : ""}`} data-marker={shellMarker}>
      <OnboardingModal />
      
      {/* Sidebar */}
      <aside className={`aa-shell-sidebar flex flex-col${isSidebarCollapsed ? " aa-shell-sidebar--collapsed" : ""}`}>
        <div className="aa-sidebar-brand">
          <div className="aa-sidebar-brand-lockup">
            <img src={brandMark} alt="AutoAtendeAI" className="aa-sidebar-brand-logo" />
            <div className="aa-sidebar-brand-copy">
              <span className="aa-sidebar-brand-name">AutoAtendeAI</span>
              <span className="aa-sidebar-brand-subtitle">PAINEL ADMINISTRATIVO</span>
            </div>
          </div>
        </div>
        <div className="aa-sidebar-toggle-row" data-aa-marker="__AUTOATENDE_V4_R5N_R15F_SIDEBAR_TOGGLE_ROW__">
          <button
            type="button"
            onClick={() => setIsSidebarCollapsed((value) => !value)}
            className="aa-sidebar-brand-toggle"
            aria-label={isSidebarCollapsed ? "Expandir menu lateral" : "Minimizar menu lateral"}
            title={isSidebarCollapsed ? "Expandir menu lateral" : "Minimizar menu lateral"}
          >
            <span className="aa-sidebar-brand-toggle-glyph">{isSidebarCollapsed ? "›" : "‹"}</span>
          </button>
        </div>
        <nav className="aa-shell-nav flex-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = Array.isArray(item.matchPaths) ? item.matchPaths.some((candidate) => location.pathname.startsWith(candidate)) : location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`aa-shell-nav-link flex items-center ${
                  isActive
                    ? 'aa-shell-nav-link--active'
                    : 'aa-shell-nav-link--idle'
                }`}
              >
                <Icon className="aa-shell-nav-icon w-5 h-5 mr-3 shrink-0" />
                <span className="aa-shell-nav-copy" data-aa-marker="__AUTOATENDE_V4_R4F_FRONT_NOTIFICATION_UI_REBASE__">
                    <span className="aa-shell-nav-label">{item.label}</span>
                    {item.path === '/inbox' && inboxNotificationCount > 0 ? (
                      <span className="aa-shell-nav-badge">
                        {inboxNotificationCount > 99 ? '99+' : inboxNotificationCount}
                      </span>
                    ) : null}
                  </span>
              </Link>
            );
          })}
        </nav>
        <div className="aa-shell-logout-wrap">
          <button 
            onClick={signOut}
            className="aa-shell-logout-btn flex items-center w-full"
          >
            <LogOut className="aa-shell-nav-icon w-5 h-5 mr-3 shrink-0" />
            Sair
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`aa-shell-main flex-1 overflow-y-auto flex flex-col${isInboxRoute ? " aa-shell-main--inbox" : ""}${isInboxPreviewRoute ? " aa-shell-main--inbox-v2-preview" : ""}${isAttendanceRoute ? " aa-shell-main--attendance" : ""}`}>
        {/* Global Warning Banner */}
        {!isInboxPreviewRoute ? <UsageWarning /> : null}

        {!isInboxWorkspaceRoute ? (
          <header className={`aa-shell-header sticky top-0 z-10${isAttendanceRoute ? " aa-shell-header--attendance" : ""}`}>
            <div className="aa-shell-header-inner">
              {/* __AUTOATENDE_V4_R5N_R15F_HEADER_TOGGLE_REMOVED__ */}
              <h2 className={`aa-shell-title${isAttendanceRoute ? " aa-shell-title--attendance-compact" : ""}`}>
                {(
                  location.pathname.startsWith('/configuracoes/assistente-central') ||
                  location.pathname.startsWith('/configuracoes/teste-assistente') ||
                  location.pathname.startsWith('/configuracoes/perfil-comercial')
                )
                  ? 'Configurações'
                  : resolveShellTitle(location.pathname)}
              </h2>
                <div
                  className="aa-shell-header-actions aa-shell-header-actions--global-top-rail"
                  data-aa-marker="__AUTOATENDE_V4_R5N_R5_RESTORE_AND_LINE_ANCHORED_TOP_RAIL__"
                >
                  <button
                    ref={notificationBellRef}
                    type="button"
                    className="aa-shell-notification-bell aa-shell-notification-bell--top-rail"
                    aria-label="Abrir notificações do Inbox"
                    aria-haspopup="dialog"
                    aria-expanded={isNotificationOpen ? 'true' : 'false'}
                    title="Notificações do Inbox"
                    onClick={() => setIsNotificationOpen((value) => !value)}
                  >
                    <Bell className="h-4 w-4" />
                    {inboxNotificationCount > 0 ? (
                      <span className="aa-shell-notification-badge">
                        {inboxNotificationCount > 99 ? '99+' : inboxNotificationCount}
                      </span>
                    ) : null}
                  </button>

                  {isNotificationOpen ? (
                    <div
                      ref={notificationPopoverRef}
                      className="aa-shell-notification-popover aa-shell-notification-popover--top-rail"
                      role="dialog"
                      aria-label="Pendências operacionais do Inbox"
                      data-aa-marker="__AUTOATENDE_V4_R5N_R5_RESTORE_AND_LINE_ANCHORED_TOP_RAIL__"
                    >
                      <div className="aa-shell-notification-popover-head">
                        <span className="aa-shell-notification-kicker">Inbox</span>
                        <strong className="aa-shell-notification-title">Pendências operacionais</strong>
                      </div>

                      <div className="aa-shell-notification-grid">
                        <div className="aa-shell-notification-metric">
                          <span>Sem responsável</span>
                          <strong>{notificationSummary?.counts?.human_unassigned_count ?? 0}</strong>
                        </div>
                        <div className="aa-shell-notification-metric">
                          <span>Em atendimento</span>
                          <strong>{notificationSummary?.counts?.human_assigned_count ?? 0}</strong>
                        </div>
                        <div className="aa-shell-notification-metric">
                          <span>Humano</span>
                          <strong>{notificationSummary?.counts?.human_count ?? 0}</strong>
                        </div>
                        <div className="aa-shell-notification-metric">
                          <span>Bot</span>
                          <strong>{notificationSummary?.counts?.bot_count ?? 0}</strong>
                        </div>
                      </div>

                      <div className="aa-shell-notification-foot">
                        <Link
                          to="/inbox"
                          className="aa-shell-notification-link"
                          onClick={() => setIsNotificationOpen(false)}
                        >
                          Abrir Inbox
                        </Link>
                      </div>
                    </div>
                  ) : null}

                  <div className="aa-shell-userbox aa-shell-userbox--global-top-rail">
                    <span className="aa-shell-user-email aa-shell-user-email--inbox-compact">{user?.email}</span>
                    <div className="aa-shell-avatar">
                      {user?.email?.charAt(0).toUpperCase()}
                    </div>
                  </div>
                </div>
            </div>
          </header>
        ) : null}
        {/* __AUTOATENDE_V4_R5N_R5_RESTORE_AND_LINE_ANCHORED_TOP_RAIL__ legacy floating cluster disabled */}
        {false ? (
          <div
            className="aa-shell-global-utility-cluster"
            data-aa-marker="__AUTOATENDE_V4_R5J_GLOBAL_NOTIFICATION_AND_USERBOX_SINGLE_CLUSTER_WRAPPER__"
          >
            <button
              ref={notificationBellRef}
              type="button"
              className="aa-shell-notification-bell aa-shell-notification-bell--floating"
              aria-label="Abrir notificações do Inbox"
              aria-haspopup="dialog"
              aria-expanded={isNotificationOpen ? 'true' : 'false'}
              title="Notificações do Inbox"
              onClick={() => setIsNotificationOpen((value) => !value)}
            >
              <Bell className="h-4 w-4" />
              {inboxNotificationCount > 0 ? (
                <span className="aa-shell-notification-badge">
                  {inboxNotificationCount > 99 ? '99+' : inboxNotificationCount}
                </span>
              ) : null}
            </button>

            <div className="aa-shell-userbox aa-shell-userbox--global-floating">
              <span className="aa-shell-user-email aa-shell-user-email--inbox-compact">{user?.email}</span>
              <div className="aa-shell-avatar">
                {user?.email?.charAt(0).toUpperCase()}
              </div>
            </div>

            {isNotificationOpen ? (
              <div
                ref={notificationPopoverRef}
                className="aa-shell-notification-popover aa-shell-notification-popover--floating"
                role="dialog"
                aria-label="Pendências operacionais do Inbox"
                data-aa-marker="__AUTOATENDE_V4_R5J_GLOBAL_NOTIFICATION_AND_USERBOX_SINGLE_CLUSTER_WRAPPER__"
              >
                <div className="aa-shell-notification-popover-head">
                  <span className="aa-shell-notification-kicker">Inbox</span>
                  <strong className="aa-shell-notification-title">Pendências operacionais</strong>
                </div>

                <div className="aa-shell-notification-grid">
                  <div className="aa-shell-notification-metric">
                    <span>Sem responsável</span>
                    <strong>{notificationSummary?.counts?.human_unassigned_count ?? 0}</strong>
                  </div>
                  <div className="aa-shell-notification-metric">
                    <span>Em atendimento</span>
                    <strong>{notificationSummary?.counts?.human_assigned_count ?? 0}</strong>
                  </div>
                  <div className="aa-shell-notification-metric">
                    <span>Humano</span>
                    <strong>{notificationSummary?.counts?.human_count ?? 0}</strong>
                  </div>
                  <div className="aa-shell-notification-metric">
                    <span>Bot</span>
                    <strong>{notificationSummary?.counts?.bot_count ?? 0}</strong>
                  </div>
                </div>

                <div className="aa-shell-notification-foot">
                  <Link
                    to="/inbox"
                    className="aa-shell-notification-link"
                    onClick={() => setIsNotificationOpen(false)}
                  >
                    Abrir Inbox
                  </Link>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className={`aa-shell-content${isInboxRoute ? " aa-shell-content--inbox" : ""}${isInboxPreviewRoute ? " aa-shell-content--inbox-v2-preview" : ""}${isAttendanceRoute ? " aa-shell-content--attendance" : ""}`}>
          {/* __AUTOATENDE_V4_R5N_R15F_INBOX_CHROME_REMOVED_FOR_FOCUS_MODE__ */}
          {children}
        </div>
      </main>
    </div>
  );
};

const ProtectedRoute = ({ children }) => {
  const { session } = useAuth();
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  return <Layout>{children}</Layout>;
};

const ProtectedBareRoute = ({ children }) => {
  const { session } = useAuth();

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

/* __AUTOATENDE_C5A2_THEME_BOOTSTRAP__ */
const applyBrandThemeContract = () => {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  const body = document.body;
  const colors = brandThemeContract?.colors || {};
  const radius = brandThemeContract?.radius || {};
  const shadow = brandThemeContract?.shadow || {};

  const variableMap = {
    '--aa-bg-app': colors.bgApp,
    '--aa-bg-panel': colors.bgPanel,
    '--aa-bg-card': colors.bgCard,
    '--aa-bg-card-soft': colors.bgCardSoft,
    '--aa-border-soft': colors.borderSoft,
    '--aa-border-strong': colors.borderStrong,
    '--aa-text-primary': colors.textPrimary,
    '--aa-text-secondary': colors.textSecondary,
    '--aa-text-muted': colors.textMuted,
    '--aa-accent': colors.accent,
    '--aa-accent-deep': colors.accentDeep,
    '--aa-accent-glow': colors.accentGlow,
    '--aa-danger-soft': colors.dangerSoft,
    '--aa-warning-soft': colors.warningSoft,
    '--aa-success-soft': colors.successSoft,
    '--aa-radius-card': radius.card,
    '--aa-radius-pill': radius.pill,
    '--aa-radius-control': radius.control,
    '--aa-shadow-card': shadow.card,
    '--aa-shadow-focus': shadow.focus,
  };

  Object.entries(variableMap).forEach(([key, value]) => {
    if (value) root.style.setProperty(key, value);
  });

  body.setAttribute('data-aa-theme', 'premium');
  body.setAttribute('data-aa-theme-version', brandThemeContract?.version || 'c5a2');
  root.style.colorScheme = 'dark';
};

// __AUTOATENDE_V4_R27H_R1_PUBLIC_SALES_LANDING_FRONTEND_ONLY_PRECISE_VALIDATION__
// __AUTOATENDE_V4_R27J_R1_PUBLIC_LANDING_MICRO_POLISH_MINIFIED_SAFE__
function PublicSalesLanding() {
  const openWhatsApp = () => {
    window.location.href = 'https://wa.me/554599373479?text=Ol%C3%A1%2C%20quero%20conhecer%20o%20AutoAtendeAI%20para%20minha%20empresa.';
  };

  return (
    <main className="aa-r27h-r1-public-landing aa-r27j-public-landing-polished" data-r27j="public-landing-micro-polish">
      <section className="aa-r27h-r1-public-hero">
        <nav className="aa-r27h-r1-public-nav" aria-label="Navegação principal">
          <div className="aa-r27h-r1-public-brand">
            <span className="aa-r27h-r1-public-brand__mark">A</span>
            <span>AutoAtendeAI</span>
          </div>

          <div className="aa-r27h-r1-public-nav__actions">
            <a className="aa-r27h-r1-public-link" href="#planos">Planos</a>
            <a className="aa-r27h-r1-public-link" href="/login">Entrar</a>
            <button className="aa-r27h-r1-public-nav__button" type="button" onClick={openWhatsApp}>
              Falar com vendas
            </button>
          </div>
        </nav>

        <div className="aa-r27h-r1-public-hero__grid">
          <div className="aa-r27h-r1-public-hero__copy">
            <span className="aa-r27h-r1-public-eyebrow">Atendimento inteligente no WhatsApp</span>
            <h1>Dê mais clareza à operação de WhatsApp da sua empresa.</h1>
            <p>
              O AutoAtendeAI ajuda empresas a centralizar conversas, responder com contexto,
              assumir atendimento humano quando necessário e acompanhar a operação em um painel profissional.
            </p>

            <div className="aa-r27h-r1-public-hero__actions">
              <button className="aa-r27h-r1-public-primary" type="button" onClick={openWhatsApp}>
                Agendar demonstração
              </button>
              <a className="aa-r27h-r1-public-secondary" href="/login">
                Acessar painel
              </a>
            </div>

            <div className="aa-r27h-r1-public-trust">
              <span>Feito para empresas que atendem clientes pelo WhatsApp</span>
              <span>Inbox, mídia, histórico e atendimento humano em uma única operação</span>
            </div>
          </div>

          <div className="aa-r27h-r1-public-preview" aria-label="Prévia conceitual da operação">
            <div className="aa-r27h-r1-public-preview__top">
              <span>Operação ao vivo</span>
              <strong>WhatsApp organizado</strong>
            </div>

            <div className="aa-r27h-r1-public-thread">
              <div className="aa-r27h-r1-public-message aa-r27h-r1-public-message--customer">
                <span>Cliente</span>
                <p>Preciso confirmar uma informação antes de comprar.</p>
              </div>
              <div className="aa-r27h-r1-public-message aa-r27h-r1-public-message--ai">
                <span>AutoAtendeAI</span>
                <p>Claro. Posso te ajudar com contexto e encaminhar para um atendente se precisar.</p>
              </div>
              <div className="aa-r27h-r1-public-status">
                <span></span>
                Conversa com histórico, mídia e nome do contato preservados
              </div>
            </div>

            <div className="aa-r27h-r1-public-preview__metrics">
              <div>
                <strong>Fluxo</strong>
                <span>operação controlada</span>
              </div>
              <div>
                <strong>Humano</strong>
                <span>assume quando precisar</span>
              </div>
              <div>
                <strong>Contexto</strong>
                <span>sem perder histórico</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="aa-r27h-r1-public-section" id="recursos">
        <div className="aa-r27h-r1-public-section__header">
          <span>Por que usar</span>
          <h2>Mais controle para empresas que dependem do WhatsApp.</h2>
        </div>

        <div className="aa-r27h-r1-public-cards">
          <article>
            <h3>Inbox profissional</h3>
            <p>Conversas, mídia, nomes de contato e histórico em uma interface feita para operação diária.</p>
          </article>
          <article>
            <h3>Assistente com contexto</h3>
            <p>Respostas mais consistentes, configuradas para a realidade comercial da empresa.</p>
          </article>
          <article>
            <h3>Atendimento humano</h3>
            <p>Quando a automação não deve resolver sozinha, a equipe assume sem perder a conversa.</p>
          </article>
        </div>
      </section>

      <section className="aa-r27h-r1-public-section aa-r27h-r1-public-section--plans" id="planos">
        <div className="aa-r27h-r1-public-section__header">
          <span>Planos</span>
          <h2>Comece com uma estrutura simples e evolua conforme a operação cresce.</h2>
        </div>

        <div className="aa-r27h-r1-public-plans">
          <article>
            <span>Essencial</span>
            <strong>A partir de R$249,90</strong>
            <p>Para empresas começando a organizar o atendimento no WhatsApp.</p>
          </article>
          <article className="aa-r27h-r1-public-plan--featured">
            <span>Profissional</span>
            <strong>A partir de R$449,90</strong>
            <p>Para operações com mais volume, equipe e necessidade de controle.</p>
          </article>
          <article>
            <span>Business</span>
            <strong>A partir de R$699,90</strong>
            <p>Para empresas que precisam de mais agentes e estrutura de escala.</p>
          </article>
        </div>
      </section>

      <section className="aa-r27h-r1-public-cta">
        <div>
          <span>Pronto para estruturar seu atendimento?</span>
          <h2>Transforme o WhatsApp da sua empresa em uma operação mais clara, organizada e profissional.</h2>

          <div className="aa-r42b-brand-proof" data-aa-r42b-marker="aa-r42b-r1-public-brand-consistency-autoatendeai">
            <p>
              <strong>AutoAtendeAI</strong> é uma plataforma SaaS de atendimento inteligente para empresas que atendem clientes pelo WhatsApp, com centralização de conversas, IA com contexto, histórico preservado e passagem para atendimento humano.
            </p>
            <p>
              A implantação é assistida, com configuração inicial da operação, revisão do assistente e acompanhamento das primeiras conversas reais.
            </p>
            <div className="aa-r42b-brand-proof__links" aria-label="Informações institucionais da AutoAtendeAI">
              <span>Política de privacidade</span>
              <span>Termos de uso</span>
              <span>Contato comercial</span>
            </div>
          </div>

        </div>
        <button type="button" onClick={openWhatsApp}>Falar com vendas</button>
      </section>
    </main>
  );
}

function App() {

  useEffect(() => {
    applyBrandThemeContract();
  }, []);
  return (
    <AuthProvider>
      <Router>
                          {/* __AUTOATENDE_C1D1_QUICK_ACCESS_MOUNT__ */}
                  <CompanyCommercialProfileQuickAccess />
<React.Suspense fallback={aaR22aRouteFallback}>
          {/* __AUTOATENDE_V4_R36E_R1_LANDING_PUBLIC_LEAD_CAPTURE_MODAL_FRONTEND_ONLY_DOCKER_BUILD__ */}
        <PublicLeadCaptureBridge />
        <Routes>
          <Route path="/onboarding" element={<OperationalOnboardingPage />} /> {/* __AUTOATENDE_STRIPE_PHASE2R_D5B_OPERATIONAL_ONBOARDING_ROUTE__ */}

          <Route path="/login" element={<Login />} />
          <Route path="/" element={<PublicSalesLanding />} />
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
          <Route path="/attendance" element={
            <ProtectedRoute>
              <Attendance />
            </ProtectedRoute>
          } />
          <Route path="/inbox" element={
            <ProtectedRoute>
              <InboxPage />
            </ProtectedRoute>
          } />          {/* __AUTOATENDE_V4_R36I_B_ADMIN_LEADS_PAGE_ROUTE_SIDEBAR_FRONTEND_ONLY__ */}
          <Route path="/leads" element={
            <ProtectedRoute>
              <RoleGuard allowed={['owner', 'company', 'admin']}>
                <AdminPublicLeadsPage />
              </RoleGuard>
            </ProtectedRoute>
          } />
          <Route path="/provisionamento" element={
            <ProtectedRoute>
              <RoleGuard allowed={['owner','admin']}>
                <AdminProvisioningQueuePage />
              </RoleGuard>
            </ProtectedRoute>
          } />

          <Route path="/billing" element={
            <ProtectedRoute>
              <BillingPage />
            </ProtectedRoute>
          } />
          <Route path="/settings" element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          } />
                  {/* __AUTOATENDE_C1D0_COMPANY_COMMERCIAL_PROFILE_ROUTE__ */}
          <Route path="/configuracoes/perfil-comercial" element={<RoleGuard allowed={['owner','admin']}><Navigate to="/configuracoes/assistente-central" replace /></RoleGuard>} />
      <Route path="/configuracoes/aquisicao" element={<ProtectedRoute><AcquisitionRecentPage /></ProtectedRoute>} />
      <Route path="/configuracoes/templates-whatsapp" element={<Navigate to="/configuracoes/aquisicao/templates" replace />} />
      <Route path="/configuracoes/aquisicao/templates" element={<ProtectedRoute><WhatsAppTemplatesPage /></ProtectedRoute>} />
      <Route path="/configuracoes/aquisicao/lista" element={<ProtectedRoute><AcquisitionListPage /></ProtectedRoute>} />
      <Route path="/configuracoes/aquisicao/lote" element={<ProtectedRoute><AcquisitionBatchPage /></ProtectedRoute>} />
                  {/* __AUTOATENDE_C1E0_ASSISTANT_PLAYGROUND_ROUTE__ */}
                  <Route path="/configuracoes/teste-assistente" element={<ProtectedRoute><RoleGuard allowed={['owner','admin']}><AssistantPreviewProfessional /></RoleGuard></ProtectedRoute>} />
                  {/* __AUTOATENDE_C2A_COMMERCIAL_ONBOARDING_ROUTE__ */}
                  <Route path="/configuracoes/onboarding-comercial" element={<RoleGuard allowed={['owner','admin']}><CommercialOnboardingWizard /></RoleGuard>} />
                  {/* __AUTOATENDE_C3A_ASSISTANT_CENTRAL_ROUTE__ */}
                  <Route path="/configuracoes/assistente-ia" element={<Navigate to="/configuracoes/assistente-central" replace />} />
                  <Route path="/configuracoes/assistente-central" element={<ProtectedRoute><RoleGuard allowed={['owner','admin']}><AssistantCentralProfessional /></RoleGuard></ProtectedRoute>} />
                  {/* __AUTOATENDE_C13D_R5B_R3_AQUISICAO_SITE_ROUTE__ */}
                  <Route path="/configuracoes/aquisicao-site" element={<Navigate to="/configuracoes/aquisicao" replace />} />

          <Route
            path="/inbox-v2-preview"
            element={
              <ProtectedBareRoute>
                <InboxV2Preview />
              </ProtectedBareRoute>
            }
          />

          <Route
            path="/inbox-legacy"
            element={
              <ProtectedRoute>
                <InboxLegacy />
              </ProtectedRoute>
            }
          />
</Routes>
        </React.Suspense>
      </Router>
    </AuthProvider>
  );
}

export default App;

// __AUTOATENDE_C15B_INBOX_SHELL_CANVAS_AUTHORITY__
