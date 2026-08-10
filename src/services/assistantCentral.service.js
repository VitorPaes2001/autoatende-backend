const fs = require('fs');
const path = require('path');

const MARKER = '__AUTOATENDE_C3C1_ASSISTANT_CENTRAL_PUBLISH_LAYER__';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const STORE_PATH = process.env.ASSISTANT_CENTRAL_STORE_PATH || path.join(DATA_DIR, 'assistant_central_store.json');
const LEGACY_STORE_PATH = process.env.ONBOARDING_STORE_PATH || path.join(DATA_DIR, 'onboarding_store.json');

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function safeParse(text, fallback = {}) {
  try {
    return JSON.parse(text);
  } catch (_) {
    return fallback;
  }
}

function readJson(filePath, fallback = {}) {
  ensureDir(filePath);
  if (!fs.existsSync(filePath)) return fallback;
  return safeParse(fs.readFileSync(filePath, 'utf8'), fallback);
}

function writeJsonAtomic(filePath, data) {
  ensureDir(filePath);
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmpPath, filePath);
}

function normalizeText(value) {
  if (value == null) return '';
  return String(value).replace(/\r\n/g, '\n').trim();
}

function normalizeArray(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeText).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/\n|,/)
      .map(normalizeText)
      .filter(Boolean);
  }
  return [];
}

function normalizeFaq(value) {
  if (value == null) return '';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '';
    try {
      return JSON.stringify(JSON.parse(trimmed), null, 2);
    } catch (_) {
      return trimmed;
    }
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch (_) {
    return '';
  }
}

/* __AUTOATENDE_C16N_C12F_A1_FIX4A_STRUCTURED_BEHAVIOR_FOUNDATION_EXACT__ */
function normalizeProfile(raw = {}) {
  const companyName = normalizeText(
    raw.companyName ?? raw.company_name ?? raw.nomeEmpresa ?? raw.nome_empresa ?? raw.businessName
  );

  const targetAudience = normalizeText(
    raw.targetAudience ?? raw.target_audience ?? raw.publicoAlvo ?? raw.publico_alvo
  );

  const toneOfVoice = normalizeText(
    raw.toneOfVoice ?? raw.tone_of_voice ?? raw.tomDeVoz ?? raw.tom_de_voz
  );

  const companyContext = normalizeText(
    raw.companyContext ?? raw.company_context ?? raw.contextoEmpresa ?? raw.contexto_empresa ?? raw.context
  );

  const guidance = normalizeText(
    raw.guidance ?? raw.additionalGuidance ?? raw.additional_guidance ?? raw.orientacoes ?? raw.orientações
  );

  const services = normalizeArray(raw.services ?? raw.servicos ?? raw.serviceList ?? raw.service_list);
  const forbiddenTopics = normalizeArray(
    raw.forbiddenTopics ?? raw.forbidden_topics ?? raw.topicosProibidos ?? raw.topicos_proibidos
  );

  const faqJson = normalizeFaq(raw.faqJson ?? raw.faq_json ?? raw.faq);

  const qualificationMode = normalizeText(
    raw.qualificationMode ?? raw.qualification_mode ?? raw.modoQualificacao ?? raw.modo_qualificacao
  );

  const responsePolicy = normalizeText(
    raw.responsePolicy ?? raw.response_policy ?? raw.politicaResposta ?? raw.politica_resposta
  );

  const qualificationFields = normalizeArray(
    raw.qualificationFields ??
    raw.qualification_fields ??
    raw.qualificationFieldsText ??
    raw.qualification_fields_text
  );

  const handoffTriggers = normalizeArray(
    raw.handoffTriggers ??
    raw.handoff_triggers ??
    raw.handoffTriggersText ??
    raw.handoff_triggers_text
  );

  const updatedAt = raw.updatedAt ?? raw.updated_at ?? new Date().toISOString();

  return {
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

    qualificationMode: qualificationMode || 'only_when_needed',
    qualification_mode: qualificationMode || 'only_when_needed',

    responsePolicy: responsePolicy || 'answer_direct_when_confident',
    response_policy: responsePolicy || 'answer_direct_when_confident',

    qualificationFields,
    qualification_fields: qualificationFields,
    qualification_fields_text: qualificationFields.join('\n'),

    handoffTriggers,
    handoff_triggers: handoffTriggers,
    handoff_triggers_text: handoffTriggers.join('\n'),

    updatedAt,
    updated_at: updatedAt
  };
}

