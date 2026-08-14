/* __AUTOATENDE_V4_R6C_DISPAROS_COMMERCIAL_COPY_ALIGNMENT__ */
import React from 'react';
import { useNavigate } from 'react-router-dom';


const PAGE_MARKER = '__AUTOATENDE_R10E_A2_FRONTEND_READONLY_SURFACE__';
const ENDPOINT = '/api/ops-surface/acquisition/recent';

function safeJsonParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function pickFirstNonEmpty(values = []) {
  for (const value of values) {
    if (value == null) continue;
    const normalized = String(value).trim();
    if (!normalized || normalized === 'undefined' || normalized === 'null') continue;
    return normalized;
  }
  return '';
}

function resolveAccessTokenCandidate(binding = {}, depth = 0) {
  if (depth > 5 || binding == null) return '';

  if (typeof binding === 'string') {
    const value = binding.trim();
    if (!value) return '';
    if (
      /^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/.test(value) ||
      value.startsWith('Bearer ')
    ) {
      return value;
    }
    try {
      return resolveAccessTokenCandidate(JSON.parse(value), depth + 1);
    } catch {
      return '';
    }
  }

  if (Array.isArray(binding)) {
    for (const item of binding) {
      const token = resolveAccessTokenCandidate(item, depth + 1);
      if (token) return token;
    }
    return '';
  }

  if (typeof binding === 'object') {
    const directKeys = ['access_token', 'accessToken', 'token', 'authToken', 'jwt'];
    for (const key of directKeys) {
      if (binding[key]) {
        const token = resolveAccessTokenCandidate(binding[key], depth + 1);
        if (token) return token;
      }
    }

    const nestedKeys = ['session', 'currentSession', 'data', 'auth', 'supabase', 'result'];
    for (const key of nestedKeys) {
      if (binding[key]) {
        const token = resolveAccessTokenCandidate(binding[key], depth + 1);
        if (token) return token;
      }
    }

    for (const key of Object.keys(binding).slice(0, 20)) {
      const token = resolveAccessTokenCandidate(binding[key], depth + 1);
      if (token) return token;
    }
  }

  return '';
}

function resolveAccessToken() {
  if (typeof window === 'undefined') return '';

  try {
    const directGlobals = [
      window.__AUTOATENDE_SESSION__,
      window.__AUTOATENDE_AUTH__,
      window.__AUTOATENDE_AUTH__?.session,
      window.__AUTOATENDE_AUTH__?.currentSession
    ];

    for (const entry of directGlobals) {
      const token = resolveAccessTokenCandidate(entry);
      if (token) return token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    }

    const storageKeys = ['token', 'authToken', 'access_token', 'adminToken', 'jwt', 'auth_token', 'auth_user', 'autoatende_user'];
    for (const key of storageKeys) {
      const raw = window.localStorage.getItem(key);
      const token = resolveAccessTokenCandidate(raw);
      if (token) return token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    }

    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key || !/^sb-.*-auth-token$/i.test(key)) continue;
      const raw = window.localStorage.getItem(key);
      const token = resolveAccessTokenCandidate(raw);
      if (token) return token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    }
  } catch {
    return '';
  }

  return '';
}

function resolveRole() {
  if (typeof window === 'undefined') return '';

  const candidates = [];

  try {
    candidates.push(window.__AUTOATENDE_AUTH__?.resolvedRole);
    candidates.push(window.__AUTOATENDE_USER__?.role);
    candidates.push(window.__AUTOATENDE_SESSION__?.user?.user_metadata?.role);
    candidates.push(window.__AUTOATENDE_SESSION__?.user?.app_metadata?.role);

    const authUser = safeJsonParse(window.localStorage.getItem('auth_user') || 'null');
    const autoUser = safeJsonParse(window.localStorage.getItem('autoatende_user') || 'null');

    candidates.push(authUser?.role);
    candidates.push(authUser?.resolvedRole);
    candidates.push(autoUser?.role);
    candidates.push(autoUser?.resolvedRole);
  } catch {
    return '';
  }

  return pickFirstNonEmpty(candidates).toLowerCase();
}

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('pt-BR');
  } catch {
    return String(value);
  }
}

function tiny(value) {
  const raw = String(value || '');
  if (!raw) return '—';
  if (raw.length <= 24) return raw;
  return `${raw.slice(0, 10)}...${raw.slice(-8)}`;
}

function FilterButton({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        border: active ? '1px solid rgba(16, 185, 129, 0.8)' : '1px solid rgba(148, 163, 184, 0.25)',
        background: active ? 'rgba(16, 185, 129, 0.12)' : 'rgba(15, 23, 42, 0.45)',
        color: '#e5e7eb',
        borderRadius: 999,
        padding: '8px 12px',
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: 600
      }}
    >
      {children}
    </button>
  );
}

function StatusPill({ status }) {
  const isBound = status === 'bound';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        borderRadius: 999,
        padding: '4px 10px',
        fontSize: 12,
        fontWeight: 700,
        border: isBound ? '1px solid rgba(16,185,129,0.55)' : '1px solid rgba(245,158,11,0.45)',
        background: isBound ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
        color: isBound ? '#6ee7b7' : '#fcd34d'
      }}
    >
      {isBound ? 'BOUND' : 'UNBOUND'}
    </span>
  );
}


function buildTemplatePreviewTextForInbox(template, fallbackName = '', fallbackLang = '', fallbackCategory = '') {
  const safeName = String(fallbackName || '').trim();
  const safeLang = String(fallbackLang || '').trim();
  const safeCategory = String(fallbackCategory || '').trim();

  if (template && typeof template === 'object') {
    const directPreview = String(
      template.previewText ||
      template.preview_text ||
      ''
    ).trim();

    if (directPreview) {
      return directPreview.slice(0, 1000);
    }

    const parts = [];
    const header = String(template.headerText || template.header || template.header_text || '').trim();
    const body = String(template.bodyText || template.body || template.body_text || '').trim();
    const footer = String(template.footerText || template.footer || template.footer_text || '').trim();

    if (header) parts.push(`HEADER: ${header}`);
    if (body) parts.push(`BODY: ${body}`);
    if (footer) parts.push(`FOOTER: ${footer}`);

    const composed = parts.join('\n\n').trim();
    if (composed) {
      return composed.slice(0, 1000);
    }

    const templateName = String(template.name || safeName || '').trim();
    const templateLang = String(template.language || safeLang || '').trim();
    const templateCategory = String(template.category || safeCategory || '').trim();

    return `[Template enviado] ${templateName}${templateLang ? ` • ${templateLang}` : ''}${templateCategory ? ` • ${templateCategory}` : ''}`.trim().slice(0, 1000);
  }

  return `[Template enviado] ${safeName}${safeLang ? ` • ${safeLang}` : ''}${safeCategory ? ` • ${safeCategory}` : ''}`.trim().slice(0, 1000);
}


/* __AUTOATENDE_C16N_C7B_R1_FIX1_DISPAROS_INDIVIDUAL_HARDENING__ */

// __AUTOATENDE_V4_R13C_R4E_R1_DIRECT_GUIDED_PARAMS_FIXED_SETSENDFORM__
function aaR13c4eR1SafeText(value) {
  return String(value ?? '').trim();
}

function aaR13c4eR1NormalizeType(value) {
  return aaR13c4eR1SafeText(value).toUpperCase();
}

function aaR13c4eR1AsArray(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') {
    if (Array.isArray(value.components)) return value.components;
    if (Array.isArray(value.parameters)) return value.parameters;
    if (Array.isArray(value.params)) return value.params;
  }
  return [];
}

