/* __AUTOATENDE_ASSISTANT_CENTRAL_STATUS_USAGE_UI_V20_C1_R3__ */
/* __AUTOATENDE_V4_R6C_DISPAROS_COMMERCIAL_COPY_ALIGNMENT__ */
/* __AUTOATENDE_C16N_C12F_B2C_D3_ROLLBACK_PROGRESSIVE_DISCLOSURE__ */
/* __AUTOATENDE_C16N_C12F_B2C_D2_CENTRAL_COMPARE_TIMELINE_DISCLOSURE__ */
/* __AUTOATENDE_C16N_C12F_B2B_PREMIUM_SIMPLIFICATION_PASS_PHASE1__ CENTRAL */
/* __AUTOATENDE_P3_R6_R5F_CENTRAL_CANONICAL_REBUILD__ */
import React, { useEffect, useMemo, useState } from 'react';


import { Link } from 'react-router-dom';



import { createPortal } from "react-dom";
const AA_R40B_R2_FAQ_JSON_TEXTAREA_REAL_FLOW_MARKER = "__AUTOATENDE_V4_R40B_R2_FIX_FAQ_JSON_TEXTAREA_REAL_FLOW_FRONTEND_ONLY__";

if (typeof window !== "undefined") {
  window.__AUTOATENDE_R40B_R2_FAQ_JSON_TEXTAREA_REAL_FLOW_FIX__ = true;
}

function aaR40bR2FormatFaqJsonForTextarea(value) {
  if (value === null || value === undefined) return "";

  if (Array.isArray(value) || typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return "";
    }
  }

  const raw = String(value);

  if (!raw.trim()) return "";

  if (raw.includes("[object Object]")) {
    return "";
  }

  const trimmed = raw.trim();

  if ((trimmed.startsWith("[") && trimmed.endsWith("]")) || (trimmed.startsWith("{") && trimmed.endsWith("}"))) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed) || (parsed && typeof parsed === "object")) {
        return JSON.stringify(parsed, null, 2);
      }
    } catch {
      return raw;
    }
  }

  return raw;
}

function aaR40bR2PickFaqJsonSource(profile) {
  if (!profile || typeof profile !== "object") return "";
  if (Object.prototype.hasOwnProperty.call(profile, "faq_base")) return profile.faq_base;
  if (Object.prototype.hasOwnProperty.call(profile, "faqBase")) return profile.faqBase;
  if (Object.prototype.hasOwnProperty.call(profile, "faq_json")) return profile.faq_json;
  if (Object.prototype.hasOwnProperty.call(profile, "faqJson")) return profile.faqJson;
  if (Object.prototype.hasOwnProperty.call(profile, "faq")) return profile.faq;
  return "";
}

function aaR40bR2ParseFaqJsonTextarea(value) {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "object") return value;

  const raw = String(value).trim();
  if (!raw || raw.includes("[object Object]")) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const AA_R40B_FAQ_JSON_DISPLAY_SERIALIZATION_MARKER = "__AUTOATENDE_V4_R40B_FAQ_JSON_DISPLAY_SERIALIZATION_FRONTEND_ONLY__";

function aaR40bFormatFaqJsonForDisplay(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "";
    if ((trimmed.startsWith("[") && trimmed.endsWith("]")) || (trimmed.startsWith("{") && trimmed.endsWith("}"))) {
      try {
        return JSON.stringify(JSON.parse(trimmed), null, 2);
      } catch {
        return value;
      }
    }
    return value;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value || "");
  }
}

function aaR40bParseFaqJsonForPayload(value) {
  if (value === null || value === undefined || value === "") return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "object") return value;
  const text = String(value).trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const API_BASE = '/api/company-commercial-profiles/assistant-central';

const EMPTY_FORM = {
  companyName: '',
  targetAudience: '',
  companyContext: '',
  toneOfVoice: '',
  guidance: '',
  servicesText: '',
  forbiddenTopicsText: '',
  faqJson: '',
  qualificationMode: 'only_when_needed',
  responsePolicy: 'answer_direct_when_confident',
  qualificationFieldsText: '',
  handoffTriggersText: ''
};

function extractTokenFromUnknown(value, depth = 0) {
  if (depth > 6 || value == null) return '';

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '';

    if (
    trimmed.startsWith('eyJ') ||
    trimmed.startsWith('Bearer ') ||
    trimmed.split('.').length === 3)
    {
      return trimmed.replace(/^Bearer\s+/i, '').trim();
    }

    try {
      const parsed = JSON.parse(trimmed);
      return extractTokenFromUnknown(parsed, depth + 1);
    } catch (_) {
      return '';
    }
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const token = extractTokenFromUnknown(item, depth + 1);
      if (token) return token;
    }
    return '';
  }

  if (typeof value === 'object') {
    const priorityKeys = [
    'access_token',
    'accessToken',
    'token',
    'authToken',
    'auth_token',
    'jwt',
    'session',
    'currentSession',
    'data',
    'user',
    'auth'];


    for (const key of priorityKeys) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        const token = extractTokenFromUnknown(value[key], depth + 1);
        if (token) return token;
      }
    }

    for (const nested of Object.values(value)) {
      const token = extractTokenFromUnknown(nested, depth + 1);
      if (token) return token;
    }
  }

  return '';
}

function getStoredToken() {
  const keys = [
  'token',
  'authToken',
  'access_token',
  'adminToken',
  'jwt',
  'auth_token',
  'supabase.auth.token',
  'sb-access-token'];


  for (const key of keys) {
    try {
      const raw = window.localStorage.getItem(key);
      const token = extractTokenFromUnknown(raw);
      if (token) return token;
    } catch (_) {}
  }

  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const storageKey = window.localStorage.key(i);
      if (!storageKey) continue;
      const raw = window.localStorage.getItem(storageKey);
      const token = extractTokenFromUnknown(raw);
      if (token) return token;
    }
  } catch (_) {}

  return '';
}

async function apiRequest(path, options = {}) {
  const token = getStoredToken();

  if (!token) {
    throw new Error('Token de autenticação não fornecido');
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch (_) {
    payload = null;
  }

  if (!response.ok) {
    const message =
    payload?.message ||
    payload?.error ||
    `Falha na requisição (${response.status})`;
    throw new Error(message);
  }

  return payload?.data || payload;
}

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeListFromUnknown(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeText(item)).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value.
    split('\n').
    map((item) => normalizeText(item)).
    filter(Boolean);
  }

  return [];
}

function listToMultiline(value) {
  return normalizeListFromUnknown(value).join('\n');
}

