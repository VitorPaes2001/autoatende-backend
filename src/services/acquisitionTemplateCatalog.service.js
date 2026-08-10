
const AA_DYNAMIC_TEMPLATE_EXAMPLES_MARKER = '__AUTOATENDE_C16N_C7C_R1D_FIX1_DYNAMIC_TEMPLATE_EXAMPLES__';

function aaNormalizeExampleField(value = []) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }

  return String(value || '')
    .split(/[;\n|]/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function aaExtractPlaceholderIndexes(text = '') {
  const matches = [...String(text || '').matchAll(/\{\{(\d+)\}\}/g)];
  const indexes = matches
    .map((item) => Number(item[1]))
    .filter((value) => Number.isFinite(value));
  return [...new Set(indexes)].sort((a, b) => a - b);
}

function aaResolveExampleValues(text, providedValues, fallbackPrefix) {
  const indexes = aaExtractPlaceholderIndexes(text);
  if (!indexes.length) return [];

  const provided = aaNormalizeExampleField(providedValues);

  return indexes.map((index, position) => {
    const next = provided[position];
    if (next) return next;
    return `${fallbackPrefix}${index}`;
  });
}

function aaBuildTextExamplePayload(componentType, text, providedValues, fallbackPrefix) {
  const resolvedValues = aaResolveExampleValues(text, providedValues, fallbackPrefix);
  if (!resolvedValues.length) return undefined;

  if (String(componentType).toUpperCase() === 'BODY') {
    return { body_text: [resolvedValues] };
  }

  return { header_text: resolvedValues };
}

const axios = require('axios');
const supabase = require('../config/supabase');
const AppError = require('../utils/AppError');

const GRAPH_VERSION = process.env.WHATSAPP_API_VERSION || 'v24.0';

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function extractPlaceholderIndexes(text = '') {
  const matches = [...String(text).matchAll(/\{\{\s*(\d+)\s*\}\}/g)];
  return [...new Set(matches.map((m) => Number(m[1])).filter(Boolean))].sort((a, b) => a - b);
}

function buildTextParameters(count, examples = [], prefix = 'valor') {
  return Array.from({ length: count }, (_, index) => ({
    type: 'text',
    text: String(examples[index] ?? `${prefix}_${index + 1}`)
  }));
}

function extractBodyExamples(component = {}) {
  const raw = component?.example?.body_text;
  if (!Array.isArray(raw)) return [];
  if (Array.isArray(raw[0])) return raw[0].map((item) => String(item));
  return raw.map((item) => String(item));
}

function extractHeaderExamples(component = {}) {
  const raw = component?.example?.header_text;
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => String(item));
}

function normalizeStatus(rawStatus = '') {
  const upper = String(rawStatus || '').trim().toUpperCase();
  if (!upper) return 'unknown';

  const map = {
    APPROVED: 'approved',
    PENDING: 'pending',
    IN_REVIEW: 'in_review',
    REJECTED: 'rejected',
    PAUSED: 'paused',
    DISABLED: 'disabled',
    ARCHIVED: 'archived',
    DELETED: 'deleted'
  };

  return map[upper] || upper.toLowerCase();
}

function isSendableStatus(rawStatus = '') {
  return String(rawStatus || '').trim().toUpperCase() === 'APPROVED';
}

function buildTextStatusLabel(rawStatus = '') {
  const normalized = normalizeStatus(rawStatus);

  const map = {
    approved: 'aprovado',
    pending: 'pendente',
    in_review: 'em análise',
    rejected: 'rejeitado',
    paused: 'pausado',
    disabled: 'desativado',
    archived: 'arquivado',
    deleted: 'excluído',
    unknown: 'desconhecido'
  };

  return map[normalized] || normalized.replace(/_/g, ' ');
}

