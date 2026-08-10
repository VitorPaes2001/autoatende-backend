const stripe = require('../config/stripe');
const billingService = require('../services/billing.service');
const stripeWebhookEventService = require('../services/stripeWebhookEvent.service');
const checkoutConfirmationEmailService = require('../services/checkoutConfirmationEmail.service');
const billingProvisioningQueueService = require('../services/billingProvisioningQueue.service');

function makeWebhookError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function getWebhookSecret() {
  return String(process.env.STRIPE_WEBHOOK_SECRET || '').trim();
}

function getRawBody(req) {
  if (Buffer.isBuffer(req.rawBody)) return req.rawBody;
  if (typeof req.rawBody === 'string') return Buffer.from(req.rawBody, 'utf8');
  if (Buffer.isBuffer(req.body)) return req.body;
  return null;
}

function sanitizeError(error) {
  return String(error?.message || error || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9_-]+\b/gi, '[REDACTED_STRIPE_KEY]')
    .replace(/\bwhsec_[A-Za-z0-9_-]+\b/gi, '[REDACTED_WEBHOOK_SECRET]')
    .replace(/\bBearer\s+\S+/gi, 'Bearer [REDACTED]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
}

function isSupportedBillingWebhookEvent(billingWebhookService, eventType) {
  const supportCheck = billingWebhookService?.isSupportedWebhookEventType;

  if (typeof supportCheck !== 'function') {
    throw makeWebhookError(
      503,
      'BILLING_WEBHOOK_CONTRACT_UNAVAILABLE',
      'Billing webhook contract is unavailable.'
    );
  }

  let supported;

  try {
    supported = supportCheck.call(billingWebhookService, eventType);
  } catch (_) {
    throw makeWebhookError(
      503,
      'BILLING_WEBHOOK_CONTRACT_UNAVAILABLE',
      'Billing webhook contract is unavailable.'
    );
  }

  if (typeof supported !== 'boolean') {
    throw makeWebhookError(
      503,
      'BILLING_WEBHOOK_CONTRACT_INVALID',
      'Billing webhook contract returned an invalid support result.'
    );
  }

  return supported;
}

function isSuccessfulBillingWebhookResult(result, eventType) {
  return (
    result &&
    typeof result === 'object' &&
    !Array.isArray(result) &&
    result.ok === true &&
    result.handled === true &&
    result.eventType === eventType
  );
}

function constructVerifiedEvent(stripeClient, rawBody, signature, secret) {
  try {
    return stripeClient.webhooks.constructEvent(rawBody, signature, secret);
  } catch (_) {
    throw makeWebhookError(
      400,
      'STRIPE_SIGNATURE_INVALID',
      'Assinatura Stripe inválida.'
    );
  }
}

function checkoutSessionId(event) {
  return event?.data?.object?.id || null;
}

async function ensureProvisioningQueue(event, queueService, logger) {
  const sessionId = checkoutSessionId(event);

  if (!sessionId) {
    throw makeWebhookError(
      503,
      'STRIPE_CHECKOUT_SESSION_ID_MISSING',
      'Checkout session id is required for durable provisioning.'
    );
  }

  const ensureQueue = queueService.ensureFromCheckoutSessionId;

  if (typeof ensureQueue !== 'function') {
    throw makeWebhookError(
      503,
      'PROVISIONING_QUEUE_SERVICE_UNAVAILABLE',
      'Provisioning queue service is unavailable.'
    );
  }

  let result;

  try {
    result = await ensureQueue.call(queueService, sessionId, {
      eventId: event.id,
      webhookType: event.type,
    });
  } catch (error) {
    logger.error('[AA_PROVISIONING_QUEUE_WEBHOOK_ERROR]', JSON.stringify({
      eventId: event.id,
      sessionId,
      error: sanitizeError(error),
    }));

    throw makeWebhookError(
      503,
      'PROVISIONING_QUEUE_WRITE_FAILED',
      'Provisioning queue could not be persisted.'
    );
  }

  const summary = {
    attempted: true,
    ok: result?.ok === true,
    durable: result?.durable === true,
    inserted: result?.inserted === true,
    existing: result?.existing === true,
    reason: result?.reason || null,
    queueId: result?.queueId || null,
    status: result?.status || null,
    checkoutSessionId: result?.checkoutSessionId || sessionId,
  };

  logger.log(
    '[AA_PROVISIONING_QUEUE_WEBHOOK_RESULT]',
    JSON.stringify({
      eventId: event.id,
      sessionId,
      ...summary,
    })
  );

  if (!result?.ok || !result?.durable) {
    throw makeWebhookError(
      503,
      'PROVISIONING_QUEUE_NOT_DURABLE',
      'Provisioning queue was not durably confirmed.'
    );
  }

  return summary;
}

