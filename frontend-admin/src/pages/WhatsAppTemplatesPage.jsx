/* __AUTOATENDE_V4_R6C_DISPAROS_COMMERCIAL_COPY_ALIGNMENT__ */
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import TemplateCreationPanel from '../components/TemplateCreationPanel';

const PAGE_MARKER = '__AUTOATENDE_C16N_C7A_R1_FIX2_TEMPLATES_SURFACE__';

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch (_) {
    return null;
  }
}

function extractTokenCandidate(input, depth = 0) {
  if (!input || depth > 5) return null;

  if (typeof input === 'string') {
    const value = input.trim();
    if (!value) return null;
    if (value.startsWith('Bearer ')) return value;
    if (value.startsWith('eyJ')) return `Bearer ${value}`;

    const parsed = safeJsonParse(value);
    if (parsed) return extractTokenCandidate(parsed, depth + 1);

    return null;
  }

  if (Array.isArray(input)) {
    for (const item of input) {
      const token = extractTokenCandidate(item, depth + 1);
      if (token) return token;
    }
    return null;
  }

  if (typeof input === 'object') {
    const preferred = [
      'access_token',
      'accessToken',
      'token',
      'jwt',
      'authorization',
      'Authorization',
      'session',
      'currentSession'
    ];

    for (const key of preferred) {
      if (key in input) {
        const token = extractTokenCandidate(input[key], depth + 1);
        if (token) return token;
      }
    }

    for (const key of Object.keys(input)) {
      const token = extractTokenCandidate(input[key], depth + 1);
      if (token) return token;
    }
  }

  return null;
}

function resolveAuthHeader() {
  try {
    const winSources = [
      window.__AUTOATENDE_SESSION__,
      window.__AUTOATENDE_AUTH__,
      window.__AUTOATENDE_USER__
    ];

    for (const source of winSources) {
      const token = extractTokenCandidate(source);
      if (token) return token;
    }
  } catch (_) {}

  try {
    const preferredKeys = [
      'auth_user',
      'autoatende_user',
      'supabase.auth.token',
      'sb-auth-token'
    ];

    for (const key of preferredKeys) {
      const raw = localStorage.getItem(key);
      const token = extractTokenCandidate(raw);
      if (token) return token;
    }

    for (const key of Object.keys(localStorage || {})) {
      const raw = localStorage.getItem(key);
      const token = extractTokenCandidate(raw);
      if (token) return token;
    }
  } catch (_) {}

  return null;
}

function normalizeCategory(value = '') {
  const v = String(value || '').toLowerCase();
  if (v.includes('marketing')) return 'marketing';
  if (v.includes('utility') || v.includes('auth')) return 'utility_auth';
  return v || 'other';
}

function formatTemplateStatusLabel(value = '') {
  const normalized = String(value || '').trim().toLowerCase();

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

  return map[normalized] || normalized.replace(/_/g, ' ') || 'desconhecido';
}


const TEMPLATE_REJECTION_OBSERVABILITY_R2J_MARKER = '__AUTOATENDE_C16N_C7C_R1E_R2J_FRONTEND__';

const rejectedTemplateDiagnosticsStyles = {
  panel: {
    marginBottom: 18,
    padding: '16px 18px',
    borderRadius: 14,
    border: '1px solid rgba(248,113,113,0.22)',
    background: 'rgba(127,29,29,0.16)',
    color: '#fecaca'
  },
  panelTitle: {
    fontWeight: 800,
    marginBottom: 10
  },
  list: {
    display: 'grid',
    gap: 10
  },
  card: {
    padding: '12px 14px',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(0,0,0,0.12)'
  },
  cardTitle: {
    fontWeight: 700,
    marginBottom: 6
  },
  fields: {
    display: 'grid',
    gap: 4,
    fontSize: 13
  }
};

function aaFormatQualityScore(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value.score) return String(value.score);
  try {
    return JSON.stringify(value);
  } catch (_) {
    return String(value);
  }
}

function aaReadTemplateDiagnostics(row = {}) {
  const raw = row?.rawMetaDiagnostics || {};
  return {
    rejectedReason: row?.rejectedReason || raw?.rejectedReason || null,
    reviewStatus: row?.reviewStatus || raw?.reviewStatus || row?.status || null,
    qualityScore: aaFormatQualityScore(row?.qualityScore || raw?.qualityScore),
    category: row?.category || raw?.category || null
  };
}


