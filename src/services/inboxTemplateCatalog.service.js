/**
 * __AUTOATENDE_V4_R13C_INBOX_TEMPLATE_REAL_RENDER_CATALOG__
 *
 * Serviço read-only para obter catálogo de templates aprovados e permitir
 * renderização visual no Inbox.
 *
 * Não envia mensagem.
 * Não altera banco.
 * Não altera consumo.
 */

const TEMPLATE_TABLE_CANDIDATES = [
  'whatsapp_templates',
  'message_templates',
  'templates'
];

function normalize(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function safeJsonParse(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (_) {
    return null;
  }
}

function pick(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value;
    }
  }
  return null;
}

function extractTextFromComponents(components) {
  const parsed = safeJsonParse(components);
  const result = {
    header: '',
    body: '',
    footer: ''
  };

  const list = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.components)
      ? parsed.components
      : [];

  for (const component of list) {
    const type = normalize(component?.type);

    const text = pick(
      component?.text,
      component?.content,
      component?.example?.body_text?.[0]?.join?.(' '),
      component?.example?.header_text?.[0]
    );

    if (!text) continue;

    if (type === 'header') result.header = String(text);
    if (type === 'body') result.body = String(text);
    if (type === 'footer') result.footer = String(text);
  }

  return result;
}

function normalizeTemplateRow(row, sourceTable) {
  const componentText = extractTextFromComponents(
    pick(row.components, row.meta_components, row.template_components, row.payload, row.raw_payload, row.meta_payload)
  );

  const name = pick(
    row.name,
    row.template_name,
    row.templateName,
    row.slug,
    row.key
  );

  const language = pick(
    row.language,
    row.lang,
    row.locale,
    row.template_language,
    row.language_code,
    row.templateLanguage,
    'pt_BR'
  );

  const status = pick(
    row.status,
    row.template_status,
    row.approval_status,
    row.review_status
  );

  const category = pick(
    row.category,
    row.template_category,
    row.type
  );

  const header = pick(
    row.header,
    row.header_text,
    row.template_header,
    componentText.header
  );

  const body = pick(
    row.body,
    row.body_text,
    row.template_body,
    row.content,
    row.message,
    row.text,
    componentText.body
  );

  const footer = pick(
    row.footer,
    row.footer_text,
    row.template_footer,
    componentText.footer
  );

  if (!name) return null;

  return {
    source_table: sourceTable,
    name: String(name),
    language: String(language || 'pt_BR'),
    status: status ? String(status) : '',
    category: category ? String(category) : '',
    header: header ? String(header) : '',
    body: body ? String(body) : '',
    footer: footer ? String(footer) : '',
    raw_keys: Object.keys(row || {})
  };
}

async function supabaseRestSelect(table) {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !serviceKey) {
    return { ok: false, table, error: 'missing_supabase_env', rows: [] };
  }

  const endpoint = `${url.replace(/\/$/, '')}/rest/v1/${encodeURIComponent(table)}?select=*&limit=500`;

  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Accept: 'application/json'
    }
  });

  const text = await response.text();

  if (!response.ok) {
    return {
      ok: false,
      table,
      status: response.status,
      error: text.slice(0, 500),
      rows: []
    };
  }

  let rows = [];

  try {
    rows = JSON.parse(text);
  } catch (err) {
    return {
      ok: false,
      table,
      error: `invalid_json:${err.message}`,
      rows: []
    };
  }

  return {
    ok: true,
    table,
    rows: Array.isArray(rows) ? rows : []
  };
}

async function loadTemplateCatalog() {
  const diagnostics = [];
  const templates = [];

  for (const table of TEMPLATE_TABLE_CANDIDATES) {
    const result = await supabaseRestSelect(table);
    diagnostics.push({
      table,
      ok: result.ok,
      status: result.status || null,
      error: result.error || null,
      count: result.rows?.length || 0
    });

    if (!result.ok) continue;

    for (const row of result.rows || []) {
      const normalized = normalizeTemplateRow(row, table);
      if (normalized) templates.push(normalized);
    }
  }

  const dedup = new Map();

  for (const template of templates) {
    const key = `${normalize(template.name)}::${normalize(template.language)}`;

    if (!dedup.has(key)) {
      dedup.set(key, template);
      continue;
    }

    const current = dedup.get(key);
    const currentScore = Number(Boolean(current.body)) + Number(Boolean(current.footer)) + Number(Boolean(current.header));
    const nextScore = Number(Boolean(template.body)) + Number(Boolean(template.footer)) + Number(Boolean(template.header));

    if (nextScore > currentScore) {
      dedup.set(key, template);
    }
  }

  return {
    ok: true,
    count: dedup.size,
    templates: Array.from(dedup.values()),
    diagnostics
  };
}

module.exports = {
  loadTemplateCatalog
};