function aaR13c4eR1TemplateComponents(template) {
  const direct = aaR13c4eR1AsArray(template?.components);
  if (direct.length) return direct;

  const nested = aaR13c4eR1AsArray(template?.template?.components);
  if (nested.length) return nested;

  const selectedNested = aaR13c4eR1AsArray(template?.selectedTemplate?.components);
  if (selectedNested.length) return selectedNested;

  return [];
}

function aaR13c4eR1GetComponentText(template, type) {
  const wanted = aaR13c4eR1NormalizeType(type);
  const components = aaR13c4eR1TemplateComponents(template);

  const component = components.find((entry) => aaR13c4eR1NormalizeType(entry?.type) === wanted);
  const fromComponent = aaR13c4eR1SafeText(component?.text || component?.content || component?.body);

  if (fromComponent) return fromComponent;

  if (wanted === 'HEADER') {
    return aaR13c4eR1SafeText(
      template?.headerText ||
      template?.header_text ||
      template?.header ||
      template?.template_header ||
      template?.selectedTemplate?.headerText ||
      template?.selectedTemplate?.header
    );
  }

  if (wanted === 'BODY') {
    return aaR13c4eR1SafeText(
      template?.bodyText ||
      template?.body_text ||
      template?.body ||
      template?.template_body ||
      template?.content ||
      template?.text ||
      template?.selectedTemplate?.bodyText ||
      template?.selectedTemplate?.body
    );
  }

  if (wanted === 'FOOTER') {
    return aaR13c4eR1SafeText(
      template?.footerText ||
      template?.footer_text ||
      template?.footer ||
      template?.template_footer ||
      template?.selectedTemplate?.footerText ||
      template?.selectedTemplate?.footer
    );
  }

  return '';
}

function aaR13c4eR1ExtractPlaceholders(text) {
  const found = [];
  const seen = new Set();
  const regex = /{{\s*(\d+)\s*}}/g;
  let match;

  while ((match = regex.exec(String(text || '')))) {
    const index = Number(match[1]);

    if (!Number.isFinite(index) || index <= 0) continue;
    if (seen.has(index)) continue;

    seen.add(index);
    found.push(index);
  }

  return found.sort((a, b) => a - b);
}

function aaR13c4eR1BuildParamSpecs(template) {
  if (!template) return [];

  const headerText = aaR13c4eR1GetComponentText(template, 'HEADER');
  const bodyText = aaR13c4eR1GetComponentText(template, 'BODY');

  const specs = [];

  for (const index of aaR13c4eR1ExtractPlaceholders(headerText)) {
    specs.push({
      component: 'header',
      index,
      label: `Header · parâmetro ${index}`
    });
  }

  for (const index of aaR13c4eR1ExtractPlaceholders(bodyText)) {
    specs.push({
      component: 'body',
      index,
      label: `Parâmetro ${index}`
    });
  }

  return specs;
}

function aaR13c4eR1BuildMetaComponents(specs, values) {
  const byComponent = new Map();

  for (const spec of specs) {
    const key = `${spec.component}:${spec.index}`;
    const value = aaR13c4eR1SafeText(values?.[key]);

    if (!value) continue;

    if (!byComponent.has(spec.component)) {
      byComponent.set(spec.component, []);
    }

    byComponent.get(spec.component).push({
      type: 'text',
      text: value
    });
  }

  return Array.from(byComponent.entries()).map(([type, parameters]) => ({
    type,
    parameters
  }));
}

function aaR13c4eR1ApplyValuesToText(text, component, specs, values) {
  let output = String(text || '');

  for (const spec of specs.filter((entry) => entry.component === component)) {
    const key = `${spec.component}:${spec.index}`;
    const value = aaR13c4eR1SafeText(values?.[key]) || `{{${spec.index}}}`;

    output = output.replace(new RegExp(`{{\\s*${spec.index}\\s*}}`, 'g'), value);
  }

  return output.trim();
}

function aaR13c4eR1RenderPreview(template, specs, values) {
  if (!template) return '';

  const header = aaR13c4eR1ApplyValuesToText(aaR13c4eR1GetComponentText(template, 'HEADER'), 'header', specs, values);
  const body = aaR13c4eR1ApplyValuesToText(aaR13c4eR1GetComponentText(template, 'BODY'), 'body', specs, values);
  const footer = aaR13c4eR1ApplyValuesToText(aaR13c4eR1GetComponentText(template, 'FOOTER'), 'footer', specs, values);

  return [header, body, footer].filter(Boolean).join('\n\n');
}

function aaR13c4eR1TemplateKey(template) {
  if (!template) return '';

  return [
    template?.id,
    template?.key,
    template?.name,
    template?.templateName,
    template?.template_name,
    template?.language,
    template?.category,
    aaR13c4eR1GetComponentText(template, 'HEADER'),
    aaR13c4eR1GetComponentText(template, 'BODY'),
    aaR13c4eR1GetComponentText(template, 'FOOTER')
  ].map((item) => aaR13c4eR1SafeText(item)).join('|');
}


// __AUTOATENDE_V4_R13C_R5C_CLEAN_INDIVIDUAL_TEMPLATE_PREVIEW__
function aaR13c5cSafeText(value) {
  return String(value ?? '').trim();
}

function aaR13c5cIsTechnicalPreviewLine(line) {
  const value = aaR13c5cSafeText(line);

  if (!value) return true;

  if (/^(nome do template|template name|idioma|language|categoria|category|mensagem aprovada|template aprovado)\s*:?\s*$/i.test(value)) {
    return true;
  }

  if (/^(pt_br|pt-br|en_us|en-us)$/i.test(value)) return true;
  if (/^(utility|utility_auth|marketing|authentication|auth)$/i.test(value)) return true;

  return false;
}

function aaR13c5cReplacePlaceholders(text, specs, values) {
  let output = String(text || '');

  const valueByIndex = new Map();

  for (const spec of Array.isArray(specs) ? specs : []) {
    const key = `${spec.component}:${spec.index}`;
    const value = aaR13c5cSafeText(values?.[key]);

    if (value && !valueByIndex.has(Number(spec.index))) {
      valueByIndex.set(Number(spec.index), value);
    }
  }

  output = output.replace(/{{\s*(\d+)\s*}}/g, (match, indexText) => {
    const index = Number(indexText);
    const value = valueByIndex.get(index);

    return value || match;
  });

  return output.trim();
}

function aaR13c5cExtractCleanSections(rawText) {
  const raw = aaR13c5cSafeText(rawText);

  const result = {
    foundSection: false,
    header: [],
    body: [],
    footer: [],
    plain: [],
  };

  if (!raw) return result;

  let current = null;

  for (const originalLine of raw.split(/\r?\n/)) {
    const line = aaR13c5cSafeText(originalLine);

    if (!line) continue;

    const sectionMatch = line.match(/^(HEADER|BODY|FOOTER)\s*:\s*(.*)$/i);

    if (sectionMatch) {
      current = String(sectionMatch[1] || '').toLowerCase();
      result.foundSection = true;

      const rest = aaR13c5cSafeText(sectionMatch[2]);

      if (rest && Array.isArray(result[current])) {
        result[current].push(rest);
      }

      continue;
    }

    if (aaR13c5cIsTechnicalPreviewLine(line)) {
      current = null;
      continue;
    }

    if (current && Array.isArray(result[current])) {
      result[current].push(line);
      continue;
    }

    result.plain.push(
      line
        .replace(/^HEADER\s*:\s*/i, '')
        .replace(/^BODY\s*:\s*/i, '')
        .replace(/^FOOTER\s*:\s*/i, '')
        .trim()
    );
  }

  return result;
}