function normalizeForm(raw = {}) {
  return {
    companyName: normalizeText(raw.companyName || raw.company_name),
    targetAudience: normalizeText(raw.targetAudience || raw.target_audience),
    companyContext: normalizeText(raw.companyContext || raw.company_context),
    toneOfVoice: normalizeText(raw.toneOfVoice || raw.tone_of_voice || raw.tone),
    guidance: normalizeText(
      raw.guidance ||
      raw.additionalGuidance ||
      raw.additional_guidance ||
      raw.assistant_guidance
    ),
    servicesText: listToMultiline(raw.services || raw.services_text),
    forbiddenTopicsText: listToMultiline(
      raw.forbiddenTopics ||
      raw.forbidden_topics ||
      raw.forbidden_topics_text
    ),
    faqJson: aaR40bR2FormatFaqJsonForTextarea(normalizeText(raw.faqJson || raw.faq_json)),
    qualificationMode: normalizeText(raw.qualificationMode || raw.qualification_mode) || 'only_when_needed',
    responsePolicy: normalizeText(raw.responsePolicy || raw.response_policy) || 'answer_direct_when_confident',
    qualificationFieldsText: listToMultiline(
      raw.qualificationFields ||
      raw.qualification_fields ||
      raw.qualification_fields_text
    ),
    handoffTriggersText: listToMultiline(
      raw.handoffTriggers ||
      raw.handoff_triggers ||
      raw.handoff_triggers_text
    )
  };
}

function buildPayload(form = {}) {
  return {
    companyName: normalizeText(form.companyName),
    targetAudience: normalizeText(form.targetAudience),
    companyContext: normalizeText(form.companyContext),
    toneOfVoice: normalizeText(form.toneOfVoice),
    guidance: normalizeText(form.guidance),
    services: normalizeListFromUnknown(form.servicesText),
    forbiddenTopics: normalizeListFromUnknown(form.forbiddenTopicsText),
    faqJson: aaR40bR2FormatFaqJsonForTextarea(normalizeText(form.faqJson)),
    qualificationMode: normalizeText(form.qualificationMode) || 'only_when_needed',
    responsePolicy: normalizeText(form.responsePolicy) || 'answer_direct_when_confident',
    qualificationFields: normalizeListFromUnknown(form.qualificationFieldsText),
    handoffTriggers: normalizeListFromUnknown(form.handoffTriggersText)
  };
}

function humanizeApiError(message = '') {
  const text = String(message || '').trim();
  if (!text) return 'Falha inesperada.';
  if (/Token de autenticação não fornecido/i.test(text)) return 'Token de autenticação não fornecido';
  if (/ASSISTANT_CENTRAL_DRAFT_EMPTY/i.test(text)) return 'O rascunho está vazio. Preencha os dados antes de publicar.';
  return text;
}

function labelDate(value) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(new Date(value));
  } catch (_) {
    return '—';
  }
}

function Section({ title, description, children }) {
  return (
    <section className="aa-brand-card p-6 aa-assistant-compact-page">
      <div className="mb-5">
        <h2 className="aa-brand-title text-xl font-semibold">{title}</h2>
        {description ? <p className="aa-brand-copy mt-2 text-sm">{description}</p> : null}
      </div>
      <div className="space-y-5">{children}</div>
    </section>);

}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-[#D9E2DD]">{label}</span>
      {children}
    </label>);

}


