/* __AUTOATENDE_V4_R6C_DISPAROS_COMMERCIAL_COPY_ALIGNMENT__ */
import React from 'react';
import { useNavigate } from 'react-router-dom';

const PAGE_MARKER = '__AUTOATENDE_C16N_C7D_R2_LIST_DYNAMIC_PARAMS_PER_CONTACT__';
const AUTH_MARKER = '__AUTOATENDE_C16N_C7D_R2_LIST_DYNAMIC_PARAMS_PER_CONTACT_AUTH__';

function tryParseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}


function resolveRuntimeAccessToken() {
  if (typeof window === 'undefined') return '';

  const directCandidates = [
    window.__AUTOATENDE_SESSION__?.access_token,
    window.__AUTOATENDE_AUTH__?.session?.access_token,
    window.__AUTOATENDE_AUTH__?.access_token,
    window.__AUTOATENDE_USER__?.access_token
  ].filter(Boolean);

  if (directCandidates.length > 0) {
    return String(directCandidates[0]);
  }

  const storageKeys = [
    'auth_user',
    'autoatende_user',
    'supabase.auth.token',
    'sb-access-token'
  ];

  for (const key of storageKeys) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;

      const parsed = tryParseJson(raw);

      if (typeof parsed === 'string' && parsed) return parsed;

      const candidates = [
        parsed?.access_token,
        parsed?.token,
        parsed?.session?.access_token,
        parsed?.currentSession?.access_token,
        parsed?.data?.session?.access_token
      ].filter(Boolean);

      if (candidates.length > 0) {
        return String(candidates[0]);
      }
    } catch {}
  }

  return '';
}

async function waitForRuntimeAccessToken(options = {}) {
  const attempts = Number(options?.attempts ?? 8);
  const delayMs = Number(options?.delayMs ?? 250);

  const immediate = resolveRuntimeAccessToken();
  if (immediate) return immediate;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    const nextToken = resolveRuntimeAccessToken();
    if (nextToken) return nextToken;
  }

  return '';
}

const LIST_AUTH_BOOTSTRAP_MARKER = '__AUTOATENDE_C16N_C8C_R1_FIX_LIST_AUTH_BOOTSTRAP_WAIT__';


function normalizeCategory(value = '') {
  const raw = String(value || '').trim().toLowerCase();
  if (raw.includes('market')) return 'marketing';
  return 'utility_auth';
}

function normalizeTemplateItem(item = {}, index = 0) {
  const name = String(item?.name || item?.template_name || `template_${index + 1}`).trim();
  const language = String(item?.language || item?.locale || 'pt_BR').trim();
  const categoryKey = normalizeCategory(item?.category || item?.categoryKey);

  return {
    id: item?.id || `${name}-${language}-${index}`,
    key: item?.key || `${name}::${language}`,
    name,
    language,
    categoryKey,
    categoryLabel: categoryKey === 'marketing' ? 'marketing' : 'utility_auth',
    previewText: String(item?.previewText || item?.preview_text || '').trim(),
    defaultSendComponents: Array.isArray(item?.defaultSendComponents) ? item.defaultSendComponents : [],
    isSendable: Boolean(item?.isSendable ?? true),
    status: String(item?.status || 'approved').trim().toLowerCase()
  };
}

function normalizePhone(rawValue = '') {
  const digits = String(rawValue || '').replace(/\D/g, '');

  if (!digits) {
    return { normalized: '', valid: false };
  }

  if (!digits.startsWith('55')) {
    return { normalized: digits, valid: false };
  }

  if (digits.length < 12 || digits.length > 13) {
    return { normalized: digits, valid: false };
  }

  return {
    normalized: digits,
    valid: true
  };
}

function getTemplateParameterBlueprint(template) {
  if (!template || !Array.isArray(template.defaultSendComponents)) {
    return [];
  }

  const blueprint = [];

  template.defaultSendComponents.forEach((component, componentIndex) => {
    const parameters = Array.isArray(component?.parameters) ? component.parameters : [];

    parameters.forEach((parameter, parameterIndex) => {
      blueprint.push({
        componentIndex,
        parameterIndex,
        type: parameter?.type || 'text'
      });
    });
  });

  return blueprint;
}

function hasUnsupportedDynamicParameterTypes(template) {
  const blueprint = getTemplateParameterBlueprint(template);
  return blueprint.some((item) => String(item.type || '').toLowerCase() !== 'text');
}

function splitInputIntoRawRows(text = '') {
  const trimmed = String(text || '').trim();
  if (!trimmed) return [];

  const lines = trimmed
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 1) {
    const single = lines[0];

    const tokens = single
      .split(/[;,]/g)
      .map((item) => item.trim())
      .filter(Boolean);

    const allLookLikePhoneCandidates =
      tokens.length > 1 &&
      tokens.every((token) => /^\+?\d[\d\s().-]*$/.test(token));

    if (allLookLikePhoneCandidates) {
      return tokens.map((token) => ({ rawLine: token, columns: [token] }));
    }
  }

  return lines.map((line) => {
    const columns = line
      .split(/[;,\t]/g)
      .map((item) => item.trim())
      .filter(Boolean);

    return {
      rawLine: line,
      columns
    };
  });
}

