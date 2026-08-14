const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');

const ACQUISITION_SERVICE_PATH = path.resolve(__dirname, 'acquisitionOperation.service.js');

const basePayload = (overrides = {}) => ({
  companyId: 'tenant-a',
  to: '+5511999999999',
  templateName: 'approved_template',
  languageCode: 'pt_BR',
  components: [],
  templateCategory: 'utility_auth',
  templatePreviewText: 'Conteúdo aprovado',
  ...overrides
});

function templateAuthorizationError({ unavailable = false, code = null } = {}) {
  const error = new Error(
    unavailable
      ? 'Não foi possível confirmar a autorização do template agora.'
      : 'Template não autorizado para esta conta operacional.'
  );
  error.code = code || (
    unavailable
      ? 'ACQUISITION_TEMPLATE_AUTHORIZATION_UNAVAILABLE'
      : 'ACQUISITION_TEMPLATE_NOT_AUTHORIZED'
  );
  error.statusCode = unavailable ? 503 : 403;
  error.meta = {
    template_authorization: unavailable ? 'unavailable' : 'denied'
  };
  return error;
}

function loadAcquisitionService(overrides = {}) {
  const calls = { boundary: [], usage: [], persist: [], resolver: [] };
  const stubs = {
    './templateUsageCategories.service': {
      normalizeTemplateUsageCategory: (value) => value || 'utility_auth'
    },
    './whatsapp.service': {
      sendTemplateMessage: async (...args) => {
        calls.boundary.push(args);
        if (overrides.boundaryError) throw overrides.boundaryError;
        return { success: true, provider_message_id: 'provider-message-1' };
      }
    },
    './usage.service': {
      consumeTemplateUsageByCategory: async (payload) => {
        calls.usage.push(payload);
        return { usage: { current: 1 }, degraded: false };
      }
    },
    './inbox.service': {
      persistOutboundBotMessage: async (payload) => {
        calls.persist.push(payload);
        return {
          success: true,
          conversation_id: 'conversation-1',
          message_id: 'message-1'
        };
      }
    },
    './templateBodyResolver.service': {
      resolveTemplateDisplayInput: async (payload) => {
        calls.resolver.push(payload);
        return { body: 'Conteúdo resolvido' };
      }
    },
    './templateDisplayText.service': {
      buildTemplateDisplayText: () => ({ text: 'Conteúdo resolvido' }),
      buildTemplateTechnicalPreview: () => 'Conteúdo técnico'
    },
    './templateInboxContent.service': {
      buildTemplateInboxContent: () => 'Conteúdo para inbox'
    }
  };

  const originalLoad = Module._load;
  delete require.cache[ACQUISITION_SERVICE_PATH];
  Module._load = function patchedLoad(request, parent, isMain) {
    if (parent?.filename === ACQUISITION_SERVICE_PATH && stubs[request]) {
      return stubs[request];
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    return { service: require(ACQUISITION_SERVICE_PATH), calls };
  } finally {
    Module._load = originalLoad;
    delete require.cache[ACQUISITION_SERVICE_PATH];
  }
}

async function captureRejection(promise) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  assert.fail('Expected operation to reject');
}

function assertAuthorizationError(error, {
  code = 'ACQUISITION_TEMPLATE_NOT_AUTHORIZED',
  statusCode = 403
} = {}) {
  assert.equal(error?.code, code);
  assert.equal(error?.statusCode, statusCode);
  assert.match(String(error?.message || ''), /autoriz|confirmar/i);
  assert.deepEqual(error?.meta, {
    template_authorization: statusCode === 503 ? 'unavailable' : 'denied'
  });
}

function assertNoPostSendEffects(calls) {
  assert.equal(calls.persist.length, 0);
  assert.equal(calls.usage.length, 0);
}

test('B1 approved domain path invokes the authoritative boundary once and records effects', async () => {
  const { service, calls } = loadAcquisitionService();
  const result = await service.sendAcquisitionTemplate(basePayload());

  assert.equal(result.success, true);
  assert.equal(calls.boundary.length, 1);
  assert.deepEqual(calls.boundary[0], [
    'tenant-a', '+5511999999999', 'approved_template', 'pt_BR', []
  ]);
  assert.equal(calls.persist.length, 1);
  assert.equal(calls.usage.length, 1);
});