function buildDefaultSendComponentsFromTemplateDefinition(components = []) {
  const result = [];
  const warnings = [];

  safeArray(components).forEach((component) => {
    const type = String(component?.type || '').toUpperCase();

    if (type === 'BODY') {
      const placeholders = extractPlaceholderIndexes(component?.text || '');
      if (placeholders.length > 0) {
        result.push({
          type: 'body',
          parameters: buildTextParameters(placeholders.length, extractBodyExamples(component), 'corpo')
        });
      }
      return;
    }

    if (type === 'HEADER') {
      const format = String(component?.format || 'TEXT').toUpperCase();

      if (format === 'TEXT') {
        const placeholders = extractPlaceholderIndexes(component?.text || '');
        if (placeholders.length > 0) {
          result.push({
            type: 'header',
            parameters: buildTextParameters(placeholders.length, extractHeaderExamples(component), 'cabecalho')
          });
        }
        return;
      }

      if (['IMAGE', 'VIDEO', 'DOCUMENT', 'LOCATION'].includes(format)) {
        warnings.push(`HEADER ${format} exige complemento manual no envio.`);
      }

      return;
    }

    if (type === 'BUTTONS') {
      safeArray(component?.buttons).forEach((button, buttonIndex) => {
        const buttonType = String(button?.type || '').toUpperCase();

        if (buttonType === 'URL') {
          const placeholders = extractPlaceholderIndexes(button?.url || '');
          if (placeholders.length > 0) {
            result.push({
              type: 'button',
              sub_type: 'url',
              index: String(buttonIndex),
              parameters: buildTextParameters(placeholders.length, [], 'botao_url')
            });
          }
        }
      });
    }
  });

  return {
    defaultSendComponents: result,
    autofillWarnings: warnings
  };
}

function buildPreviewText(components = []) {
  const lines = [];

  safeArray(components).forEach((component) => {
    const type = String(component?.type || '').toUpperCase();

    if (type === 'HEADER') {
      const format = String(component?.format || 'TEXT').toUpperCase();
      if (format === 'TEXT' && component?.text) {
        lines.push(`HEADER: ${component.text}`);
      } else if (format && format !== 'TEXT') {
        lines.push(`HEADER (${format})`);
      }
      return;
    }

    if (type === 'BODY' && component?.text) {
      lines.push(`BODY: ${component.text}`);
      return;
    }

    if (type === 'FOOTER' && component?.text) {
      lines.push(`FOOTER: ${component.text}`);
      return;
    }

    if (type === 'BUTTONS' && Array.isArray(component?.buttons) && component.buttons.length > 0) {
      const buttonsLine = component.buttons
        .map((button) => {
          const buttonType = String(button?.type || '').toUpperCase();
          const label = button?.text || button?.url || button?.phone_number || '';
          return `${buttonType}${label ? `: ${label}` : ''}`;
        })
        .join(' | ');

      if (buttonsLine) {
        lines.push(`BUTTONS: ${buttonsLine}`);
      }
    }
  });

  return lines.join('\n\n').trim();
}

async function resolveCompanyAccount(companyId) {
  const { data: account, error } = await supabase
    .from('whatsapp_accounts')
    .select('company_id, waba_id, access_token, phone_number_id, phone_number')
    .eq('company_id', companyId)
    .maybeSingle();

  if (error) {
    throw new AppError('Failed to load WhatsApp account for template catalog', 500, {
      code: 'ACQUISITION_TEMPLATE_CATALOG_ACCOUNT_LOOKUP_FAILED',
      meta: error
    });
  }

  if (!account) {
    throw new AppError('No WhatsApp account connected for this company', 400, {
      code: 'ACQUISITION_TEMPLATE_CATALOG_NO_ACCOUNT'
    });
  }

  if (!account.waba_id || !account.access_token) {
    throw new AppError('WhatsApp account is missing WABA or access token', 400, {
      code: 'ACQUISITION_TEMPLATE_CATALOG_INCOMPLETE_ACCOUNT',
      meta: {
        has_waba_id: Boolean(account.waba_id),
        has_access_token: Boolean(account.access_token)
      }
    });
  }

  return account;
}