function stripCompareNoise(profile = {}) {
  const normalized = normalizeProfile(profile);
  return {
    companyName: normalized.companyName,
    targetAudience: normalized.targetAudience,
    toneOfVoice: normalized.toneOfVoice,
    companyContext: normalized.companyContext,
    guidance: normalized.guidance,
    services: normalized.services,
    forbiddenTopics: normalized.forbiddenTopics,
    faqJson: normalized.faqJson
  };
}

function isMeaningfulProfile(profile = {}) {
  const comparable = stripCompareNoise(profile);
  return Object.values(comparable).some((value) => {
    if (Array.isArray(value)) return value.length > 0;
    return Boolean(String(value || '').trim());
  });
}

function getAssistantStore() {
  const store = readJson(STORE_PATH, {});
  if (!store.companies || typeof store.companies !== 'object') {
    store.companies = {};
  }
  return store;
}

function getLegacyStore() {
  return readJson(LEGACY_STORE_PATH, {});
}

function extractLegacyNode(legacyStore, companyId) {
  if (!legacyStore || typeof legacyStore !== 'object') return null;

  const candidates = [
    legacyStore?.companies?.[companyId],
    legacyStore?.[companyId],
    legacyStore?.companies?.default,
    legacyStore?.default
  ].filter(Boolean);

  return candidates[0] || null;
}

function bootstrapFromLegacy(companyId) {
  const legacyStore = getLegacyStore();
  const legacyNode = extractLegacyNode(legacyStore, companyId);

  if (!legacyNode) return null;

  const normalized = normalizeProfile(legacyNode);
  return {
    draft: normalized,
    published: normalized,
    meta: {
      source: 'legacy_bootstrap',
      lastPublishedAt: normalized.updatedAt,
      lastPublishedVersion: 1,
      dirty: false
    }
  };
}


/* __AUTOATENDE_C16N_C12E_C1C_PUBLISH_HISTORY_BACKFILL_MINIMUM_SAFE__ */
function buildReconciledCurrentPublishEntry(published = {}, meta = {}) {
  const version = Number(meta?.lastPublishedVersion || 0);

  if (!version) {
    return null;
  }

  if (!isMeaningfulProfile(published)) {
    return null;
  }

  const normalizedPublished = normalizeProfile(published);
  const publishedAt =
    meta?.lastPublishedAt ||
    normalizedPublished?.updatedAt ||
    normalizedPublished?.updated_at ||
    new Date().toISOString();

  return {
    id: `reconciled-current-v${version}-${String(publishedAt).replace(/[^0-9]/g, '').slice(0, 14) || 'unknown'}`,
    version,
    publishedAt,
    actor: meta?.lastPublishedBy || 'system_reconciliation',
    totalChangedFields: 0,
    changedFields: [],
    summary:
      meta?.lastPublishedSummary ||
      'Histórico reconciliado a partir do estado publicado atual. Versões anteriores a esta etapa não estavam disponíveis para reconstrução automática.',
    source: 'backfilled_from_current_state',
    snapshotAvailable: true,
    snapshot: normalizedPublished
  };
}

function reconcileMissingPublishHistory(companyId, store, currentRecord = {}) {
  if (!companyId || !store?.companies) {
    return currentRecord;
  }

  const existingHistory = Array.isArray(currentRecord?.publishHistory)
    ? currentRecord.publishHistory.filter(Boolean)
    : [];

  if (existingHistory.length > 0) {
    return currentRecord;
  }

  const published = normalizeProfile(currentRecord?.published || {});
  const meta = currentRecord?.meta || {};
  const reconciledEntry = buildReconciledCurrentPublishEntry(published, meta);

  if (!reconciledEntry) {
    return currentRecord;
  }

  const nextRecord = {
    ...currentRecord,
    publishHistory: [reconciledEntry],
    meta: {
      ...meta,
      lastPublishedSummary: meta?.lastPublishedSummary || reconciledEntry.summary,
      publishHistoryBackfilledAt: new Date().toISOString(),
      publishHistoryBackfillSource: 'current_published_state_only'
    }
  };

  store.companies[companyId] = nextRecord;
  writeJsonAtomic(STORE_PATH, store);

  return nextRecord;
}