async function sendCheckoutConfirmationEmail(event, emailService, logger) {
  if (event.type !== 'checkout.session.completed') {
    return {
      attempted: false,
      reason: 'not_checkout_session_completed',
    };
  }

  const sessionId = checkoutSessionId(event);

  if (!sessionId || typeof emailService.sendCheckoutConfirmationEmail !== 'function') {
    return {
      attempted: false,
      sent: false,
      reason: 'confirmation_email_unavailable',
    };
  }

  try {
    const result = await emailService.sendCheckoutConfirmationEmail(sessionId);

    logger.log('[AA_CONFIRMATION_EMAIL_WEBHOOK_RESULT]', JSON.stringify({
      eventId: event.id,
      sessionId,
      sent: result?.sent === true,
      skipped: result?.skipped === true,
      reason: result?.reason,
      alreadySent: result?.alreadySent === true,
    }));

    return {
      attempted: true,
      ...result,
    };
  } catch (error) {
    logger.error('[AA_CONFIRMATION_EMAIL_WEBHOOK_ERROR]', JSON.stringify({
      eventId: event.id,
      sessionId,
      error: sanitizeError(error),
    }));

    return {
      attempted: true,
      ok: false,
      sent: false,
      skipped: true,
      reason: 'confirmation_email_error',
    };
  }
}