function buildRowsFromContacts(text = '', template = null) {
  const blueprint = getTemplateParameterBlueprint(template);
  const requiredParamCount = blueprint.length;
  const seen = new Set();

  return splitInputIntoRawRows(text).map(({ rawLine, columns }) => {
    const phoneRaw = columns[0] || '';
    const rawParams = columns.slice(1);
    const parsed = normalizePhone(phoneRaw);

    if (!parsed.valid) {
      return {
        raw: rawLine,
        normalized: parsed.normalized || '—',
        paramsProvided: rawParams,
        paramsUsed: [],
        state: 'invalid',
        reason: 'Número fora do padrão esperado.'
      };
    }

    if (seen.has(parsed.normalized)) {
      return {
        raw: rawLine,
        normalized: parsed.normalized,
        paramsProvided: rawParams,
        paramsUsed: [],
        state: 'duplicate',
        reason: 'Contato duplicado na lista.'
      };
    }

    seen.add(parsed.normalized);

    if (requiredParamCount > 0 && rawParams.length < requiredParamCount) {
      return {
        raw: rawLine,
        normalized: parsed.normalized,
        paramsProvided: rawParams,
        paramsUsed: rawParams,
        state: 'missing_params',
        reason: `Parâmetros insuficientes. Esperado: ${requiredParamCount}. Recebido: ${rawParams.length}.`
      };
    }

    return {
      raw: rawLine,
      normalized: parsed.normalized,
      paramsProvided: rawParams,
      paramsUsed: requiredParamCount > 0 ? rawParams.slice(0, requiredParamCount) : [],
      state: 'valid',
      reason:
        requiredParamCount > 0
          ? `Linha pronta com ${requiredParamCount} parâmetro(s).`
          : 'Linha pronta para envio.'
    };
  });
}

function summarizeRows(rows = []) {
  return rows.reduce(
    (acc, row) => {
      acc.total += 1;
      if (row.state === 'valid') acc.valid += 1;
      if (row.state === 'duplicate') acc.duplicate += 1;
      if (row.state === 'invalid') acc.invalid += 1;
      if (row.state === 'missing_params') acc.missingParams += 1;
      return acc;
    },
    { total: 0, valid: 0, duplicate: 0, invalid: 0, missingParams: 0 }
  );
}

function stateBadge(state) {
  if (state === 'valid') {
    return {
      label: 'válido',
      color: '#d1fae5',
      border: '1px solid rgba(52,211,153,0.18)',
      background: 'rgba(6,78,59,0.22)'
    };
  }

  if (state === 'duplicate') {
    return {
      label: 'duplicado',
      color: '#fde68a',
      border: '1px solid rgba(245,158,11,0.22)',
      background: 'rgba(120,53,15,0.22)'
    };
  }

  if (state === 'missing_params') {
    return {
      label: 'sem parâmetro',
      color: '#fcd34d',
      border: '1px solid rgba(245,158,11,0.24)',
      background: 'rgba(120,53,15,0.20)'
    };
  }

  return {
    label: 'inválido',
    color: '#fecaca',
    border: '1px solid rgba(248,113,113,0.22)',
    background: 'rgba(127,29,29,0.22)'
  };
}

function executionBadge(status) {
  if (status === 'sent') {
    return {
      label: 'enviado',
      color: '#d1fae5',
      border: '1px solid rgba(52,211,153,0.18)',
      background: 'rgba(6,78,59,0.22)'
    };
  }

  if (status === 'skipped') {
    return {
      label: 'ignorado',
      color: '#fde68a',
      border: '1px solid rgba(245,158,11,0.22)',
      background: 'rgba(120,53,15,0.22)'
    };
  }

  return {
    label: 'falhou',
    color: '#fecaca',
    border: '1px solid rgba(248,113,113,0.22)',
    background: 'rgba(127,29,29,0.22)'
  };
}

function buildComponentsForRow(template, row) {
  const components = Array.isArray(template?.defaultSendComponents) ? template.defaultSendComponents : [];
  let cursor = 0;

  return components.map((component) => {
    const cloned = {
      ...component,
      parameters: Array.isArray(component?.parameters)
        ? component.parameters.map((parameter) => {
            if (String(parameter?.type || '').toLowerCase() === 'text') {
              const nextValue = row.paramsUsed[cursor] ?? parameter?.text ?? '';
              cursor += 1;
              return {
                ...parameter,
                text: String(nextValue)
              };
            }

            return { ...parameter };
          })
        : component?.parameters
    };

    return cloned;
  });
}