test('B2 rejected template from the boundary fails closed without downstream effects', async () => {
  const { service, calls } = loadAcquisitionService({
    boundaryError: templateAuthorizationError()
  });
  const error = await captureRejection(service.sendAcquisitionTemplate(basePayload()));

  assertAuthorizationError(error);
  assert.equal(calls.boundary.length, 1);
  assertNoPostSendEffects(calls);
});

test('B3 unknown template from the boundary fails closed', async () => {
  const { service, calls } = loadAcquisitionService({
    boundaryError: templateAuthorizationError()
  });
  const error = await captureRejection(service.sendAcquisitionTemplate(basePayload({
    templateName: 'unknown_template'
  })));

  assertAuthorizationError(error);
  assert.equal(calls.boundary.length, 1);
  assertNoPostSendEffects(calls);
});

test('B4 unavailable authority remains sanitized through the domain path', async () => {
  const { service, calls } = loadAcquisitionService({
    boundaryError: templateAuthorizationError({ unavailable: true })
  });
  const error = await captureRejection(service.sendAcquisitionTemplate(basePayload()));

  assertAuthorizationError(error, {
    code: 'ACQUISITION_TEMPLATE_AUTHORIZATION_UNAVAILABLE',
    statusCode: 503
  });
  assert.equal(JSON.stringify(error).includes('access_token'), false);
  assert.equal(calls.boundary.length, 1);
  assertNoPostSendEffects(calls);
});

test('B5 empty authoritative catalog result fails closed at the boundary', async () => {
  const { service, calls } = loadAcquisitionService({
    boundaryError: templateAuthorizationError()
  });
  const error = await captureRejection(service.sendAcquisitionTemplate(basePayload()));

  assertAuthorizationError(error);
  assert.equal(calls.boundary.length, 1);
  assertNoPostSendEffects(calls);
});

test('B6 cross-tenant approval cannot pass through the domain path', async () => {
  const { service, calls } = loadAcquisitionService({
    boundaryError: templateAuthorizationError()
  });
  const error = await captureRejection(service.sendAcquisitionTemplate(basePayload({
    companyId: 'tenant-b'
  })));

  assertAuthorizationError(error);
  assert.deepEqual(calls.boundary[0].slice(0, 1), ['tenant-b']);
  assertNoPostSendEffects(calls);
});

test('B7 cross-account mismatch remains a sanitized domain rejection', async () => {
  const { service, calls } = loadAcquisitionService({
    boundaryError: templateAuthorizationError({
      code: 'WHATSAPP_TEMPLATE_AUTHORIZATION_ACCOUNT_MISMATCH'
    })
  });
  const error = await captureRejection(service.sendAcquisitionTemplate(basePayload()));

  assertAuthorizationError(error, {
    code: 'WHATSAPP_TEMPLATE_AUTHORIZATION_ACCOUNT_MISMATCH'
  });
  assert.equal(calls.boundary.length, 1);
  assertNoPostSendEffects(calls);
});

test('B8 pending template from the boundary fails closed', async () => {
  const { service, calls } = loadAcquisitionService({
    boundaryError: templateAuthorizationError()
  });
  const error = await captureRejection(service.sendAcquisitionTemplate(basePayload()));

  assertAuthorizationError(error);
  assert.equal(calls.boundary.length, 1);
  assertNoPostSendEffects(calls);
});

test('B9 forged client approval fields are not forwarded to the send boundary', async () => {
  const { service, calls } = loadAcquisitionService({
    boundaryError: templateAuthorizationError()
  });
  const error = await captureRejection(service.sendAcquisitionTemplate(basePayload({
    approved: true,
    status: 'APPROVED',
    isSendable: true,
    authorizationContext: {
      providerAccount: { wabaId: 'forged-waba' }
    }
  })));

  assertAuthorizationError(error);
  assert.equal(calls.boundary.length, 1);
  assert.equal(calls.boundary[0].length, 5);
  assert.equal(JSON.stringify(calls.boundary[0]).includes('forged-waba'), false);
  assertNoPostSendEffects(calls);
});

test('B10 missing template name fails before the send boundary', async () => {
  const { service, calls } = loadAcquisitionService();
  const error = await captureRejection(service.sendAcquisitionTemplate(basePayload({
    templateName: '   '
  })));

  assert.equal(error.code, 'ACQUISITION_SEND_TEMPLATE_MISSING');
  assert.equal(error.statusCode, 400);
  assert.equal(calls.boundary.length, 0);
  assertNoPostSendEffects(calls);
});
