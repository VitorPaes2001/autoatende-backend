/**
 * Analytics Service
 * Centraliza o rastreamento de eventos de produto.
 * Atualmente loga no console, mas está pronto para PostHog/Google Analytics.
 */

class AnalyticsService {
  constructor() {
    this.initialized = false;
    this.user = null;
  }

  init(user) {
    this.user = user;
    this.initialized = true;
    this.log('Analytics initialized for user:', user?.email);
  }

  /**
   * Rastreia um evento
   * @param {string} eventName - Nome do evento (ex: onboarding_started)
   * @param {object} properties - Dados adicionais (ex: { step: 1 })
   */
  track(eventName, properties = {}) {
    if (!eventName) return;

    const payload = {
      event: eventName,
      timestamp: new Date().toISOString(),
      user_id: this.user?.id,
      email: this.user?.email,
      ...properties
    };

    // 1. Log no Console (Dev/Simples)
    console.groupCollapsed(`📊 [Analytics] ${eventName}`);
    console.log('Payload:', payload);
    console.groupEnd();

    // 2. Futura integração com PostHog
    // if (window.posthog) {
    //   window.posthog.capture(eventName, payload);
    // }
  }

  // Helper interno para logs do serviço
  log(...args) {
    if (import.meta.env.DEV) {
      console.log('[AnalyticsService]', ...args);
    }
  }
}

export const analytics = new AnalyticsService();
