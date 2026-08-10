const AutoAtendeSite = (() => {
  const money = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  const planMap = {
    essencial: { name: 'Essencial', monthly: 24990, implementation: 49000 },
    profissional: { name: 'Profissional', monthly: 44990, implementation: 69000 },
    business: { name: 'Business', monthly: 69990, implementation: 99000 },
  };

  function currencyFromCents(value) {
    return money.format(Number(value || 0) / 100);
  }

  function getSelectedPlan(form) {
    const key = form?.plan?.value || 'profissional';
    return planMap[key] || planMap.profissional;
  }

  function getSessionId() {
    const params = new URLSearchParams(window.location.search);
    return params.get('session_id');
  }

  function buildOnboardingUrl(sessionId) {
    return '/onboarding/?session_id=' + encodeURIComponent(sessionId || '');
  }

  function buildWhatsAppUrl(sessionId, planName) {
    const text = [
      'Olá, acabei de confirmar a contratação da AutoAtendeAI.',
      '',
      `Plano: ${planName || 'não identificado'}`,
      `Código da contratação: ${sessionId || 'não informado'}`,
      '',
      'Quero iniciar o onboarding assistido.'
    ].join('\n');

    return 'https://wa.me/554598131537?text=' + encodeURIComponent(text);
  }

  function updateCheckoutSummary(form, target) {
    if (!form || !target) return;

    const selected = getSelectedPlan(form);
    const total = selected.monthly + selected.implementation;

    target.innerHTML = `
      <div class="summary-line"><span>Plano</span><strong>${selected.name}</strong></div>
      <div class="summary-line"><span>Mensalidade</span><strong>${currencyFromCents(selected.monthly)}</strong></div>
      <div class="summary-line"><span>Implementação personalizada</span><strong>${currencyFromCents(selected.implementation)}</strong></div>
      <div class="summary-line"><span>Total inicial</span><strong>${currencyFromCents(total)}</strong></div>
      <div class="summary-line"><span>Depois</span><strong>${currencyFromCents(selected.monthly)}/mês</strong></div>
    `;
  }

  function initCheckoutForm() {
    const form = document.querySelector('[data-checkout-form]');
    if (!form) return;

    const message = document.querySelector('[data-checkout-message]');
    const summary = document.querySelector('[data-checkout-summary]');

    updateCheckoutSummary(form, summary);

    form.plan?.addEventListener('change', () => {
      updateCheckoutSummary(form, summary);
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      if (message) {
        message.textContent = 'Gerando ambiente seguro de pagamento...';
        message.className = 'notice status-wait full';
      }

      const data = Object.fromEntries(new FormData(form).entries());
      data.acceptedTerms = Boolean(form.acceptedTerms?.checked);

      try {
        const response = await fetch('/api/public/billing/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });

        const result = await response.json();

        if (!response.ok || !result.url) {
          throw new Error(result.message || 'Não foi possível iniciar a contratação.');
        }

        window.location.href = result.url;
      } catch (error) {
        if (message) {
          message.textContent = error.message || 'Não foi possível iniciar a contratação agora.';
          message.className = 'notice status-error full';
        }
      }
    });
  }

  async function fetchCheckoutStatus(sessionId) {
    const response = await fetch('/api/public/billing/checkout/status?session_id=' + encodeURIComponent(sessionId));
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Não foi possível consultar o status.');
    }

    return result;
  }


  async function requestConfirmationEmail(sessionId) {
    try {
      const response = await fetch('/api/public/billing/checkout/confirmation-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });

      const result = await response.json().catch(() => ({}));

      return {
        ok: response.ok,
        ...result,
      };
    } catch (error) {
      return {
        ok: false,
        sent: false,
        reason: 'request_failed',
      };
    }
  }

  async function initSuccessPage() {
    const statusBox = document.querySelector('[data-checkout-status]');
    if (!statusBox) return;

    const sessionId = getSessionId();

    if (!sessionId) {
      statusBox.textContent = 'Sessão não informada. Volte para a contratação e tente novamente.';
      statusBox.className = 'notice status-error';
      return;
    }

    try {
      const result = await fetchCheckoutStatus(sessionId);
      const planName = result.plan?.name || 'AutoAtendeAI';

      if (result.onboarding?.allowed) {
        statusBox.className = 'notice status-ok';
        statusBox.innerHTML = `
          <strong>Pagamento confirmado.</strong><br>
          Plano: ${planName}<br>
          Seu onboarding assistido já pode ser iniciado com segurança.
          <div class="hero-note" data-confirmation-email-status style="margin-top:10px">Enviando e-mail de confirmação...</div>
          <div class="hero-actions" style="margin-top:18px">
            <a class="btn btn-primary" href="${buildOnboardingUrl(sessionId)}">Iniciar onboarding</a>
            <a class="btn btn-secondary" href="${buildWhatsAppUrl(sessionId, planName)}" target="_blank" rel="noopener">Falar com implantação</a>
          </div>
        `;
        const emailStatus = statusBox.querySelector('[data-confirmation-email-status]');
        const emailResult = await requestConfirmationEmail(sessionId);

        if (emailStatus) {
          if (emailResult.sent) {
            emailStatus.textContent = 'E-mail de confirmação enviado para o cliente.';
          } else if (emailResult.alreadySent) {
            emailStatus.textContent = 'E-mail de confirmação já havia sido enviado.';
          } else if (emailResult.reason === 'smtp_not_configured') {
            emailStatus.textContent = 'Confirmação liberada. O envio automático de e-mail ainda precisa de SMTP configurado.';
          } else {
            emailStatus.textContent = 'Confirmação liberada. O e-mail automático não foi enviado neste momento.';
          }
        }

        return;
      }

      statusBox.className = 'notice status-wait';
      statusBox.innerHTML = `
        <strong>Status atual:</strong> ${result.paymentStatus || 'aguardando confirmação'}<br>
        A contratação ainda não foi confirmada. Se você acabou de concluir o pagamento, aguarde alguns instantes e atualize esta página.
      `;
    } catch (error) {
      statusBox.textContent = error.message || 'Não foi possível consultar o status agora.';
      statusBox.className = 'notice status-error';
    }
  }

  async function initOnboardingPage() {
    const statusBox = document.querySelector('[data-onboarding-status]');
    if (!statusBox) return;

    const sessionInfo = document.querySelector('[data-onboarding-session]');
    const whatsappLink = document.querySelector('[data-onboarding-whatsapp]');
    const copyButton = document.querySelector('[data-copy-session]');
    const sessionId = getSessionId();

    if (!sessionId) {
      statusBox.textContent = 'Não encontramos o código da contratação. Volte para a página de sucesso ou fale com implantação.';
      statusBox.className = 'notice status-error';
      return;
    }

    if (sessionInfo) {
      sessionInfo.textContent = 'Código da contratação: ' + sessionId;
    }

    if (copyButton) {
      copyButton.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(sessionId);
          copyButton.textContent = 'Código copiado';
        } catch (_) {
          copyButton.textContent = 'Copie: ' + sessionId;
        }
      });
    }

    try {
      const result = await fetchCheckoutStatus(sessionId);
      const planName = result.plan?.name || 'AutoAtendeAI';

      if (!result.onboarding?.allowed) {
        statusBox.className = 'notice status-wait';
        statusBox.innerHTML = `
          <strong>Contratação ainda em validação.</strong><br>
          Se você acabou de concluir o pagamento, aguarde alguns instantes e atualize esta página.
        `;
        return;
      }

      if (whatsappLink) {
        whatsappLink.href = buildWhatsAppUrl(sessionId, planName);
      }

      statusBox.className = 'notice status-ok';
      statusBox.innerHTML = `
        <strong>Contratação confirmada.</strong><br>
        Plano: ${planName}<br>
        A etapa de onboarding assistido está liberada. Fale com implantação para iniciar a configuração personalizada da sua operação.
      `;
    } catch (error) {
      statusBox.textContent = error.message || 'Não foi possível validar a contratação agora.';
      statusBox.className = 'notice status-error';
    }
  }

  function initFaqAnalytics() {
    document.querySelectorAll('.faq-item').forEach((item) => {
      item.addEventListener('toggle', () => {
        if (item.open) {
          document.querySelectorAll('.faq-item[open]').forEach((other) => {
            if (other !== item) other.open = false;
          });
        }
      });
    });
  }

  function init() {
    initCheckoutForm();
    initSuccessPage();
    initOnboardingPage();
    initFaqAnalytics();
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', AutoAtendeSite.init);