function createWebhookHandler({
  stripeClient = stripe,
  billingWebhookService = billingService,
  eventLedger = stripeWebhookEventService,
  emailService = checkoutConfirmationEmailService,
  queueService = billingProvisioningQueueService,
  webhookSecretProvider = getWebhookSecret,
  logger = console,
} = {}) {
  return async function handleWebhook(req, res) {
    let event = null;
    let claim = null;

    try {
      const secret = webhookSecretProvider();

      if (!secret) {
        throw makeWebhookError(
          500,
          'STRIPE_WEBHOOK_SECRET_NOT_CONFIGURED',
          'Stripe webhook secret is not configured.'
        );
      }

      const rawBody = getRawBody(req);

      if (!rawBody) {
        throw makeWebhookError(
          400,
          'STRIPE_RAW_BODY_MISSING',
          'Raw body is required for Stripe webhook signature verification.'
        );
      }

      const signature = req.headers['stripe-signature'];

      if (!signature) {
        throw makeWebhookError(
          400,
          'STRIPE_SIGNATURE_MISSING',
          'Stripe signature header is missing.'
        );
      }

      event = constructVerifiedEvent(stripeClient, rawBody, signature, secret);

      if (
        event.type === 'checkout.session.completed' &&
        typeof queueService.ensureFromCheckoutSessionId !== 'function'
      ) {
        throw makeWebhookError(
          503,
          'PROVISIONING_QUEUE_SERVICE_UNAVAILABLE',
          'Provisioning queue service is unavailable.'
        );
      }

      claim = await eventLedger.claimEvent(event);

      if (claim.result === stripeWebhookEventService.CLAIM_RESULTS.ALREADY_PROCESSED) {
        return res.status(200).json({
          received: true,
          duplicate: true,
          id: event.id,
          type: event.type,
        });
      }

      if (claim.result === stripeWebhookEventService.CLAIM_RESULTS.IN_PROGRESS) {
        claim = null;
        throw makeWebhookError(
          503,
          'STRIPE_WEBHOOK_EVENT_IN_PROGRESS',
          'Stripe webhook event is already being processed.'
        );
      }

      if (claim.result === stripeWebhookEventService.CLAIM_RESULTS.ERROR) {
        const claimErrorCode = claim.errorCode || 'STRIPE_WEBHOOK_EVENT_CLAIM_REJECTED';
        claim = null;
        throw makeWebhookError(
          503,
          claimErrorCode,
          'Stripe webhook event claim was rejected.'
        );
      }

      const ownsClaim =
        claim.result === stripeWebhookEventService.CLAIM_RESULTS.CLAIMED ||
        claim.result === stripeWebhookEventService.CLAIM_RESULTS.RETRY_CLAIMED;

      if (!ownsClaim) {
        claim = null;
        throw makeWebhookError(
          503,
          'STRIPE_WEBHOOK_EVENT_CLAIM_INVALID',
          'Stripe webhook event claim was not granted.'
        );
      }

      let provisioningQueue = {
        attempted: false,
        reason: 'not_checkout_session_completed',
      };
      let billingResult = null;
      let billingForwarded = false;

      if (event.type === 'checkout.session.completed') {
        provisioningQueue = await ensureProvisioningQueue(
          event,
          queueService,
          logger
        );
      } else {
        const billingEventSupported = isSupportedBillingWebhookEvent(
          billingWebhookService,
          event.type
        );

        if (billingEventSupported) {
          if (typeof billingWebhookService.handleWebhook !== 'function') {
            throw makeWebhookError(
              503,
              'BILLING_WEBHOOK_SERVICE_UNAVAILABLE',
              'Billing webhook service is unavailable.'
            );
          }

          billingResult = await billingWebhookService.handleWebhook(event);

          if (!isSuccessfulBillingWebhookResult(billingResult, event.type)) {
            throw makeWebhookError(
              503,
              'BILLING_WEBHOOK_RESULT_INVALID',
              'Billing webhook service did not confirm successful processing.'
            );
          }

          billingForwarded = true;
        }
      }

      const processed = await eventLedger.markProcessed(
        claim.eventId,
        claim.attemptCount
      );

      if (!processed?.ok) {
        throw makeWebhookError(
          503,
          'STRIPE_WEBHOOK_EVENT_CLAIM_LOST',
          'Stripe webhook event claim was lost before completion.'
        );
      }

      const confirmationEmail = await sendCheckoutConfirmationEmail(
        event,
        emailService,
        logger
      );

      return res.status(200).json({
        received: true,
        duplicate: false,
        id: event.id,
        type: event.type,
        attemptCount: claim.attemptCount,
        provisioningQueue,
        confirmationEmail,
        billingForwarded,
        billingResult,
      });
    } catch (error) {
      const statusCode = error.statusCode || 500;
      const code = error.code || 'STRIPE_WEBHOOK_ERROR';

      if (event && claim?.attemptCount) {
        try {
          const failed = await eventLedger.markFailed(
            claim.eventId,
            claim.attemptCount,
            error
          );

          if (!failed?.ok) {
            logger.error('[StripeWebhook] Failed claim could not be closed:', {
              eventId: event.id,
              result: failed?.result || 'UNKNOWN',
            });
          }
        } catch (recordError) {
          logger.error(
            '[StripeWebhook] Failed to record failed event:',
            sanitizeError(recordError)
          );
        }
      }

      logger.error('[StripeWebhook] Rejected:', {
        code,
        statusCode,
        message: sanitizeError(error),
      });

      return res.status(statusCode).json({
        error: true,
        code,
        message: statusCode >= 500
          ? 'Webhook Stripe não pôde ser processado.'
          : error.message,
      });
    }
  };
}

const handleWebhook = createWebhookHandler();

module.exports = {
  createWebhookHandler,
  handleWebhook,
  webhook: handleWebhook,
  stripeWebhook: handleWebhook,
};