function aaR13c5cBuildCleanPreviewText(rawText, specs, values) {
  const parsed = aaR13c5cExtractCleanSections(rawText);

  const sections = [];

  if (parsed.foundSection) {
    const header = aaR13c5cReplacePlaceholders(parsed.header.join('\n'), specs, values);
    const body = aaR13c5cReplacePlaceholders(parsed.body.join('\n'), specs, values);
    const footer = aaR13c5cReplacePlaceholders(parsed.footer.join('\n'), specs, values);

    if (header) sections.push(header);
    if (body) sections.push(body);
    if (footer) sections.push(footer);

    return sections.join('\n\n').trim();
  }

  const plain = parsed.plain.filter(Boolean).join('\n\n').trim();

  return aaR13c5cReplacePlaceholders(plain, specs, values);
}

export default function AcquisitionRecentPage() {

  const [aaR13c4eR1SelectedTemplate, setAaR13c4eR1SelectedTemplate] = React.useState(null); // __AUTOATENDE_V4_R13C_R4E_R1_DIRECT_GUIDED_PARAMS_FIXED_SETSENDFORM__
  const [aaR13c4eR1ParamValues, setAaR13c4eR1ParamValues] = React.useState({});

  const [aaR13c4eR3VisibleBodyText, setAaR13c4eR3VisibleBodyText] = React.useState(''); // __AUTOATENDE_V4_R13C_R4E_R3_VISIBLE_META_BODY_PARAM_FALLBACK_NO_OBSERVER__

  const navigate = useNavigate();
  const localRole = React.useMemo(() => resolveRole(), []);

  const [filterMode, setFilterMode] = React.useState('all');
  const [limit, setLimit] = React.useState(20);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [payload, setPayload] = React.useState(null);
  const [sendForm, setSendForm] = React.useState({
    to: '',
    templateName: '',
    languageCode: 'pt_BR',
    templateCategory: 'utility_auth',
    componentsRaw: '[]'
  });
  const [sending, setSending] = React.useState(false);
  const [sendResult, setSendResult] = React.useState(null);
  const [templateCatalog, setTemplateCatalog] = React.useState([]);
  const [templateCatalogLoading, setTemplateCatalogLoading] = React.useState(false);
  const [templateCatalogError, setTemplateCatalogError] = React.useState('');

  const [billingStatus, setBillingStatus] = React.useState(null);
  const [billingError, setBillingError] = React.useState('');



  const acquisitionFrontFixesMarker = '__AUTOATENDE_C16N_C3E_R6_FRONT_FIXES__';
  const fetchBillingStatus = React.useCallback(async () => {
    try {
      const token = resolveAccessToken();
      if (!token) return;

      const response = await fetch('/api/billing/status', {
        method: 'GET',
        credentials: 'include',
        headers: {
          Authorization: token,
          'Content-Type': 'application/json'
        }
      });

      const raw = await response.text();
      const parsed = raw ? safeJsonParse(raw) || { raw } : {};

      if (!response.ok) {
          throw new Error(parsed?.message || parsed?.error || `HTTP ${response.status}`);
        }

      const normalizedBilling = parsed?.data || parsed || {};
      setBillingStatus(normalizedBilling);
      setBillingError('');
    } catch (err) {
      setBillingError(String(err?.message || err || 'Falha ao carregar saldo operacional de billing.'));
    }
  }, []);
  const fetchTemplateCatalog = React.useCallback(async () => {
    try {
      setTemplateCatalogLoading(true);
      setTemplateCatalogError('');

      const token = resolveAccessToken();

      if (!token) {
        setTemplateCatalog([]);
        setTemplateCatalogError('Aguardando autenticação da sessão...');
        return;
      }

      const response = await fetch('/api/ops-surface/acquisition/templates', {
        credentials: 'include',
        headers: {
          Authorization: token
        }
      });

      const raw = await response.text();
      const parsed = raw ? safeJsonParse(raw) || { raw } : {};

      if (!response.ok) {
        throw new Error(parsed?.message || parsed?.error || `HTTP ${response.status}`);
      }

      setTemplateCatalog(Array.isArray(parsed?.items) ? parsed.items : []);
    } catch (err) {
      setTemplateCatalog([]);
      setTemplateCatalogError(String(err?.message || err || 'Falha ao carregar templates aprovados.'));
    } finally {
      setTemplateCatalogLoading(false);
    }
  }, []);
  const selectedCatalogKey = React.useMemo(() => {
    const name = String(sendForm.templateName || '').trim();
    const language = String(sendForm.languageCode || '').trim();
    if (!name || !language) return '';
    return `${name}::${language}`;
  }, [sendForm.templateName, sendForm.languageCode]);

  const selectedCatalogTemplate = React.useMemo(() => {
    return templateCatalog.find((item) => item?.key === selectedCatalogKey) || null;
  }, [templateCatalog, selectedCatalogKey]);

  const templateAuthorizationState = templateCatalogLoading
    ? 'loading'
    : templateCatalogError
      ? 'unavailable'
      : templateCatalog.length === 0
        ? 'empty'
        : selectedCatalogTemplate
          ? 'ready'
          : 'unapproved';
  const templateAuthorizationMessage = {
    loading: 'Aguarde o carregamento dos templates aprovados antes de enviar.',
    unavailable: 'O catálogo de templates aprovados está indisponível. O envio permanece bloqueado.',
    empty: 'Nenhum template aprovado está disponível. O envio permanece bloqueado.',
    unapproved: 'Selecione um template aprovado para liberar o envio.',
    ready: ''
  }[templateAuthorizationState];
  const templateSendDisabled =
    sending || templateAuthorizationState !== 'ready';

  const stringifyTemplateComponents = React.useCallback((item) => {
    const payload = Array.isArray(item?.defaultSendComponents) ? item.defaultSendComponents : [];
    return JSON.stringify(payload, null, 2);
  }, []);

  const acquisitionTemplateAutofillMarker = '__AUTOATENDE_C16N_C4B_AUTOFILL_TEMPLATE_COMPONENTS__';


  const handleApprovedTemplateChange = React.useCallback((e) => {
    const key = String(e.target.value || '').trim();
    const selected = templateCatalog.find((item) => item?.key === key) || null;
    if (!selected) return;

    setAaR13c4eR1SelectedTemplate(selected); // __AUTOATENDE_V4_R13C_R4E_R1_DIRECT_GUIDED_PARAMS_FIXED_SETSENDFORM__
    setAaR13c4eR1ParamValues({});
    setSendForm((prev) => ({
      ...prev,
      templateName: selected.name,
      languageCode: selected.language,
      templateCategory: selected.categoryKey || prev.templateCategory,
      componentsRaw: stringifyTemplateComponents(selected)
    }));
  }, [templateCatalog, stringifyTemplateComponents]);


  const fetchRows = React.useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const token = resolveAccessToken();
      if (!token) {
        throw new Error('Token de autenticação não encontrado no navegador.');
      }

      const params = new URLSearchParams();
      params.set('limit', String(limit));

      if (filterMode === 'bound') params.set('only_bound', '1');
      if (filterMode === 'unbound') params.set('only_unbound', '1');
      if (filterMode === 'global_unbound') {
        params.set('only_unbound', '1');
        params.set('global_unbound', '1');
      }

      const response = await fetch(`${ENDPOINT}?${params.toString()}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          Authorization: token
        }
      });

      const raw = await response.text();
      const parsed = raw ? safeJsonParse(raw) || { raw } : {};

      if (!response.ok) {
        throw new Error(parsed?.message || parsed?.error || `HTTP ${response.status}`);
      }

      setPayload(parsed?.data || parsed);
    } catch (err) {
      setPayload(null);
      setError(String(err?.message || err || 'Falha ao carregar histórico de disparos.'));
    } finally {
      setLoading(false);
    }
  }, [filterMode, limit]);
  const acquisitionProviderMetaFallbackMarker = '__AUTOATENDE_C16N_C3G_PROVIDER_META_FALLBACK__';

  React.useEffect(() => {
    fetchTemplateCatalog();
  }, [fetchTemplateCatalog]);
  const acquisitionTemplateCatalogMarker = '__AUTOATENDE_C16N_C4A_TEMPLATE_CATALOG_VALIDATION__';

  const handleSendTemplate = React.useCallback(async () => {
    setSendResult(null);

    const token = resolveAccessToken();
    if (!token) {
      setSendResult({
        type: 'error',
        text: 'Token de autenticação não encontrado no navegador.'
      });
      return;
    }

    const normalizedTo = String(sendForm.to || '').trim();
    const normalizedTemplateName = String(sendForm.templateName || '').trim();
    const normalizedLanguageCode = String(sendForm.languageCode || 'pt_BR').trim() || 'pt_BR';
    const normalizedCategory = String(sendForm.templateCategory || 'utility_auth').trim() || 'utility_auth';


    if (templateCatalogLoading) {
      setSendResult({
        type: 'error',
        text: 'Aguarde o carregamento dos templates aprovados antes de enviar.'
      });
      return;
    }

    if (templateCatalogError) {
      setSendResult({
        type: 'error',
        text: 'O catálogo de templates aprovados está indisponível. O envio permanece bloqueado.'
      });
      return;
    }

    if (templateCatalog.length === 0) {
      setSendResult({
        type: 'error',
        text: 'Nenhum template aprovado está disponível. O envio permanece bloqueado.'
      });
      return;
    }

    const matched = templateCatalog.find(
      (item) => item?.name === normalizedTemplateName && item?.language === normalizedLanguageCode
    );

    if (!matched) {
      setSendResult({
        type: 'error',
        text: 'Template/idioma não encontrado entre os templates aprovados da Meta.'
      });
      return;
    }

    if ((matched?.categoryKey || '') && matched.categoryKey !== normalizedCategory) {
      setSendForm((prev) => ({
        ...prev,
        templateCategory: matched.categoryKey
      }));
    }

    if (!normalizedTo) {
      setSendResult({
        type: 'error',
        text: 'Informe o telefone de destino.'
      });
      return;
    }

    if (!normalizedTemplateName) {
      setSendResult({
        type: 'error',
        text: 'Informe o nome do template.'
      });
      return;
    }

    let parsedComponents = [];
    try {
      parsedComponents = JSON.parse(sendForm.componentsRaw || '[]');
      if (!Array.isArray(parsedComponents)) {
        throw new Error('components_not_array');
      }
    } catch (_err) {
      setSendResult({
        type: 'error',
        text: 'O campo components precisa ser um JSON válido em formato de array.'
      });
      return;
    }

    setSending(true);
    try {
      const response = await fetch('/api/ops-surface/acquisition/send-template', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token
        },
        body: JSON.stringify({
          to: normalizedTo,
          template_name: normalizedTemplateName,
          language_code: normalizedLanguageCode,
          template_category: normalizedCategory,
          components: parsedComponents,
        templatePreviewText: buildTemplatePreviewTextForInbox(
          selectedCatalogTemplate,
          normalizedTemplateName,
          normalizedLanguageCode,
          normalizedCategory
        )
        })
      });

      const raw = await response.text();
      const parsed = raw ? safeJsonParse(raw) || { raw } : {};

      if (!response.ok) {
          const providerError =
            parsed?.meta?.provider_error ||
            parsed?.meta?.error ||
            parsed?.error ||
            null;
          const providerMeta =
            parsed?.meta?.provider_meta ||
            parsed?.meta ||
            null;
          const debugContext =
            parsed?.meta?.debug_context ||
            parsed?.meta?.debugContext ||
            null;

          const richMessage = {
            message: parsed?.message || parsed?.error || `HTTP ${response.status}`,
            providerError,
            providerMeta,
            debugContext
          };

          throw new Error(JSON.stringify(richMessage));
        }

      const data = parsed?.data || parsed || {};
      setSendResult({
        type: 'success',
        text: `Template enviado com sucesso para ${data?.to || normalizedTo}.`,
        data
      });

      setBillingStatus((prev) => {
        if (!prev || typeof prev !== 'object') return prev;

        const next = {
          ...prev,
          usage: {
            ...(prev.usage || {})
          }
        };

        if (normalizedCategory === 'marketing') {
          next.usage.marketingTemplates = Number(next.usage.marketingTemplates ?? 0) + 1;
        } else {
          next.usage.utilityAuthTemplates = Number(next.usage.utilityAuthTemplates ?? 0) + 1;
        }

        return next;
      });

      await Promise.allSettled([fetchRows(), fetchBillingStatus()]);
    } catch (err) {
      let parsedError = null;
      try {
        parsedError = JSON.parse(String(err?.message || ''));
      } catch (_e) {
        parsedError = null;
      }

      setSendResult({
        type: 'error',
        text: parsedError?.message || String(err?.message || err || 'Falha ao enviar template operacional.'),
        providerError: parsedError?.providerError || null,
        providerMeta: parsedError?.providerMeta || null,
        debugContext: parsedError?.debugContext || null
      });
    } finally {
      setSending(false);
    }
  }, [
    fetchBillingStatus,
    fetchRows,
    selectedCatalogTemplate,
    sendForm,
    templateCatalog,
    templateCatalogError,
    templateCatalogLoading
  ]);


  React.useEffect(() => {
    Promise.allSettled([fetchRows(), fetchBillingStatus()]);
  }, [fetchRows, fetchBillingStatus]);

  const rows = payload?.rows || [];
  const filters = payload?.filters || {};
  const viewer = payload?.viewer || null;
  const role = (viewer?.resolved_role || localRole || '').toLowerCase();
  const isAdminLike = Boolean(
    typeof viewer?.is_admin_like === 'boolean'
      ? viewer.is_admin_like
      : ['company', 'admin', 'owner'].includes(role) /* __AUTOATENDE_C16N_A2_ACQ_COMPANY_ADMIN_PARITY__ */
  );
  const resolvedCompanyId = viewer?.resolved_company_id || filters?.company_id || '';
  const viewerMarker = '__AUTOATENDE_R10E_A3_FRONTEND_VIEWER_PREF__';
  const billingLimits = billingStatus?.limits || {};
  const billingUsage = billingStatus?.usage || {};
  const marketingIncluded = Number(billingLimits.marketingTemplates ?? 0);
  const utilityAuthIncluded = Number(billingLimits.utilityAuthTemplates ?? 0);
  const marketingUsed = Number(billingUsage.marketingTemplates ?? 0);
  const utilityAuthUsed = Number(billingUsage.utilityAuthTemplates ?? 0);
  const marketingRemaining = Math.max(marketingIncluded - marketingUsed, 0);
  const utilityAuthRemaining = Math.max(utilityAuthIncluded - utilityAuthUsed, 0);
  const acquisitionBillingReconciliationMarker = '__AUTOATENDE_C16N_C3A_BILLING_RECONCILIATION__';


  const aaR13c4eR1ParamSpecs = aaR13c4eR1BuildParamSpecs(aaR13c4eR1SelectedTemplate); // __AUTOATENDE_V4_R13C_R4E_R1_DIRECT_GUIDED_PARAMS_FIXED_SETSENDFORM__
  const aaR13c4eR1SelectedTemplateKey = aaR13c4eR1TemplateKey(aaR13c4eR1SelectedTemplate);
  const aaR13c4eR1PreviewText = aaR13c4eR1RenderPreview(
    aaR13c4eR1SelectedTemplate,
    aaR13c4eR1ParamSpecs,
    aaR13c4eR1ParamValues
  );

  const aaR13c4eR1HandleParamChange = (spec, value) => {
    const key = `${spec.component}:${spec.index}`;
    const nextValues = {
      ...aaR13c4eR1ParamValues,
      [key]: value
    };

    setAaR13c4eR1ParamValues(nextValues);

    const nextComponents = aaR13c4eR1BuildMetaComponents(aaR13c4eR1ParamSpecs, nextValues);

    setSendForm((prev) => ({
      ...prev,
      componentsRaw: JSON.stringify(nextComponents, null, 2)
    }));
  };

  const aaR13c4eR3SpecsFromVisibleBody = aaR13c4eR1BuildParamSpecs({
    components: aaR13c4eR3VisibleBodyText
      ? [
          {
            type: 'body',
            text: aaR13c4eR3VisibleBodyText
          }
        ]
      : []
  });

  const aaR13c4eR3SpecsFromComponentsRaw = React.useMemo(() => {
    try {
      const parsed = JSON.parse(sendForm?.componentsRaw || '[]');

      if (!Array.isArray(parsed)) return [];

      const specs = [];

      for (const component of parsed) {
        const type = String(component?.type || '').toLowerCase();

        if (!['body', 'header'].includes(type)) continue;

        const parameters = Array.isArray(component?.parameters) ? component.parameters : [];

        parameters.forEach((_, index) => {
          specs.push({
            component: type,
            index: index + 1,
            label: type === 'body' ? `Parâmetro ${index + 1}` : `Header · parâmetro ${index + 1}`
          });
        });
      }

      return specs;
    } catch (_) {
      return [];
    }
  }, [sendForm?.componentsRaw]);

  const aaR13c4eR3DisplayParamSpecs =
    aaR13c4eR1ParamSpecs.length > 0
      ? aaR13c4eR1ParamSpecs
      : aaR13c4eR3SpecsFromVisibleBody.length > 0
        ? aaR13c4eR3SpecsFromVisibleBody
        : aaR13c4eR3SpecsFromComponentsRaw;

  const aaR13c4eR3ValueMapFromComponentsRaw = React.useMemo(() => {
    try {
      const parsed = JSON.parse(sendForm?.componentsRaw || '[]');

      if (!Array.isArray(parsed)) return {};

      const values = {};

      for (const component of parsed) {
        const type = String(component?.type || '').toLowerCase();

        if (!['body', 'header'].includes(type)) continue;

        const parameters = Array.isArray(component?.parameters) ? component.parameters : [];

        parameters.forEach((parameter, index) => {
          const key = `${type}:${index + 1}`;
          values[key] = String(parameter?.text ?? parameter?.value ?? '');
        });
      }

      return values;
    } catch (_) {
      return {};
    }
  }, [sendForm?.componentsRaw]);

  const aaR13c4eR3GetDisplayValue = (key) => {
    if (Object.prototype.hasOwnProperty.call(aaR13c4eR1ParamValues, key)) {
      return aaR13c4eR1ParamValues[key] || '';
    }

    return aaR13c4eR3ValueMapFromComponentsRaw[key] || '';
  };

  const aaR13c4eR3HandleParamChange = (spec, value) => {
    const key = `${spec.component}:${spec.index}`;
    const nextValues = {
      ...aaR13c4eR3ValueMapFromComponentsRaw,
      ...aaR13c4eR1ParamValues,
      [key]: value
    };

    setAaR13c4eR1ParamValues(nextValues);

    const nextComponents = aaR13c4eR1BuildMetaComponents(aaR13c4eR3DisplayParamSpecs, nextValues);

    setSendForm((prev) => ({
      ...prev,
      componentsRaw: JSON.stringify(nextComponents, null, 2)
    }));
  };

  const aaR13c4eR3PreviewText =
    aaR13c4eR1PreviewText ||
    aaR13c4eR3VisibleBodyText ||
    '';

  const aaR13c5cPreviewValues = {
    ...aaR13c4eR3ValueMapFromComponentsRaw,
    ...aaR13c4eR1ParamValues
  }; // __AUTOATENDE_V4_R13C_R5C_CLEAN_INDIVIDUAL_TEMPLATE_PREVIEW__

  const aaR13c5cCleanPreviewText = aaR13c5cBuildCleanPreviewText(
    aaR13c4eR3PreviewText,
    aaR13c4eR3DisplayParamSpecs,
    aaR13c5cPreviewValues
  );


  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const root =
          document.querySelector('.aa-disparos-page--individual') ||
          document.querySelector('.aa-settings-shell') ||
          document.body;

        if (!root) return;

        const nodes = Array.from(root.querySelectorAll('div, pre, p, span'))
          .slice(0, 250);

        const found = nodes
          .map((node) => String(node.innerText || node.textContent || '').trim())
          .filter((value) => value.includes('{{') && !value.includes('"parameters"') && !value.includes('Exemplo:'))
          .find((value) => value.toLowerCase().includes('body:') || value.includes('{{1}}'));

        if (!found) return;

        const bodyMatch = found.match(/BODY\s*:\s*([\s\S]*?)(?:\n\s*(?:HEADER|FOOTER)\s*:|$)/i);
        const nextBody = String((bodyMatch && bodyMatch[1]) || found).trim();

        if (nextBody && nextBody.includes('{{')) {
          setAaR13c4eR3VisibleBodyText((current) => current === nextBody ? current : nextBody);
        }
      } catch (_) {
        // fallback visual pontual; não deve quebrar a tela
      }
    }, 80);

    return () => window.clearTimeout(timer);
  }, [
    aaR13c4eR1SelectedTemplateKey,
    sendForm?.templateName,
    sendForm?.name,
    sendForm?.componentsRaw
  ]);


  // __AUTOATENDE_V4_R13C_R4E_R3_VISIBLE_META_BODY_PARAM_FALLBACK_NO_OBSERVER__


  return (
    <div
      data-marker={PAGE_MARKER}
      className="aa-page-shell aa-settings-shell aa-disparos-page aa-disparos-page--individual"
      style={{
        color: '#e5e7eb'
      }}
    >
      <div style={{ maxWidth: 1240, margin: '0 auto' }}>
        <div
          style={{
            border: '1px solid rgba(16,185,129,0.18)',
            background: 'linear-gradient(135deg, rgba(5,46,22,0.32) 0%, rgba(15,23,42,0.55) 100%)',
            borderRadius: 24,
            padding: 24,
            marginBottom: 20,
            display: 'none'
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.14em', color: '#34d399', marginBottom: 10 }}>
            AQUISIÇÃO · LEITURA OPERACIONAL
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 28 }}>Eventos recentes de disparos</h1>
              <p style={{ margin: '10px 0 0 0', color: '#cbd5e1', maxWidth: 760 }}>
                Superfície read-only para inspeção operacional da trilha de disparos persistida, com foco em bound vs unbound,
                origem do tráfego e vínculo ao tenant.
              </p>
            </div>

            <div style={{ minWidth: 220 }}>
              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>Role detectada</div>
              <div style={{ fontWeight: 700 }}>{role || 'não resolvida'}</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 8 }}>Admin-like</div>
              <div style={{ fontWeight: 700 }}>{isAdminLike ? 'sim' : 'não'}</div>
            </div>
          </div>
        </div>

        <div
          style={{
            border: '1px solid rgba(148,163,184,0.16)',
            background: 'rgba(15,23,42,0.55)',
            borderRadius: 18,
            padding: 16,
            marginBottom: 14
          }}
        >          {/* __AUTOATENDE_C16N_C1_ACQUISITION_OPERATIONAL_CARD__ */}
          <div
            style={{
              border: '1px solid rgba(16,185,129,0.20)',
              background: 'rgba(15,23,42,0.62)',
              borderRadius: 18,
              padding: 16,
              marginBottom: 14
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.14em', color: '#34d399', marginBottom: 8 }}>
      
      <section
        data-aa-marker="__AUTOATENDE_C16N_C7B_R4C_R1B_ACQ_HERO_STANDARDIZATION__"
        style={{
          border: '1px solid rgba(52,211,153,0.18)',
          background: 'linear-gradient(135deg, rgba(3,10,18,0.96), rgba(4,20,28,0.92))',
          padding: 24,
          borderRadius: 18
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.14em', color: '#34d399', marginBottom: 8 }}>
          DISPAROS · OPERAÇÃO INDIVIDUAL
        </div>

        <h1 style={{ margin: 0, fontSize: 34, lineHeight: 1.05, color: '#f8fafc' }}>
          Disparo individual
        </h1>

        <p style={{ marginTop: 12, marginBottom: 0, color: '#9fb3c8', maxWidth: 940 }}>
          Envie um template aprovado para um contato específico com preenchimento guiado. Templates, Lista e Lote ficam disponíveis pela navegação desta mesma área operacional.
        </p>
      </section>


<section
        style={{
          border: '1px solid rgba(148,163,184,0.16)',
          background: 'rgba(5,15,28,0.9)',
          borderRadius: 18,
          padding: 14,
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          alignItems: 'center',
          marginBottom: 18
        }}
      >
        <button
          style={{
            padding: '10px 14px',
            borderRadius: 12,
            border: '1px solid rgba(52,211,153,0.25)',
            background: 'rgba(6,78,59,0.28)',
            color: '#d1fae5',
            fontWeight: 700,
            cursor: 'default'
          }}
        >
          Disparos
        </button>

        <button
          onClick={() => navigate('/configuracoes/aquisicao/templates')}
          style={{
            padding: '10px 14px',
            borderRadius: 12,
            border: '1px solid rgba(148,163,184,0.18)',
            background: 'transparent',
            color: '#f8fafc',
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          Templates
        </button>

        <button
          onClick={() => navigate('/configuracoes/aquisicao/lista')}
          style={{
            padding: '10px 14px',
            borderRadius: 12,
            border: '1px solid rgba(148,163,184,0.18)',
            background: 'transparent',
            color: '#f8fafc',
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          Lista
        </button>

        <button
          onClick={() => navigate('/configuracoes/aquisicao/lote')}
          style={{
            padding: '10px 14px',
            borderRadius: 12,
            border: '1px solid rgba(148,163,184,0.18)',
            background: 'transparent',
            color: '#f8fafc',
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          Lote
        </button>
      </section>

                  ENVIO ATUAL
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#f8fafc', marginBottom: 6 }}>
                  Envio operacional
                </div>
                <div style={{ fontSize: 13, color: '#94a3b8', maxWidth: 760, lineHeight: 1.6 }}>
                  Envie um template aprovado para um contato específico com preenchimento guiado. Lista e Lote ficam disponíveis nesta mesma área, sem mexer no fluxo já validado.
                  
                </div>
              </div>

              <div style={{ minWidth: 260, display: 'none' }}>
                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>Endpoint operacional</div>
                <div style={{ fontWeight: 700, color: '#e5e7eb' }}>/api/ops-surface/acquisition/send-template</div>
              </div>
            </div>

            {/* __AUTOATENDE_C16N_C2_ACQUISITION_BILLING_SURFACE__ */}
            <div
              style={{
                border: '1px solid rgba(148,163,184,0.18)',
                background: 'rgba(2,6,23,0.42)',
                borderRadius: 16,
                padding: 14,
                marginBottom: 14
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.12em', color: '#93c5fd' }}>
                  SALDO DISPONÍVEL PARA DISPAROS
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>
                  source: <strong>/api/billing/status</strong>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                <div style={{ border: '1px solid rgba(16,185,129,0.18)', borderRadius: 12, padding: 12, background: 'rgba(16,185,129,0.08)' }}>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>Marketing</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#f8fafc' }}>{marketingRemaining}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>
                    usados {marketingUsed} · incluídos {marketingIncluded}
                  </div>
                </div>

                <div style={{ border: '1px solid rgba(56,189,248,0.18)', borderRadius: 12, padding: 12, background: 'rgba(56,189,248,0.08)' }}>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>Utility/Auth</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#f8fafc' }}>{utilityAuthRemaining}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>
                    usados {utilityAuthUsed} · incluídos {utilityAuthIncluded}
                  </div>
                </div>
              </div>

              {billingError ? (
                <div style={{ marginTop: 10, fontSize: 12, color: '#fca5a5' }}>
                  Saldo indisponível agora: {billingError}
                </div>
              ) : null}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>Telefone destino</div>
                <input
                  value={sendForm.to}
                  onChange={(e) => setSendForm((prev) => ({ ...prev, to: e.target.value }))}
                  placeholder="Ex.: 5545999999999"
                  style={{
                    width: '100%',
                    background: 'rgba(2,6,23,0.9)',
                    color: '#e5e7eb',
                    border: '1px solid rgba(148,163,184,0.24)',
                    borderRadius: 10,
                    padding: '10px 12px',
                    outline: 'none'
                  }}
                />
              </div>

              <div>

              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>Template aprovado</div>
                <select
                  value={selectedCatalogKey}
                  onChange={handleApprovedTemplateChange}
                  style={{
                    width: '100%',
                    minHeight: 40,
                    background: '#031525',
                    color: '#e5e7eb',
                    border: '1px solid rgba(148,163,184,0.22)',
                    borderRadius: 12,
                    padding: '0 14px'
                  }}
                >
                  <option value="">
                    {templateCatalogLoading
                      ? 'Carregando templates aprovados...'
                      : templateCatalog.length > 0
                      ? 'Escolha um template aprovado'
                      : 'Nenhum template aprovado carregado'}
                  </option>
                  {templateCatalog.map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.label}
                    </option>
                  ))}
                </select>

                <div style={{ fontSize: 12, color: templateCatalogError ? '#fca5a5' : '#94a3b8', marginTop: 6 }}>
                  {templateCatalogError || 'Selecionar um item aprovado preenche nome, idioma e categoria. O envio é bloqueado se o par nome/idioma não existir na Meta.'}
                </div>
              </div>

                
              {selectedCatalogTemplate?.previewText ? (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>
                    Mensagem aprovada (Meta)
                  </div>
                  <div
                    style={{
                      whiteSpace: 'pre-wrap',
                      fontSize: 12,
                      lineHeight: 1.6,
                      color: '#cbd5e1',
                      background: '#031525',
                      border: '1px solid rgba(148,163,184,0.22)',
                      borderRadius: 12,
                      padding: '12px 14px'
                    }}
                  >
                    {selectedCatalogTemplate.previewText}
                  </div>

                  {Array.isArray(selectedCatalogTemplate?.autofillWarnings) && selectedCatalogTemplate.autofillWarnings.length > 0 ? (
                    <div style={{ marginTop: 8, fontSize: 12, color: '#fbbf24' }}>
                      {selectedCatalogTemplate.autofillWarnings.join(' • ')}
                    </div>
                  ) : null}
                </div>
              ) : null}

<div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>Nome do template</div>
                <input
                  value={sendForm.templateName}
                  onChange={(e) => setSendForm((prev) => ({ ...prev, templateName: e.target.value }))}
                  placeholder="Ex.: lembrete_pagamento"
                  style={{
                    width: '100%',
                    background: 'rgba(2,6,23,0.9)',
                    color: '#e5e7eb',
                    border: '1px solid rgba(148,163,184,0.24)',
                    borderRadius: 10,
                    padding: '10px 12px',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>Idioma</div>
                <input
                  value={sendForm.languageCode}
                  onChange={(e) => setSendForm((prev) => ({ ...prev, languageCode: e.target.value }))}
                  placeholder="pt_BR"
                  style={{
                    width: '100%',
                    background: 'rgba(2,6,23,0.9)',
                    color: '#e5e7eb',
                    border: '1px solid rgba(148,163,184,0.24)',
                    borderRadius: 10,
                    padding: '10px 12px',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>Categoria</div>
                <select
                  value={sendForm.templateCategory}
                  onChange={(e) => setSendForm((prev) => ({ ...prev, templateCategory: e.target.value }))}
                  style={{
                    width: '100%',
                    background: 'rgba(2,6,23,0.9)',
                    color: '#e5e7eb',
                    border: '1px solid rgba(148,163,184,0.24)',
                    borderRadius: 10,
                    padding: '10px 12px',
                    outline: 'none'
                  }}
                >
                  <option value="utility_auth">utility_auth</option>
                  <option value="marketing">marketing</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>

              {/* __AUTOATENDE_V4_R13C_R4E_R4_FIX_PARAM_PANEL_CONDITION__ */}
              {aaR13c4eR3DisplayParamSpecs.length > 0 ? (
                <div className="aa-r13c-r4e-r2-fix-param-panel __AUTOATENDE_V4_R13C_R4E_R2_FIX_PARAM_FIELDS_BEFORE_JSON__">
                  <div className="aa-r13c-r4e-r2-fix-param-panel__top">
                    <div>
                      <div className="aa-r13c-r4e-r2-fix-param-panel__eyebrow">Variáveis do template</div>
                      <div className="aa-r13c-r4e-r2-fix-param-panel__title">Preencha os dados da mensagem</div>
                      <div className="aa-r13c-r4e-r2-fix-param-panel__hint">
                        Estes campos substituem os marcadores como {'{{1}}'}, {'{{2}}'} e assim por diante. Digite o valor correto para este envio.
                      </div>
                    </div>
                    <span className="aa-r13c-r4e-r2-fix-param-panel__badge">
                      {aaR13c4eR3DisplayParamSpecs.length} campo{aaR13c4eR3DisplayParamSpecs.length > 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="aa-r13c-r4e-r2-fix-param-panel__grid">
                    {aaR13c4eR3DisplayParamSpecs.map((spec) => {
                      const key = `${spec.component}:${spec.index}`;

                      return (
                        <label key={key} className="aa-r13c-r4e-r2-fix-param-panel__field">
                          <span>{spec.label}</span>
                          <input
                            type="text"
                            value={aaR13c4eR3GetDisplayValue(key)}
                            onChange={(event) => aaR13c4eR3HandleParamChange(spec, event.target.value)}
                            placeholder={spec.component === 'body' ? 'Digite o nome ou valor do parâmetro' : 'Digite o valor do parâmetro'}
                            autoComplete="off"
                          />
                        </label>
                      );
                    })}
                  </div>

                  <div className="aa-r13c-r4e-r2-fix-param-panel__preview">
                    <div className="aa-r13c-r4e-r2-fix-param-panel__previewLabel">Prévia da mensagem</div>
                    <pre>{aaR13c5cCleanPreviewText || 'Preencha os campos acima para visualizar a mensagem final.'}</pre>
                  </div>
                </div>
              ) : null}

              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>Parâmetros avançados (opcional)</div>
              <textarea
                value={sendForm.componentsRaw}
                onChange={(e) => setSendForm((prev) => ({ ...prev, componentsRaw: e.target.value }))}
                rows={7}
                spellCheck={false}
                style={{
                  width: '100%',
                  background: 'rgba(2,6,23,0.9)',
                  color: '#e5e7eb',
                  border: '1px solid rgba(148,163,184,0.24)',
                  borderRadius: 10,
                  padding: '12px',
                  outline: 'none',
                  resize: 'vertical',
                  fontFamily: 'monospace',
                  fontSize: 12
                }}
              />
            </div>

            {templateAuthorizationMessage ? (
              <div
                role="status"
                style={{
                  marginBottom: 12,
                  fontSize: 12,
                  color: templateAuthorizationState === 'unavailable' ? '#fca5a5' : '#fbbf24'
                }}
              >
                {templateAuthorizationMessage}
              </div>
            ) : null}

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6 }}>

              {aaR13c4eR1ParamSpecs.length > 0 ? (
                <div className="aa-r13c-r4e-r1-guided-params">
                  <div className="aa-r13c-r4e-r1-guided-params__header">
                    <div>
                      <div className="aa-r13c-r4e-r1-guided-params__title">Parâmetros do template</div>
                      <div className="aa-r13c-r4e-r1-guided-params__subtitle">
                        Preencha os campos abaixo. O sistema monta automaticamente os parâmetros técnicos do envio.
                      </div>
                    </div>
                    <span className="aa-r13c-r4e-r1-guided-params__badge">
                      {aaR13c4eR1ParamSpecs.length} variável{aaR13c4eR1ParamSpecs.length > 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="aa-r13c-r4e-r1-guided-params__grid">
                    {aaR13c4eR1ParamSpecs.map((spec) => {
                      const key = `${spec.component}:${spec.index}`;

                      return (
                        <label key={key} className="aa-r13c-r4e-r1-guided-params__field">
                          <span>{spec.label}</span>
                          <input
                            type="text"
                            value={aaR13c4eR1ParamValues[key] || ''}
                            onChange={(event) => aaR13c4eR1HandleParamChange(spec, event.target.value)}
                            placeholder={spec.component === 'body' ? 'Ex.: Vitor' : 'Digite o valor do parâmetro'}
                            autoComplete="off"
                          />
                        </label>
                      );
                    })}
                  </div>

                  <div className="aa-r13c-r4e-r1-guided-params__preview">
                    <div className="aa-r13c-r4e-r1-guided-params__previewLabel">Prévia da mensagem</div>
                    <pre>{aaR13c4eR1PreviewText || 'Preencha os parâmetros para visualizar a mensagem final.'}</pre>
                  </div>
                </div>
              ) : null}

                Use parâmetros avançados somente quando o template realmente exigir variáveis. Exemplo:
                {' '}
                <code>{'[{"type":"body","parameters":[{"type":"text","text":"João"}]}]'}</code>
              </div>

              <button
                onClick={handleSendTemplate}
                disabled={templateSendDisabled}
                style={{
                  border: '1px solid rgba(16,185,129,0.45)',
                  background: templateSendDisabled ? 'rgba(148,163,184,0.18)' : 'rgba(16,185,129,0.12)',
                  color: '#e5e7eb',
                  borderRadius: 12,
                  padding: '10px 16px',
                  cursor: templateSendDisabled ? 'not-allowed' : 'pointer',
                  fontWeight: 800
                }}
              >
                {sending ? 'Enviando...' : 'Enviar template'}
              </button>
            </div>

            {sendResult ? (
              <div
                style={{
                  marginTop: 14,
                  border: sendResult.type === 'success'
                    ? '1px solid rgba(16,185,129,0.35)'
                    : '1px solid rgba(248,113,113,0.35)',
                  background: sendResult.type === 'success'
                    ? 'rgba(16,185,129,0.10)'
                    : 'rgba(248,113,113,0.10)',
                  borderRadius: 14,
                  padding: 14
                }}
              >
                <div style={{ fontWeight: 700, color: sendResult.type === 'success' ? '#6ee7b7' : '#fca5a5', marginBottom: 8 }}>
                  {sendResult.type === 'success' ? 'Operação concluída' : 'Falha operacional'}
                </div>
                <div style={{ fontSize: 13, color: '#e5e7eb', lineHeight: 1.6 }}>
                  {sendResult.text}
                </div>

                {sendResult.type === 'error' && (sendResult.providerError || sendResult.providerMeta || sendResult.debugContext) ? (
                  <div
                    style={{
                      marginTop: 10,
                      border: '1px solid rgba(148,163,184,0.22)',
                      background: 'rgba(2,6,23,0.42)',
                      borderRadius: 12,
                      padding: 12
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 800,
                        letterSpacing: '0.08em',
                        color: '#fda4af',
                        marginBottom: 8
                      }}
                    >
                      DETALHE DO PROVIDER
                    </div>

                    {sendResult.providerError ? (
                      <div style={{ fontSize: 12, color: '#f1f5f9', lineHeight: 1.7, marginBottom: 8 }}>
                        <strong>provider_error:</strong> {JSON.stringify(sendResult.providerError)}
                      </div>
                    ) : null}

                    {sendResult.debugContext ? (
                      <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.7, marginBottom: 8 }}>
                        <strong>debug_context:</strong> {JSON.stringify(sendResult.debugContext)}
                      </div>
                    ) : null}

                    {sendResult.providerMeta ? (
                      <details style={{ fontSize: 12, color: '#cbd5e1' }}>
                        <summary style={{ cursor: 'pointer', fontWeight: 700 }}>
                          Ver payload bruto do provider
                        </summary>
                        <pre
                          style={{
                            marginTop: 10,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            background: 'rgba(2,6,23,0.88)',
                            borderRadius: 10,
                            padding: 10,
                            color: '#e2e8f0'
                          }}
                        >
{JSON.stringify(sendResult.providerMeta, null, 2)}
                        </pre>
                      </details>
                    ) : null}
                  </div>
                ) : null}

                {/* __AUTOATENDE_C16N_C3D_FRONT_ERROR_PANEL__ */}
                {sendResult.data ? (
                  <div style={{ marginTop: 10, fontSize: 12, color: '#94a3b8', lineHeight: 1.7 }}>
                    categoria: <strong>{sendResult.data.template_category || '—'}</strong>
                    {' · '}provider_message_id: <strong>{tiny(sendResult.data.provider_message_id)}</strong>
                    {' · '}templates usados: <strong>{sendResult.data?.usage?.templatesUsed ?? '—'}</strong>
                    {' · '}overage: <strong>{sendResult.data?.usage?.overageTemplates ?? '—'}</strong>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>


          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
            <FilterButton active={filterMode === 'all'} onClick={() => setFilterMode('all')}>Todos</FilterButton>
            <FilterButton active={filterMode === 'bound'} onClick={() => setFilterMode('bound')}>Apenas bound</FilterButton>
            <FilterButton active={filterMode === 'unbound'} onClick={() => setFilterMode('unbound')}>Apenas unbound</FilterButton>
            {isAdminLike ? (
              <FilterButton active={filterMode === 'global_unbound'} onClick={() => setFilterMode('global_unbound')}>
                Global unbound
              </FilterButton>
            ) : null}

            <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ fontSize: 12, color: '#94a3b8' }}>Limite</label>
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                style={{
                  background: 'rgba(2,6,23,0.9)',
                  color: '#e5e7eb',
                  border: '1px solid rgba(148,163,184,0.24)',
                  borderRadius: 10,
                  padding: '8px 10px'
                }}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <button
                onClick={fetchRows}
                style={{
                  border: '1px solid rgba(16,185,129,0.45)',
                  background: 'rgba(16,185,129,0.12)',
                  color: '#e5e7eb',
                  borderRadius: 12,
                  padding: '8px 14px',
                  cursor: 'pointer',
                  fontWeight: 700
                }}
              >
                {loading ? 'Atualizando...' : 'Atualizar'}
              </button>
            </div>
          </div>

          

          {error ? (
            <div style={{ marginTop: 14, color: '#fca5a5', fontWeight: 600 }}>{error}</div>
          ) : null}
        </div>

        <div style={{ display: 'grid', gap: 14 }}>
          {false && rows.length === 0 && !loading ? (
            <div
              style={{
                border: '1px solid rgba(148,163,184,0.16)',
                background: 'rgba(15,23,42,0.55)',
                borderRadius: 18,
                padding: 20,
                color: '#cbd5e1'
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 8 }}>
                Nenhum evento encontrado para os filtros atuais.
              </div>
              <div style={{ fontSize: 13, color: '#94a3b8' }}>
                Leitura atual do tenant resolvido pelo backend.
                {' '}scope=<strong>{filters.scope_mode || '—'}</strong>,
                {' '}company_id=<strong>{resolvedCompanyId || '—'}</strong>,
                {' '}janela de leitura=<strong>30 dias</strong>.
              </div>
            </div>
          ) : null}

          {rows.map((row) => (
            <div
              key={row.id}
              style={{
                border: '1px solid rgba(148,163,184,0.16)',
                background: 'rgba(15,23,42,0.58)',
                borderRadius: 18,
                padding: 18
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>Criado em</div>
                  <div style={{ fontWeight: 700 }}>{formatDate(row.created_at || row.occurred_at)}</div>
                </div>
                <StatusPill status={row.bind_status} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
                <div><div style={{ fontSize: 12, color: '#94a3b8' }}>tracking_key</div><div>{tiny(row.tracking_key)}</div></div>
                <div><div style={{ fontSize: 12, color: '#94a3b8' }}>session_key</div><div>{tiny(row.session_key)}</div></div>
                <div><div style={{ fontSize: 12, color: '#94a3b8' }}>click_id</div><div>{tiny(row.click_id)}</div></div>
                <div><div style={{ fontSize: 12, color: '#94a3b8' }}>utm_source</div><div>{row.utm_source || '—'}</div></div>
                <div><div style={{ fontSize: 12, color: '#94a3b8' }}>utm_medium</div><div>{row.utm_medium || '—'}</div></div>
                <div><div style={{ fontSize: 12, color: '#94a3b8' }}>utm_campaign</div><div>{row.utm_campaign || '—'}</div></div>
                <div><div style={{ fontSize: 12, color: '#94a3b8' }}>refhost</div><div>{row.refhost || '—'}</div></div>
                <div><div style={{ fontSize: 12, color: '#94a3b8' }}>source_surface</div><div>{row.source_surface || '—'}</div></div>
                <div><div style={{ fontSize: 12, color: '#94a3b8' }}>company_id</div><div>{tiny(row.company_id)}</div></div>
                <div><div style={{ fontSize: 12, color: '#94a3b8' }}>client_id</div><div>{tiny(row.client_id)}</div></div>
                <div><div style={{ fontSize: 12, color: '#94a3b8' }}>user_id</div><div>{tiny(row.user_id)}</div></div>
                <div><div style={{ fontSize: 12, color: '#94a3b8' }}>lead_email</div><div>{row.lead_email || '—'}</div></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