function getCompanyState(companyId) {
  if (!companyId) {
    throw new Error('ASSISTANT_CENTRAL_COMPANY_ID_REQUIRED');
  }

  const store = getAssistantStore();

  if (!store.companies[companyId]) {
    store.companies[companyId] = bootstrapFromLegacy(companyId) || {
      draft: normalizeProfile({}),
      published: normalizeProfile({}),
      meta: {
        source: 'empty',
        lastPublishedAt: null,
        lastPublishedVersion: 0,
        dirty: false
      }
    };
    writeJsonAtomic(STORE_PATH, store);
  }

  let current = store.companies[companyId] || {};
  current = reconcileMissingPublishHistory(companyId, store, current);
  const draft = normalizeProfile(current.draft || current.published || {});
  const published = normalizeProfile(current.published || {});

  /* __AUTOATENDE_ASSISTANT_ACTIVATION_RUNTIME_CONTRACT_V20_B2_R4__ */
  const hasStoredAssistantEnabled =
    typeof current.assistantEnabled === 'boolean' ||
    typeof current.assistant_enabled === 'boolean';

  const assistantEnabled = hasStoredAssistantEnabled
    ? Boolean(
        typeof current.assistantEnabled === 'boolean'
          ? current.assistantEnabled
          : current.assistant_enabled
      )
    : isMeaningfulProfile(published);

  const assistantActivationMigrated =
    !hasStoredAssistantEnabled;

  const hasUnpublishedChanges =
    JSON.stringify(stripCompareNoise(draft)) !== JSON.stringify(stripCompareNoise(published));

  const rawPublishHistory = Array.isArray(current.publishHistory)
    ? current.publishHistory.filter(Boolean)
    : [];
  const publishHistory = rawPublishHistory.map((entry) =>
    normalizePublishHistoryEntry(
      entry,
      published,
      Number((current.meta || {}).lastPublishedVersion || 0)
    )
  );

  if (
    assistantActivationMigrated ||
    JSON.stringify(rawPublishHistory) !== JSON.stringify(publishHistory)
  ) {
    store.companies[companyId] = {
      ...current,
      draft,
      published,
      assistantEnabled,
      publishHistory,
      meta: {
        ...(current.meta || {}),
        dirty: hasUnpublishedChanges,
        ...(assistantActivationMigrated
          ? {
              assistantActivationMigratedAt:
                new Date().toISOString(),
              assistantActivationMigrationRule:
                assistantEnabled
                  ? 'existing_published_enabled'
                  : 'empty_profile_disabled'
            }
          : {})
      }
    };
    writeJsonAtomic(STORE_PATH, store);
  }

  return {
    marker: MARKER,
    companyId,
    draft,
    published,
    assistantEnabled,
    meta: {
      ...(current.meta || {}),
      dirty: hasUnpublishedChanges
    },
    publishHistory,
    publishHistoryCount: publishHistory.length,
    hasUnpublishedChanges
  };
}


/* __AUTOATENDE_C16N_C12E_C2B_FIX1_ROLLBACK_AUDIT_SUMMARY_RESILIENT__ */
function normalizePendingPublishContext(payload = {}, now = new Date().toISOString()) {
  const raw = payload?.publishContext;

  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const type = String(raw.type || '').trim();
  if (!type) {
    return null;
  }

  return {
    type,
    restoredVersion: Number(raw.restoredVersion || 0) || null,
    referenceVersion: Number(raw.referenceVersion || 0) || null,
    savedAt: now
  };
}

function buildRollbackPublishedSummary(context = {}, nextVersion = 0) {
  const restoredVersion = Number(context?.restoredVersion || 0) || null;
  const referenceVersion = Number(context?.referenceVersion || 0) || null;
  const currentVersion = Number(nextVersion || 0) || 0;

  if (restoredVersion && referenceVersion) {
    return `Rollback controlado: v${restoredVersion} republicada como v${currentVersion}, substituindo operacionalmente a referência v${referenceVersion}.`;
  }

  if (restoredVersion) {
    return `Rollback controlado: v${restoredVersion} republicada como v${currentVersion}.`;
  }

  return `Rollback controlado publicado como v${currentVersion}.`;
}


