/* __AUTOATENDE_C16N_C12F_B2C_D1_R2_PREVIEW_AUTHORITY_DISCLOSURE_LITERAL_JSX_FIX__ */
/* __AUTOATENDE_C16N_C12F_B2B_PREMIUM_SIMPLIFICATION_PASS_PHASE1__ PREVIEW */
import React, { useEffect, useMemo, useState } from 'react';


import { Link } from 'react-router-dom';

const STATE_API = '/api/company-commercial-profiles/assistant-central/state';
const PREVIEW_API = '/api/company-commercial-profiles/assistant-central/preview';
const HISTORY_KEY = 'autoatende_assistant_preview_history_v3';

/* __AUTOATENDE_P3_R6_R5_PREVIEW_AUTH_BINDING__ */
function extractTokenFromUnknown(value, depth = 0) {
  if (depth > 5 || value == null) return '';

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '';

    const looksLikeJson =
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'));

    if (looksLikeJson) {
      try {
        return extractTokenFromUnknown(JSON.parse(trimmed), depth + 1);
      } catch (_) {}
    }

    if (/^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/.test(trimmed)) {
      return trimmed;
    }

    return '';
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const token = extractTokenFromUnknown(item, depth + 1);
      if (token) return token;
    }
    return '';
  }

  if (typeof value === 'object') {
    const directKeys = [
      'access_token',
      'accessToken',
      'token',
      'authToken',
      'jwt'
    ];

    for (const key of directKeys) {
      if (value[key]) {
        const token = extractTokenFromUnknown(value[key], depth + 1);
        if (token) return token;
      }
    }

    const nestedKeys = [
      'session',
      'currentSession',
      'data',
      'auth',
      'supabase',
      'result'
    ];

    for (const key of nestedKeys) {
      if (value[key]) {
        const token = extractTokenFromUnknown(value[key], depth + 1);
        if (token) return token;
      }
    }

    for (const key of Object.keys(value).slice(0, 20)) {
      const token = extractTokenFromUnknown(value[key], depth + 1);
      if (token) return token;
    }
  }

  return '';
}

function getStoredToken() {
  try {
    const directStorageKeys = [
      'token',
      'authToken',
      'access_token',
      'adminToken',
      'jwt',
      'auth_token'
    ];

    for (const key of directStorageKeys) {
      const raw = window.localStorage.getItem(key);
      const token = extractTokenFromUnknown(raw);
      if (token) return token;
    }

    const runtimeCandidates = [
      window.__AUTOATENDE_SESSION__,
      window.__AUTOATENDE_AUTH__,
      window.__AUTOATENDE_AUTH__?.session,
      window.__AUTOATENDE_AUTH__?.currentSession
    ];

    for (const candidate of runtimeCandidates) {
      const token = extractTokenFromUnknown(candidate);
      if (token) return token;
    }

    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key) continue;

      if (/^sb-.*-auth-token$/i.test(key)) {
        const raw = window.localStorage.getItem(key);
        const token = extractTokenFromUnknown(raw);
        if (token) return token;
      }
    }
  } catch (_) {}

  return null;
}


async function apiRequest(url, options = {}) {
  const token = getStoredToken();

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token && !headers.Authorization) {
    headers.Authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
  }

  const response = await fetch(url, {
    credentials: 'include',
    ...options,
    headers
  });

  const text = await response.text();
  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch (_) {
    data = {};
  }

  if (!response.ok) {
    throw new Error(data?.message || data?.error || text || `HTTP ${response.status}`);
  }

  return data?.data || data;
}

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('pt-BR');
  } catch (_) {
    return value;
  }
}

function loadHistory() {
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function saveHistory(items) {
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 8)));
}

function providerLabel(provider) {
  if (provider === 'openai_hardened') return 'OpenAI + guard';
  if (provider === 'openai') return 'OpenAI';
  if (provider === 'fallback') return 'Fallback';
  return provider || '—';
}

const EXAMPLES = [
  { label: 'Funcionamento', text: 'Como a AutoAtendeAI funciona na prática?' },
  { label: 'Planos', text: 'Quais são os planos da AutoAtendeAI hoje?' },
  { label: 'Comercial', text: 'Como vocês ajudam uma empresa a atender melhor no WhatsApp?' },
  { label: 'Qualificação', text: 'Como o bot pode ajudar na qualificação de leads?' }
];