function SmallStatCard({ label, value, hint }) {
  return (
    <div
      style={{
        border: '1px solid rgba(52,211,153,0.12)',
        background: 'linear-gradient(180deg, rgba(2,6,23,0.72), rgba(2,12,27,0.92))',
        borderRadius: 18,
        padding: 16
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 800, color: '#60a5fa', letterSpacing: '0.12em', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 18, color: '#f8fafc', fontWeight: 800, marginBottom: 6 }}>{value}</div>
      <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.45 }}>{hint}</div>
    </div>
  );
}


const LIST_OPERATIONAL_HARDENING_MARKER = '__AUTOATENDE_C16N_C8B_R1_FIX_LIST_OPERATIONAL_HARDENING__';

const listOperationalStyles = {
  wrapper: {
    marginTop: 14,
    marginBottom: 18,
    border: '1px solid rgba(56,189,248,0.16)',
    borderRadius: 16,
    background: 'rgba(3,7,18,0.72)',
    padding: 16
  },
  title: {
    color: '#e5e7eb',
    fontWeight: 800,
    fontSize: 14,
    marginBottom: 10
  },
  text: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 1.55
  },
  badges: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    marginBottom: 10
  },
  recommended: {
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    color: '#d1fae5',
    border: '1px solid rgba(52,211,153,0.24)',
    background: 'rgba(6,78,59,0.24)'
  },
  fallback: {
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    color: '#dbeafe',
    border: '1px solid rgba(96,165,250,0.24)',
    background: 'rgba(30,41,59,0.42)'
  },
  csv: {
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    color: '#fde68a',
    border: '1px solid rgba(245,158,11,0.28)',
    background: 'rgba(120,53,15,0.24)'
  },
  warning: {
    marginTop: 10,
    color: '#fca5a5',
    fontSize: 12,
    lineHeight: 1.5
  },
  code: {
    display: 'block',
    marginTop: 10,
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid rgba(148,163,184,0.14)',
    background: 'rgba(2,12,24,0.6)',
    color: '#e2e8f0',
    fontSize: 13,
    whiteSpace: 'pre-wrap'
  }
};

function getListOperationalTags(selectedTemplate, requiredParamCount) {
  const name = String(selectedTemplate?.name || '').trim().toLowerCase();
  const tags = [];

  if (name === 'retorno_solicitacao_autoatende_v3') {
    tags.push({ key: 'recommended', label: 'Template recomendado', style: listOperationalStyles.recommended });
  }

  if (name === 'autoatende_probe_full_01') {
    tags.push({ key: 'fallback', label: 'Fallback técnico', style: listOperationalStyles.fallback });
  }

  if (requiredParamCount === 1) {
    tags.push({ key: 'csv_nome', label: 'CSV esperado: telefone;nome', style: listOperationalStyles.csv });
  } else if (requiredParamCount > 1) {
    tags.push({
      key: 'csv_multi',
      label: `CSV esperado: telefone;valor1${Array.from({ length: requiredParamCount - 1 }, (_, i) => `;valor${i + 2}`).join('')}`,
      style: listOperationalStyles.csv
    });
  }

  return tags;
}

function renderListOperationalGuidance(selectedTemplate, requiredParamCount) {
  const tags = getListOperationalTags(selectedTemplate, requiredParamCount);
  const templateName = String(selectedTemplate?.name || '').trim();

  return (
    <div data-aa-marker={LIST_OPERATIONAL_HARDENING_MARKER} style={listOperationalStyles.wrapper}>
      <div style={listOperationalStyles.title}>
        Orientação operacional da Lista
      </div>

      <div style={listOperationalStyles.text}>
        Use preferencialmente <strong>retorno_solicitacao_autoatende_v3</strong> para envios utility com variável.
        O template <strong>autoatende_probe_full_01</strong> deve ficar apenas como contingência técnica.
      </div>

      <div style={listOperationalStyles.badges}>
        {tags.map((tag) => (
          <span key={tag.key} style={tag.style}>
            {tag.label}
          </span>
        ))}
      </div>

      {requiredParamCount === 1 ? (
        <code style={listOperationalStyles.code}>
          telefone;nome
          \n
          5511999999999;João
        </code>
      ) : requiredParamCount > 1 ? (
        <code style={listOperationalStyles.code}>
          telefone;valor1;valor2
          \n
          5511999999999;João;Pedido 123
        </code>
      ) : (
        <code style={listOperationalStyles.code}>
          telefone
          \n
          5511999999999
        </code>
      )}

      {templateName ? (
        <div style={listOperationalStyles.text}>
          Template selecionado agora: <strong>{templateName}</strong>
        </div>
      ) : null}

      <div style={listOperationalStyles.warning}>
        Evite usar templates legados rejeitados da família <strong>retorno_solicitacao_autoatende_param_*</strong> e <strong>retorno_solicitacao_autoatende_v2</strong>.
      </div>
    </div>
  );
}



const LIST_TEMPLATE_PRIORITY_MARKER = '__AUTOATENDE_C16N_C8B_R2C_FIX_PRIORITIZE_RECOMMENDED_TEMPLATE__';