function saveDraft(companyId, payload = {}, actor = 'panel') {
  const state = getCompanyState(companyId);
  const store = getAssistantStore();
  const now = new Date().toISOString();
  const pendingPublishContext = normalizePendingPublishContext(payload, now);

  const draft = normalizeProfile({
    ...state.draft,
    ...(payload.profile || payload),
    updatedAt: now,
    updated_at: now
  });

  const published = normalizeProfile(state.published || {});
  const hasUnpublishedChanges =
    JSON.stringify(stripCompareNoise(draft)) !== JSON.stringify(stripCompareNoise(published));

  store.companies[companyId] = {
    draft,
    published,
    assistantEnabled: Boolean(state.assistantEnabled),
    publishHistory: Array.isArray(state.publishHistory) ? state.publishHistory : [],
    meta: {
      ...(state.meta || {}),
      source: (state.meta && state.meta.source) || 'assistant_central',
      lastDraftAt: now,
      lastDraftBy: actor,
      pendingPublishContext,
      dirty: hasUnpublishedChanges
    }
  };

  writeJsonAtomic(STORE_PATH, store);
  return getCompanyState(companyId);
}


/* __AUTOATENDE_C16N_C12E_A2_FIX1_PUBLISH_AUDIT_TIMELINE__ */
const PUBLISH_HISTORY_LIMIT = 20;

const AUDIT_FIELD_LABELS = {
  companyName: 'Nome da empresa',
  targetAudience: 'Público-alvo',
  companyContext: 'Contexto da empresa',
  toneOfVoice: 'Tom de voz',
  guidance: 'Orientação do negócio',
  services: 'Serviços',
  forbiddenTopics: 'Tópicos proibidos',
  faqJson: 'FAQ/Base de conhecimento'
};

function auditComparableValue(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item ?? '').trim())
      .filter(Boolean)
      .join(' | ')
      .trim();
  }

  return String(value ?? '').trim();
}

function buildPublishChangedFields(previousProfile = {}, nextProfile = {}) {
  const previous = stripCompareNoise(normalizeProfile(previousProfile || {}));
  const current = stripCompareNoise(normalizeProfile(nextProfile || {}));

  return Object.keys(AUDIT_FIELD_LABELS)
    .filter((key) => auditComparableValue(previous[key]) !== auditComparableValue(current[key]))
    .map((key) => ({
      key,
      label: AUDIT_FIELD_LABELS[key]
    }));
}


/* __AUTOATENDE_C16N_C12E_B1_FIX1_VERSION_COMPARE_FOUNDATION__ */
function buildAuditSnapshot(profile = {}) {
  const normalized = normalizeProfile(profile || {});

  return {
    companyName: normalized.companyName || '',
    targetAudience: normalized.targetAudience || '',
    companyContext: normalized.companyContext || '',
    toneOfVoice: normalized.toneOfVoice || '',
    guidance: normalized.guidance || '',
    services: Array.isArray(normalized.services) ? normalized.services : [],
    forbiddenTopics: Array.isArray(normalized.forbiddenTopics) ? normalized.forbiddenTopics : [],
    faqJson: normalized.faqJson || '',
    updatedAt: normalized.updatedAt || normalized.updated_at || null
  };
}

function normalizePublishHistoryEntry(entry = {}, currentPublished = {}, currentVersion = 0) {
  const base = {
    ...entry,
    changedFields: Array.isArray(entry.changedFields) ? entry.changedFields : [],
    totalChangedFields: Number(entry.totalChangedFields || 0)
  };

  if (base.snapshot && typeof base.snapshot === 'object') {
    return {
      ...base,
      snapshot: buildAuditSnapshotWithStructuredBehavior(base.snapshot),
      snapshotAvailable: true
    };
  }

  const canBackfillLatest =
    Number(base.version || 0) > 0 &&
    Number(currentVersion || 0) > 0 &&
    Number(base.version || 0) === Number(currentVersion || 0);

  if (canBackfillLatest) {
    return {
      ...base,
      snapshot: buildAuditSnapshotWithStructuredBehavior(currentPublished || {}),
      snapshotAvailable: true
    };
  }

  return {
    ...base,
    snapshot: null,
    snapshotAvailable: false
  };
}


function buildPublishHistorySummary(changedFields = []) {
  if (!Array.isArray(changedFields) || !changedFields.length) {
    return 'Publicação concluída sem diferenças estruturais relevantes.';
  }

  const labels = changedFields.slice(0, 3).map((item) => item.label).filter(Boolean);
  const extra = changedFields.length - labels.length;

  if (!labels.length) {
    return `Publicação concluída com ${changedFields.length} mudança(s).`;
  }

  if (extra > 0) {
    return `Mudanças em ${labels.join(', ')} e mais ${extra} campo(s).`;
  }

  return `Mudanças em ${labels.join(', ')}.`;
}