function mapTemplateRow(row = {}) {
  const name = String(row?.name || '').trim();
  const language = String(row?.language || '').trim();
  const category = String(row?.category || '').trim();
  const rawStatus = String(row?.status || '').trim();
  const componentDefinitions = safeArray(row?.components);
  const rejectedReason = String(row?.rejected_reason || '').trim() || null;
  const qualityScore =
    row?.quality_score?.score ||
    row?.quality_score ||
    null;

  const { defaultSendComponents, autofillWarnings } =
    buildDefaultSendComponentsFromTemplateDefinition(componentDefinitions);

  const categoryKey =
    category.toUpperCase() === 'MARKETING'
      ? 'marketing'
      : 'utility_auth';

  const sendable = isSendableStatus(rawStatus);

  return {
    id: row?.id || null,
    key: `${name}::${language}`,
    name,
    language,
    category,
    categoryKey,
    status: normalizeStatus(rawStatus),
    statusLabel: buildTextStatusLabel(rawStatus),
    rawStatus: String(rawStatus || '').toUpperCase() || 'UNKNOWN',
    isSendable: sendable,
    label: `${name} • ${language} • ${category || 'N/A'}`,
    previewText: buildPreviewText(componentDefinitions),
    componentDefinitions,
    defaultSendComponents,
    autofillWarnings,
    rejectedReason,
    reviewStatus: normalizeStatus(rawStatus),
    qualityScore,
    rawMetaDiagnostics: {
      marker: '__AUTOATENDE_C16N_C7C_R1E_R2J_BACKEND__',
      rejectedReason,
      reviewStatus: normalizeStatus(rawStatus),
      qualityScore,
      category
    }
  };
}

async function listTemplatesForCompany(companyId, options = {}) {
  const approvedOnly = Boolean(options?.approvedOnly);
  const account = await resolveCompanyAccount(companyId);

  const response = await axios.get(
    `https://graph.facebook.com/${GRAPH_VERSION}/${account.waba_id}/message_templates`,
    {
      params: {
        fields: 'name,status,language,category,id,components,rejected_reason,quality_score',
        limit: 200
      },
      headers: {
        Authorization: `Bearer ${account.access_token}`
      },
      timeout: 20000
    }
  );

  const rows = Array.isArray(response?.data?.data) ? response.data.data : [];
  const mapped = rows.map(mapTemplateRow);

  const filtered = approvedOnly ? mapped.filter((row) => row.isSendable) : mapped;

  const counts = mapped.reduce((acc, row) => {
    const key = row.status || 'unknown';
    acc[key] = Number(acc[key] || 0) + 1;
    return acc;
  }, {});

  const items = filtered.sort((a, b) => {
    const left = `${a.name}::${a.language}`;
    const right = `${b.name}::${b.language}`;
    return left.localeCompare(right, 'pt-BR');
  });

  return {
    items,
    meta: {
      total: items.length,
      total_all_status: mapped.length,
      total_sendable: mapped.filter((row) => row.isSendable).length,
      counts,
      approved_only: approvedOnly,
      graph_version: GRAPH_VERSION,
      waba_id: account.waba_id,
      phone_number_id: account.phone_number_id || null,
      phone_number: account.phone_number || null
    }
  };
}

async function listApprovedTemplatesForCompany(companyId) {
  return listTemplatesForCompany(companyId, { approvedOnly: true });
}


function normalizeTemplateCreateCategory(rawValue = '') {
  const value = String(rawValue || '').trim().toLowerCase();

  if (value === 'marketing') return 'MARKETING';
  if (value === 'utility' || value === 'utility_auth' || value === 'utility/auth') return 'UTILITY';

  throw new AppError('Categoria de template inválida. Use marketing ou utility_auth.', 400, {
    code: 'ACQUISITION_TEMPLATE_CREATE_INVALID_CATEGORY',
    meta: { received_category: rawValue }
  });
}

function normalizeTemplateCreateName(rawValue = '') {
  const normalized = String(rawValue || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!normalized || normalized.length < 3) {
    throw new AppError('Nome do template inválido. Use ao menos 3 caracteres.', 400, {
      code: 'ACQUISITION_TEMPLATE_CREATE_INVALID_NAME',
      meta: { received_name: rawValue }
    });
  }

  return normalized;
}

