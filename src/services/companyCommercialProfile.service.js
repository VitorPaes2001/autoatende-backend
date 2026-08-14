const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const STORE_PATH =
  process.env.ONBOARDING_STORE_PATH ||
  path.join(process.cwd(), "data", "onboarding_store.json");

function readJsonSafe(filePath) {
  try {
    if (!fs.existsSync(filePath)) return {};
    const raw = fs.readFileSync(filePath, "utf8");
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    return {};
  }
}

function normalizeCommercialProfile(companyId, raw = {}, source = "unknown") {
  const ensureList = (value) => {
    if (value == null) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === "string") return value.trim() ? [value.trim()] : [];
    return [value];
  };

  const ensureText = (value) => {
    if (value == null) return "";
    if (typeof value === "string") return value.trim();
    try {
      return JSON.stringify(value);
    } catch (_) {
      return String(value);
    }
  };

  return {
    company_id: companyId,
    company_name: ensureText(raw.company_name),
    company_context: ensureText(raw.company_context),
    services: ensureList(raw.services),
    target_audience: ensureText(raw.target_audience),
    tone: ensureText(raw.tone),
    escalation_rules: raw.escalation_rules || {},
    forbidden_topics: ensureList(raw.forbidden_topics),
    faq_base: raw.faq_base || [],
    assistant_guidance: typeof raw.assistant_guidance === "string"
      ? raw.assistant_guidance
      : Array.isArray(raw.assistant_guidance)
        ? raw.assistant_guidance.join("\n\n")
        : "",
    onboarding_completed: Boolean(raw.onboarding_completed),
    source,
    updated_at: raw.updated_at || null
  };
}

function getSupabaseAdmin() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL;

  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) return null;

  return createClient(url, key, {
    auth: { persistSession: false }
  });
}

function getCompanyCommercialProfileFromFile(companyId) {
  const store = readJsonSafe(STORE_PATH);
  const raw = store && typeof store === "object" ? store[companyId] : null;
  if (!raw || typeof raw !== "object") return null;
  return normalizeCommercialProfile(companyId, raw, "json_file");
}

async function tryGetCompanyCommercialProfileFromDb(companyId) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from("company_commercial_profiles")
      .select("*")
      .eq("company_id", companyId)
      .maybeSingle();

    if (error || !data) return null;
    return normalizeCommercialProfile(companyId, data, "database");
  } catch (_) {
    return null;
  }
}

async function getCompanyCommercialProfile(companyId, options = {}) {
  const preferDb = options.preferDb !== false;

  if (preferDb) {
    const dbProfile = await tryGetCompanyCommercialProfileFromDb(companyId);
    if (dbProfile) return dbProfile;
  }

  const fileProfile = getCompanyCommercialProfileFromFile(companyId);
  if (fileProfile) return fileProfile;

  return normalizeCommercialProfile(companyId, {}, "empty");
}

/* __AUTOATENDE_C1C_PROFILE_UPSERT__ */
function sanitizeCommercialProfilePayload(payload = {}) {
  const source = payload && typeof payload === "object" ? payload : {};

  const has = (key) => Object.prototype.hasOwnProperty.call(source, key);

  const out = {};

  if (has("company_name")) out.company_name = source.company_name;
  if (has("company_context")) out.company_context = source.company_context;
  if (has("services")) out.services = source.services;
  if (has("target_audience")) out.target_audience = source.target_audience;
  if (has("tone")) out.tone = source.tone;
  if (has("escalation_rules")) out.escalation_rules = source.escalation_rules;
  if (has("forbidden_topics")) out.forbidden_topics = source.forbidden_topics;
  if (has("faq_base")) out.faq_base = source.faq_base;
  if (has("assistant_guidance")) out.assistant_guidance = source.assistant_guidance;
  if (has("onboarding_completed")) out.onboarding_completed = Boolean(source.onboarding_completed);

  return out;
}