const TEMPLATE_OPERATIONAL_BADGES_MARKER = '__AUTOATENDE_C16N_C7D_R1B_TEMPLATE_CATALOG_OPERATIONAL_BADGES__';

const templateOperationalBadgeStyles = {
  row: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 10
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
  pending: {
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    color: '#fde68a',
    border: '1px solid rgba(245,158,11,0.28)',
    background: 'rgba(120,53,15,0.24)'
  },
  legacyRejected: {
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    color: '#fecaca',
    border: '1px solid rgba(248,113,113,0.28)',
    background: 'rgba(127,29,29,0.24)'
  }
};

function getTemplateOperationalProfile(row = {}) {
  const name = String(row?.name || '').trim().toLowerCase();
  const status = String(row?.status || '').trim().toLowerCase();

  const recommendedNames = new Set([
    'retorno_solicitacao_autoatende_v3',
    'confirmacao_contato_autoatende_03'
  ]);

  const fallbackNames = new Set([
    'autoatende_probe_full_01'
  ]);

  const legacyRejectedNames = new Set([
    'retorno_solicitacao_autoatende_param_01',
    'retorno_solicitacao_autoatende_param_02',
    'retorno_solicitacao_autoatende_param_03',
    'retorno_solicitacao_autoatende_v2',
    'confirmacao_contato_autoatende_01'
  ]);

  const tags = [];

  if (recommendedNames.has(name)) {
    tags.push({
      key: 'recommended',
      label: 'Recomendado',
      style: templateOperationalBadgeStyles.recommended
    });
  }

  if (fallbackNames.has(name)) {
    tags.push({
      key: 'fallback',
      label: 'Fallback técnico',
      style: templateOperationalBadgeStyles.fallback
    });
  }

  if (status === 'pending' && recommendedNames.has(name)) {
    tags.push({
      key: 'pending_validation',
      label: 'Em validação final',
      style: templateOperationalBadgeStyles.pending
    });
  }

  if (status === 'rejected' && legacyRejectedNames.has(name)) {
    tags.push({
      key: 'legacy_rejected',
      label: 'Legado rejeitado',
      style: templateOperationalBadgeStyles.legacyRejected
    });
  }

  return tags;
}

function renderTemplateOperationalBadges(row = {}) {
  const tags = getTemplateOperationalProfile(row);
  if (!tags.length) return null;

  return (
    <div data-aa-marker={TEMPLATE_OPERATIONAL_BADGES_MARKER} style={templateOperationalBadgeStyles.row}>
      {tags.map((tag) => (
        <span key={tag.key} style={tag.style}>
          {tag.label}
        </span>
      ))}
    </div>
  );
}


function aaR6eResolveTemplateStatusGroup(row = {}) {
  const rawStatus = String(row?.status || row?.reviewStatus || row?.statusLabel || '').trim().toLowerCase();

  if (
    row?.isSendable ||
    rawStatus === 'approved' ||
    rawStatus.includes('aprov') ||
    rawStatus.includes('pronto')
  ) {
    return 'approved';
  }

  if (
    rawStatus === 'pending' ||
    rawStatus === 'in_review' ||
    rawStatus.includes('pend') ||
    rawStatus.includes('análise') ||
    rawStatus.includes('analise') ||
    rawStatus.includes('review')
  ) {
    return 'pending';
  }

  if (
    rawStatus === 'rejected' ||
    rawStatus.includes('reject') ||
    rawStatus.includes('rejeit') ||
    rawStatus.includes('recus')
  ) {
    return 'rejected';
  }

  return 'pending';
}