function getListTemplatePriority(item) {
  const name = String(item?.name || '').trim().toLowerCase();

  if (name === 'retorno_solicitacao_autoatende_v3') return 1;
  if (name === 'autoatende_probe_full_01') return 2;
  if (name === 'confirmacao_contato_autoatende_03') return 3;

  if (name.startsWith('retorno_solicitacao_autoatende_')) return 10;
  if (name.startsWith('autoatende_probe_')) return 20;
  if (name.startsWith('confirmacao_contato_autoatende_')) return 30;

  return 100;
}

function sortTemplatesForList(items = []) {
  return [...items].sort((a, b) => {
    const pa = getListTemplatePriority(a);
    const pb = getListTemplatePriority(b);
    if (pa !== pb) return pa - pb;

    const na = String(a?.name || '').trim().toLowerCase();
    const nb = String(b?.name || '').trim().toLowerCase();
    return na.localeCompare(nb, 'pt-BR');
  });
}



function getListExpectedFormatText(requiredParamCount = 0) {
  if (requiredParamCount <= 0) {
    return 'Formato esperado: telefone. Ex.: 5511999999999';
  }

  if (requiredParamCount === 1) {
    return 'Formato esperado: telefone;nome. Ex.: 5511999999999;João';
  }

  return `Formato esperado: telefone${Array.from({ length: requiredParamCount }, (_, index) => `;valor${index + 1}`).join('')}. Ex.: 5511999999999;João`;
}

function getListInputPlaceholder(requiredParamCount = 0) {
  if (requiredParamCount <= 0) {
    return 'Cole números separados por quebra de linha, vírgula ou ponto e vírgula.';
  }

  return getListExpectedFormatText(requiredParamCount);
}

const LIST_EXPECTED_FORMAT_MARKER = '__AUTOATENDE_C16N_C8D_R1C_FIX_RESIDUAL_LIST_MICROCOPY__';

function buildListTemplateOptionLabel(item = {}) {
  const name = String(item?.name || '').trim() || 'template';
  const language = String(item?.language || '').trim();
  const category = String(item?.categoryLabel || item?.categoryKey || '').trim();

  const parts = [name];
  if (language) parts.push(language);
  if (category) parts.push(category);

  return parts.join(' • ');
}

const LIST_DROPDOWN_LABEL_MARKER = '__AUTOATENDE_C16N_C8C_R2_FIX_LIST_DROPDOWN_LABEL__';

function getPreferredListTemplateKey(items = []) {
  const sorted = sortTemplatesForList(items);

  const preferred = sorted.find((item) =>
    String(item?.name || '').trim().toLowerCase() === 'retorno_solicitacao_autoatende_v3'
  );
  if (preferred?.key) return preferred.key;

  const fallback = sorted.find((item) =>
    String(item?.name || '').trim().toLowerCase() === 'autoatende_probe_full_01'
  );
  if (fallback?.key) return fallback.key;

  return sorted[0]?.key || '';
}


const LIST_EXECUTION_HUMANIZED_MARKER = '__AUTOATENDE_C16N_C9A_R1C_FIX_HUMANIZE_LIST_EXECUTION_DETAIL__';

const LIST_EXECUTION_CONFIRMATION_MARKER = '__AUTOATENDE_C16N_C9B_R1_LIST_EXECUTION_CONFIRMATION_GATE__';

const LIST_EXECUTE_CTA_READINESS_MARKER = '__AUTOATENDE_C16N_C9D_R1B_FIX_EXECUTE_CTA_READINESS__';

const LIST_REGRESSION_FIX_MARKER = '__AUTOATENDE_C16N_C9D_R1C_REGRESSION_FIX__';