function toFileStoreShape(profile = {}) {
  return {
    company_name: profile.company_name || "",
    company_context: profile.company_context || "",
    services: Array.isArray(profile.services) ? profile.services : [],
    target_audience: profile.target_audience || "",
    tone: profile.tone || "",
    escalation_rules: profile.escalation_rules || {},
    forbidden_topics: Array.isArray(profile.forbidden_topics) ? profile.forbidden_topics : [],
    faq_base: Array.isArray(profile.faq_base) ? profile.faq_base : [],
    assistant_guidance: profile.assistant_guidance || "",
    onboarding_completed: Boolean(profile.onboarding_completed),
    updated_at: new Date().toISOString()
  };
}

function writeCompanyCommercialProfileToFile(companyId, profile = {}) {
  const store = readJsonSafe(STORE_PATH);
  store[companyId] = toFileStoreShape(profile);
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
  return normalizeCommercialProfile(companyId, store[companyId], "json_file");
}

async function upsertCompanyCommercialProfile(companyId, payload = {}, options = {}) {
  const preferDb = options.preferDb !== false;
  const sanitized = sanitizeCommercialProfilePayload(payload);

  const current = await getCompanyCommercialProfile(companyId, { preferDb: true });

  const merged = {
    company_name: sanitized.company_name !== undefined ? sanitized.company_name : current.company_name,
    company_context: sanitized.company_context !== undefined ? sanitized.company_context : current.company_context,
    services: sanitized.services !== undefined ? sanitized.services : current.services,
    target_audience: sanitized.target_audience !== undefined ? sanitized.target_audience : current.target_audience,
    tone: sanitized.tone !== undefined ? sanitized.tone : current.tone,
    escalation_rules: sanitized.escalation_rules !== undefined ? sanitized.escalation_rules : current.escalation_rules,
    forbidden_topics: sanitized.forbidden_topics !== undefined ? sanitized.forbidden_topics : current.forbidden_topics,
    faq_base: sanitized.faq_base !== undefined ? sanitized.faq_base : current.faq_base,
    assistant_guidance: sanitized.assistant_guidance !== undefined ? sanitized.assistant_guidance : current.assistant_guidance,
    onboarding_completed: sanitized.onboarding_completed !== undefined ? Boolean(sanitized.onboarding_completed) : Boolean(current.onboarding_completed),
    source: "db",
  };

  const supabase = getSupabaseAdmin();

  if (preferDb && supabase) {
    try {
      const payloadDb = {
        company_id: companyId,
        company_name: merged.company_name || "",
        company_context: merged.company_context || "",
        services: Array.isArray(merged.services) ? merged.services : [],
        target_audience: merged.target_audience || "",
        tone: merged.tone || "",
        escalation_rules: merged.escalation_rules || {},
        forbidden_topics: Array.isArray(merged.forbidden_topics) ? merged.forbidden_topics : [],
        faq_base: Array.isArray(merged.faq_base) ? merged.faq_base : [],
        assistant_guidance: merged.assistant_guidance || "",
        onboarding_completed: Boolean(merged.onboarding_completed),
        source: "db"
      };

      const { data, error } = await supabase
        .from("company_commercial_profiles")
        .upsert(payloadDb, { onConflict: "company_id" })
        .select("*")
        .single();

      if (!error && data) {
        return normalizeCommercialProfile(companyId, data, "database");
      }
    } catch (_) {}
  }

  return writeCompanyCommercialProfileToFile(companyId, merged);
}

module.exports = {
  STORE_PATH,
  normalizeCommercialProfile,
  getCompanyCommercialProfileFromFile,
  tryGetCompanyCommercialProfileFromDb,
  getCompanyCommercialProfile,
  upsertCompanyCommercialProfile,

};



// __AUTOATENDE_C3C5A_CANONICAL_RUNTIME_PROFILE_WRAPPER__
const assistantCentralService = require('./assistantCentral.service');

function __aa_c3c5a_normText(value) {
  return String(value || '').replace(/\r\n/g, '\n').trim();
}