export default function AssistantPreviewProfessional() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [publishBusy, setPublishBusy] = useState(false);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [state, setState] = useState(null);
  const [sourceMode, setSourceMode] = useState('published');
  const [message, setMessage] = useState('Quais são os planos da AutoAtendeAI hoje?');
  const [responseText, setResponseText] = useState('');
  const [responseMeta, setResponseMeta] = useState(null);
  const [history, setHistory] = useState(() => loadHistory());

  async function loadState() {
    setLoading(true);
    setError('');
    setFlash('');

    try {
      const data = await apiRequest(STATE_API);
      setState(data);
    } catch (err) {
      setError(err.message || 'Falha ao carregar o estado da Central do Assistente.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadState();
  }, []);

  const sourceSummary = useMemo(() => {
    if (!state) return '';
    if (sourceMode === 'draft') {
      return state?.hasUnpublishedChanges
        ? 'Você está simulando o rascunho ainda não publicado. Isso é útil para validar mudanças antes de afetar o bot.'
        : 'O rascunho está igual ao publicado neste momento.';
    }
    return 'Escolha a versão que deseja testar e confira a resposta do assistente.';
  }, [state, sourceMode]);

  async function handleGeneratePreview() {
    setBusy(true);
    setError('');
    setFlash('');

    try {
      const data = await apiRequest(PREVIEW_API, {
        method: 'POST',
        body: JSON.stringify({
          sourceMode,
          message
        })
      });

      setResponseText(data?.response || '');
      setResponseMeta(data || null);
      setFlash('Resposta de teste gerada com sucesso.');

      const item = {
        id: Date.now(),
        at: new Date().toISOString(),
        sourceMode,
        message,
        response: data?.response || '',
        provider: data?.provider || 'unknown',
        qualityGuardApplied: Boolean(data?.qualityGuardApplied),
        usedFallback: Boolean(data?.usedFallback),
        handoffSimulation: data?.handoffSimulation || null
      };

      const nextHistory = [item, ...history].slice(0, 8);
      setHistory(nextHistory);
      saveHistory(nextHistory);
    } catch (err) {
      setError(err.message || 'Falha ao gerar a prévia.');
    } finally {
      setBusy(false);
    }
  }

  function handleReuse(item) {
    setMessage(item.message || '');
    setSourceMode(item.sourceMode || 'published');
    setResponseText(item.response || '');
    setResponseMeta({
      provider: item.provider || 'unknown',
      qualityGuardApplied: Boolean(item.qualityGuardApplied),
      usedFallback: Boolean(item.usedFallback),
      handoffSimulation: item.handoffSimulation || null,
      sourceMode: item.sourceMode || 'published'
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleClearHistory() {
    setHistory([]);
    saveHistory([]);
  }

  // __AUTOATENDE_C16N_C12D_B_FIX1_RUNTIME_AUTHORITY_UI__
  const [runtimeAuthority, setRuntimeAuthority] = React.useState(null);
  const [runtimeAuthorityLoading, setRuntimeAuthorityLoading] = React.useState(false);
  const [runtimeAuthorityError, setRuntimeAuthorityError] = React.useState('');
  // __AUTOATENDE_C16N_C12D_C_RUNTIME_AUTHORITY_POLISH__
  const [runtimePromptExpanded, setRuntimePromptExpanded] = React.useState(false);
  const [runtimePromptCopied, setRuntimePromptCopied] = React.useState(false);
  // __AUTOATENDE_C16N_C12D_DB_FIX2_RUNTIME_VS_SNAPSHOT__
  const [snapshotAuthority, setSnapshotAuthority] = React.useState(null);
  const [snapshotAuthorityLoading, setSnapshotAuthorityLoading] = React.useState(false);
  const [snapshotAuthorityError, setSnapshotAuthorityError] = React.useState('');

  const aaRuntimeAuthorityDeepFind = React.useCallback((value, depth = 0) => {
    if (value == null || depth > 5) return '';

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return '';

      try {
        const parsed = JSON.parse(trimmed);
        const nested = aaRuntimeAuthorityDeepFind(parsed, depth + 1);
        if (nested) return nested;
      } catch (_err) {}

      if (trimmed.startsWith('eyJ')) return trimmed;
      return '';
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        const found = aaRuntimeAuthorityDeepFind(item, depth + 1);
        if (found) return found;
      }
      return '';
    }

    if (typeof value === 'object') {
      if (typeof value.access_token === 'string' && value.access_token.trim()) {
        return value.access_token.trim();
      }

      for (const raw of Object.values(value)) {
        const found = aaRuntimeAuthorityDeepFind(raw, depth + 1);
        if (found) return found;
      }
    }

    return '';
  }, []);

  const resolveRuntimeAuthorityAccessToken = React.useCallback(() => {
    if (typeof window === 'undefined') return '';

    const directCandidates = [
      window.__AUTOATENDE_SESSION__,
      window.__AUTOATENDE_AUTH__,
      window.__AUTOATENDE_USER__,
    ];

    for (const candidate of directCandidates) {
      const token = aaRuntimeAuthorityDeepFind(candidate);
      if (token) return token;
    }

    try {
      const keys = Object.keys(window.localStorage || {});
      for (const key of keys) {
        const raw = window.localStorage.getItem(key);
        const token = aaRuntimeAuthorityDeepFind(raw);
        if (token) return token;
      }
    } catch (_err) {}

    return '';
  }, [aaRuntimeAuthorityDeepFind]);

  const resolveRuntimeAuthorityCompanyId = React.useCallback(() => {
    const directCandidates = [
      state?.meta?.company_id,
      state?.meta?.companyId,
      state?.published?.company_id,
      state?.published?.companyId,
      state?.draft?.company_id,
      state?.draft?.companyId,
      state?.published?.company?.id,
      state?.draft?.company?.id,
    ];

    for (const value of directCandidates) {
      const normalized = String(value || '').trim();
      if (normalized) return normalized;
    }

    const scanObject = (value, depth = 0) => {
      if (value == null || depth > 5) return '';

      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return '';
        try {
          const parsed = JSON.parse(trimmed);
          return scanObject(parsed, depth + 1);
        } catch (_err) {
          return '';
        }
      }

      if (Array.isArray(value)) {
        for (const item of value) {
          const found = scanObject(item, depth + 1);
          if (found) return found;
        }
        return '';
      }

      if (typeof value === 'object') {
        for (const [key, raw] of Object.entries(value)) {
          if (['company_id', 'companyId', 'client_id', 'clientId'].includes(key)) {
            const normalized = String(raw || '').trim();
            if (normalized) return normalized;
          }
          const nested = scanObject(raw, depth + 1);
          if (nested) return nested;
        }
      }

      return '';
    };

    if (typeof window === 'undefined') return '';

    const directWindowCandidates = [
      window.__AUTOATENDE_SESSION__,
      window.__AUTOATENDE_AUTH__,
      window.__AUTOATENDE_USER__,
    ];

    for (const candidate of directWindowCandidates) {
      const found = scanObject(candidate);
      if (found) return found;
    }

    try {
      const keys = Object.keys(window.localStorage || {});
      for (const key of keys) {
        const raw = window.localStorage.getItem(key);
        const found = scanObject(raw);
        if (found) return found;
      }
    } catch (_err) {}

    return '';
  }, [state]);

  const loadRuntimeAuthority = React.useCallback(async () => {
    setRuntimeAuthorityLoading(true);
    setRuntimeAuthorityError('');

    try {
      const accessToken = resolveRuntimeAuthorityAccessToken();
      const companyId = resolveRuntimeAuthorityCompanyId();

      let url = '/api/assistant-preview/runtime-authority';
      const params = new URLSearchParams();

      if (companyId) params.set('company_id', companyId);
      const qs = params.toString();
      if (qs) url += `?${qs}`;

      const headers = {};
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
      if (companyId) headers['x-company-id'] = companyId;

      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload?.ok) {
        const message =
          payload?.message ||
          payload?.error ||
          'Falha ao carregar a authority do runtime.';
        throw new Error(String(message));
      }

      setRuntimeAuthority(payload?.data || null);
    } catch (error) {
      setRuntimeAuthorityError(error?.message || 'Falha ao carregar a authority do runtime.');
      setRuntimeAuthority(null);
    } finally {
      setRuntimeAuthorityLoading(false);
    }
  }, [resolveRuntimeAuthorityAccessToken, resolveRuntimeAuthorityCompanyId]);


  const handleCopyRuntimePrompt = React.useCallback(async () => {
    const promptText = String(runtimeAuthority?.runtime_system_prompt || '').trim();
    if (!promptText) return;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(promptText);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = promptText;
        textarea.setAttribute('readonly', 'readonly');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      setRuntimePromptCopied(true);
      window.setTimeout(() => setRuntimePromptCopied(false), 1800);
    } catch (_error) {
      setRuntimeAuthorityError('Falha ao copiar o prompt efetivo.');
    }
  }, [runtimeAuthority?.runtime_system_prompt]);


  const loadSnapshotAuthority = React.useCallback(async () => {
    setSnapshotAuthorityLoading(true);
    setSnapshotAuthorityError('');

    try {
      const accessToken = resolveRuntimeAuthorityAccessToken();
      const companyId = resolveRuntimeAuthorityCompanyId();

      let url = '/api/assistant-preview/snapshot-authority';
      const params = new URLSearchParams();

      if (companyId) params.set('company_id', companyId);
      if (sourceMode) params.set('sourceMode', sourceMode);
      if (message?.trim()) params.set('message', message.trim());

      const qs = params.toString();
      if (qs) url += `?${qs}`;

      const headers = {};
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
      if (companyId) headers['x-company-id'] = companyId;

      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload?.ok) {
        const messageText =
          payload?.message ||
          payload?.error ||
          'Falha ao carregar o snapshot selecionado.';
        throw new Error(String(messageText));
      }

      setSnapshotAuthority(payload?.data || null);
    } catch (error) {
      setSnapshotAuthorityError(error?.message || 'Falha ao carregar o snapshot selecionado.');
      setSnapshotAuthority(null);
    } finally {
      setSnapshotAuthorityLoading(false);
    }
  }, [resolveRuntimeAuthorityAccessToken, resolveRuntimeAuthorityCompanyId, sourceMode, message]);

  React.useEffect(() => {
    if (!loading) {
      loadSnapshotAuthority();
    }
  }, [
    loading,
    sourceMode,
    message,
    state?.meta?.lastPublishedAt,
    state?.meta?.lastPublishedVersion,
    loadSnapshotAuthority
  ]);

  const runtimeChars = Number(runtimeAuthority?.runtime_system_prompt_length || 0);
  const snapshotChars = Number(snapshotAuthority?.snapshot_system_prompt_length || 0);
  const charsDelta = runtimeChars - snapshotChars;

  const comparisonStatus = (() => {
    if (!runtimeAuthority && !snapshotAuthority) {
      return {
        label: 'Comparação indisponível',
        summary: 'A comparação runtime x snapshot ainda não está disponível.'
      };
    }

    const hasUnpublishedChanges = Boolean(snapshotAuthority?.snapshot_summary?.hasUnpublishedChanges);

    if (sourceMode === 'draft' && hasUnpublishedChanges) {
      return {
        label: 'Há divergência',
        summary: 'Você está comparando um rascunho com mudanças não publicadas contra a produção atual.'
      };
    }

    if (sourceMode === 'draft' && !hasUnpublishedChanges) {
      return {
        label: 'Rascunho em sincronia',
        summary: 'O rascunho selecionado não indica mudanças pendentes relevantes em relação à produção.'
      };
    }

    if (sourceMode === 'published' && hasUnpublishedChanges) {
      return {
        label: 'Produção estável, rascunho pendente',
        summary: 'Você está vendo a produção publicada, mas existe um rascunho com mudanças ainda não publicadas.'
      };
    }

    return {
      label: 'Em sincronia operacional',
      summary: 'O snapshot selecionado corresponde à base publicada sem mudanças pendentes.'
    };
  })();

  const previewAuthorityDisclosureSummary = `${comparisonStatus.label} · Snapshot ${snapshotAuthority?.sourceMode || sourceMode} · Δ ${charsDelta >= 0 ? `+${charsDelta}` : String(charsDelta)} chars`;




  // __AUTOATENDE_C16N_C12D_EB_FIX1_DRAFT_CHANGE_SUMMARY__
  const normalizeDraftCompareValue = React.useCallback((value) => {
    if (value == null) return '';

    if (Array.isArray(value)) {
      return value
        .map((item) => normalizeDraftCompareValue(item))
        .filter(Boolean)
        .join(' | ')
        .trim();
    }

    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch (_error) {
        return '';
      }
    }

    return String(value).trim();
  }, []);

  const draftChangeSummary = React.useMemo(() => {
    const published = state?.published || {};
    const draft = state?.draft || {};

    const fieldMap = [
      { key: 'companyName', label: 'Nome da empresa', impact: 'alto' },
      { key: 'targetAudience', label: 'Público-alvo', impact: 'alto' },
      { key: 'toneOfVoice', label: 'Tom de voz', impact: 'alto' },
      { key: 'companyContext', label: 'Contexto da empresa', impact: 'alto' },
      { key: 'guidance', label: 'Orientação do negócio', impact: 'alto' },
      { key: 'services', label: 'Serviços', impact: 'médio' },
      { key: 'forbiddenTopics', label: 'Tópicos proibidos', impact: 'alto' },
      { key: 'faqJson', label: 'FAQ / base de conhecimento', impact: 'médio' },
    ];

    const changes = fieldMap
      .map((field) => {
        const before = normalizeDraftCompareValue(published?.[field.key]);
        const after = normalizeDraftCompareValue(draft?.[field.key]);

        if (before === after) return null;

        return {
          ...field,
          before,
          after,
          beforePreview: before || 'N/D',
          afterPreview: after || 'N/D'
        };
      })
      .filter(Boolean);

    const highImpact = changes.filter((item) => item.impact === 'alto').length;
    const mediumImpact = changes.filter((item) => item.impact === 'médio').length;

    return {
      total: changes.length,
      highImpact,
      mediumImpact,
      changes
    };
  }, [state, normalizeDraftCompareValue]);


  // __AUTOATENDE_C16N_C12D_F1_FIX1_PUBLISH_GATE__
  const previewSourceLabel = String(
    responseMeta?.snapshotLabel ||
    responseMeta?.snapshot ||
    responseMeta?.sourceMode ||
    ''
  ).trim().toLowerCase();

  const draftPreviewReady =
    Boolean(String(responseText || '').trim()) &&
    (
      previewSourceLabel.includes('draft') ||
      previewSourceLabel.includes('rascunho')
    );

  const gateChecklist = React.useMemo(() => {
    return [
      {
        key: 'runtime',
        label: 'Authority do runtime carregada',
        ok: Boolean(runtimeAuthority?.runtime_system_prompt)
      },
      {
        key: 'comparison',
        label: 'Comparação runtime vs snapshot carregada',
        ok: Boolean(snapshotAuthority?.snapshot_system_prompt)
      },
      {
        key: 'draft_changes',
        label: 'Rascunho com mudanças pendentes',
        ok: Boolean(state?.hasUnpublishedChanges)
      },
      {
        key: 'draft_preview',
        label: 'Prévia recente do rascunho gerada',
        ok: Boolean(draftPreviewReady)
      }
    ];
  }, [
    runtimeAuthority?.runtime_system_prompt,
    snapshotAuthority?.snapshot_system_prompt,
    state?.hasUnpublishedChanges,
    draftPreviewReady
  ]);

  const gateReadyCount = gateChecklist.filter((item) => item.ok).length;

  const publishGateStatus = React.useMemo(() => {
    if (!state?.hasUnpublishedChanges) {
      return {
        label: 'Sem mudanças para publicar',
        summary: 'O publicado e o rascunho estão alinhados. Não existe versão pendente para publicação agora.',
      };
    }

    if (sourceMode !== 'draft') {
      return {
        label: 'Troque para rascunho',
        summary: 'Há mudanças pendentes, mas a tela ainda está olhando para o publicado. Troque para rascunho antes de publicar.',
      };
    }

    if (!runtimeAuthority?.runtime_system_prompt || !snapshotAuthority?.snapshot_system_prompt) {
      return {
        label: 'Revisão técnica incompleta',
        summary: 'Antes de publicar, carregue a authority do runtime e a comparação com o snapshot.',
      };
    }

    if (!draftPreviewReady) {
      return {
        label: 'Gere prévia do rascunho',
        summary: 'As mudanças já existem, mas ainda falta uma prévia recente do rascunho para validar o comportamento antes da publicação.',
      };
    }

    return {
      label: 'Pronto para publicar',
      summary: 'A revisão operacional foi concluída: o rascunho tem mudanças, o comparativo foi carregado e existe uma prévia recente do rascunho.',
    };
  }, [
    state?.hasUnpublishedChanges,
    sourceMode,
    runtimeAuthority?.runtime_system_prompt,
    snapshotAuthority?.snapshot_system_prompt,
    draftPreviewReady
  ]);



  // __AUTOATENDE_C16N_C12D_F2B_REAL_PUBLISH_CTA__
  const PUBLISH_API = "/api/company-commercial-profiles/assistant-central/publish";
  const PUBLISH_METHOD = "POST";


  // __AUTOATENDE_C16N_C12D_F2C_POST_PUBLISH_POLISH__
  const publishGateSecondaryLabel = state?.hasUnpublishedChanges
    ? `Checklist: ${gateReadyCount}/${gateChecklist.length}`
    : 'Checklist encerrado';

  function handleOpenAssistantCentral() {
    window.location.assign('/configuracoes/assistente-central');
  }


  const canPublishNow =
    publishGateStatus?.label === 'Pronto para publicar' &&
    sourceMode === 'draft' &&
    Boolean(state?.hasUnpublishedChanges);

  function humanizePublishError(message = '') {
    const text = String(message || '').trim();
    if (!text) return 'Falha inesperada ao publicar o rascunho.';
    if (/Token de autenticação não fornecido/i.test(text)) return 'Token de autenticação não fornecido';
    if (/ASSISTANT_CENTRAL_DRAFT_EMPTY/i.test(text)) return 'O rascunho está vazio. Preencha os dados antes de publicar.';
    if (/COMPANY_ID_NOT_RESOLVED/i.test(text)) return 'Não foi possível resolver a empresa ativa para publicação.';
    return text;
  }

  async function handlePublishDraftNow() {
    if (!canPublishNow || publishBusy) return;

    const confirmed = window.confirm(
      'Publicar o rascunho agora?\n\nIsso vai promover a versão atual do rascunho para produção.'
    );

    if (!confirmed) return;

    setPublishBusy(true);
    setError('');
    setFlash('');

    try {
      await apiRequest(PUBLISH_API, {
        method: PUBLISH_METHOD
      });

      setFlash('Rascunho publicado com sucesso.');
      setSourceMode('published');

      await loadState();
      try { await loadRuntimeAuthority(); } catch (_) {}
      try { await loadSnapshotAuthority(); } catch (_) {}
    } catch (err) {
      setError(humanizePublishError(err?.message || ''));
    } finally {
      setPublishBusy(false);
    }
  }

  async function handleReloadPublishGate() {
    setError('');
    setFlash('');

    try {
      await loadState();
      try { await loadRuntimeAuthority(); } catch (_) {}
      try { await loadSnapshotAuthority(); } catch (_) {}
      setFlash('Validações recarregadas com sucesso.');
    } catch (err) {
      setError(err?.message || 'Falha ao recarregar validações.');
    }
  }


  const draftChangeStatus = React.useMemo(() => {
    if (!state?.hasUnpublishedChanges) {
      return {
        label: 'Sem mudanças pendentes',
        summary: 'O rascunho está alinhado ao publicado. Não há mudanças estruturais pendentes para revisão.'
      };
    }

    if (draftChangeSummary.highImpact > 0) {
      return {
        label: 'Mudanças de alto impacto',
        summary: 'O rascunho altera campos centrais que mudam diretamente o comportamento comercial da IA.'
      };
    }

    return {
      label: 'Mudanças moderadas',
      summary: 'Há mudanças publicáveis no rascunho, mas sem alterar os campos mais críticos da base.'
    };
  }, [state?.hasUnpublishedChanges, draftChangeSummary]);


  const runtimeAuthorityGeneratedAtLabel = runtimeAuthority?.generated_at
    ? formatDate(runtimeAuthority.generated_at)
    : '—';

  const runtimeAuthorityCompanyLabel = runtimeAuthority?.company_id || '—';


  React.useEffect(() => {
    if (!loading) {
      loadRuntimeAuthority();
    }
  }, [
    loading,
    state?.meta?.lastPublishedAt,
    state?.meta?.lastPublishedVersion,
    loadRuntimeAuthority
  ]);



  if (loading) {
    return (
      <div className="aa-page-shell aa-settings-shell aa-assistant-compact-page aa-assistant-preview-r10v-scope __AUTOATENDE_V4_R10X_R1_ASSISTANT_TEST_COPY_CONSISTENCY_AUDIT__ __AUTOATENDE_V4_R10W_R1_FIX2_PREVIEW_COPY_TO_ASSISTANT_TEST_LANGUAGE__ __AUTOATENDE_V4_R10V_R1_FIX_ASSISTANT_PREVIEW_PROFESSIONAL_POLISH__">
        <div className="aa-brand-container">
          <div className="aa-brand-card p-6">
            <p className="aa-brand-copy text-sm">Carregando teste do assistente...</p>
          </div>
        </div>
      </div>
    );
  }

  
  /* __AUTOATENDE_V4_R10V_R9_SIMPLE_PREVIEW_RESULT_CARD_FROM_STATE__:DERIVED_START */
  const aaR10v9ExtractPreviewText = (value, depth = 0) => {
    if (!value || depth > 5) return '';

    if (typeof value === 'string') {
      return value.trim();
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        const extracted = aaR10v9ExtractPreviewText(item, depth + 1);
        if (extracted) return extracted;
      }
      return '';
    }

    if (typeof value === 'object') {
      const preferredKeys = [
        'answer',
        'assistantAnswer',
        'assistant_answer',
        'assistantResponse',
        'assistant_response',
        'response',
        'reply',
        'content',
        'text',
        'message',
        'output',
        'result',
        'preview',
        'previewText',
        'preview_text',
        'completion',
      ];

      for (const key of preferredKeys) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
          const extracted = aaR10v9ExtractPreviewText(value[key], depth + 1);
          if (extracted) return extracted;
        }
      }

      for (const key of Object.keys(value)) {
        if (/answer|response|reply|content|text|message|preview|output|result/i.test(key)) {
          const extracted = aaR10v9ExtractPreviewText(value[key], depth + 1);
          if (extracted) return extracted;
        }
      }
    }

    return '';
  };

  const aaR10v9PreviewText = aaR10v9ExtractPreviewText([responseText, responseMeta, history]);
  /* __AUTOATENDE_V4_R10V_R9_SIMPLE_PREVIEW_RESULT_CARD_FROM_STATE__:DERIVED_END */

