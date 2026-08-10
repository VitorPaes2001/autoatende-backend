/**
 * __AUTOATENDE_V4_R13C_R3B_R2_PATCH_REAL_SEND_TEMPLATE_BODY_SCOPE__
 *
 * Resolve BODY/components do template aprovado antes da persistência no Inbox.
 * Falha em modo seguro: se não conseguir consultar Meta/conta/template, não quebra o envio.
 */

const MARKER = "__AUTOATENDE_V4_R13C_R3B_R2_PATCH_REAL_SEND_TEMPLATE_BODY_SCOPE__";

function s(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function safeJson(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  try { return JSON.parse(value); } catch (_) { return null; }
}

function pick(...values) {
  for (const value of values) {
    const text = s(value);
    if (text) return text;
  }
  return "";
}

function asArray(value) {
  const parsed = safeJson(value);
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed?.components)) return parsed.components;
  if (Array.isArray(parsed?.data)) return parsed.data;
  return [];
}

function normalizeName(value) {
  return s(value).toLowerCase();
}

function normalizeLang(value) {
  return s(value || "pt_BR").toLowerCase().replace("-", "_");
}

function hasTemplateBody(input = {}) {
  if (s(input.body) || s(input.body_text) || s(input.template_body)) return true;

  const components = asArray(
    input.components ||
    input.templateComponents ||
    input.template_components ||
    input.selectedTemplate?.components ||
    input.template?.components
  );

  return components.some((component) => {
    const type = s(component?.type).toLowerCase();
    return type === "body" && s(component?.text);
  });
}

function getAccountToken(account = {}) {
  return pick(
    account.access_token,
    account.token,
    account.permanent_token,
    account.whatsapp_access_token,
    account.meta_access_token,
    account.business_access_token
  );
}

function getAccountWabaId(account = {}) {
  return pick(
    account.waba_id,
    account.whatsapp_business_account_id,
    account.business_account_id,
    account.wabaId
  );
}

function redactError(error) {
  if (!error) return null;
  if (typeof error === "string") return error.slice(0, 500);

  const out = {};
  for (const [key, value] of Object.entries(error)) {
    const low = key.toLowerCase();

    if (low.includes("token") || low.includes("key") || low.includes("secret") || low.includes("password")) {
      out[key] = "[REDACTED]";
    } else if (typeof value === "string") {
      out[key] = value.slice(0, 500);
    } else {
      out[key] = value;
    }
  }

  return out;
}

async function supabaseGet(path) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceKey) {
    return { ok: false, status: 0, data: null, error: "missing_supabase_env" };
  }

  const url = `${String(supabaseUrl).replace(/\/+$/, "")}/rest/v1/${path}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Accept: "application/json"
    }
  });

  const text = await response.text();
  let data = null;

  try { data = text ? JSON.parse(text) : null; }
  catch (_) { data = text; }

  return {
    ok: response.ok,
    status: response.status,
    data,
    error: response.ok ? null : String(text).slice(0, 800)
  };
}

async function findWhatsappAccount({ companyId, clientId, phoneNumberId } = {}) {
  const filters = [];

  if (companyId) filters.push(`company_id=eq.${encodeURIComponent(companyId)}`);
  if (clientId) filters.push(`client_id=eq.${encodeURIComponent(clientId)}`);
  if (phoneNumberId) filters.push(`phone_number_id=eq.${encodeURIComponent(phoneNumberId)}`);

  for (const filter of filters) {
    const result = await supabaseGet(`whatsapp_accounts?select=*&${filter}&limit=1`);

    if (result.ok && Array.isArray(result.data) && result.data[0]) {
      return { ok: true, source: `whatsapp_accounts:${filter}`, account: result.data[0] };
    }
  }

  const all = await supabaseGet("whatsapp_accounts?select=*&limit=2");

  if (all.ok && Array.isArray(all.data) && all.data.length === 1) {
    return { ok: true, source: "whatsapp_accounts:single_account_fallback", account: all.data[0] };
  }

  return {
    ok: false,
    source: "whatsapp_accounts",
    account: null,
    reason: all?.ok ? `accounts_found_${Array.isArray(all.data) ? all.data.length : 0}` : all?.error || "not_found"
  };
}

async function fetchMetaTemplates({ wabaId, accessToken }) {
  if (!wabaId || !accessToken) {
    return { ok: false, status: 0, data: [], error: "missing_waba_or_access_token" };
  }

  const fields = encodeURIComponent("name,language,status,category,components");
  const url = `https://graph.facebook.com/v18.0/${encodeURIComponent(wabaId)}/message_templates?fields=${fields}&limit=1000`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json"
    }
  });

  const text = await response.text();
  let data = null;

  try { data = text ? JSON.parse(text) : null; }
  catch (_) { data = text; }

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      data: [],
      error: data || String(text).slice(0, 800)
    };
  }

  return {
    ok: true,
    status: response.status,
    data: Array.isArray(data?.data) ? data.data : [],
    error: null
  };
}