function buildPublishHistoryEntry({
  companyId,
  previousPublished,
  nextPublished,
  actor = 'panel',
  version = 0,
  publishedAt = null
}) {
  const changedFields = buildPublishChangedFields(previousPublished, nextPublished);
  const safePublishedAt = publishedAt || new Date().toISOString();

  return {
    id: `${companyId || 'company'}:${version || 0}:${safePublishedAt}`,
    companyId: companyId || null,
    version: Number(version || 0),
    publishedAt: safePublishedAt,
    actor: String(actor || 'panel').trim() || 'panel',
    summary: buildPublishHistorySummary(changedFields),
    totalChangedFields: changedFields.length,
    changedFields,
    snapshot: buildAuditSnapshotWithStructuredBehavior(nextPublished || {}),
    snapshotAvailable: true,
    source: 'assistant_central_publish'
  };
}


function toLegacyPayload(published, meta = {}) {
  const normalized = normalizeProfile(published);
  const publishedAt = meta.publishedAt || new Date().toISOString();

  return {
    ...normalized,
    publishedAt,
    published_at: publishedAt,
    source: 'assistant_central_published',
    source_marker: MARKER,
    version: meta.version || 1
  };
}

function syncPublishedToLegacy(companyId, published, meta = {}) {
  const legacyStore = getLegacyStore();
  const payload = toLegacyPayload(published, meta);

  const mergedRootNode = {
    ...(legacyStore?.[companyId] || {}),
    ...payload
  };

  legacyStore[companyId] = mergedRootNode;

  legacyStore.companies = {
    ...(legacyStore.companies || {}),
    [companyId]: {
      ...(legacyStore?.companies?.[companyId] || {}),
      ...payload
    }
  };

  writeJsonAtomic(LEGACY_STORE_PATH, legacyStore);
  return payload;
}

function publish(companyId, actor = 'panel') {
  const state = getCompanyState(companyId);

  if (!isMeaningfulProfile(state.draft)) {
    throw new Error('ASSISTANT_CENTRAL_DRAFT_EMPTY');
  }

  const store = getAssistantStore();
  const now = new Date().toISOString();
  const pendingPublishContext = state.meta?.pendingPublishContext || null;
  const version = Number(state.meta?.lastPublishedVersion || 0) + 1;
  const published = normalizeProfile({
    ...state.draft,
    updatedAt: now,
    updated_at: now
  });

  const previousPublished = normalizeProfile(state.published || {});
  const previousHistory = Array.isArray(state.publishHistory) ? state.publishHistory : [];
  const historyEntry = buildPublishHistoryEntry({
    companyId,
    previousPublished,
    nextPublished: published,
    actor,
    version,
    publishedAt: now
  });

  syncPublishedToLegacy(companyId, published, { publishedAt: now, version });

  store.companies[companyId] = {
    draft: published,
    published,
    assistantEnabled: Boolean(state.assistantEnabled),
    publishHistory: [historyEntry, ...previousHistory].slice(0, PUBLISH_HISTORY_LIMIT),
    meta: {
      ...(state.meta || {}),
      source: 'assistant_central',
      lastPublishedAt: now,
      lastPublishedBy: actor,
      lastPublishedVersion: version,
      lastPublishedSummary: historyEntry.summary,
      dirty: false
    }
  };


  if (store.companies[companyId]?.meta) {
    store.companies[companyId].meta.pendingPublishContext = null;
  }

  if (pendingPublishContext?.type === 'controlled_rollback') {
    const rollbackSummary = buildRollbackPublishedSummary(pendingPublishContext, version);
    const currentRecord = store.companies[companyId] || {};

    if (currentRecord?.meta) {
      currentRecord.meta.lastPublishedSummary = rollbackSummary;
    }

    if (Array.isArray(currentRecord?.publishHistory)) {
      const historyIndex = currentRecord.publishHistory.findIndex(
        (entry) => Number(entry?.version || 0) === version
      );

      if (historyIndex >= 0) {
        const currentEntry = currentRecord.publishHistory[historyIndex] || {};
        currentRecord.publishHistory[historyIndex] = {
          ...currentEntry,
          summary: rollbackSummary,
          operationType: 'controlled_rollback',
          rollbackFromVersion: pendingPublishContext?.restoredVersion || null,
          rollbackReferenceVersion: pendingPublishContext?.referenceVersion || null
        };
      }
    }
  }

  writeJsonAtomic(STORE_PATH, store);
  return getCompanyState(companyId);
}