return (
    <div
      className="aa-page-shell aa-settings-shell aa-assistant-preview-r10v-scope aa-preview-premium-workspace-v20-d2-b1 __AUTOATENDE_V4_R10V_R2_FIX_APPLY_SCOPE_TO_LOADED_PREVIEW_PAGE__"
      data-aa-preview-source={sourceMode}
      data-aa-preview-state={busy ? 'loading' : aaR10v9PreviewText ? 'ready' : 'idle'}
      data-aa-preview-workspace="premium"
    >
      <div className="aa-brand-container space-y-6">
        <div className="aa-brand-card aa-product-hero aa-preview-workspace-hero p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="aa-brand-kicker">TESTE DO ASSISTENTE</p>
              <h1 className="aa-product-hero-title mt-2">Teste do Assistente</h1>
              <p className="aa-product-hero-copy mt-3 text-sm">
                Envie uma pergunta e veja como o assistente responderia ao cliente antes de usar em produção.
              </p>
            </div>

            <div className="aa-preview-hero-status flex flex-wrap gap-2">
              <span className="aa-product-pill-neutral">
                Fonte: {sourceMode === 'draft' ? 'Rascunho' : 'Publicado'}
              </span>
              <span className={state?.hasUnpublishedChanges ? 'aa-product-pill-neutral' : 'aa-product-pill-success'}>
                {state?.hasUnpublishedChanges ? 'Mudanças pendentes' : 'Em sincronia'}
              </span>
            </div>
          </div>

          <div className="aa-preview-context-strip mt-5 grid gap-3 lg:grid-cols-4">
            <div className="aa-brand-metric p-4">
              <p className="aa-brand-metric-label">Empresa</p>
              <p className="aa-brand-metric-value mt-2 text-sm">
                {state?.draft?.companyName || state?.published?.companyName || 'AutoAtendeAI'}
              </p>
            </div>

            <div className="aa-brand-metric p-4">
              <p className="aa-brand-metric-label">Versão publicada</p>
              <p className="aa-brand-metric-value mt-2 text-sm">
                {state?.meta?.lastPublishedVersion || 0}
              </p>
            </div>

            <div className="aa-brand-metric p-4">
              <p className="aa-brand-metric-label">Última publicação</p>
              <p className="aa-brand-metric-value mt-2 text-sm">
                {formatDate(state?.meta?.lastPublishedAt)}
              </p>
            </div>

            <div className="aa-brand-metric p-4">
              <p className="aa-brand-metric-label">Status do rascunho</p>
              <p className="aa-brand-metric-value mt-2 text-sm">
                {state?.hasUnpublishedChanges ? 'Há mudanças não publicadas' : 'Rascunho em sincronia'}
              </p>
            </div>
          </div>
        </div>

        {flash ? (
          <div className="aa-brand-info p-4 text-sm">{flash}</div>
        ) : null}

        {error ? (
          <div className="aa-brand-danger p-4 text-sm">{error}</div>
        ) : null}

        <div className="aa-preview-workspace-grid grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
          <div className="aa-brand-card p-6 aa-preview-test-panel aa-preview-workspace-composer __AUTOATENDE_V4_R10V_R4_PREVIEW_SIMPLE_TEST_MODE__">
            <div className="flex flex-col gap-4">
              <div>
                <p className="aa-brand-kicker">Área de teste</p>
                <h2 className="aa-brand-title mt-2 text-xl font-semibold">Teste uma pergunta</h2>
                <p className="aa-brand-copy mt-2 text-sm">{sourceSummary}</p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setSourceMode('published')}
                  aria-pressed={sourceMode === 'published'}
                  className={`${sourceMode === 'published' ? 'aa-brand-btn-primary' : 'aa-brand-btn-secondary'} aa-preview-source-option px-4 py-3 text-sm font-semibold`}
                >
                  Usar publicado
                </button>

                <button
                  type="button"
                  onClick={() => setSourceMode('draft')}
                  aria-pressed={sourceMode === 'draft'}
                  className={`${sourceMode === 'draft' ? 'aa-brand-btn-primary' : 'aa-brand-btn-secondary'} aa-preview-source-option px-4 py-3 text-sm font-semibold`}
                >
                  Usar rascunho
                </button>
              </div>

              {sourceMode === 'draft' && state?.hasUnpublishedChanges ? (
                <div className="aa-brand-warning p-4 text-sm">
                  Você está simulando alterações ainda não publicadas. Esse teste é o melhor ponto para calibrar a resposta antes de impactar o bot.
                </div>
              ) : null}

              <div className="aa-brand-subcard aa-preview-quick-actions p-4">
                <p className="aa-brand-metric-label">Exemplos rápidos</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {EXAMPLES.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => setMessage(item.text)}
                      className="aa-brand-btn-secondary px-3 py-2 text-xs font-semibold"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-[#D9E2DD]">
                  Pergunta de teste
                </label>
                <textarea
                  rows={8}
                  aria-label="Pergunta de teste"
                  className="aa-brand-textarea aa-preview-question-input px-4 py-3 text-sm"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Digite a pergunta que você quer simular..."
                />
              </div>

              <div className="aa-preview-composer-actions flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleGeneratePreview}
                  disabled={busy}
                  className="aa-brand-btn-primary aa-preview-generate-button px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy ? 'Gerando prévia...' : 'Gerar resposta de teste'}
                </button>

                <button
                  type="button"
                  onClick={() => setMessage('')}
                  disabled={busy}
                  className="aa-brand-btn-secondary aa-preview-clear-button px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Limpar pergunta
                </button>
              </div>
            </div>
          </div>

          {/* __AUTOATENDE_V4_R10V_R9_SIMPLE_PREVIEW_RESULT_CARD_FROM_STATE__:CARD_START */}
          <div className="aa-brand-card aa-preview-simple-result-panel aa-preview-workspace-result __AUTOATENDE_V4_R10V_R9_SIMPLE_PREVIEW_RESULT_CARD_FROM_STATE__">
            <div className="flex flex-col gap-3">
              <div>
                <p className="aa-brand-kicker">Resultado do teste</p>
                <h2 className="aa-brand-title mt-2 text-xl font-semibold">Resposta do assistente</h2>
                <p className="aa-brand-copy mt-2 text-sm">
                  Confira abaixo como o assistente responderia ao cliente.
                </p>
              </div>

              <div
                className="aa-preview-response-meta flex flex-wrap gap-2"
                data-aa-preview-microcopy="pt-BR"
              >
                <span className="aa-product-pill-neutral">
                  Fonte: {(responseMeta?.sourceMode || sourceMode) === 'draft' ? 'Rascunho' : 'Publicado'}
                </span>
                <span className="aa-product-pill-neutral">
                  Modelo: {providerLabel(responseMeta?.provider)}
                </span>
                {responseMeta?.qualityGuardApplied ? (
                  <span className="aa-product-pill-success">Quality guard</span>
                ) : null}
                {responseMeta?.usedFallback ? (
                  <span className="aa-product-pill-neutral">Fallback utilizado</span>
                ) : null}
              </div>

              {/* __AUTOATENDE_PREVIEW_HANDOFF_SIMULATION_NOTICE_V20_E1_B7_R3__ */}
              {responseMeta?.handoffSimulation?.active ? (
                <div
                  className="aa-preview-handoff-simulation-notice"
                  role="status"
                  data-aa-preview-handoff-simulation="true"
                >
                  <p className="aa-preview-handoff-simulation-notice__title">
                    {responseMeta?.handoffSimulation?.label || 'Simulação de transbordo'}
                  </p>
                  <p className="aa-preview-handoff-simulation-notice__copy">
                    {responseMeta?.handoffSimulation?.notice || 'Nenhuma ação real foi executada.'}
                  </p>
                </div>
              ) : null}

              <div
                className={`aa-preview-simple-result-box aa-preview-response-surface ${busy ? 'is-loading' : aaR10v9PreviewText ? 'has-response' : 'is-empty'}`}
                aria-live="polite"
                aria-busy={busy}
              >
                {aaR10v9PreviewText ? (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#E7F4EF]">
                    {aaR10v9PreviewText}
                  </p>
                ) : (
                  <p className="text-sm leading-relaxed text-[#8FA59D]">
                    Gere uma resposta de teste para visualizar o comportamento do assistente.
                  </p>
                )}
              </div>
            </div>
          </div>
          {/* __AUTOATENDE_V4_R10V_R9_SIMPLE_PREVIEW_RESULT_CARD_FROM_STATE__:CARD_END */}


        <div className="aa-brand-card p-6 __AUTOATENDE_V4_R10V_R4_PREVIEW_SIMPLE_TEST_MODE__ aa-preview-advanced-panel">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-2">
                      <p className="aa-brand-kicker">Gate de publicação</p>
                      <h2 className="aa-brand-title mt-1 text-xl font-semibold">Está seguro publicar agora?</h2>
                      <p className="aa-brand-copy text-sm">
                        Este gate consolida as validações mínimas antes de promover o rascunho para produção.
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span className="aa-product-pill-neutral">
                        {publishGateStatus.label}
                      </span>
                      <span className="aa-product-pill-neutral">
                        {publishGateSecondaryLabel}
                      </span>
                    </div>
                  </div>

                  <div className="aa-brand-subcard mt-5 p-5">
                    <p className="text-sm font-semibold text-[#F3F7F5]">{publishGateStatus.summary}</p>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {gateChecklist.map((item) => (
                        <div key={item.key} className="aa-brand-metric p-4">
                          <p className="aa-brand-metric-label">{item.label}</p>
                          <p className="aa-brand-metric-value mt-2 text-sm">
                            {item.key === 'draft_changes' && !state?.hasUnpublishedChanges
                              ? 'Não aplicável'
                              : item.ok
                                ? 'OK'
                                : 'Pendente'}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-3">
                      <div className="aa-brand-metric p-4">
                        <p className="aa-brand-metric-label">Snapshot em foco</p>
                        <p className="aa-brand-metric-value mt-2 text-sm">
                          {sourceMode === 'draft' ? 'Rascunho' : 'Publicado'}
                        </p>
                      </div>

                      <div className="aa-brand-metric p-4">
                        <p className="aa-brand-metric-label">Mudanças pendentes</p>
                        <p className="aa-brand-metric-value mt-2 text-sm">
                          {state?.hasUnpublishedChanges ? 'Sim' : 'Não'}
                        </p>
                      </div>

                      <div className="aa-brand-metric p-4">
                        <p className="aa-brand-metric-label">Prévia recente do rascunho</p>
                        <p className="aa-brand-metric-value mt-2 text-sm">
                          {draftPreviewReady ? 'Validada' : 'Ausente'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                      {state?.hasUnpublishedChanges ? (
                        <button
                          type="button"
                          onClick={handlePublishDraftNow}
                          disabled={!canPublishNow || publishBusy}
                          className="aa-brand-btn-primary px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {publishBusy ? 'Publicando rascunho...' : 'Publicar rascunho agora'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleOpenAssistantCentral}
                          className="aa-brand-btn-secondary px-4 py-3 text-sm font-semibold"
                        >
                          Editar rascunho
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={handleReloadPublishGate}
                        disabled={publishBusy}
                        className="aa-brand-btn-secondary px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Recarregar validações
                      </button>
                    </div>

                    <div className="mt-4 aa-brand-subcard p-4">
                      <p className="aa-brand-copy text-sm">
                        {state?.hasUnpublishedChanges
                          ? <>A publicação real só fica liberada quando o gate atingir <strong>Pronto para publicar</strong>.</>
                          : 'Não há alterações pendentes. Para uma nova publicação, volte à Central do Assistente e edite o rascunho.'}
                      </p>
                    </div>
                  </div>
                </div>


          <div className="space-y-6">
            
          <div className="aa-brand-card p-6 aa-preview-advanced-panel __AUTOATENDE_V4_R10V_R4_PREVIEW_SIMPLE_TEST_MODE__">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-2">
                <p className="aa-brand-kicker">Authority do runtime</p>
                <h2 className="aa-brand-title mt-1 text-xl font-semibold">Prompt efetivo em produção</h2>
                <p className="aa-brand-copy text-sm">
                  Esta seção lê a fonte de verdade do runtime para mostrar o prompt realmente usado hoje em produção.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={loadRuntimeAuthority}
                  disabled={runtimeAuthorityLoading}
                  className="aa-brand-btn-secondary px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {runtimeAuthorityLoading ? 'Atualizando...' : 'Recarregar authority'}
                </button>

                <button
                  type="button"
                  onClick={handleCopyRuntimePrompt}
                  disabled={runtimeAuthorityLoading || !runtimeAuthority?.runtime_system_prompt}
                  className="aa-brand-btn-secondary px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {runtimePromptCopied ? 'Prompt copiado' : 'Copiar prompt'}
                </button>

                <button
                  type="button"
                  onClick={() => setRuntimePromptExpanded((value) => !value)}
                  disabled={!runtimeAuthority?.runtime_system_prompt}
                  className="aa-brand-btn-secondary px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {runtimePromptExpanded ? 'Recolher prompt' : 'Expandir prompt'}
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="aa-product-pill-neutral">
                Fonte: {runtimeAuthority?.authority_source || '—'}
              </span>
              <span className="aa-product-pill-neutral">
                Helper: {runtimeAuthority?.runtime_helper_file || '—'}
              </span>
              <span className="aa-product-pill-neutral">
                Empresa: {runtimeAuthorityCompanyLabel}
              </span>
              <span className="aa-product-pill-neutral">
                Chars: {runtimeAuthority?.runtime_system_prompt_length || 0}
              </span>
              <span className="aa-product-pill-neutral">
                Gerado em: {runtimeAuthorityGeneratedAtLabel}
              </span>
            </div>

            {runtimeAuthorityError ? (
              <div className="aa-brand-danger mt-4 p-4 text-sm">{runtimeAuthorityError}</div>
            ) : null}

            {runtimePromptCopied ? (
              <div className="aa-brand-info mt-4 p-3 text-xs">
                Prompt efetivo copiado para a área de transferência.
              </div>
            ) : null}

            <div className="mt-5">
              {runtimeAuthorityLoading ? (
                <div className="aa-brand-subcard p-5">
                  <p className="aa-brand-copy text-sm">Carregando authority do runtime...</p>
                </div>
              ) : runtimeAuthority?.runtime_system_prompt ? (
                <div
                  className="aa-brand-subcard p-5"
                  style={{
                    maxHeight: runtimePromptExpanded ? 520 : 220,
                    overflow: 'auto',
                    transition: 'max-height 160ms ease'
                  }}
                >
                  <p className="whitespace-pre-wrap text-sm leading-7 text-[#E8F0EC]">
                    {runtimeAuthority.runtime_system_prompt}
                  </p>
                </div>
              ) : (
                <div className="aa-brand-subcard p-5">
                  <p className="aa-brand-copy text-sm">
                    Authority do runtime indisponível no momento.
                  </p>
                </div>
              )}
            </div>
          </div>

<div className="aa-brand-card p-6 aa-preview-advanced-panel __AUTOATENDE_V4_R10V_R4_PREVIEW_SIMPLE_TEST_MODE__">
              <div className="flex flex-col gap-2">
                <details className="aa-brand-card aa-assistant-disclosure aa-assistant-disclosure-authority p-6">
                  <summary className="aa-assistant-disclosure-summary">
                    <div className="min-w-0">
                      <p className="aa-brand-kicker">Runtime vs Snapshot</p>
                      <h2 className="aa-brand-title mt-1 text-xl font-semibold">Comparação operacional</h2>
                      <p className="aa-assistant-disclosure-inline text-sm">
                        {previewAuthorityDisclosureSummary}
                      </p>
                    </div>
                    <span className="aa-assistant-disclosure-chevron" aria-hidden="true">▾</span>
                  </summary>
                  <div className="aa-assistant-disclosure-body">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-wrap gap-2">
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="aa-product-pill-neutral">{comparisonStatus.label}</span>
                    <span className="aa-product-pill-neutral">
                      Snapshot: {snapshotAuthority?.sourceMode || sourceMode}
                    </span>
                    <span className="aa-product-pill-neutral">
                      Runtime chars: {runtimeChars}
                    </span>
                    <span className="aa-product-pill-neutral">
                      Snapshot chars: {snapshotChars}
                    </span>
                    <span className="aa-product-pill-neutral">
                      Δ chars: {charsDelta >= 0 ? `+${charsDelta}` : String(charsDelta)}
                    </span>
                  </div>
                      </div>
                    <button
                      type="button"
                      onClick={loadSnapshotAuthority}
                      disabled={snapshotAuthorityLoading}
                      className="aa-brand-btn-secondary px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {snapshotAuthorityLoading ? 'Atualizando...' : 'Atualizar comparação'}
                    </button>
                    </div>
                  {snapshotAuthorityError ? (
                    <div className="aa-brand-danger mt-4 p-4 text-sm">{snapshotAuthorityError}</div>
                  ) : null}
                  </div>
                </details>

                <div className="aa-brand-card p-6 aa-preview-advanced-panel __AUTOATENDE_V4_R10V_R4_PREVIEW_SIMPLE_TEST_MODE__">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-2">
                      <p className="aa-brand-kicker">Resumo do rascunho</p>
                      <h2 className="aa-brand-title mt-1 text-xl font-semibold">O que mudou antes de publicar</h2>
                      <p className="aa-brand-copy text-sm">
                        Este resumo mostra as mudanças estruturais entre o rascunho e a versão publicada da Central do Assistente.
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span className="aa-product-pill-neutral">
                        {draftChangeStatus.label}
                      </span>
                      <span className="aa-product-pill-neutral">
                        Campos alterados: {draftChangeSummary.total}
                      </span>
                    </div>
                  </div>

                  <div className="aa-brand-subcard mt-5 p-5">
                    <p className="text-sm font-semibold text-[#F3F7F5]">{draftChangeStatus.summary}</p>

                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <div className="aa-brand-metric p-4">
                        <p className="aa-brand-metric-label">Mudanças totais</p>
                        <p className="aa-brand-metric-value mt-2 text-sm">{draftChangeSummary.total}</p>
                      </div>

                      <div className="aa-brand-metric p-4">
                        <p className="aa-brand-metric-label">Impacto alto</p>
                        <p className="aa-brand-metric-value mt-2 text-sm">{draftChangeSummary.highImpact}</p>
                      </div>

                      <div className="aa-brand-metric p-4">
                        <p className="aa-brand-metric-label">Impacto médio</p>
                        <p className="aa-brand-metric-value mt-2 text-sm">{draftChangeSummary.mediumImpact}</p>
                      </div>
                    </div>

                    {draftChangeSummary.changes.length ? (
                      <div className="mt-5 space-y-3">
                        {draftChangeSummary.changes.map((item) => (
                          <div key={item.key} className="aa-brand-subcard p-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="aa-product-pill-neutral">{item.label}</span>
                              <span className="aa-product-pill-neutral">Impacto: {item.impact}</span>
                            </div>

                            <div className="mt-3 grid gap-3 md:grid-cols-2">
                              <div>
                                <p className="aa-brand-metric-label">Publicado</p>
                                <p className="mt-2 text-sm leading-6 text-[#B7C6C0] line-clamp-4">
                                  {item.beforePreview}
                                </p>
                              </div>

                              <div>
                                <p className="aa-brand-metric-label">Rascunho</p>
                                <p className="mt-2 text-sm leading-6 text-[#E8F0EC] line-clamp-4">
                                  {item.afterPreview}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-5 aa-brand-subcard p-5">
                        <p className="aa-brand-copy text-sm">
                          Não há diferenças estruturais relevantes entre o rascunho e o publicado neste momento.
                        </p>
                      </div>
                    )}
                  </div>
                </div>


                

                <p className="aa-brand-kicker">Resultado do teste</p>
                <h2 className="aa-brand-title mt-1 text-xl font-semibold">Resposta do assistente</h2>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="aa-product-pill-neutral">
                  Snapshot: {responseMeta?.sourceMode || sourceMode}
                </span>
                <span className="aa-product-pill-neutral">
                  Engine: {providerLabel(responseMeta?.provider)}
                </span>
                <span className={responseMeta?.usedFallback ? 'aa-product-pill-neutral' : 'aa-product-pill-success'}>
                  {responseMeta?.usedFallback ? 'Fallback usado' : 'Prévia IA'}
                </span>
                {responseMeta?.qualityGuardApplied ? (
                  <span className="aa-product-pill-neutral">Quality guard aplicado</span>
                ) : null}
              </div>

              <div className="aa-brand-subcard mt-5 p-5">
                {responseText ? (
                  <p className="whitespace-pre-wrap text-sm leading-7 text-[#E8F0EC]">{responseText}</p>
                ) : (
                  <p className="aa-brand-copy text-sm">
                    A prévia aparecerá aqui após a geração. O objetivo é validar a resposta antes da publicação.
                  </p>
                )}
              </div>
            </div>

            <div className="aa-brand-card p-6 aa-preview-advanced-panel __AUTOATENDE_V4_R10V_R4_PREVIEW_SIMPLE_TEST_MODE__">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="aa-brand-kicker">Histórico local</p>
                  <h2 className="aa-brand-title mt-1 text-xl font-semibold">Últimas simulações</h2>
                </div>

                <button
                  type="button"
                  onClick={handleClearHistory}
                  className="aa-brand-btn-secondary px-3 py-2 text-xs font-semibold"
                >
                  Limpar histórico
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {history.length ? history.map((item) => (
                  <div key={item.id} className="aa-brand-subcard p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="aa-product-pill-neutral">{item.sourceMode}</span>
                      <span className="aa-product-pill-neutral">{formatDate(item.at)}</span>
                      <span className="aa-product-pill-neutral">{providerLabel(item.provider)}</span>
                    </div>

                    <p className="mt-3 text-sm font-semibold text-[#F3F7F5]">{item.message}</p>
                    <p className="mt-2 line-clamp-4 text-sm leading-6 text-[#B7C6C0]">{item.response}</p>

                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => handleReuse(item)}
                        className="aa-brand-btn-secondary px-3 py-2 text-xs font-semibold"
                      >
                        Reusar esta simulação
                      </button>
                    </div>
                  </div>
                )) : (
                  <p className="aa-brand-copy text-sm">
                    Nenhuma simulação registrada ainda neste navegador.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