function __aa_c3c5a_normList(value) {
  if (Array.isArray(value)) {
    return value.map(__aa_c3c5a_normText).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split('\n').map(__aa_c3c5a_normText).filter(Boolean);
  }
  return [];
}

function __aa_c3c5a_extractCompanyId(args) {
  for (const arg of args || []) {
    if (!arg) continue;

    if (typeof arg === 'string' && /^[0-9a-f-]{36}$/i.test(arg)) {
      return arg;
    }

    if (typeof arg === 'object') {
      const candidates = [
        arg.companyId,
        arg.company_id,
        arg.clientCompanyId,
        arg.client_company_id,
        arg.context?.companyId,
        arg.context?.company_id,
        arg.profile?.companyId,
        arg.profile?.company_id
      ].filter(Boolean);

      for (const value of candidates) {
        if (typeof value === 'string') return value;
      }
    }
  }

  return process.env.AUTOATENDE_DEFAULT_COMPANY_ID || null;
}

function __aa_c3c5a_normalizePublishedProfile(published = {}, state = {}) {
  const companyName = __aa_c3c5a_normText(published.companyName || published.company_name);
  const targetAudience = __aa_c3c5a_normText(published.targetAudience || published.target_audience);
  const toneOfVoice = __aa_c3c5a_normText(published.toneOfVoice || published.tone_of_voice);
  const companyContext = __aa_c3c5a_normText(published.companyContext || published.company_context);
  const guidance = __aa_c3c5a_normText(
    published.guidance ||
    published.additionalGuidance ||
    published.additional_guidance
  );

  const services = __aa_c3c5a_normList(published.services || published.services_text);
  const forbiddenTopics = __aa_c3c5a_normList(
    published.forbiddenTopics ||
    published.forbidden_topics ||
    published.forbidden_topics_text
  );
  const faqJson = __aa_c3c5a_normText(published.faqJson || published.faq_json);

  const payload = {
    companyName,
    company_name: companyName,

    targetAudience,
    target_audience: targetAudience,

    toneOfVoice,
    tone_of_voice: toneOfVoice,

    companyContext,
    company_context: companyContext,

    guidance,
    additionalGuidance: guidance,
    additional_guidance: guidance,

    services,
    services_text: services.join('\n'),

    forbiddenTopics,
    forbidden_topics: forbiddenTopics,
    forbidden_topics_text: forbiddenTopics.join('\n'),

    faqJson,
    faq_json: faqJson,

    source: 'assistant_central_published',
    profile_source: 'assistant_central_published',
    source_marker: '__AUTOATENDE_C3C5A_CANONICAL_RUNTIME_PROFILE_WRAPPER__',
    lastPublishedVersion: Number(state?.meta?.lastPublishedVersion || 0),
    lastPublishedAt: state?.meta?.lastPublishedAt || null
  };

  return payload;
}

function __aa_c3c5a_mergeResultShape(baseResult, canonicalPayload) {
  if (!baseResult || typeof baseResult !== 'object') {
    return { ...canonicalPayload };
  }

  const merged = {
    ...baseResult,
    ...canonicalPayload
  };

  if (baseResult.profile && typeof baseResult.profile === 'object') {
    merged.profile = {
      ...baseResult.profile,
      ...canonicalPayload
    };
  }

  if (baseResult.data && typeof baseResult.data === 'object') {
    merged.data = {
      ...baseResult.data,
      ...canonicalPayload
    };
  }

  if (baseResult.result && typeof baseResult.result === 'object') {
    merged.result = {
      ...baseResult.result,
      ...canonicalPayload
    };
  }

  return merged;
}