function discardDraft(companyId, actor = 'panel') {
  const state = getCompanyState(companyId);
  const store = getAssistantStore();
  const now = new Date().toISOString();

  const published = normalizeProfile(state.published || {});
  store.companies[companyId] = {
    draft: published,
    published,
    assistantEnabled: Boolean(state.assistantEnabled),
    publishHistory: Array.isArray(state.publishHistory) ? state.publishHistory : [],
    meta: {
      ...(state.meta || {}),
      lastDraftAt: now,
      lastDraftBy: actor,
      dirty: false
    }
  };

  writeJsonAtomic(STORE_PATH, store);
  return getCompanyState(companyId);
}

/* __AUTOATENDE_C16N_C12F_B1_WIRING_STRUCTURED_BEHAVIOR_PREVIEW_RUNTIME__ AUDIT_SNAPSHOT */
function buildAuditSnapshotWithStructuredBehavior(profile = {}) {
  const base = buildAuditSnapshot(profile || {});
  const normalized = normalizeProfile(profile || {});
  const qualificationMode =
    normalized.qualificationMode || normalized.qualification_mode || 'only_when_needed';
  const responsePolicy =
    normalized.responsePolicy || normalized.response_policy || 'answer_direct_when_confident';
  const qualificationFields = Array.isArray(normalized.qualificationFields)
    ? normalized.qualificationFields
    : Array.isArray(normalized.qualification_fields)
      ? normalized.qualification_fields
      : [];
  const handoffTriggers = Array.isArray(normalized.handoffTriggers)
    ? normalized.handoffTriggers
    : Array.isArray(normalized.handoff_triggers)
      ? normalized.handoff_triggers
      : [];

  return {
    ...base,
    qualificationMode,
    qualification_mode: qualificationMode,
    responsePolicy,
    response_policy: responsePolicy,
    qualificationFields,
    qualification_fields: qualificationFields,
    qualificationFieldsText: qualificationFields.join('\n'),
    qualification_fields_text: qualificationFields.join('\n'),
    handoffTriggers,
    handoff_triggers: handoffTriggers,
    handoffTriggersText: handoffTriggers.join('\n'),
    handoff_triggers_text: handoffTriggers.join('\n'),
  };
}


/* __AUTOATENDE_ASSISTANT_ACTIVATION_RUNTIME_CONTRACT_V20_B2_R4__ */
function setAssistantEnabled(
  companyId,
  enabled,
  actor = 'panel'
) {
  if (!companyId) {
    throw new Error(
      'ASSISTANT_CENTRAL_COMPANY_ID_REQUIRED'
    );
  }

  if (typeof enabled !== 'boolean') {
    throw new Error(
      'ASSISTANT_CENTRAL_ENABLED_BOOLEAN_REQUIRED'
    );
  }

  const state = getCompanyState(companyId);

  if (
    enabled &&
    !isMeaningfulProfile(state.published)
  ) {
    throw new Error(
      'ASSISTANT_CENTRAL_PUBLISHED_REQUIRED'
    );
  }

  const store = getAssistantStore();
  const current =
    store.companies[companyId] || {};

  const now = new Date().toISOString();
  const safeActor =
    String(actor || 'panel').trim() ||
    'panel';

  store.companies[companyId] = {
    ...current,
    draft: normalizeProfile(
      current.draft ||
      state.draft ||
      {}
    ),
    published: normalizeProfile(
      current.published ||
      state.published ||
      {}
    ),
    assistantEnabled: enabled,
    publishHistory:
      Array.isArray(current.publishHistory)
        ? current.publishHistory
        : Array.isArray(state.publishHistory)
          ? state.publishHistory
          : [],
    meta: {
      ...(current.meta || state.meta || {}),
      assistantEnabled: enabled,
      assistantStatus:
        enabled ? 'active' : 'inactive',
      assistantStatusUpdatedAt: now,
      assistantStatusUpdatedBy: safeActor,
      assistantActivationSource:
        'assistant_central'
    }
  };

  writeJsonAtomic(
    STORE_PATH,
    store
  );

  return getCompanyState(companyId);
}

module.exports = {
  MARKER,
  STORE_PATH,
  LEGACY_STORE_PATH,
  normalizeProfile,
  getCompanyState,
  saveDraft,
  publish,
  discardDraft,
  setAssistantEnabled
};

module.exports.buildAuditSnapshotWithStructuredBehavior = buildAuditSnapshotWithStructuredBehavior;