function findTemplate(templates = [], input = {}) {
  const wantedName = normalizeName(input.templateName || input.template_name || input.name);
  const wantedLang = normalizeLang(input.languageCode || input.language || input.lang || "pt_BR");

  if (!wantedName) return null;

  const sameName = templates.filter((template) => normalizeName(template?.name) === wantedName);

  if (!sameName.length) return null;

  return sameName.find((template) => normalizeLang(template?.language) === wantedLang) || sameName[0];
}

function componentText(template = {}, type) {
  const components = asArray(template.components);
  const item = components.find((component) => s(component?.type).toLowerCase() === type);
  return s(item?.text || item?.content || item?.body);
}

async function resolveTemplateDisplayInput(input = {}) {
  try {
    if (hasTemplateBody(input)) {
      return {
        ...input,
        __templateBodyResolver: {
          marker: MARKER,
          ok: true,
          source: "input_already_had_body"
        }
      };
    }

    const accountResult = await findWhatsappAccount({
      companyId: input.companyId || input.company_id,
      clientId: input.clientId || input.client_id,
      phoneNumberId: input.phoneNumberId || input.phone_number_id
    });

    if (!accountResult.ok || !accountResult.account) {
      return {
        ...input,
        __templateBodyResolver: {
          marker: MARKER,
          ok: false,
          source: "account_not_found",
          reason: accountResult.reason || null
        }
      };
    }

    const accessToken = getAccountToken(accountResult.account);
    const wabaId = getAccountWabaId(accountResult.account);

    const meta = await fetchMetaTemplates({ wabaId, accessToken });

    if (!meta.ok) {
      return {
        ...input,
        __templateBodyResolver: {
          marker: MARKER,
          ok: false,
          source: "meta_fetch_failed",
          accountSource: accountResult.source,
          hasWabaId: Boolean(wabaId),
          hasAccessToken: Boolean(accessToken),
          status: meta.status,
          error: redactError(meta.error)
        }
      };
    }

    const template = findTemplate(meta.data, input);

    if (!template) {
      return {
        ...input,
        __templateBodyResolver: {
          marker: MARKER,
          ok: false,
          source: "template_not_found",
          accountSource: accountResult.source,
          templatesFetched: meta.data.length,
          templateName: input.templateName || input.template_name || input.name || null,
          languageCode: input.languageCode || input.language || "pt_BR"
        }
      };
    }

    const components = asArray(template.components);
    const body = componentText(template, "body");
    const header = componentText(template, "header");
    const footer = componentText(template, "footer");

    return {
      ...input,
      template: { ...(input.template || {}), ...template },
      selectedTemplate: { ...(input.selectedTemplate || {}), ...template },
      components: components.length ? components : input.components,
      templateComponents: components.length ? components : input.templateComponents,
      body: input.body || body,
      body_text: input.body_text || body,
      template_body: input.template_body || body,
      header: input.header || header,
      footer: input.footer || footer,
      __templateBodyResolver: {
        marker: MARKER,
        ok: true,
        source: `meta_message_templates:${accountResult.source}`,
        templateName: template.name || null,
        languageCode: template.language || null,
        status: template.status || null,
        category: template.category || null,
        componentsCount: components.length
      }
    };
  } catch (error) {
    return {
      ...input,
      __templateBodyResolver: {
        marker: MARKER,
        ok: false,
        source: "resolver_exception",
        error: error?.message || String(error)
      }
    };
  }
}

module.exports = {
  MARKER,
  resolveTemplateDisplayInput,
  findTemplate,
  hasTemplateBody
};