async function __aa_c3c5a_wrapExport(exportName) {
  const original = module.exports[exportName];
  if (typeof original !== 'function') return;

  module.exports[exportName] = async function (...args) {
    const companyId = __aa_c3c5a_extractCompanyId(args);
    let originalResult = null;
    let originalError = null;

    try {
      originalResult = await original.apply(this, args);
    } catch (err) {
      originalError = err;
    }

    try {
      if (companyId) {
        const state = assistantCentralService.getCompanyState(companyId);
        const published = state?.published || null;

        if (published && typeof published === 'object' && Object.keys(published).length > 0) {
          const canonicalPayload = __aa_c3c5a_normalizePublishedProfile(published, state);
          return __aa_c3c5a_mergeResultShape(originalResult, canonicalPayload);
        }
      }
    } catch (assistantCentralError) {
      console.error('[C3C5A][ASSISTANT_CENTRAL_PRIMARY_READ_FAILED]', assistantCentralError.message);
    }

    if (originalError) {
      throw originalError;
    }

    return originalResult;
  };
}

[
  'getCompanyCommercialProfile',
  'resolveCompanyCommercialProfile',
  'getResolvedCompanyCommercialProfile',
  'loadCompanyCommercialProfile',
  'getCommercialProfile',
  'getCommercialProfileByCompanyId',
  'getCompanyProfile',
  'getCompanyProfileById'
].forEach((name) => {
  if (typeof module.exports[name] === 'function') {
    __aa_c3c5a_wrapExport(name);
  }
});

module.exports.__AUTOATENDE_C3C5A_ACTIVE__ = true;