export default function AcquisitionListPage() {
  const navigate = useNavigate();
  const fileInputRef = React.useRef(null);

  const [contactsText, setContactsText] = React.useState('');
  const [templates, setTemplates] = React.useState([]);
  const [loadingTemplates, setLoadingTemplates] = React.useState(true);
  const [templateError, setTemplateError] = React.useState('');
  const [selectedTemplateKey, setSelectedTemplateKey] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [executionSummary, setExecutionSummary] = React.useState(null);
  const [executionRows, setExecutionRows] = React.useState([]);

  const selectedTemplate = React.useMemo(
    () => templates.find((item) => item.key === selectedTemplateKey) || null,
    [templates, selectedTemplateKey]
  );

  const requiredParamCount = React.useMemo(
    () => getTemplateParameterBlueprint(selectedTemplate).length,
    [selectedTemplate]
  );

  const unsupportedDynamicTypes = React.useMemo(
    () => hasUnsupportedDynamicParameterTypes(selectedTemplate),
    [selectedTemplate]
  );

  const rows = React.useMemo(
    () => buildRowsFromContacts(contactsText, selectedTemplate),
    [contactsText, selectedTemplate]
  );

  const summary = React.useMemo(() => summarizeRows(rows), [rows]);

  async function loadTemplates() {
    setLoadingTemplates(true);
    setTemplateError('');

    try {
      const accessToken = await waitForRuntimeAccessToken({ attempts: 8, delayMs: 250 });

      const response = await fetch('/api/ops-surface/acquisition/templates', {
        method: 'GET',
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        credentials: 'include'
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.message || payload?.error || 'Falha ao carregar templates aprovados.');
      }

      const items = Array.isArray(payload?.items) ? payload.items.map(normalizeTemplateItem) : [];
      const sortedItems = sortTemplatesForList(items);
      setTemplates(sortedItems);

      setSelectedTemplateKey((current) => {
        if (current && sortedItems.some((item) => item.key === current)) return current;
        return getPreferredListTemplateKey(sortedItems);
      });
    } catch (error) {
      setTemplates([]);
      setSelectedTemplateKey('');
      setTemplateError(error?.message || 'Falha ao carregar templates aprovados.');
    } finally {
      setLoadingTemplates(false);
    }
  }

  React.useEffect(() => {
    loadTemplates();
  }, []);


  React.useEffect(() => {
    setExecutionSummary(null);
    setExecutionRows([]);
  }, [contactsText, selectedTemplateKey]);

  const LIST_RESET_EXECUTION_MARKER = '__AUTOATENDE_C16N_C9C_R1B_RESET_EXECUTION_ON_INPUT_CHANGE__';


  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleImportFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      setContactsText(content);
    } catch {
      setTemplateError('Não foi possível ler o arquivo selecionado.');
    } finally {
      event.target.value = '';
    }
  }

  async function handleExecuteList() {
    setExecutionSummary(null);
    setExecutionRows([]);

    if (!selectedTemplate) {
      setExecutionSummary({
        ok: false,
        message: 'Selecione um template aprovado antes de executar a lista.'
      });
      return;
    }

    if (summary.valid === 0) {
      setExecutionSummary({
        ok: false,
        message: 'Não existem contatos válidos para envio.'
      });
      return;
    }

    if (unsupportedDynamicTypes) {
      setExecutionSummary({
        ok: false,
        message: 'O template selecionado possui tipos de parâmetros ainda não suportados nesta etapa.'
      });
      return;
    }

    const accessToken = await waitForRuntimeAccessToken({ attempts: 8, delayMs: 250 });
    if (!accessToken) {
      setExecutionSummary({
        ok: false,
        message: 'Sessão não encontrada para autenticar a execução da lista. Faça login novamente.'
      });
      return;
    }

    const previewContacts = rows
      .filter((item) => item.state === 'valid')
      .slice(0, 3)
      .map((item) => item.normalized)
      .join(', ');

    const confirmationMessage = [
      'Confirmar execução da lista?',
      '',
      `Template: ${selectedTemplate?.name || 'template'}`,
      `Contatos válidos: ${summary.valid}`,
      previewContacts ? `Primeiros contatos: ${previewContacts}` : '',
      summary.valid > 3 ? `... e mais ${summary.valid - 3} contato(s).` : ''
    ]
      .filter(Boolean)
      .join('\n');

    if (typeof window !== 'undefined' && !window.confirm(confirmationMessage)) {
      setExecutionSummary({
        ok: false,
        message: 'Execução cancelada pelo operador antes do envio.'
      });
      return;
    }

    setSending(true);

    const resultRows = [];

    for (const row of rows) {
      if (row.state !== 'valid') {
        resultRows.push({
          contact: row.normalized,
          status: 'skipped',
          detail: row.reason || 'Linha ignorada.'
        });
        setExecutionRows([...resultRows]);
        continue;
      }

      try {
        const payload = {
          to: row.normalized,
          phoneNumber: row.normalized,
          phone_number: row.normalized,
          destination: row.normalized,
          templateName: selectedTemplate.name,
          template_name: selectedTemplate.name,
          name: selectedTemplate.name,
          languageCode: selectedTemplate.language,
          language_code: selectedTemplate.language,
          language: selectedTemplate.language,
          category: selectedTemplate.categoryKey,
          components: buildComponentsForRow(selectedTemplate, row)
        };

        const response = await fetch('/api/ops-surface/acquisition/send-template', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`
          },
          credentials: 'include',
          body: JSON.stringify(payload)
        });

        const body = await response.json().catch(() => ({}));

        if (!response.ok || body?.ok === false) {
          throw new Error(body?.message || body?.error || 'Falha no envio.');
        }

        const providerMessageId =
          body?.data?.provider_message_id ||
          body?.provider_message_id ||
          body?.data?.message_id ||
          body?.message_id ||
          '';

        resultRows.push({
          contact: row.normalized,
          status: 'sent',
          detail:
            body?.message ||
            body?.data?.message ||
            'Template enviado com sucesso.',
          rawProviderMessageId: providerMessageId ? String(providerMessageId) : ''
        });
      } catch (error) {
        resultRows.push({
          contact: row.normalized,
          status: 'failed',
          detail: error?.message || 'Falha no envio.'
        });
      }

      setExecutionRows([...resultRows]);
    }

    const sentCount = resultRows.filter((item) => item.status === 'sent').length;
    const failedCount = resultRows.filter((item) => item.status === 'failed').length;
    const skippedCount = resultRows.filter((item) => item.status === 'skipped').length;

    setExecutionSummary({
      ok: failedCount === 0,
      message:
        failedCount === 0
          ? `Execução concluída. ${sentCount} contato(s) receberam o template.`
          : `Execução concluída com ressalvas. ${sentCount} enviado(s), ${failedCount} falha(s) e ${skippedCount} ignorado(s).`,
      sentCount,
      failedCount,
      skippedCount
    });

    setSending(false);
  }

  const helperText = getListExpectedFormatText(requiredParamCount);

  const executeButtonDisabled =
    sending ||
    loadingTemplates ||
    !selectedTemplate ||
    summary.valid === 0 ||
    unsupportedDynamicTypes;

  const executeButtonLabel =
    sending ? 'Enviando...' : 'Executar envio da lista';

  const executeButtonTitle =
    !selectedTemplate
      ? 'Selecione um template aprovado antes de executar a lista.'
      : summary.valid === 0
      ? 'Adicione ao menos um contato válido para executar a lista.'
      : unsupportedDynamicTypes
      ? 'O template selecionado possui tipos de parâmetros ainda não suportados nesta etapa.'
      : sending
      ? 'Envio em andamento.'
      : 'Executar envio da lista';



  return (
    <div className="aa-page-shell aa-settings-shell space-y-4" data-aa-page="acquisition-list" data-aa-marker={PAGE_MARKER} data-aa-auth={AUTH_MARKER}>
      <section
        style={{
          border: '1px solid rgba(52,211,153,0.14)',
          background: 'linear-gradient(180deg, rgba(2,6,23,0.72), rgba(2,12,27,0.92))',
          borderRadius: 18,
          padding: 20
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.14em', color: '#34d399', marginBottom: 8 }}>
          DISPAROS · LISTA EXECUÇÃO R2
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, color: '#f8fafc', marginBottom: 10 }}>
          Execução real por lista com parâmetros
        </div>
        <div style={{ fontSize: 14, color: '#9fb3c8', lineHeight: 1.55, maxWidth: 1000 }}>
          Esta etapa já executa envio real para os contatos válidos da lista e agora aceita parâmetros textuais por linha quando o template exigir variáveis. Duplicados, inválidos e linhas com parâmetros insuficientes ficam fora da execução.
        </div>
      </section>

      <section
        style={{
          border: '1px solid rgba(52,211,153,0.14)',
          background: 'linear-gradient(180deg, rgba(2,6,23,0.72), rgba(2,12,27,0.92))',
          borderRadius: 18,
          padding: 14,
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap'
        }}
      >
        <button
          type="button"
          onClick={() => navigate('/configuracoes/aquisicao')}
          style={{
            padding: '10px 14px',
            borderRadius: 12,
            border: '1px solid rgba(52,211,153,0.18)',
            background: 'rgba(15,23,42,0.4)',
            color: '#f8fafc',
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          Disparos
        </button>

        <button
          type="button"
          onClick={() => navigate('/configuracoes/aquisicao/templates')}
          style={{
            padding: '10px 14px',
            borderRadius: 12,
            border: '1px solid rgba(52,211,153,0.18)',
            background: 'rgba(15,23,42,0.4)',
            color: '#f8fafc',
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          Templates
        </button>

        <button
          type="button"
          style={{
            padding: '10px 14px',
            borderRadius: 12,
            border: '1px solid rgba(52,211,153,0.22)',
            background: 'rgba(6,78,59,0.24)',
            color: '#f8fafc',
            fontWeight: 800,
            cursor: 'default'
          }}
        >
          Lista
        </button>

        <button
          type="button"
          onClick={() => navigate('/configuracoes/aquisicao/lote')}
          style={{
            padding: '10px 14px',
            borderRadius: 12,
            border: '1px solid rgba(52,211,153,0.18)',
            background: 'rgba(15,23,42,0.4)',
            color: '#f8fafc',
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          Lote
        </button>
      </section>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12
        }}
      >
        <SmallStatCard label="TOTAL LIDO" value={summary.total} hint="Quantidade bruta identificada na entrada." />
        <SmallStatCard label="VÁLIDOS" value={summary.valid} hint="Prontos para a execução real desta etapa." />
        <SmallStatCard label="DUPLICADOS" value={summary.duplicate} hint="Contatos repetidos separados antes do envio." />
        <SmallStatCard label="INVÁLIDOS" value={summary.invalid} hint="Números fora do padrão esperado ficaram fora da execução." />
        <SmallStatCard label="SEM PARÂMETRO" value={summary.missingParams} hint="Linhas com telefone válido mas sem dados suficientes para preencher o template." />
      </section>

      <section
        style={{
          border: '1px solid rgba(52,211,153,0.14)',
          background: 'linear-gradient(180deg, rgba(2,6,23,0.72), rgba(2,12,27,0.92))',
          borderRadius: 18,
          padding: 16
        }}
      >
        <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 700, marginBottom: 8 }}>Contatos da lista</div>
        <textarea
          value={contactsText}
          onChange={(e) => setContactsText(e.target.value)}
          rows={5}
          placeholder={getListInputPlaceholder(requiredParamCount)}
          style={{
            width: '100%',
            borderRadius: 14,
            border: '1px solid rgba(148,163,184,0.18)',
            background: '#03111c',
            color: '#f8fafc',
            padding: '14px 16px',
            resize: 'vertical'
          }}
        />

        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 10 }}>
          {helperText}
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.csv"
            style={{ display: 'none' }}
            onChange={handleImportFile}
          />

          <button
            type="button"
            onClick={handleImportClick}
            style={{
              padding: '10px 14px',
              borderRadius: 12,
              border: '1px solid rgba(52,211,153,0.18)',
              background: 'rgba(15,23,42,0.4)',
              color: '#f8fafc',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Importar CSV/TXT
          </button>

          <button
            type="button"
            onClick={() => navigate('/configuracoes/aquisicao')}
            style={{
              padding: '10px 14px',
              borderRadius: 12,
              border: '1px solid rgba(52,211,153,0.18)',
              background: 'rgba(15,23,42,0.4)',
              color: '#f8fafc',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Abrir disparo individual
          </button>

          <button
            type="button"
            onClick={loadTemplates}
            disabled={loadingTemplates}
            style={{
              padding: '10px 14px',
              borderRadius: 12,
              border: '1px solid rgba(52,211,153,0.18)',
              background: loadingTemplates ? 'rgba(15,23,42,0.6)' : 'rgba(15,23,42,0.4)',
              color: '#f8fafc',
              fontWeight: 700,
              cursor: loadingTemplates ? 'not-allowed' : 'pointer'
            }}
          >
            {loadingTemplates ? 'Atualizando templates...' : 'Atualizar templates'}
          </button>

          <button
            type="button"
            onClick={handleExecuteList}
          disabled={executeButtonDisabled}
          title={executeButtonTitle}
          aria-disabled={executeButtonDisabled}
            
            style={{
              padding: '10px 16px',
              borderRadius: 12,
              border: '1px solid rgba(52,211,153,0.24)',
              background:
                sending || loadingTemplates || !selectedTemplate || summary.valid === 0 || unsupportedDynamicTypes
                  ? 'rgba(15,23,42,0.6)'
                  : 'rgba(6,78,59,0.28)',
              color: '#f8fafc',
              fontWeight: 800,
              cursor:
                sending || loadingTemplates || !selectedTemplate || summary.valid === 0 || unsupportedDynamicTypes
                  ? 'not-allowed'
                  : 'pointer'
            }}
          >
            {executeButtonLabel}
          </button>
        </div>

        {templateError ? (
          <div
            style={{
              marginTop: 12,
              padding: '12px 14px',
              borderRadius: 12,
              border: '1px solid rgba(248,113,113,0.22)',
              background: 'rgba(127,29,29,0.18)',
              color: '#fecaca',
              fontSize: 14
            }}
          >
            {templateError}
          </div>
        ) : null}

        {unsupportedDynamicTypes ? (
          <div
            style={{
              marginTop: 12,
              padding: '12px 14px',
              borderRadius: 12,
              border: '1px solid rgba(245,158,11,0.22)',
              background: 'rgba(120,53,15,0.18)',
              color: '#fde68a',
              fontSize: 14
            }}
          >
            O template selecionado possui tipos de parâmetros ainda não suportados nesta etapa. Esta versão suporta apenas parâmetros textuais.
          </div>
        ) : null}

        {requiredParamCount > 0 ? (
          <div
            style={{
              marginTop: 12,
              padding: '12px 14px',
              borderRadius: 12,
              border: '1px solid rgba(59,130,246,0.22)',
              background: 'rgba(30,64,175,0.14)',
              color: '#bfdbfe',
              fontSize: 14
            }}
          >
            O template selecionado exige <strong>{requiredParamCount}</strong> parâmetro(s) por linha, além do telefone.
          </div>
        ) : null}

        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 700, marginBottom: 8 }}>Template base</div>

          <select
            value={selectedTemplateKey}
            onChange={(e) => setSelectedTemplateKey(e.target.value)}
            style={{
              width: '100%',
              borderRadius: 12,
              border: '1px solid rgba(148,163,184,0.18)',
              background: '#03111c',
              color: '#f8fafc',
              padding: '12px 14px'
            }}
          >
            {templates.map((item) => {
              const itemName = String(item?.name || '').trim().toLowerCase();
              const suffix =
                itemName === 'retorno_solicitacao_autoatende_v3'
                  ? ' · recomendado'
                  : itemName === 'autoatende_probe_full_01'
                  ? ' · fallback'
                  : '';

              return (
                <option key={item.key} value={item.key}>
                  {`${buildListTemplateOptionLabel(item)}${suffix}`}
                </option>
              );
            })}
          </select>
        </div>

        {selectedTemplate ? (
          <div
            style={{
              marginTop: 12,
              border: '1px solid rgba(52,211,153,0.12)',
              background: 'rgba(2,6,23,0.48)',
              borderRadius: 16,
              padding: 14,
              whiteSpace: 'pre-wrap',
              color: '#f8fafc',
              lineHeight: 1.6
            }}
          >
            {selectedTemplate.previewText || 'Sem preview disponível para este template.'}
          </div>
        ) : null}
      </section>

      <section
        style={{
          border: '1px solid rgba(52,211,153,0.14)',
          background: 'linear-gradient(180deg, rgba(2,6,23,0.72), rgba(2,12,27,0.92))',
          borderRadius: 18,
          padding: 16
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 800, color: '#60a5fa', letterSpacing: '0.12em', marginBottom: 10 }}>
          PRÉ-VISUALIZAÇÃO DA VALIDAÇÃO
        </div>

        {rows.length === 0 ? (
          <div style={{ fontSize: 14, color: '#94a3b8' }}>Nenhum contato informado até o momento.</div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {rows.map((row, index) => {
              const badge = stateBadge(row.state);
              return (
                <div
                  key={`${row.raw}-${index}`}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(180px, 1fr) minmax(180px, 1fr) minmax(200px, 1fr) auto',
                    gap: 12,
                    alignItems: 'center',
                    border: '1px solid rgba(52,211,153,0.10)',
                    background: 'rgba(2,6,23,0.36)',
                    borderRadius: 14,
                    padding: '12px 14px'
                  }}
                >
                  <div style={{ color: '#f8fafc', fontWeight: 700 }}>{row.raw}</div>
                  <div style={{ color: '#9fb3c8', fontSize: 14 }}>{row.normalized}</div>
                  <div style={{ color: '#94a3b8', fontSize: 13 }}>
                    {row.paramsUsed.length > 0 ? row.paramsUsed.join(' | ') : '—'}
                  </div>
                  <div
                    style={{
                      padding: '4px 10px',
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 800,
                      color: badge.color,
                      border: badge.border,
                      background: badge.background
                    }}
                  >
                    {badge.label}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section
        style={{
          border: '1px solid rgba(52,211,153,0.14)',
          background: 'linear-gradient(180deg, rgba(2,6,23,0.72), rgba(2,12,27,0.92))',
          borderRadius: 18,
          padding: 16
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 800, color: '#60a5fa', letterSpacing: '0.12em', marginBottom: 10 }}>
          EXECUÇÃO REAL DA LISTA
        </div>

        {executionSummary ? (
          <div
            style={{
              marginBottom: 14,
              padding: '12px 14px',
              borderRadius: 12,
              border: executionSummary.ok ? '1px solid rgba(52,211,153,0.22)' : '1px solid rgba(245,158,11,0.22)',
              background: executionSummary.ok ? 'rgba(6,78,59,0.18)' : 'rgba(120,53,15,0.18)',
              color: executionSummary.ok ? '#d1fae5' : '#fde68a',
              fontSize: 14
            }}
          >
            <div style={{ fontWeight: 800, marginBottom: 4 }}>{executionSummary.message}</div>
            {'sentCount' in executionSummary ? (
              <div style={{ fontSize: 13 }}>
                enviados: <strong>{executionSummary.sentCount}</strong>
                {' · '}
                falhas: <strong>{executionSummary.failedCount}</strong>
                {' · '}
                ignorados: <strong>{executionSummary.skippedCount}</strong>
              </div>
            ) : null}
          </div>
        ) : (
          <div style={{ fontSize: 14, color: '#94a3b8', marginBottom: 12 }}>
            Esta etapa envia os contatos válidos da lista usando o endpoint já validado do disparo individual, agora com suporte a parâmetros textuais por linha.
          </div>
        )}

        {executionRows.length === 0 ? (
          <div style={{ fontSize: 14, color: '#94a3b8' }}>Nenhuma execução realizada até o momento.</div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {executionRows.map((row, index) => {
              const badge = executionBadge(row.status);
              return (
                <div
                  key={`${row.contact}-${index}`}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(180px, 1fr) minmax(260px, 2fr) auto',
                    gap: 12,
                    alignItems: 'center',
                    border: '1px solid rgba(52,211,153,0.10)',
                    background: 'rgba(2,6,23,0.36)',
                    borderRadius: 14,
                    padding: '12px 14px'
                  }}
                >
                  <div style={{ color: '#f8fafc', fontWeight: 700 }}>{row.contact}</div>
                  <div style={{ color: '#9fb3c8', fontSize: 14 }}>{row.detail}</div>
                  <div
                    style={{
                      padding: '4px 10px',
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 800,
                      color: badge.color,
                      border: badge.border,
                      background: badge.background
                    }}
                  >
                    {badge.label}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