function normalizeLanguageCode(rawValue = '') {
  const value = String(rawValue || '').trim();
  if (!value || !/^[a-z]{2}_[A-Z]{2}$/.test(value)) {
    throw new AppError('Idioma inválido. Use formato como pt_BR ou en_US.', 400, {
      code: 'ACQUISITION_TEMPLATE_CREATE_INVALID_LANGUAGE',
      meta: { received_language: rawValue }
    });
  }
  return value;
}

function normalizeTextField(rawValue = '', options = {}) {
  const value = String(rawValue || '').trim();
  const required = Boolean(options.required);
  const field = options.field || 'field';

  if (required && !value) {
    throw new AppError(`Campo obrigatório ausente: ${field}.`, 400, {
      code: 'ACQUISITION_TEMPLATE_CREATE_REQUIRED_FIELD_MISSING',
      meta: { field }
    });
  }

  return value;
}

function buildCreateTemplateComponents({
  headerText = '',
  bodyText = '',
  footerText = '',
  headerExamples = [],
  bodyExamples = []
}) {
  const components = [];

  if (headerText) {
    const headerComponent = {
      type: 'HEADER',
      format: 'TEXT',
      text: headerText
    };

    const headerExample = aaBuildTextExamplePayload('HEADER', headerText, headerExamples, 'Exemplo');
    if (headerExample) headerComponent.example = headerExample;

    components.push(headerComponent);
  }

  const bodyComponent = {
    type: 'BODY',
    text: bodyText
  };

  const bodyExample = aaBuildTextExamplePayload('BODY', bodyText, bodyExamples, 'Valor');
  if (bodyExample) bodyComponent.example = bodyExample;

  components.push(bodyComponent);

  if (footerText) {
    components.push({
      type: 'FOOTER',
      text: footerText
    });
  }

  return components;
}

async function createTemplateForCompany(companyId, payload = {}) {
  const account = await resolveCompanyAccount(companyId);

  const name = normalizeTemplateCreateName(payload?.name);
  const language = normalizeLanguageCode(payload?.language);
  const category = normalizeTemplateCreateCategory(payload?.category);
  const headerText = normalizeTextField(payload?.headerText, { field: 'headerText', required: false });
  const bodyText = normalizeTextField(payload?.bodyText, { field: 'bodyText', required: true });
  const footerText = normalizeTextField(payload?.footerText, { field: 'footerText', required: false });
  const headerExamples = aaNormalizeExampleField(payload?.headerExamples);
  const bodyExamples = aaNormalizeExampleField(payload?.bodyExamples);

  const requestBody = {
    name,
    language,
    category,
    components: buildCreateTemplateComponents({
      headerText,
      bodyText,
      footerText,
      headerExamples,
      bodyExamples
    })
  };

  const debugBase = {
    marker: '__AUTOATENDE_C16N_C7C_R3B_CREATE_TEMPLATE_OBSERVABILITY__',
    companyId,
    waba_id: account?.waba_id || null,
    phone_number_id: account?.phone_number_id || null,
    template_name: name,
    language,
    category,
    requestBody
  };

  try {
    const response = await axios.post(
      `https://graph.facebook.com/${GRAPH_VERSION}/${account.waba_id}/message_templates`,
      requestBody,
      {
        headers: {
          Authorization: `Bearer ${account.access_token}`,
          'Content-Type': 'application/json'
        },
        timeout: 20000
      }
    );

    console.log('[AA_TEMPLATE_CREATE_DEBUG]', JSON.stringify({
      ...debugBase,
      ok: true,
      meta_status: response?.status || null,
      meta_response: response?.data || null
    }));

    return {
      created: true,
      requestBody,
      meta_response: response?.data || null,
      debug_marker: '__AUTOATENDE_C16N_C7C_R3B_CREATE_TEMPLATE_OBSERVABILITY__'
    };
  } catch (error) {
    console.error('[AA_TEMPLATE_CREATE_DEBUG]', JSON.stringify({
      ...debugBase,
      ok: false,
      meta_status: error?.response?.status || null,
      meta_response: error?.response?.data || null,
      message: error?.message || null
    }));

    throw error;
  }
}

module.exports = {
  createTemplateForCompany,
  listTemplatesForCompany,
  listApprovedTemplatesForCompany
};