export default function AssistantCentralProfessional() {

  /* __AUTOATENDE_ASSISTANT_CENTRAL_GUIDED_TABS_COMPACT_LAYOUT_V20_C2_C1_C3_R3__ */

  const aaAssistantSectionHashMap = {
    "#assistant-central-identidade": "identity",
    "#assistant-central-diretrizes": "guidance",
    "#assistant-central-comportamento": "behavior",
    "#assistant-central-conhecimento": "knowledge",
    "#assistant-central-governanca": "governance",
  };

  const aaAssistantSectionIdMap = {
    identity: "assistant-central-identidade",
    guidance: "assistant-central-diretrizes",
    behavior: "assistant-central-comportamento",
    knowledge: "assistant-central-conhecimento",
    governance: "assistant-central-governanca",
  };

  const [aaActiveSection, setAaActiveSection] = useState(() => {
    if (typeof window === "undefined") {
      return "identity";
    }

    return (
      aaAssistantSectionHashMap[window.location.hash] ||
      "identity"
    );
  });

  const aaSelectAssistantSection = (sectionName) => {
    const targetId =
      aaAssistantSectionIdMap[sectionName];

    if (!targetId) {
      return;
    }

    setAaActiveSection(sectionName);

    if (
      typeof window !== "undefined" &&
      window.history?.replaceState
    ) {
      window.history.replaceState(
        null,
        "",
        `#${targetId}`
      );
    }
  };

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [publishBusy, setPublishBusy] = useState(false);
  const [activationBusy, setActivationBusy] = useState(false);
  const [error, setError] = useState('');
  const [compareBaseId, setCompareBaseId] = useState('');
  const [compareTargetId, setCompareTargetId] = useState('');
  const [showOnlyChangedFields, setShowOnlyChangedFields] = useState(true);
  const [rollbackBusy, setRollbackBusy] = useState(false);
  const [flash, setFlash] = useState('');
  const [meta, setMeta] = useState({});
  const [published, setPublished] = useState({});
  const [form, setForm] = useState(EMPTY_FORM);
  const [state, setState] = useState(null);

  const assistantEnabled = Boolean(
    state?.assistantEnabled
  );

  const assistantPublishedVersion = Number(
    state?.meta?.lastPublishedVersion ||
    meta?.lastPublishedVersion ||
    0
  );

  const assistantCanActivate =
    assistantPublishedVersion > 0;

  // __AUTOATENDE_C16N_C12E_C1B_FIX3_STATE_RUNTIME_AUTHORITY_RESILIENT__
  const draftPayload = useMemo(() => buildPayload(form), [form]);
  const publishedPayload = useMemo(() => buildPayload(normalizeForm(published)), [published]);


  // __AUTOATENDE_C16N_C12E_B2B_FIX2_VERSION_DIFF_UI__
  const comparableHistory = useMemo(() => {
    const raw = Array.isArray(state?.publishHistory) ? state.publishHistory : [];
    return raw.filter((item) => item?.snapshotAvailable && item?.snapshot);
  }, [state?.publishHistory]);

  useEffect(() => {
    if (!comparableHistory.length) {
      if (compareBaseId) setCompareBaseId('');
      if (compareTargetId) setCompareTargetId('');
      return;
    }

    const safeTarget = comparableHistory.find((item) => item?.id === compareTargetId) ?
    compareTargetId :
    comparableHistory[0]?.id || '';

    const candidateBase = comparableHistory.find((item) => item?.id === compareBaseId) ?
    compareBaseId :
    comparableHistory[1]?.id || comparableHistory[0]?.id || '';

    const safeBase =
    candidateBase === safeTarget ?
    comparableHistory.find((item) => item?.id !== safeTarget)?.id || candidateBase :
    candidateBase;

    if (safeTarget !== compareTargetId) setCompareTargetId(safeTarget);
    if (safeBase !== compareBaseId) setCompareBaseId(safeBase);
  }, [comparableHistory, compareBaseId, compareTargetId]);

  const compareFieldDefs = useMemo(() => ([
  { key: 'companyName', label: 'Nome da empresa', impact: 'alto' },
  { key: 'targetAudience', label: 'Público-alvo', impact: 'alto' },
  { key: 'companyContext', label: 'Contexto da empresa', impact: 'alto' },
  { key: 'toneOfVoice', label: 'Tom de voz', impact: 'alto' },
  { key: 'guidance', label: 'Orientação do negócio', impact: 'alto' },
  { key: 'services', label: 'Serviços', impact: 'médio' },
  { key: 'forbiddenTopics', label: 'Tópicos proibidos', impact: 'alto' },
  { key: 'faqJson', label: 'FAQ / base de conhecimento', impact: 'médio' },
  { key: 'qualificationMode', label: 'Modo de qualificação' },
  { key: 'responsePolicy', label: 'Política de resposta' },
  { key: 'qualificationFieldsText', label: 'Campos de qualificação' },
  { key: 'handoffTriggersText', label: 'Gatilhos de transbordo' }]), []);


  const normalizeDiffValue = (value) => {
    if (value == null) return '';
    if (Array.isArray(value)) {
      return value.
      map((item) => String(item ?? '').trim()).
      filter(Boolean).
      join(' | ').
      trim();
    }
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch (_) {
        return '';
      }
    }
    return String(value).trim();
  };

  const compareBaseEntry = comparableHistory.find((item) => item?.id === compareBaseId) || null;
  const compareTargetEntry = comparableHistory.find((item) => item?.id === compareTargetId) || null;

  const versionDiffRows = useMemo(() => {
    const baseSnapshot = compareBaseEntry?.snapshot || {};
    const targetSnapshot = compareTargetEntry?.snapshot || {};

    return compareFieldDefs.map((field) => {
      const baseValue = normalizeDiffValue(baseSnapshot?.[field.key]);
      const targetValue = normalizeDiffValue(targetSnapshot?.[field.key]);
      const changed = baseValue !== targetValue;

      return {
        ...field,
        changed,
        baseValue: baseValue || 'N/D',
        targetValue: targetValue || 'N/D'
      };
    });
  }, [compareBaseEntry, compareFieldDefs, compareTargetEntry]);

  const visibleVersionDiffRows = showOnlyChangedFields ?
  versionDiffRows.filter((item) => item.changed) :
  versionDiffRows;

  const compareReady =
  // __AUTOATENDE_C16N_C12E_C2A_FIX1_ROLLBACK_GUARD_SEMANTIC_HARDENING__
  Boolean(compareBaseEntry?.id) &&
  Boolean(compareTargetEntry?.id) &&
  compareBaseEntry?.id !== compareTargetEntry?.id;

  const compareDisclosureSummary = compareReady ?
  `Comparação pronta · ${compareBaseEntry ? `base v${compareBaseEntry.version || '—'}` : 'base —'} · ${compareTargetEntry ? `comparada v${compareTargetEntry.version || '—'}` : 'comparada —'}` :
  'Escolha duas versões com snapshot disponível para comparar.';

  const timelineDisclosureSummary = comparableHistory?.length ?
  `${comparableHistory.length} publicação(ões) com snapshot disponível na linha do tempo.` :
  'Ainda não há publicações suficientes para leitura histórica detalhada.';


  const versionDiffChangedCount = versionDiffRows.filter((item) => item.changed).length;



  // __AUTOATENDE_C16N_C12E_C1B_CONTROLLED_ROLLBACK_VIA_EXISTING_CONTRACT__
  // __AUTOATENDE_C16N_C12E_C2A_FIX1_ROLLBACK_GUARD_SEMANTIC_HARDENING__
  const activePublishedVersion = Number(state?.meta?.lastPublishedVersion || meta?.lastPublishedVersion || 0);
  const selectedRollbackVersion = Number(compareBaseEntry?.version || 0);
  const rollbackTargetsActiveVersion =
  activePublishedVersion > 0 &&
  selectedRollbackVersion > 0 &&
  selectedRollbackVersion === activePublishedVersion;

  const rollbackReady =
  compareReady &&
  Boolean(compareBaseEntry?.snapshot) &&
  !rollbackBusy &&
  !busy &&
  !publishBusy &&
  !rollbackTargetsActiveVersion;

  const rollbackDisclosureSummary = rollbackBusy ?
  'Rollback em andamento...' :
  rollbackReady ?
  compareBaseEntry ? `Versão alvo: v${compareBaseEntry.version || '—'}` : 'Versão base pronta para restauração' :
  'Selecione uma versão restaurável para liberar o rollback.';


  async function // __AUTOATENDE_C16N_C12E_C2B_FIX1_ROLLBACK_AUDIT_SUMMARY_RESILIENT__
  handleControlledRollbackToBaseVersion() {
    if (!compareReady || !compareBaseEntry?.snapshot || rollbackBusy) return;

    const baseVersion = Number(compareBaseEntry?.version || 0) || 'selecionada';

    const confirmed = window.confirm(
      `Restaurar a versão ${baseVersion} como nova publicação ativa?\n\n` +
      `Esse rollback não apaga o histórico. Ele restaura o snapshot escolhido como nova versão publicada.`
    );

    if (!confirmed) return;

    setRollbackBusy(true);
    setError('');
    setFlash('');

    try {
      const rollbackProfile = compareBaseEntry?.snapshot || {};

      const draftData = await apiRequest('/draft', {
        method: 'PUT',
        body: JSON.stringify({
          profile: rollbackProfile,
          publishContext: {
            // __AUTOATENDE_C16N_C12E_C2B_FIX2_FRONT_RUNTIME_REFERENCE_GUARD__
            type: 'controlled_rollback',
            restoredVersion: Number(baseVersion || 0) || null,
            referenceVersion: Number(compareTargetEntry?.version || 0) || null
          }
        })
      });

      setState(draftData || null);
      setMeta(draftData?.meta || {});
      setPublished(draftData?.published || {});
      setForm(normalizeForm(draftData?.draft || rollbackProfile || {}));

      const publishData = await apiRequest('/publish', {
        method: 'POST'
      });

      setState(publishData || null);
      setMeta(publishData?.meta || {});
      setPublished(publishData?.published || {});
      setForm(normalizeForm(publishData?.draft || publishData?.published || {}));

      setFlash(
        `Rollback controlado concluído. A versão ${baseVersion} foi republicada como nova versão ativa.`
      );

      await loadState();
    } catch (err) {
      setError(
        humanizeApiError(
          err?.message || 'Falha ao executar rollback controlado.'
        )
      );
    } finally {
      setRollbackBusy(false);
    }
  }


  const localHasChanges = useMemo(() => {
    return JSON.stringify(draftPayload) !== JSON.stringify(publishedPayload);
  }, [draftPayload, publishedPayload]);

  async function loadState() {
    setLoading(true);
    setError('');
    setFlash('');

    try {
      const data = await apiRequest('/state');
      setState(data || null);
      setMeta(data?.meta || {});
      setPublished(data?.published || {});
      setForm(normalizeForm(data?.draft || data?.published || {}));
    } catch (err) {
      setError(humanizeApiError(err?.message || 'Falha ao carregar a Central do Assistente.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadState();
  }, []);

  function updateField(key, value) {
    setForm((current) => ({
      ...current,
      [key]: value
    }));
  }

  async function handleSaveDraft() {
    setBusy(true);
    setError('');
    setFlash('');

    try {
      const data = await apiRequest('/draft', {
        method: 'PUT',
        body: JSON.stringify({ profile: draftPayload })
      });

      setState(data || null);
      setMeta(data?.meta || {});
      setPublished(data?.published || {});
      setForm(normalizeForm(data?.draft || {}));
      setFlash('Rascunho salvo com sucesso.');
    } catch (err) {
      setError(humanizeApiError(err?.message || 'Falha ao salvar rascunho.'));
    } finally {
      setBusy(false);
    }
  }

  async function handlePublish() {
    const confirmed = window.confirm(
      'Publicar a versão atual do rascunho e colocar essa nova configuração em produção?'
    );

    if (!confirmed) return;

    setPublishBusy(true);
    setError('');
    setFlash('');

    try {
      const data = await apiRequest('/publish', {
        method: 'POST'
      });

      setState(data || null);
      setMeta(data?.meta || {});
      setPublished(data?.published || {});
      setForm(normalizeForm(data?.draft || data?.published || {}));
      setFlash('Alterações publicadas com sucesso. O bot passa a usar a nova versão nas próximas respostas.');
    } catch (err) {
      setError(humanizeApiError(err?.message || 'Falha ao publicar alterações.'));
    } finally {
      setPublishBusy(false);
    }
  }


  async function handleToggleAssistant() {
    if (
      !assistantEnabled &&
      !assistantCanActivate
    ) {
      setError(
        'Publique uma configuração válida antes de ativar o assistente.'
      );
      return;
    }

    const nextEnabled =
      !assistantEnabled;

    const confirmed = window.confirm(
      nextEnabled
        ? 'Ativar o assistente para responder automaticamente às próximas mensagens recebidas?'
        : 'Desativar o assistente? As conversas continuarão disponíveis para atendimento humano, mas não receberão respostas automáticas.'
    );

    if (!confirmed) return;

    setActivationBusy(true);
    setError('');
    setFlash('');

    try {
      const data = await apiRequest(
        '/activation',
        {
          method: 'PATCH',
          body: JSON.stringify({
            enabled: nextEnabled
          })
        }
      );

      setState(data || null);
      setMeta(data?.meta || {});
      setPublished(
        data?.published || {}
      );

      setFlash(
        nextEnabled
          ? 'Assistente ativado. As próximas mensagens elegíveis poderão receber respostas automáticas.'
          : 'Assistente desativado. O atendimento automático foi interrompido para esta empresa.'
      );
    } catch (err) {
      setError(
        humanizeApiError(
          err?.message ||
          'Falha ao alterar o status do assistente.'
        )
      );
    } finally {
      setActivationBusy(false);
    }
  }

  async function handleDiscardDraft() {
    const confirmed = window.confirm(
      'Descartar o rascunho atual e voltar para a última versão publicada?'
    );

    if (!confirmed) return;

    setBusy(true);
    setError('');
    setFlash('');

    try {
      const data = await apiRequest('/discard-draft', {
        method: 'POST'
      });

      setState(data || null);
      setMeta(data?.meta || {});
      setPublished(data?.published || {});
      setForm(normalizeForm(data?.draft || data?.published || {}));
      setFlash('Rascunho descartado. A tela voltou para a última versão publicada.');
    } catch (err) {
      setError(humanizeApiError(err?.message || 'Falha ao descartar rascunho.'));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="aa-page-shell aa-settings-shell">
        <div className="aa-brand-container">
          <div className="aa-brand-card p-6">
            <p className="aa-brand-copy text-sm">Carregando Central do Assistente...</p>
          </div>
        </div>
      </div>);

  }

  return (
    <div className="aa-page-shell aa-settings-shell">
      <div className="aa-brand-container space-y-6">
        







































































        

        <div className="grid gap-6">

          {/* __AUTOATENDE_C16N_C12E_A2_FIX1_PUBLISH_AUDIT_TIMELINE__ */}      {/* __AUTOATENDE_C16N_C12E_B1_FIX1_VERSION_COMPARE_FOUNDATION__ */}

          









































































          


          {/* __AUTOATENDE_C16N_C12E_B2B_FIX2_VERSION_DIFF_UI__ */}
          
































































































































































          


          <div
            className="aa-assistant-overview-stack"
            data-aa-overview-stack="true"
          >
<section className="aa-assistant-central-intro aa-brand-card" data-aa-header-block="hero" data-aa-header-phase="__AUTOATENDE_ASSISTANT_CENTRAL_PREMIUM_HEADER_HIERARCHY_V20_C2_B1_R3__">
      {/* __AUTOATENDE_V4_R10F_ASSISTANT_CENTER_AST_CHILD_ORDER_REORDER__: título operacional inserido antes da configuração principal. */}
      <div className="aa-brand-kicker">Central do Assistente</div>
      <h1 className="aa-assistant-central-intro-title">Central do Assistente</h1>
      <p className="aa-assistant-central-intro-copy">
        Configure a identidade, o comportamento e o conhecimento operacional que orientam o agente de IA da empresa.
      </p>
    </section>

          <section
            className="aa-assistant-status-card aa-brand-card"
            data-assistant-status={
              assistantEnabled
                ? 'active'
                : 'inactive'
            }
           data-aa-header-block="status">
            <div className="aa-assistant-status-layout">
              <div className="aa-assistant-status-copy">
                <p className="aa-brand-kicker">
                  Status operacional
                </p>

                <div className="aa-assistant-status-heading">
                  <span
                    className={
                      assistantEnabled
                        ? 'aa-assistant-status-dot is-active'
                        : 'aa-assistant-status-dot is-inactive'
                    }
                    aria-hidden="true"
                  />

                  <h2 className="aa-assistant-status-title">
                    {assistantEnabled
                      ? 'Assistente ativo'
                      : 'Assistente inativo'}
                  </h2>
                </div>

                <p className="aa-assistant-status-description">
                  {assistantEnabled
                    ? 'A configuração publicada está liberada para responder automaticamente às conversas elegíveis.'
                    : assistantCanActivate
                      ? 'A configuração está publicada, mas o atendimento automático permanece desativado.'
                      : 'Finalize e publique a configuração antes de liberar o atendimento automático.'}
                </p>
              </div>

              <div className="aa-assistant-status-metrics">
                <div className="aa-assistant-status-metric">
                  <span>Versão publicada</span>
                  <strong>
                    {assistantPublishedVersion > 0
                      ? `v${assistantPublishedVersion}`
                      : 'Nenhuma'}
                  </strong>
                </div>

                <div className="aa-assistant-status-metric">
                  <span>Configuração</span>
                  <strong>
                    {localHasChanges
                      ? 'Alterações pendentes'
                      : 'Em sincronia'}
                  </strong>
                </div>

                <div className="aa-assistant-status-metric">
                  <span>Operação</span>
                  <strong>
                    {assistantEnabled
                      ? 'Automática'
                      : 'Somente humano'}
                  </strong>
                </div>
              </div>
            </div>
          </section>
          </div>
          <div
            className="aa-assistant-guided-shell"
            data-aa-guided-shell="true"
           data-aa-panel-binding-fix-phase="__AUTOATENDE_ASSISTANT_CENTRAL_PANEL_BINDING_AND_EXACT_SPACING_V20_C2_C1_C4__"
            data-aa-active-section={aaActiveSection}
            data-aa-active-section-phase="__AUTOATENDE_ASSISTANT_CENTRAL_ACTIVE_SECTION_STATE_BINDING_V20_C2_C1_C5_R2__"
          >
<nav
            className="aa-assistant-section-nav aa-assistant-guided-tabs"
            aria-label="Áreas de configuração do assistente"
            data-aa-section-nav="true"
            data-aa-guided-tabs="true"
            data-aa-tabs-phase="__AUTOATENDE_ASSISTANT_CENTRAL_GUIDED_TABS_COMPACT_LAYOUT_V20_C2_C1_C3_R3__"
          >
            <span
              className="aa-assistant-section-nav-prefix"
              aria-hidden="true"
            >
              Configurar
            </span>

            <div
              className="aa-assistant-section-nav-links"
              role="tablist"
              aria-label="Etapas da configuração"
            >
              <button
                id="aa-assistant-tab-identity"
                type="button"
                role="tab"
                aria-selected={aaActiveSection === "identity"}
                aria-controls="assistant-central-identidade"
                data-aa-guided-tab="identity"
                data-aa-active={
                  aaActiveSection === "identity"
                    ? "true"
                    : undefined
                }
                onClick={() =>
                  aaSelectAssistantSection("identity")
                }
              >
                Identidade
              </button>

              <button
                id="aa-assistant-tab-guidance"
                type="button"
                role="tab"
                aria-selected={aaActiveSection === "guidance"}
                aria-controls="assistant-central-diretrizes"
                data-aa-guided-tab="guidance"
                data-aa-active={
                  aaActiveSection === "guidance"
                    ? "true"
                    : undefined
                }
                onClick={() =>
                  aaSelectAssistantSection("guidance")
                }
              >
                Diretrizes
              </button>

              <button
                id="aa-assistant-tab-behavior"
                type="button"
                role="tab"
                aria-selected={aaActiveSection === "behavior"}
                aria-controls="assistant-central-comportamento"
                data-aa-guided-tab="behavior"
                data-aa-active={
                  aaActiveSection === "behavior"
                    ? "true"
                    : undefined
                }
                onClick={() =>
                  aaSelectAssistantSection("behavior")
                }
              >
                Comportamento
              </button>

              <button
                id="aa-assistant-tab-knowledge"
                type="button"
                role="tab"
                aria-selected={aaActiveSection === "knowledge"}
                aria-controls="assistant-central-conhecimento"
                data-aa-guided-tab="knowledge"
                data-aa-active={
                  aaActiveSection === "knowledge"
                    ? "true"
                    : undefined
                }
                onClick={() =>
                  aaSelectAssistantSection("knowledge")
                }
              >
                Conhecimento
              </button>

              <button
                id="aa-assistant-tab-governance"
                type="button"
                role="tab"
                aria-selected={aaActiveSection === "governance"}
                aria-controls="assistant-central-governanca"
                data-aa-guided-tab="governance"
                data-aa-active={
                  aaActiveSection === "governance"
                    ? "true"
                    : undefined
                }
                onClick={() =>
                  aaSelectAssistantSection("governance")
                }
              >
                Governança
              </button>
            </div>
          </nav>
<Section title="Identidade e posicionamento" description="Base da identidade comercial usada para orientar a IA sobre quem é a empresa e para quem ela vende." data-aa-ia-section="identity" id="assistant-central-identidade" data-aa-guided-panel="identity" role="tabpanel" aria-labelledby="aa-assistant-tab-identity" hidden={aaActiveSection !== "identity"}>
            <div className="grid gap-5 lg:grid-cols-2">
              <Field label="Nome da empresa">
                <input className="aa-brand-input w-full px-4 py-3 text-sm" value={form.companyName} onChange={(e) => updateField('companyName', e.target.value)} placeholder="Ex.: AutoAtendeAI" />
                
              </Field>

              <Field label="Público-alvo">
                <input
                  className="aa-brand-input w-full px-4 py-3 text-sm"
                  value={form.targetAudience}
                  onChange={(e) => updateField('targetAudience', e.target.value)}
                  placeholder="Ex.: empresas brasileiras que atendem via WhatsApp" />
                
              </Field>
            </div>

            <Field label="Contexto da empresa">
              <textarea
                rows={7}
                className="aa-brand-textarea w-full px-4 py-3 text-sm"
                value={form.companyContext}
                onChange={(e) => updateField('companyContext', e.target.value)}
                placeholder="Explique o que a empresa faz, diferenciais, proposta de valor e contexto comercial." />
              
            </Field>
          </Section>

          <Section
            title="Tom, diretrizes e operação comercial"
            description="Diretrizes para a forma como o assistente deve responder." data-aa-ia-section="guidance" id="assistant-central-diretrizes" data-aa-guided-panel="guidance" role="tabpanel" aria-labelledby="aa-assistant-tab-guidance" hidden={aaActiveSection !== "guidance"}>
            
            <div className="grid gap-5 lg:grid-cols-2">
              <Field label="Tom de voz">
                <input
                  className="aa-brand-input w-full px-4 py-3 text-sm"
                  value={form.toneOfVoice}
                  onChange={(e) => updateField('toneOfVoice', e.target.value)}
                  placeholder="Ex.: profissional, claro, consultivo e objetivo" />
                
              </Field>

              <Field label="Guidance adicional">
                <textarea
                  rows={4}
                  className="aa-brand-textarea w-full px-4 py-3 text-sm"
                  value={form.guidance}
                  onChange={(e) => updateField('guidance', e.target.value)}
                  placeholder="Instruções complementares de postura comercial e operacional." />
                
              </Field>
            </div>
          </Section>

          {/* __AUTOATENDE_C16N_C12F_A1_FIX4A_STRUCTURED_BEHAVIOR_FOUNDATION_EXACT__ */}
          <Section
            title="Comportamento estruturado do assistente"
            description="Defina como o assistente qualifica, quando escalar para humano e qual postura deve adotar ao responder." data-aa-ia-section="behavior" id="assistant-central-comportamento" data-aa-guided-panel="behavior" role="tabpanel" aria-labelledby="aa-assistant-tab-behavior" hidden={aaActiveSection !== "behavior"}>
            
            <div className="grid gap-5 lg:grid-cols-2">
              <Field label="Estratégia de qualificação">
                <select
                  className="aa-brand-input w-full px-4 py-3 text-sm"
                  value={form.qualificationMode}
                  onChange={(e) => updateField('qualificationMode', e.target.value)}>
                  
                  <option value="only_when_needed">Perguntar só quando necessário</option>
                  <option value="guided_progressive">Qualificação progressiva</option>
                  <option value="always_collect_minimum">Coletar dados mínimos antes de avançar</option>
                </select>
              </Field>

              <Field label="Postura de resposta">
                <select
                  className="aa-brand-input w-full px-4 py-3 text-sm"
                  value={form.responsePolicy}
                  onChange={(e) => updateField('responsePolicy', e.target.value)}>
                  
                  <option value="answer_direct_when_confident">Responder direto quando souber</option>
                  <option value="brief_question_when_missing_context">Pergunta curta quando faltar contexto</option>
                  <option value="qualify_before_offer">Qualificar antes de avançar comercialmente</option>
                </select>
              </Field>
            </div>

            <Field label="Campos de qualificação prioritários (um por linha)">
              <textarea
                rows={5}
                className="aa-brand-textarea w-full px-4 py-3 text-sm"
                value={form.qualificationFieldsText}
                onChange={(e) => updateField('qualificationFieldsText', e.target.value)}
                placeholder={'Ex.:\nNome\nSegmento\nObjetivo\nPorte da operação'} />
              
            </Field>

            <Field label="Gatilhos de transbordo humano (um por linha)">
              <textarea
                rows={5}
                className="aa-brand-textarea w-full px-4 py-3 text-sm"
                value={form.handoffTriggersText}
                onChange={(e) => updateField('handoffTriggersText', e.target.value)}
                placeholder={'Ex.:\nCliente pede humano\nCaso fora do escopo\nPedido sensível\nProposta muito customizada'} />
              
            </Field>
          </Section>

          <Section
            title="Conhecimento operacional"
            description="Esses blocos ajudam a IA a responder com base no que foi configurado." data-aa-ia-section="knowledge" id="assistant-central-conhecimento" data-aa-guided-panel="knowledge" role="tabpanel" aria-labelledby="aa-assistant-tab-knowledge" hidden={aaActiveSection !== "knowledge"}>
            
            <Field label="Serviços / ofertas (um por linha)">
              <textarea
                rows={6}
                className="aa-brand-textarea w-full px-4 py-3 text-sm"
                value={form.servicesText}
                onChange={(e) => updateField('servicesText', e.target.value)}
                placeholder={'Ex.:\nAtendimento via WhatsApp\nQualificação de leads\nInbox com operação humana'} />
              
            </Field>

            <Field label="Tópicos proibidos / limites (um por linha)">
              <textarea
                rows={5}
                className="aa-brand-textarea w-full px-4 py-3 text-sm"
                value={form.forbiddenTopicsText}
                onChange={(e) => updateField('forbiddenTopicsText', e.target.value)}
                placeholder={'Ex.:\nNão prometer integração não configurada\nNão inventar prazo comercial'} />
              
            </Field>

            <Field label="FAQ JSON / bloco estruturado">
              <textarea
                rows={8}
                className="aa-brand-textarea w-full px-4 py-3 text-sm"
                value={aaR40bR2FormatFaqJsonForTextarea(aaR40bFormatFaqJsonForDisplay(form.faqJson))}
                onChange={(e) => updateField('faqJson', e.target.value)}
                placeholder='Ex.: [{"question":"Como funciona?","answer":"..."}]' />
              
            </Field>
          </Section>
        <details
            id="assistant-central-governanca"
            className="aa-assistant-governance-disclosure"
            data-aa-governance-disclosure="true"
            data-aa-ia-section="governance"
           data-aa-guided-panel="governance" role="tabpanel" aria-labelledby="aa-assistant-tab-governance" hidden={aaActiveSection !== "governance"} open={aaActiveSection === "governance"}>
            <summary className="aa-assistant-governance-summary">
              <span className="aa-assistant-governance-summary-copy">
                <span className="aa-assistant-governance-kicker">
                  Governança avançada
                </span>

                <strong>
                  Histórico, versões e restauração
                </strong>

                <span>
                  Consulte publicações, compare snapshots ou restaure
                  uma versão anterior somente quando necessário.
                </span>
              </span>

              <span
                className="aa-assistant-governance-summary-action"
                aria-hidden="true"
              >
                <span className="aa-assistant-governance-open-label">
                  Abrir
                </span>

                <span className="aa-assistant-governance-close-label">
                  Recolher
                </span>

                <span className="aa-assistant-governance-chevron">
                  ›
                </span>
              </span>
            </summary>

            <div className="aa-assistant-governance-content">
<div className="aa-assistant-snapshot-card-bottom  __AUTOATENDE_V4_R10U_R7_SNAPSHOT_SUMMARY_FLATTEN_FINAL__">
    {/* __AUTOATENDE_V4_R10K_SNAPSHOT_CARD_MOVED_BY_FINAL_OUTPUT_ORDER__: card de versões e snapshots movido para antes da governança administrativa. */}
  
<div className="aa-assistant-snapshot-static-summary">
            <div className="min-w-0">
              <p className="aa-brand-kicker">Versões e snapshots</p>
              <h2 className="aa-brand-title text-xl font-semibold">Comparação entre versões</h2>
              <p className="aa-assistant-disclosure-inline text-sm">{compareDisclosureSummary}</p>
            </div>
</div>
</div><div id="aa-assistant-version-governance" /* __AUTOATENDE_V4_R10S_GOVERNANCE_SCROLL_TARGET__ */ className="aa-assistant-version-governance-bottom">
    <div className="aa-brand-kicker">Governança do assistente</div>
    <h2 className="aa-brand-title">Histórico, comparação e rollback</h2>
    <p className="aa-brand-copy">
      Área administrativa para revisar publicações, comparar versões e restaurar snapshots quando necessário.
    </p>
  

<Section title="Linha do tempo de publicações" description="Histórico append-only das versões publicadas do assistente. Isso ajuda a rastrear quando cada versão entrou em produção, por quem e com qual resumo de mudanças.">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="aa-brand-metric p-4">
                <p className="aa-brand-metric-label">Publicações registradas</p>
                <p className="aa-brand-metric-value mt-2 text-sm">
                  {Number(state?.publishHistoryCount || state?.publishHistory?.length || 0)}
                </p>
              </div>

              <div className="aa-brand-metric p-4">
                <p className="aa-brand-metric-label">Versão publicada atual</p>
                <p className="aa-brand-metric-value mt-2 text-sm">
                  {Number(state?.meta?.lastPublishedVersion || 0)}
                </p>
              </div>

              <div className="aa-brand-metric p-4">
                <p className="aa-brand-metric-label">Último resumo publicado</p>
                <p className="mt-2 text-sm leading-6 text-[#E8F0EC]">
                  {state?.meta?.lastPublishedSummary || 'Ainda não há resumo catalogado para esta linha do tempo.'}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {Array.isArray(state?.publishHistory) && state.publishHistory.length ? state.publishHistory.map((item) => <div key={item?.id || `${item?.version || 'v'}-${item?.publishedAt || 'date'}`} className="aa-brand-subcard p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="aa-product-pill-neutral">Versão {item?.version || '—'}</span>
                    <span className="aa-product-pill-neutral">{labelDate(item?.publishedAt)}</span>
                    <span className="aa-product-pill-neutral">Ator: {item?.actor || 'panel'}</span>
                    <span className="aa-product-pill-neutral">
                      Campos alterados: {Number(item?.totalChangedFields || 0)}
                    </span>
          <span className="aa-product-pill-neutral">
            Snapshot: {item?.snapshotAvailable ? 'Disponível' : 'Indisponível'}
          </span>
                  </div>

                  <p className="mt-3 text-sm font-semibold text-[#F3F7F5]">
                    {item?.summary || 'Publicação registrada.'}
                  </p>

                  {Array.isArray(item?.changedFields) && item.changedFields.length ? <div className="mt-3 flex flex-wrap gap-2">
                      {item.changedFields.slice(0, 6).map((field) => <span key={`${item?.id || item?.version || 'entry'}-${field?.key || field?.label || 'field'}`} className="aa-product-pill-neutral">
                          {field?.label || field?.key || 'Campo'}
                        </span>)}
                    </div> : <p className="mt-3 text-sm leading-6 text-[#B7C6C0]">
                      Sem mudanças estruturais detalhadas nesta publicação.
                    </p>}
                </div>) : <div className="aa-brand-subcard p-5">
                  <p className="aa-brand-copy text-sm">
                    Ainda não há publicações nesta linha do tempo. As próximas publicações aparecerão aqui com snapshot versionado.
                  </p>
                </div>}
            </div>
          </Section>

<Section title="Comparação entre versões publicadas" description="Escolha em “Versão a restaurar” a publicação que deve voltar como nova versão ativa e use “Versão de referência” apenas para visualizar a diferença.">
            {comparableHistory.length < 2 ? <div className="aa-brand-subcard p-5">
                <p className="aa-brand-copy text-sm">
                  É preciso ter pelo menos duas publicações com snapshot disponível para comparar versões.
                </p>
              </div> : <>
                <div className="grid gap-5 lg:grid-cols-2">
                  <Field label="Versão a restaurar">
                    <select className="aa-brand-input w-full px-4 py-3 text-sm" value={compareBaseId} onChange={(e) => setCompareBaseId(e.target.value)}>
                      {comparableHistory.map((item) => <option key={item.id} value={item.id}>
                          {`Versão ${item.version || '—'} · ${labelDate(item.publishedAt)}`}
                        </option>)}
                    </select>
                  </Field>

                  <Field label="Versão de referência">
                    <select className="aa-brand-input w-full px-4 py-3 text-sm" value={compareTargetId} onChange={(e) => setCompareTargetId(e.target.value)}>
                      {comparableHistory.map((item) => <option key={item.id} value={item.id}>
                          {`Versão ${item.version || '—'} · ${labelDate(item.publishedAt)}`}
                        </option>)}
                    </select>
                  </Field>
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                  <div className="aa-brand-metric p-4">
                    <p className="aa-brand-metric-label">Versão base</p>
                    <p className="aa-brand-metric-value mt-2 text-sm">
                      {compareBaseEntry ? `v${compareBaseEntry.version || '—'}` : '—'}
                    </p>
                  </div>

                  <div className="aa-brand-metric p-4">
                    <p className="aa-brand-metric-label">Versão comparada</p>
                    <p className="aa-brand-metric-value mt-2 text-sm">
                      {compareTargetEntry ? `v${compareTargetEntry.version || '—'}` : '—'}
                    </p>
                  </div>

                  <div className="aa-brand-metric p-4">
                    <p className="aa-brand-metric-label">Campos alterados</p>
                    <p className="aa-brand-metric-value mt-2 text-sm">
                      {versionDiffChangedCount}
                    </p>
                  </div>

                  <div className="aa-brand-metric p-4">
                    <p className="aa-brand-metric-label">Snapshots comparáveis</p>
                    <p className="aa-brand-metric-value mt-2 text-sm">
                      {comparableHistory.length}
                    </p>
                  </div>
                </div>

                <details className="aa-brand-card aa-assistant-disclosure aa-assistant-disclosure-central p-6">
                  <summary className="aa-assistant-disclosure-summary">
                    <div className="min-w-0">
                      <p className="aa-brand-kicker">Rollback controlado</p>
                      <h2 className="aa-brand-title mt-1 text-xl font-semibold">Restauração de versão</h2>
                      <p className="aa-assistant-disclosure-inline text-sm">{rollbackDisclosureSummary}</p>
                    </div>
                    <span className="aa-assistant-disclosure-chevron" aria-hidden="true">▾</span>
                  </summary>
                  <div className="aa-assistant-disclosure-body">
                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={() => setShowOnlyChangedFields((value) => !value)} className="aa-brand-btn-secondary px-4 py-3 text-sm font-semibold">
                    {showOnlyChangedFields ? 'Mostrar todos os campos' : 'Mostrar apenas diferenças'}
                  </button>

                  <button type="button" onClick={handleControlledRollbackToBaseVersion} disabled={!rollbackReady} className="aa-brand-btn-primary px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60">
                    {rollbackBusy ? 'Restaurando versão...' : compareBaseEntry ? `Restaurar versão ${compareBaseEntry.version || '—'}` : 'Restaurar versão base'}
                  </button>
                </div>
                <div className="aa-brand-subcard p-4">
                  <p className="aa-brand-copy text-sm">
                    O rollback controlado sempre restaura a versão escolhida em “Versão a restaurar”, publica isso como nova versão e preserva todo o histórico anterior. Se a versão escolhida já for a ativa, o rollback fica bloqueado para evitar republicação desnecessária.
                  </p>
                </div>
                  </div>
                </details>

                {!compareReady ? <div className="aa-brand-subcard p-5">
                    <p className="aa-brand-copy text-sm">
                      Escolha duas versões diferentes para liberar a comparação.
                    </p>
                  </div> : visibleVersionDiffRows.length ? <div className="space-y-3">
                    {visibleVersionDiffRows.map((row) => <div key={row.key} className="aa-brand-subcard p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="aa-product-pill-neutral">{row.label}</span>
                          <span className="aa-product-pill-neutral">Impacto: {row.impact}</span>
                          <span className="aa-product-pill-neutral">
                            {row.changed ? 'Alterado' : 'Sem mudança'}
                          </span>
                        </div>

                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <div>
                            <p className="aa-brand-metric-label">
                              {compareBaseEntry ? `Versão ${compareBaseEntry.version || '—'}` : 'Versão base'}
                            </p>
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#B7C6C0]">
                              {row.baseValue}
                            </p>
                          </div>

                          <div>
                            <p className="aa-brand-metric-label">
                              {compareTargetEntry ? `Versão ${compareTargetEntry.version || '—'}` : 'Versão comparada'}
                            </p>
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#E8F0EC]">
                              {row.targetValue}
                            </p>
                          </div>
                        </div>
                      </div>)}
                  </div> : <div className="aa-brand-subcard p-5">
                    <p className="aa-brand-copy text-sm">
                      Não há diferenças visíveis entre as duas versões selecionadas com o filtro atual.
                    </p>
                  </div>}
              </>}
          </Section>

</div>
            </div>
          </details>
          </div></div>

        <div className="aa-fixed-bottom-dock">
          <div className="aa-brand-sticky p-4">
            {typeof document !== "undefined"
  ? createPortal(
<div className="aa-product-sticky-actions" data-aa-action-dock="true" data-aa-action-dock-portal="body" data-aa-portal-phase="__AUTOATENDE_ASSISTANT_CENTRAL_ACTION_DOCK_BODY_PORTAL_V20_C2_A2__" data-aa-phase="__AUTOATENDE_ASSISTANT_CENTRAL_PREMIUM_ACTION_DOCK_V20_C2_A1_R2__">
              <div>
                <p className="text-sm font-semibold text-[#F3F7F5]">
                  {localHasChanges ? 'Há alterações pendentes para publicação.' : 'Rascunho e versão publicada estão em sincronia.'}
                </p>
                <p className="text-sm text-[#A8B5AF]">
                  Salvar rascunho não altera o bot. Publicar coloca a nova versão em produção para as próximas respostas.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row" data-aa-action-group="true">
                <button
                  type="button"
                  onClick={handleToggleAssistant}
                  disabled={
                    busy ||
                    publishBusy ||
                    activationBusy ||
                    (
                      !assistantEnabled &&
                      !assistantCanActivate
                    )
                  }
                  className={
                    assistantEnabled
                      ? 'aa-brand-btn-secondary px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60'
                      : 'aa-brand-btn-primary px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60'
                  }
                 data-aa-action="activation">
                  {activationBusy
                    ? 'Atualizando status...'
                    : assistantEnabled
                      ? 'Desativar assistente'
                      : 'Ativar assistente'}
                </button>

                <button type="button" onClick={handleDiscardDraft} disabled={busy || publishBusy} className="aa-brand-btn-secondary px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60" data-aa-action="discard">
                  {busy ? 'Processando...' : 'Descartar rascunho'}
                </button>

                <button type="button" onClick={handleSaveDraft} disabled={busy || publishBusy} className="aa-brand-btn-secondary px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60" data-aa-action="save">
                  {busy ? 'Salvando...' : 'Salvar rascunho'}
                </button>

                <button type="button" onClick={handlePublish} disabled={busy || publishBusy} className="aa-brand-btn-primary px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60" data-aa-action="publish">
                  {publishBusy ? 'Publicando...' : 'Publicar no bot'}
                </button>
              </div>
            </div>,
      document.body
    )
  : null}
<div data-aa-action-dock-spacer="true" aria-hidden="true" />
          </div>
        </div>
      </div>
    </div>);}
// __AUTOATENDE_V4_R10T_ASSISTANT_CENTER_HISTORY_BUTTON_REMOVED__