function renderRejectedTemplatesDiagnostics(rows = []) {
  const rejectedRows = (Array.isArray(rows) ? rows : []).filter((row) => {
    const status = String(row?.status || row?.reviewStatus || '').trim().toLowerCase();
    return status === 'rejected' || status.includes('rejeit') || status.includes('reject');
  });

  if (!rejectedRows.length) return null;

  return (
    <div data-aa-marker={TEMPLATE_REJECTION_OBSERVABILITY_R2J_MARKER} style={rejectedTemplateDiagnosticsStyles.panel}>
      <div style={rejectedTemplateDiagnosticsStyles.panelTitle}>
        Diagnóstico de templates rejeitados
      </div>

      <div style={rejectedTemplateDiagnosticsStyles.list}>
        {rejectedRows.map((row, index) => {
          const diag = aaReadTemplateDiagnostics(row);

          return (
            <div
              key={row.id || row.name || index}
              style={rejectedTemplateDiagnosticsStyles.card}
            >
              <div style={rejectedTemplateDiagnosticsStyles.cardTitle}>
                {row.name || 'Template sem nome'}
              </div>

              <div style={rejectedTemplateDiagnosticsStyles.fields}>
                <div><strong>Status:</strong> {String(diag.reviewStatus || 'rejected')}</div>
                <div><strong>Motivo:</strong> {String(diag.rejectedReason || 'Meta não devolveu motivo explícito no catálogo')}</div>
                {diag.qualityScore ? <div><strong>Quality score:</strong> {String(diag.qualityScore)}</div> : null}
                {diag.category ? <div><strong>Categoria:</strong> {String(diag.category)}</div> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function resolveTemplateStatusPill(status = '', isSendable = false) {
  const normalized = String(status || '').trim().toLowerCase();

  if (isSendable || normalized === 'approved') {
    return {
      label: 'pronto para disparo',
      color: '#d1fae5',
      border: '1px solid rgba(52,211,153,0.18)',
      background: 'rgba(6,78,59,0.22)'
    };
  }

  if (normalized === 'pending' || normalized === 'in_review') {
    return {
      label: normalized === 'in_review' ? 'em análise' : 'pendente',
      color: '#fde68a',
      border: '1px solid rgba(245,158,11,0.28)',
      background: 'rgba(120,53,15,0.24)'
    };
  }

  if (normalized === 'rejected') {
    return {
      label: 'rejeitado',
      color: '#fecaca',
      border: '1px solid rgba(248,113,113,0.28)',
      background: 'rgba(127,29,29,0.24)'
    };
  }

  return {
    label: formatTemplateStatusLabel(normalized),
    color: '#cbd5e1',
    border: '1px solid rgba(148,163,184,0.22)',
    background: 'rgba(15,23,42,0.35)'
  };
}

function normalizeTemplateItem(item = {}, index = 0) {
  const status = String(item?.status || item?.state || 'unknown').trim().toLowerCase();
  const isSendable = Boolean(item?.isSendable ?? status === 'approved');

  return {
    id: item?.id || `${item?.name || 'template'}-${item?.language || 'lang'}-${index}`,
    name: String(item?.name || item?.template_name || 'Template sem nome').trim(),
    language: String(item?.language || item?.locale || '—').trim(),
    category: normalizeCategory(item?.category || item?.template_category),
    status,
    statusLabel: String(item?.statusLabel || item?.status_label || formatTemplateStatusLabel(status)).trim(),
    isSendable,
    previewText: String(
      item?.previewText ||
      item?.preview_text ||
      item?.bodyPreview ||
      item?.body_preview ||
      item?.content ||
      ''
    ).trim(),
    autofillWarnings: Array.isArray(item?.autofillWarnings)
      ? item.autofillWarnings
      : Array.isArray(item?.autofill_warnings)
      ? item.autofill_warnings
      : []
  };
}

function shorten(text = '', max = 700) {
  const safe = String(text || '').trim();
  if (!safe) return '';
  if (safe.length <= max) return safe;
  return `${safe.slice(0, max - 1)}…`;
}

export default function WhatsAppTemplatesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const openedFromDisparos = location.pathname.startsWith('/configuracoes/aquisicao');
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [category, setCategory] = React.useState('all');
  const [language, setLanguage] = React.useState('all');

  const fetchTemplates = React.useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const authHeader = resolveAuthHeader();
      const headers = {};
      if (authHeader) headers.Authorization = authHeader;

      const response = await fetch('/api/ops-surface/acquisition/templates/catalog', {
        method: 'GET',
        credentials: 'include',
        headers
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || `Falha ao carregar templates (${response.status}).`);
      }

      const sourceRows = Array.isArray(payload?.templates)
        ? payload.templates
        : Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload?.data)
        ? payload.data
        : [];

      setRows(sourceRows.map((item, index) => normalizeTemplateItem(item, index)));
    } catch (err) {
      setRows([]);
      setError(err?.message || 'Falha inesperada ao carregar templates.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const languages = React.useMemo(() => {
    return Array.from(new Set(rows.map((row) => row.language).filter(Boolean))).sort();
  }, [rows]);

  const [templateStatusView, setTemplateStatusView] = React.useState('approved'); // __AUTOATENDE_V4_R6E_TEMPLATES_STATUS_GROUPING__

  const filteredRows = React.useMemo(() => {
    const q = String(query || '').trim().toLowerCase();

    return rows.filter((row) => {
      const haystack = [
        row.name,
        row.language,
        row.category,
        row.status,
        row.previewText
      ].join(' ').toLowerCase();

      const matchQuery = !q || haystack.includes(q);
      const matchCategory = category === 'all' || row.category === category;
      const matchLanguage = language === 'all' || row.language === language;

      return matchQuery && matchCategory && matchLanguage;
    });
  }, [rows, query, category, language]);

  const templateStatusBuckets = React.useMemo(() => {
    const buckets = {
      approved: [],
      pending: [],
      rejected: []
    };

    filteredRows.forEach((row) => {
      const group = aaR6eResolveTemplateStatusGroup(row);
      if (buckets[group]) buckets[group].push(row);
      else buckets.pending.push(row);
    });

    return buckets;
  }, [filteredRows]);

  const statusVisibleRows = React.useMemo(() => {
    return templateStatusBuckets[templateStatusView] || [];
  }, [templateStatusBuckets, templateStatusView]);

  const templateStatusTabs = React.useMemo(() => ([
    {
      id: 'approved',
      label: 'Aprovados',
      count: templateStatusBuckets.approved.length,
      accent: '#34d399',
      description: 'prontos para disparo'
    },
    {
      id: 'pending',
      label: 'Pendentes',
      count: templateStatusBuckets.pending.length,
      accent: '#60a5fa',
      description: 'em análise ou aguardando'
    },
    {
      id: 'rejected',
      label: 'Rejeitados',
      count: templateStatusBuckets.rejected.length,
      accent: '#f87171',
      description: 'precisam revisão'
    }
  ]), [templateStatusBuckets]);


  return (
    <div
      className="aa-page-shell aa-settings-shell"
      data-aa-marker={PAGE_MARKER}
      style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
    >
      <section
        style={{
          border: '1px solid rgba(52,211,153,0.18)',
          background: 'linear-gradient(135deg, rgba(3,10,18,0.96), rgba(4,20,28,0.92))',
          padding: 24,
          borderRadius: 18
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.14em', color: '#34d399', marginBottom: 8 }}>
          {openedFromDisparos ? 'DISPAROS · TEMPLATES' : 'TEMPLATES · FUNDAÇÃO DE GESTÃO'}
        </div>

        <h1 style={{ margin: 0, fontSize: 34, lineHeight: 1.05, color: '#f8fafc' }}>
          Templates WhatsApp
        </h1>

        <p style={{ marginTop: 12, marginBottom: 0, color: '#9fb3c8', maxWidth: 920 }}>
          {openedFromDisparos ? 'Catálogo operacional completo de templates dentro do fluxo de Disparos. Aqui você acompanha o status real do catálogo sem contaminar a superfície de envio.' : 'Catálogo completo dos templates da empresa, com leitura de status sincronizada para separar gestão do que está realmente pronto para envio.'}
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
          alignItems: 'center'
        }}
      >
        <button
          onClick={() => navigate('/configuracoes/aquisicao')}
          style={{
            padding: '10px 14px',
            borderRadius: 12,
            border: '1px solid rgba(148,163,184,0.18)',
            background: openedFromDisparos ? 'rgba(6,78,59,0.22)' : 'transparent',
            color: '#f8fafc',
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          Disparos
        </button>

        <button
          onClick={() => navigate('/configuracoes/aquisicao/templates')}
          style={{
            padding: '10px 14px',
            borderRadius: 12,
            border: '1px solid rgba(52,211,153,0.25)',
            background: 'rgba(6,78,59,0.28)',
            color: '#d1fae5',
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

            <TemplateCreationPanel />

<section
        style={{
          border: '1px solid rgba(148,163,184,0.16)',
          background: 'rgba(5,15,28,0.9)',
          borderRadius: 18,
          padding: 18,
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          alignItems: 'center'
        }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar template, idioma, categoria ou conteúdo"
          style={{
            minWidth: 280,
            flex: 1,
            padding: '12px 14px',
            borderRadius: 12,
            border: '1px solid rgba(148,163,184,0.18)',
            background: '#03111c',
            color: '#f8fafc'
          }}
        />

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          style={{
            minWidth: 180,
            padding: '12px 14px',
            borderRadius: 12,
            border: '1px solid rgba(148,163,184,0.18)',
            background: '#03111c',
            color: '#f8fafc'
          }}
        >
          <option value="all">Todas categorias</option>
          <option value="marketing">Marketing</option>
          <option value="utility_auth">Utility/Auth</option>
          <option value="other">Outras</option>
        </select>

        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          style={{
            minWidth: 150,
            padding: '12px 14px',
            borderRadius: 12,
            border: '1px solid rgba(148,163,184,0.18)',
            background: '#03111c',
            color: '#f8fafc'
          }}
        >
          <option value="all">Todos idiomas</option>
          {languages.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>

        <button
          onClick={fetchTemplates}
          style={{
            padding: '12px 16px',
            borderRadius: 12,
            border: '1px solid rgba(52,211,153,0.25)',
            background: 'rgba(6,78,59,0.28)',
            color: '#d1fae5',
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          Atualizar
        </button>
      </section>

      <section
        style={{
          border: '1px solid rgba(148,163,184,0.16)',
          background: 'rgba(5,15,28,0.9)',
          borderRadius: 18,
          padding: 18
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.12em', color: '#60a5fa', marginBottom: 6 }}>
              CATÁLOGO POR STATUS
            </div>
            <div style={{ color: '#f8fafc', fontSize: 24, fontWeight: 800 }}>
              {filteredRows.length}
            </div>
          </div>

          <div style={{ color: '#94a3b8', alignSelf: 'center' }}>
            Organize a operação por status: aprovados para uso, pendentes em acompanhamento e rejeitados para revisão.
          </div>
        </div>


        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 10,
            marginBottom: 18
          }}
        >
          {templateStatusTabs.map((tab) => {
            const active = templateStatusView === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTemplateStatusView(tab.id)}
                style={{
                  textAlign: 'left',
                  borderRadius: 14,
                  border: active ? `1px solid ${tab.accent}` : '1px solid rgba(148,163,184,0.14)',
                  background: active ? 'rgba(6,78,59,0.22)' : 'rgba(2,8,20,0.72)',
                  padding: '14px 16px',
                  cursor: 'pointer',
                  boxShadow: active ? '0 0 0 3px rgba(52,211,153,0.08)' : 'none'
                }}
              >
                <div style={{ color: tab.accent, fontSize: 12, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  {tab.label}
                </div>
                <div style={{ color: '#f8fafc', fontSize: 26, fontWeight: 900, marginTop: 6 }}>
                  {tab.count}
                </div>
                <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>
                  {tab.description}
                </div>
              </button>
            );
          })}
        </div>

        {loading ? (
          <div style={{ color: '#94a3b8' }}>Carregando templates...</div>
        ) : error ? (
          <div style={{ color: '#fca5a5' }}>{error}</div>
        ) : filteredRows.length === 0 ? (
          <div style={{ color: '#94a3b8' }}>Nenhum template encontrado para os filtros atuais.</div>
        ) : statusVisibleRows.length === 0 ? (
          <div style={{ color: '#94a3b8' }}>
            Nenhum template nesta categoria com os filtros atuais.
          </div>
        ) : (
          <>
            {templateStatusView === 'rejected' ? renderRejectedTemplatesDiagnostics(statusVisibleRows) : null}
            <div style={{ display: 'grid', gap: 14 }}>
              {statusVisibleRows.map((row) => (
              <article
                key={row.id}
                style={{
                  border: '1px solid rgba(148,163,184,0.14)',
                  borderRadius: 16,
                  padding: 18,
                  background: 'linear-gradient(180deg, rgba(2,8,20,0.92), rgba(4,18,28,0.88))'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
                  <div>
                    <div style={{ color: '#f8fafc', fontSize: 20, fontWeight: 800 }}>
                      {row.name}
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 4 }}>
                      {row.language} · {row.category} · {row.statusLabel}
                    </div>
                    {renderTemplateOperationalBadges(row)}
                  </div>

                  {(() => {
                  const pill = resolveTemplateStatusPill(row.status, row.isSendable);
                  return (
                    <div
                      style={{
                        alignSelf: 'flex-start',
                        padding: '6px 10px',
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 700,
                        color: pill.color,
                        border: pill.border,
                        background: pill.background
                      }}
                    >
                      {pill.label}
                    </div>
                  );
                })()}
                </div>

                <div
                  style={{
                    border: '1px solid rgba(96,165,250,0.14)',
                    borderRadius: 14,
                    padding: 14,
                    background: 'rgba(2,12,24,0.7)',
                    color: '#dbeafe',
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.5,
                    fontSize: 14
                  }}
                >
                  {shorten(row.previewText) || 'Sem preview textual disponível.'}
                </div>

                {row.autofillWarnings.length > 0 ? (
                  <div style={{ marginTop: 10, color: '#fcd34d', fontSize: 13 }}>
                    {row.autofillWarnings.join(' • ')}
                  </div>
                ) : null}
              </article>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
