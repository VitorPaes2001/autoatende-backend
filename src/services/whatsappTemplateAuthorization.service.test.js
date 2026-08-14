const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');

const WHATSAPP_SERVICE_PATH = path.resolve(__dirname, 'whatsapp.service.js');

const approvedTemplate = (overrides = {}) => ({
  name: 'approved_template',
  language: 'pt_BR',
  status: 'approved',
  rawStatus: 'APPROVED',
  isSendable: true,
  ...overrides
});

const approvedCatalog = (overrides = {}) => {
  const { meta = {}, ...rest } = overrides;
  return {
    items: [approvedTemplate()],
    ...rest,
    meta: {
      approved_only: true,
      waba_id: 'waba-tenant-a',
      phone_number_id: 'phone-tenant-a',
      ...meta
    }
  };
};

const defaultAccount = (overrides = {}) => ({
  company_id: 'tenant-a',
  waba_id: 'waba-tenant-a',
  phone_number_id: 'phone-tenant-a',
  access_token: 'SYNTHETIC_ACCOUNT_TOKEN',
  ...overrides
});

function loadSendBoundary(overrides = {}) {
  const calls = { catalog: [], accountLookups: [], provider: [] };
  const account = Object.prototype.hasOwnProperty.call(overrides, 'account')
    ? overrides.account
    : defaultAccount();
  const catalog = overrides.catalog || (() => approvedCatalog());

  const supabase = {
    from(table) {
      assert.equal(table, 'whatsapp_accounts');
      return {
        select() { return this; },
        eq(column, value) {
          calls.accountLookups.push({ column, value });
          this.lookupColumn = column;
          return this;
        },
        async maybeSingle() {
          if (this.lookupColumn === 'company_id') {
            return { data: account, error: overrides.accountError || null };
          }
          return { data: overrides.clientAccount || null, error: null };
        }
      };
    }
  };
  const axios = {
    async post(...args) {
      calls.provider.push(args);
      return { data: { messages: [{ id: 'mock-provider-message' }] } };
    }
  };
  const catalogService = {
    async listApprovedTemplatesForCompany(companyId) {
      calls.catalog.push(companyId);
      if (overrides.catalogError) throw overrides.catalogError;
      return catalog(companyId);
    }
  };

  const originalLoad = Module._load;
  delete require.cache[WHATSAPP_SERVICE_PATH];
  Module._load = function patchedLoad(request, parent, isMain) {
    if (parent?.filename === WHATSAPP_SERVICE_PATH) {
      if (request === '../config/supabase') return supabase;
      if (request === 'axios') return axios;
      if (request === './acquisitionTemplateCatalog.service') return catalogService;
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    return { service: require(WHATSAPP_SERVICE_PATH), calls };
  } finally {
    Module._load = originalLoad;
    delete require.cache[WHATSAPP_SERVICE_PATH];
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

function send(service, overrides = {}, forgedContext) {
  return service.sendTemplateMessage(
    overrides.companyId || 'tenant-a',
    overrides.to || '+5511999999999',
    Object.prototype.hasOwnProperty.call(overrides, 'templateName')
      ? overrides.templateName
      : 'approved_template',
    Object.prototype.hasOwnProperty.call(overrides, 'languageCode')
      ? overrides.languageCode
      : 'pt_BR',
    overrides.components || [],
    forgedContext
  );
}

function assertDenied(error, code = 'ACQUISITION_TEMPLATE_NOT_AUTHORIZED') {
  assert.equal(error?.code, code);
  assert.equal(error?.statusCode, 403);
  assert.deepEqual(error?.meta, { template_authorization: 'denied' });
}

function assertUnavailable(error, hidden = []) {
  assert.equal(error?.code, 'ACQUISITION_TEMPLATE_AUTHORIZATION_UNAVAILABLE');
  assert.equal(error?.statusCode, 503);
  assert.deepEqual(error?.meta, { template_authorization: 'unavailable' });
  const publicShape = JSON.stringify({
    message: error?.message,
    code: error?.code,
    meta: error?.meta,
    details: error?.details
  });
  for (const value of hidden) assert.equal(publicShape.includes(value), false);
}

test('D1 authoritative APPROVED for the correct tenant/account calls provider exactly once', async () => {
  const { service, calls } = loadSendBoundary();
  const result = await send(service);

  assert.equal(result.success, true);
  assert.deepEqual(calls.catalog, ['tenant-a']);
  assert.deepEqual(calls.accountLookups, [{ column: 'company_id', value: 'tenant-a' }]);
  assert.equal(calls.provider.length, 1);
  assert.equal(calls.provider[0][1].template.name, 'approved_template');
  assert.equal(calls.provider[0][1].template.language.code, 'pt_BR');
});

test('D2 forged APPROVED context cannot override authoritative REJECTED status', async () => {
  const { service, calls } = loadSendBoundary({
    catalog: () => approvedCatalog({
      items: [approvedTemplate({ status: 'rejected', rawStatus: 'REJECTED', isSendable: false })]
    })
  });
  const error = await captureRejection(send(service, {}, {
    approved: true,
    status: 'APPROVED',
    isSendable: true,
    providerAccount: { wabaId: 'waba-tenant-a', phoneNumberId: 'phone-tenant-a' },
    templateIdentity: { name: 'approved_template', languageCode: 'pt_BR' }
  }));

  assertDenied(error);
  assert.equal(calls.provider.length, 0);
});

test('D3 forged matching context cannot authorize an unknown template', async () => {
  const { service, calls } = loadSendBoundary({
    catalog: () => approvedCatalog({ items: [] })
  });
  const error = await captureRejection(send(service, {
    templateName: 'unknown_template'
  }, {
    approved: true,
    status: 'APPROVED',
    providerAccount: { wabaId: 'waba-tenant-a', phoneNumberId: 'phone-tenant-a' },
    templateIdentity: { name: 'unknown_template', languageCode: 'pt_BR' }
  }));

  assertDenied(error);
  assert.equal(calls.provider.length, 0);
});

test('D4 forged matching context cannot override authoritative PENDING status', async () => {
  const { service, calls } = loadSendBoundary({
    catalog: () => approvedCatalog({
      items: [approvedTemplate({ status: 'pending', rawStatus: 'PENDING', isSendable: false })]
    })
  });
  const error = await captureRejection(send(service, {}, {
    status: 'APPROVED',
    isSendable: true,
    providerAccount: { wabaId: 'waba-tenant-a', phoneNumberId: 'phone-tenant-a' },
    templateIdentity: { name: 'approved_template', languageCode: 'pt_BR' }
  }));

  assertDenied(error);
  assert.equal(calls.provider.length, 0);
});

test('D5 forged matching context cannot bypass unavailable authority', async () => {
  const sentinel = 'RAW_AUTHORITY_SECRET_SENTINEL';
  const rawError = new Error(`provider failure ${sentinel}`);
  rawError.response = { status: 401, data: { access_token: sentinel } };
  const { service, calls } = loadSendBoundary({ catalogError: rawError });
  const error = await captureRejection(send(service, {}, {
    approved: true,
    status: 'APPROVED',
    isSendable: true,
    providerAccount: { wabaId: 'waba-tenant-a', phoneNumberId: 'phone-tenant-a' },
    templateIdentity: { name: 'approved_template', languageCode: 'pt_BR' }
  }));

  assertUnavailable(error, [sentinel, 'access_token']);
  assert.equal(calls.accountLookups.length, 0);
  assert.equal(calls.provider.length, 0);
});

test('D6 tenant A forged approval cannot authorize tenant B', async () => {
  const { service, calls } = loadSendBoundary({
    catalog: (companyId) => companyId === 'tenant-a'
      ? approvedCatalog()
      : approvedCatalog({ items: [], meta: { waba_id: 'waba-tenant-b' } })
  });
  const error = await captureRejection(send(service, { companyId: 'tenant-b' }, {
    approved: true,
    status: 'APPROVED',
    providerAccount: { wabaId: 'waba-tenant-a', phoneNumberId: 'phone-tenant-a' },
    templateIdentity: { name: 'approved_template', languageCode: 'pt_BR' }
  }));

  assertDenied(error);
  assert.deepEqual(calls.catalog, ['tenant-b']);
  assert.equal(calls.provider.length, 0);
});

test('D7 account A approval cannot dispatch through account B', async () => {
  const accountToken = 'ACCOUNT_B_TOKEN_SENTINEL';
  const { service, calls } = loadSendBoundary({
    account: defaultAccount({
      waba_id: 'waba-tenant-b',
      phone_number_id: 'phone-tenant-b',
      access_token: accountToken
    })
  });
  const error = await captureRejection(send(service, {}, {
    approved: true,
    status: 'APPROVED',
    providerAccount: { wabaId: 'waba-tenant-a', phoneNumberId: 'phone-tenant-a' },
    templateIdentity: { name: 'approved_template', languageCode: 'pt_BR' }
  }));

  assertDenied(error, 'WHATSAPP_TEMPLATE_AUTHORIZATION_ACCOUNT_MISMATCH');
  assert.equal(JSON.stringify(error).includes(accountToken), false);
  assert.equal(calls.provider.length, 0);
});

test('D8 no authorizationContext is required when live authority approves', async () => {
  const { service, calls } = loadSendBoundary();
  const result = await service.sendTemplateMessage(
    'tenant-a', '+5511999999999', 'approved_template', 'pt_BR', []
  );

  assert.equal(result.success, true);
  assert.equal(calls.catalog.length, 1);
  assert.equal(calls.provider.length, 1);
});

test('D9 malformed authorizationContext cannot create authorization', async () => {
  const { service, calls } = loadSendBoundary({
    catalog: () => approvedCatalog({ items: [] })
  });
  const error = await captureRejection(send(service, {}, ['APPROVED', true]));

  assertDenied(error);
  assert.equal(calls.provider.length, 0);
});

test('D10 caller-provided status APPROVED is ignored without live approval', async () => {
  const { service, calls } = loadSendBoundary({
    catalog: () => approvedCatalog({
      items: [approvedTemplate({ status: 'disabled', rawStatus: 'DISABLED', isSendable: false })]
    })
  });
  const error = await captureRejection(send(service, {}, {
    status: 'APPROVED',
    rawStatus: 'APPROVED',
    isSendable: true
  }));

  assertDenied(error);
  assert.equal(calls.provider.length, 0);
});

test('I1 outer whitespace is trimmed without changing provider identifier case', async () => {
  const { service, calls } = loadSendBoundary();
  const result = await send(service, {
    templateName: '  approved_template  ',
    languageCode: '  pt_BR  '
  });

  assert.equal(result.success, true);
  assert.equal(calls.provider.length, 1);
  assert.equal(calls.provider[0][1].template.name, 'approved_template');
  assert.equal(calls.provider[0][1].template.language.code, 'pt_BR');
});

test('I2 template name matching remains case-sensitive', async () => {
  const { service, calls } = loadSendBoundary();
  const error = await captureRejection(send(service, {
    templateName: 'Approved_Template'
  }));

  assertDenied(error);
  assert.equal(calls.provider.length, 0);
});

test('I3 locale matching remains case-sensitive without normalization', async () => {
  const { service, calls } = loadSendBoundary();
  const error = await captureRejection(send(service, {
    languageCode: 'pt_br'
  }));

  assertDenied(error);
  assert.equal(calls.provider.length, 0);
});

test('I4 missing language preserves the existing pt_BR default', async () => {
  const { service, calls } = loadSendBoundary();
  const result = await send(service, { languageCode: undefined });

  assert.equal(result.success, true);
  assert.equal(calls.provider.length, 1);
  assert.equal(calls.provider[0][1].template.language.code, 'pt_BR');
});

test('I5 same name in another language cannot authorize the requested locale', async () => {
  const { service, calls } = loadSendBoundary({
    catalog: () => approvedCatalog({
      items: [approvedTemplate({ language: 'en_US' })]
    })
  });
  const error = await captureRejection(send(service));

  assertDenied(error);
  assert.equal(calls.provider.length, 0);
});

test('I6 malformed authority response fails unavailable and closed', async () => {
  const { service, calls } = loadSendBoundary({
    catalog: () => ({ items: {}, meta: { approved_only: true, waba_id: 'waba-tenant-a' } })
  });
  const error = await captureRejection(send(service));

  assertUnavailable(error);
  assert.equal(calls.provider.length, 0);
});

test('I7 authority timeout fails unavailable and closed', async () => {
  const timeoutError = new Error('synthetic timeout detail');
  timeoutError.code = 'ETIMEDOUT';
  const { service, calls } = loadSendBoundary({ catalogError: timeoutError });
  const error = await captureRejection(send(service));

  assertUnavailable(error, ['synthetic timeout detail', 'ETIMEDOUT']);
  assert.equal(calls.provider.length, 0);
});

test('I8 authoritative DISABLED status cannot reach provider', async () => {
  const { service, calls } = loadSendBoundary({
    catalog: () => approvedCatalog({
      items: [approvedTemplate({ status: 'disabled', rawStatus: 'DISABLED', isSendable: false })]
    })
  });
  const error = await captureRejection(send(service));

  assertDenied(error);
  assert.equal(calls.provider.length, 0);
});

test('I9 missing template name rejects before authority or provider calls', async () => {
  const { service, calls } = loadSendBoundary();
  const error = await captureRejection(send(service, { templateName: '   ' }));

  assert.equal(error.code, 'WHATSAPP_TEMPLATE_NAME_MISSING');
  assert.equal(error.statusCode, 400);
  assert.equal(calls.catalog.length, 0);
  assert.equal(calls.accountLookups.length, 0);
  assert.equal(calls.provider.length, 0);
});