/* __AUTOATENDE_V4_R28H_R2_DB_FIRST_PERSISTENCE_NO_HOST_NODE__ */
(function aaR28hR2InstallDbFirstCommercialProfilePersistence() {
  const R28H_R2_MARKER = '__AUTOATENDE_V4_R28H_R2_DB_FIRST_PERSISTENCE_NO_HOST_NODE__';
  const TABLE = 'company_commercial_profiles';

  const previousGet = module.exports.getCompanyCommercialProfile;
  const previousUpsert = module.exports.upsertCompanyCommercialProfile;

  function getSupabaseClientForR28hR2() {
    const cfg = require('../config/supabase');
    const candidates = [
      cfg && cfg.supabaseAdmin,
      cfg && cfg.supabaseService,
      cfg && cfg.supabase,
      cfg && cfg.default,
      cfg
    ];

    for (const candidate of candidates) {
      if (candidate && typeof candidate.from === 'function') return candidate;
    }

    throw new Error('R28H_R2_SUPABASE_CLIENT_NOT_AVAILABLE');
  }

  function textValue(value) {
    if (value === null || typeof value === 'undefined') return null;
    if (Array.isArray(value)) {
      const joined = value
        .map((item) => {
          if (item === null || typeof item === 'undefined') return '';
          if (typeof item === 'string') return item.trim();
          return JSON.stringify(item);
        })
        .filter(Boolean)
        .join('\n');
      return joined || null;
    }
    if (typeof value === 'object') return JSON.stringify(value);
    const text = String(value).trim();
    return text || null;
  }

  function boolValue(value, fallback) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', '1', 'yes', 'sim'].includes(normalized)) return true;
      if (['false', '0', 'no', 'nao', 'não'].includes(normalized)) return false;
    }
    return fallback;
  }

  function pick(payload, keys) {
    for (const key of keys) {
      if (payload && Object.prototype.hasOwnProperty.call(payload, key)) {
        const value = payload[key];
        if (value !== null && typeof value !== 'undefined' && value !== '') return value;
      }
    }
    return null;
  }

  function listValue(value) {
    if (Array.isArray(value)) return value.filter((item) => item !== null && typeof item !== 'undefined');
    if (value === null || typeof value === 'undefined') return [];
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return [];
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed;
      } catch (_) {}
      return trimmed.split(/\n|;|\|/).map((item) => item.trim()).filter(Boolean);
    }
    return [value];
  }

  function jsonArrayValue(value) {
    if (Array.isArray(value)) return value;
    if (value === null || typeof value === 'undefined') return [];
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return [];
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed;
        if (parsed && typeof parsed === 'object') return [parsed];
      } catch (_) {}
      return [{ question: trimmed, answer: '' }];
    }
    if (typeof value === 'object') return [value];
    return [];
  }

  function resolveCompanyId(companyIdOrPayload, payloadMaybe) {
    if (typeof companyIdOrPayload === 'string' && companyIdOrPayload.trim()) {
      return companyIdOrPayload.trim();
    }

    const payload = companyIdOrPayload && typeof companyIdOrPayload === 'object'
      ? companyIdOrPayload
      : payloadMaybe && typeof payloadMaybe === 'object'
        ? payloadMaybe
        : {};

    return textValue(pick(payload, ['company_id', 'companyId', 'tenant_company_id', 'tenantCompanyId']));
  }

  function resolvePayload(companyIdOrPayload, payloadMaybe) {
    if (payloadMaybe && typeof payloadMaybe === 'object') return payloadMaybe;
    if (companyIdOrPayload && typeof companyIdOrPayload === 'object') return companyIdOrPayload;
    return {};
  }

  function buildDbRow(companyId, payload) {
    const servicesText = textValue(pick(payload, ['services_text', 'servicesText', 'services', 'products', 'products_text']));
    const tone = textValue(pick(payload, ['tone', 'tone_of_voice', 'toneOfVoice']));
    const forbiddenText = textValue(pick(payload, ['forbidden_topics_text', 'forbiddenTopicsText', 'forbidden_topics', 'forbiddenTopics']));
    const faqBase = jsonArrayValue(pick(payload, ['faq_base', 'faqBase', 'faq_json', 'faqJson', 'faqs', 'faq']));
    const additionalGuidance = textValue(pick(payload, ['additional_guidance', 'additionalGuidance']));

    const row = {
      company_id: companyId,
      client_id: textValue(pick(payload, ['client_id', 'clientId'])),
      company_name: textValue(pick(payload, ['company_name', 'companyName', 'business_name', 'businessName', 'name'])),
      company_context: textValue(pick(payload, ['company_context', 'companyContext', 'business_context', 'businessContext', 'context'])),
      services: servicesText,
      services_text: servicesText,
      target_audience: textValue(pick(payload, ['target_audience', 'targetAudience', 'audience'])),
      tone,
      tone_of_voice: textValue(pick(payload, ['tone_of_voice', 'toneOfVoice'])) || tone,
      assistant_guidance: textValue(pick(payload, ['assistant_guidance', 'assistantGuidance', 'guidance'])),
      additional_guidance: additionalGuidance,
      additionalGuidance,
      faq_base: faqBase,
      faq_json: jsonArrayValue(pick(payload, ['faq_json', 'faqJson'])) || faqBase,
      forbidden_topics: forbiddenText,
      forbidden_topics_text: forbiddenText,
      escalation_rules: textValue(pick(payload, ['escalation_rules', 'escalationRules'])),
      onboarding_completed: boolValue(pick(payload, ['onboarding_completed', 'onboardingCompleted']), true),
      profile_source: textValue(pick(payload, ['profile_source', 'profileSource'])) || 'company_commercial_profiles',
      source_marker: textValue(pick(payload, ['source_marker', 'sourceMarker'])) || R28H_R2_MARKER,
      last_published_at: textValue(pick(payload, ['last_published_at', 'lastPublishedAt'])),
      last_published_version: textValue(pick(payload, ['last_published_version', 'lastPublishedVersion'])),
      lastPublishedAt: textValue(pick(payload, ['lastPublishedAt', 'last_published_at'])),
      lastPublishedVersion: textValue(pick(payload, ['lastPublishedVersion', 'last_published_version'])),
      updated_at: new Date().toISOString()
    };

    Object.keys(row).forEach((key) => {
      if (row[key] === null || typeof row[key] === 'undefined') delete row[key];
    });

    return row;
  }

  function normalizeDbProfile(row) {
    if (!row || typeof row !== 'object') return null;

    const servicesText = row.services_text || row.services || '';
    const forbiddenText = row.forbidden_topics_text || row.forbidden_topics || '';

    return {
      ...row,
      company_id: row.company_id,
      client_id: row.client_id || null,
      company_name: row.company_name || '',
      company_context: row.company_context || '',
      services: listValue(servicesText),
      services_text: servicesText,
      target_audience: row.target_audience || '',
      tone: row.tone || row.tone_of_voice || '',
      tone_of_voice: row.tone_of_voice || row.tone || '',
      assistant_guidance: row.assistant_guidance || '',
      additional_guidance: row.additional_guidance || row.additionalGuidance || '',
      additionalGuidance: row.additionalGuidance || row.additional_guidance || '',
      faq_base: jsonArrayValue(row.faq_base),
      faq_json: jsonArrayValue(row.faq_json || row.faq_base),
      forbidden_topics: listValue(forbiddenText),
      forbidden_topics_text: forbiddenText,
      escalation_rules: row.escalation_rules || '',
      onboarding_completed: boolValue(row.onboarding_completed, false),
      profile_source: row.profile_source || 'company_commercial_profiles',
      source_marker: row.source_marker || R28H_R2_MARKER
    };
  }

  async function readDbProfile(companyId) {
    if (!companyId) return null;

    const supabase = getSupabaseClientForR28hR2();
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle();

    if (error) {
      error.message = 'R28H_R2_DB_READ_FAILED: ' + error.message;
      throw error;
    }

    return normalizeDbProfile(data);
  }

  async function upsertDbProfile(companyId, payload) {
    if (!companyId) {
      const error = new Error('R28H_R2_COMPANY_ID_REQUIRED');
      error.status = 400;
      throw error;
    }

    const supabase = getSupabaseClientForR28hR2();
    const row = buildDbRow(companyId, payload);

    const { data, error } = await supabase
      .from(TABLE)
      .upsert(row, { onConflict: 'company_id' })
      .select('*')
      .single();

    if (error) {
      error.message = 'R28H_R2_DB_UPSERT_FAILED: ' + error.message;
      throw error;
    }

    return normalizeDbProfile(data);
  }

  module.exports.getCompanyCommercialProfile = async function r28hR2GetCompanyCommercialProfileDbFirst(companyIdOrPayload, maybeOptions) {
    const companyId = resolveCompanyId(companyIdOrPayload, maybeOptions);

    const dbProfile = await readDbProfile(companyId);
    if (dbProfile) return dbProfile;

    if (typeof previousGet === 'function') {
      const fallbackProfile = await previousGet.apply(this, arguments);
      if (fallbackProfile && typeof fallbackProfile === 'object') {
        return {
          ...fallbackProfile,
          profile_source: fallbackProfile.profile_source || fallbackProfile.profileSource || 'fallback_read_only',
          source_marker: fallbackProfile.source_marker || fallbackProfile.sourceMarker || '__AUTOATENDE_C3C5A_CANONICAL_RUNTIME_PROFILE_WRAPPER__'
        };
      }
      return fallbackProfile;
    }

    return null;
  };

  module.exports.upsertCompanyCommercialProfile = async function r28hR2UpsertCompanyCommercialProfileDbFirst(companyIdOrPayload, payloadMaybe) {
    const companyId = resolveCompanyId(companyIdOrPayload, payloadMaybe);
    const payload = resolvePayload(companyIdOrPayload, payloadMaybe);

    const dbProfile = await upsertDbProfile(companyId, payload);

    try {
      if (typeof writeCompanyCommercialProfileToFile === 'function') {
        const fileShape = typeof toFileStoreShape === 'function' ? toFileStoreShape(dbProfile) : dbProfile;
        writeCompanyCommercialProfileToFile(companyId, fileShape);
      }
    } catch (error) {
      console.warn('[R28H-R2] File mirror write skipped after successful DB upsert', {
        marker: R28H_R2_MARKER,
        company_id: companyId,
        error: error && error.message ? error.message : String(error)
      });
    }

    return dbProfile;
  };

  module.exports.__AUTOATENDE_V4_R28H_R2_DB_FIRST_ACTIVE__ = true;
})();

