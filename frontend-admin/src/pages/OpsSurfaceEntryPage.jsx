import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BarChart3,
  ExternalLink,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  AlertCircle,
  MousePointerClick,
  Globe2,
  Clock3,
  Mouse,
  FileText,
  Target,
  Link2,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// __AUTOATENDE_C13D_R8D_SHOW_SNAPSHOT_DELTAS__

const OPS_SURFACE_URL = '/ops-surface/index.html';
const SNAPSHOT_API_URL = '/api/ops-surface/site-clicks-summary';

const shellCardStyle = {
  background: 'rgba(15, 23, 42, 0.72)',
  border: '1px solid rgba(148, 163, 184, 0.18)',
  borderRadius: 20,
  boxShadow: '0 12px 40px rgba(2, 6, 23, 0.18)',
  backdropFilter: 'blur(10px)'
};

const mutedTextStyle = { color: '#94a3b8' };
const titleTextStyle = { color: '#f8fafc' };

function pickFirstNumber(obj, keys) {
  if (!obj || typeof obj !== 'object') return null;
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) return Number(value);
  }
  return null;
}

function pickFirstString(obj, keys) {
  if (!obj || typeof obj !== 'object') return null;
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function sanitizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function sanitizeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function formatNumber(value) {
  if (value === null || value === undefined || value === '') return '—';
  try {
    return new Intl.NumberFormat('pt-BR').format(Number(value));
  } catch {
    return String(value);
  }
}

function formatDate(value) {
  if (!value) return 'Sem registro recente';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(parsed);
  } catch {
    return parsed.toLocaleString('pt-BR');
  }
}

function formatPercentDelta(value) {
  if (value === null || value === undefined || value === '') return '—';
  const pct = Number(value) * 100;
  if (!Number.isFinite(pct)) return '—';
  return `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`;
}

function compactText(value, max = 80) {
  const text = String(value || '').trim();
  if (!text) return '—';
  if (text.length <= max) return text;
  return `${text.slice(0, max).trim()}...`;
}

function getRankLabel(item, fallback) {
  return (
    pickFirstString(item, ['label']) ||
    pickFirstString(item, ['source', 'name', 'utm_source', 'campaign', 'utm_campaign', 'path', 'landing_page', 'url', 'refhost', 'host', 'domain']) ||
    fallback
  );
}

function getRankValue(item) {
  return (
    pickFirstNumber(item, ['value']) ??
    pickFirstNumber(item, ['clicks', 'count', 'events', 'total', 'conversions', 'total_conversions', 'leads']) ??
    0
  );
}

function getLeader(items, fallbackLabel) {
  const safe = sanitizeArray(items);
  if (!safe.length) return null;
  const sorted = [...safe].sort((a, b) => (getRankValue(b) || 0) - (getRankValue(a) || 0));
  const top = sorted[0];
  return {
    label: compactText(getRankLabel(top, fallbackLabel), 64),
    value: getRankValue(top),
    raw: top
  };
}

function MetricCard({ icon: Icon, label, value, helper }) {
  return (
    <div style={{ ...shellCardStyle, padding: '1rem 1.1rem', minHeight: 132 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(34, 197, 94, 0.12)',
            color: '#22c55e'
          }}
        >
          <Icon size={18} />
        </div>
        <span style={{ ...mutedTextStyle, fontSize: 13, fontWeight: 600 }}>{label}</span>
      </div>

      <div style={{ ...titleTextStyle, fontSize: 28, fontWeight: 800, lineHeight: 1.1, marginBottom: 8 }}>
        {value}
      </div>

      <div style={{ ...mutedTextStyle, fontSize: 13, lineHeight: 1.5 }}>
        {helper}
      </div>
    </div>
  );
}

function StatusBanner({ tone = 'neutral', title, description, action }) {
  const toneMap = {
    success: {
      border: 'rgba(34, 197, 94, 0.35)',
      background: 'rgba(34, 197, 94, 0.10)',
      icon: ShieldCheck,
      iconColor: '#22c55e'
    },
    warning: {
      border: 'rgba(250, 204, 21, 0.35)',
      background: 'rgba(250, 204, 21, 0.10)',
      icon: ShieldAlert,
      iconColor: '#facc15'
    },
    danger: {
      border: 'rgba(248, 113, 113, 0.35)',
      background: 'rgba(248, 113, 113, 0.10)',
      icon: AlertCircle,
      iconColor: '#f87171'
    },
    neutral: {
      border: 'rgba(148, 163, 184, 0.24)',
      background: 'rgba(15, 23, 42, 0.42)',
      icon: BarChart3,
      iconColor: '#cbd5e1'
    }
  };

  const currentTone = toneMap[tone] || toneMap.neutral;
  const Icon = currentTone.icon;

  return (
    <div
      style={{
        border: `1px solid ${currentTone.border}`,
        background: currentTone.background,
        borderRadius: 18,
        padding: '1rem 1.1rem'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: currentTone.iconColor,
            background: 'rgba(255,255,255,0.04)',
            flexShrink: 0
          }}
        >
          <Icon size={18} />
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ ...titleTextStyle, fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
            {title}
          </div>
          <div style={{ ...mutedTextStyle, fontSize: 14, lineHeight: 1.6 }}>
            {description}
          </div>
          {action ? <div style={{ marginTop: 12 }}>{action}</div> : null}
        </div>
      </div>
    </div>
  );
}

function SimpleTableCard({ icon: Icon, title, description, items, itemFormatter }) {
  const safeItems = sanitizeArray(items).slice(0, 5);

  return (
    <div style={{ ...shellCardStyle, padding: '1.2rem 1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(34, 197, 94, 0.12)',
            color: '#22c55e'
          }}
        >
          <Icon size={18} />
        </div>
        <div>
          <div style={{ ...titleTextStyle, fontSize: 16, fontWeight: 700 }}>{title}</div>
          <div style={{ ...mutedTextStyle, fontSize: 13 }}>{description}</div>
        </div>
      </div>

      {safeItems.length === 0 ? (
        <div style={{ ...mutedTextStyle, fontSize: 14, lineHeight: 1.6 }}>
          Sem dados suficientes neste snapshot.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {safeItems.map((item, index) => (
            <div
              key={`${title}-${index}`}
              style={{
                border: '1px solid rgba(148, 163, 184, 0.14)',
                borderRadius: 14,
                padding: '0.85rem 0.95rem',
                background: 'rgba(255,255,255,0.02)'
              }}
            >
              {itemFormatter(item, index)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ExecutiveHighlight({ title, description }) {
  return (
    <div
      style={{
        border: '1px solid rgba(148, 163, 184, 0.14)',
        borderRadius: 16,
        padding: '0.95rem 1rem',
        background: 'rgba(255,255,255,0.02)'
      }}
    >
      <div style={{ ...titleTextStyle, fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{title}</div>
      <div style={{ ...mutedTextStyle, fontSize: 14, lineHeight: 1.6 }}>{description}</div>
    </div>
  );
}

function DeltaCard({ title, delta }) {
  const safe = sanitizeObject(delta);
  const absolute = pickFirstNumber(safe, ['absolute_delta']);
  const relative = pickFirstNumber(safe, ['relative_delta']);

  let tone = {
    border: 'rgba(148, 163, 184, 0.18)',
    background: 'rgba(255,255,255,0.02)',
    color: '#cbd5e1',
    icon: Minus
  };

  if (absolute !== null && absolute > 0) {
    tone = {
      border: 'rgba(34, 197, 94, 0.25)',
      background: 'rgba(34, 197, 94, 0.08)',
      color: '#86efac',
      icon: TrendingUp
    };
  } else if (absolute !== null && absolute < 0) {
    tone = {
      border: 'rgba(248, 113, 113, 0.25)',
      background: 'rgba(248, 113, 113, 0.08)',
      color: '#fca5a5',
      icon: TrendingDown
    };
  }

  const Icon = tone.icon;

  return (
    <div
      style={{
        border: `1px solid ${tone.border}`,
        background: tone.background,
        borderRadius: 16,
        padding: '1rem 1rem'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <Icon size={18} color={tone.color} />
        <div style={{ ...titleTextStyle, fontSize: 15, fontWeight: 700 }}>{title}</div>
      </div>

      <div style={{ ...titleTextStyle, fontSize: 24, fontWeight: 800, marginBottom: 6 }}>
        {absolute === null ? '—' : `${absolute > 0 ? '+' : ''}${formatNumber(absolute)}`}
      </div>

      <div style={{ ...mutedTextStyle, fontSize: 13, lineHeight: 1.5 }}>
        Variação relativa: {formatPercentDelta(relative)}
      </div>
    </div>
  );
}

export default function OpsSurfaceEntryPage() {
  const { session } = useAuth();
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSnapshot = React.useCallback(async () => {
    if (!session?.access_token) {
      setSnapshot(null);
      setError('missing_session');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(SNAPSHOT_API_URL, {
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          setError('auth');
          setSnapshot(null);
          return;
        }
        if (res.status === 404) {
          setError('not_found');
          setSnapshot(null);
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }

      const payload = await res.json();
      setSnapshot(payload?.data || null);
    } catch (err) {
      setSnapshot(null);
      setError(err?.message || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    fetchSnapshot();
  }, [fetchSnapshot]);

  const derived = useMemo(() => {
    const rawSnapshot = sanitizeObject(snapshot);
    const rawTotals = sanitizeObject(rawSnapshot.totals);
    const normalized = sanitizeObject(rawSnapshot.normalized);
    const normalizedMetrics = sanitizeObject(normalized.metrics);
    const comparison = sanitizeObject(rawSnapshot.comparison);
    const comparisonMetrics = sanitizeObject(comparison.metrics);
    const history = sanitizeObject(rawSnapshot.history);
    const currentSnapshot = sanitizeObject(rawSnapshot.current_snapshot);
    const previousSnapshot = sanitizeObject(rawSnapshot.previous_snapshot);

    const topSources = sanitizeArray(normalized.top_sources).length
      ? sanitizeArray(normalized.top_sources)
      : sanitizeArray(rawSnapshot.top_sources);

    const topLandingPages = sanitizeArray(normalized.top_landing_pages).length
      ? sanitizeArray(normalized.top_landing_pages)
      : sanitizeArray(rawSnapshot.top_landing_pages);

    const topCampaigns = sanitizeArray(normalized.top_campaigns).length
      ? sanitizeArray(normalized.top_campaigns)
      : sanitizeArray(rawSnapshot.top_campaigns);

    const topRefhosts = sanitizeArray(normalized.top_refhosts).length
      ? sanitizeArray(normalized.top_refhosts)
      : sanitizeArray(rawSnapshot.top_refhosts);

    const recentEvents = sanitizeArray(normalized.recent_events).length
      ? sanitizeArray(normalized.recent_events)
      : sanitizeArray(rawSnapshot.recent_events);

    const totalClicks =
      pickFirstNumber(normalizedMetrics, ['total_clicks']) ??
      pickFirstNumber(rawTotals, ['all_clicks', 'total_clicks', 'clicks', 'events', 'total_events']) ??
      recentEvents.length;

    const totalConversions =
      pickFirstNumber(normalizedMetrics, ['total_conversions']) ??
      pickFirstNumber(rawTotals, ['conversions', 'total_conversions', 'leads']) ??
      topCampaigns.reduce((acc, item) => acc + (getRankValue(item) || 0), 0);

    const totalSources =
      pickFirstNumber(normalizedMetrics, ['total_sources']) ??
      pickFirstNumber(rawTotals, ['origins_count', 'sources_count', 'channels_count']) ??
      topSources.length;

    const generatedAt =
      pickFirstString(normalized, ['generated_at']) ??
      pickFirstString(rawSnapshot, ['generated_at', 'updated_at', 'snapshot_at']);

    const windowDays =
      pickFirstNumber(normalized, ['window_days']) ??
      pickFirstNumber(rawSnapshot, ['window_days']);

    const leaderSource = getLeader(topSources, 'Origem líder');
    const leaderCampaign = getLeader(topCampaigns, 'Campanha líder');
    const leaderLanding = getLeader(topLandingPages, 'Landing líder');
    const leaderRefhost = getLeader(topRefhosts, 'Refhost líder');

    return {
      snapshotSource: pickFirstString(rawSnapshot, ['source']),
      snapshotPath: pickFirstString(rawSnapshot, ['snapshot_path']),
      totalClicks,
      totalConversions,
      totalSources,
      generatedAt,
      windowDays,
      topSources,
      topLandingPages,
      topCampaigns,
      topRefhosts,
      recentEvents,
      hasSnapshot: Object.keys(rawSnapshot).length > 0,
      usingNormalized: Object.keys(normalized).length > 0,
      leaderSource,
      leaderCampaign,
      leaderLanding,
      leaderRefhost,
      comparisonAvailable: comparison.available === true,
      comparisonMetrics,
      history,
      currentSnapshot,
      previousSnapshot
    };
  }, [snapshot]);

  const primaryButtonStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '0.85rem 1.15rem',
    borderRadius: 14,
    background: '#22c55e',
    color: '#052e16',
    fontWeight: 800,
    textDecoration: 'none',
    border: 'none',
    cursor: 'pointer'
  };

  const secondaryButtonStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '0.85rem 1.15rem',
    borderRadius: 14,
    background: 'transparent',
    color: '#e2e8f0',
    fontWeight: 700,
    textDecoration: 'none',
    border: '1px solid rgba(148, 163, 184, 0.22)',
    cursor: 'pointer'
  };

  const executiveSummary = useMemo(() => {
    if (!derived.hasSnapshot) return [];
    const items = [];

    if (derived.leaderSource) {
      items.push({
        title: 'Maior origem de volume',
        description: `${derived.leaderSource.label} lidera o snapshot atual com ${formatNumber(derived.leaderSource.value)} registros relevantes.`
      });
    }

    if (derived.leaderCampaign) {
      items.push({
        title: 'Campanha líder',
        description: `${derived.leaderCampaign.label} aparece como principal campanha observada no período, com ${formatNumber(derived.leaderCampaign.value)} registros.`
      });
    }

    if (derived.leaderLanding) {
      items.push({
        title: 'Landing page com maior tração',
        description: `${derived.leaderLanding.label} é a principal porta de entrada do período, com ${formatNumber(derived.leaderLanding.value)} registros.`
      });
    }

    if (derived.leaderRefhost) {
      items.push({
        title: 'Refhost mais recorrente',
        description: `${derived.leaderRefhost.label} aparece como principal domínio/refhost observado neste snapshot.`
      });
    }

    return items.slice(0, 4);
  }, [derived]);

  return (
    <div className="aa-page-container" style={{ maxWidth: 1180, margin: '0 auto', padding: '2rem 1.5rem 3rem' }}>
      <div style={{ marginBottom: '1.25rem' }}>
        <button
          type="button"
          onClick={() => window.history.back()}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            color: '#94a3b8',
            background: 'transparent',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            fontSize: 14,
            marginBottom: 16
          }}
        >
          <ArrowLeft size={16} />
          Voltar
        </button>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 14,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(34, 197, 94, 0.12)',
                  color: '#22c55e'
                }}
              >
                <BarChart3 size={20} />
              </div>
              <span
                style={{
                  fontSize: 12,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: '#86efac',
                  fontWeight: 800
                }}
              >
                Aquisição do site
              </span>
            </div>

            <h1 style={{ margin: 0, color: '#f8fafc', fontSize: 'clamp(1.8rem, 3vw, 2.5rem)', lineHeight: 1.08 }}>
              Visão operacional de cliques, origens e conversões
            </h1>
            <p style={{ margin: '0.85rem 0 0', color: '#94a3b8', fontSize: 15, lineHeight: 1.75, maxWidth: 820 }}>
              Esta versão já lê o snapshot atual, o anterior e a comparação calculada no backend, preparando a evolução da aquisição para uma leitura de tendência mais real dentro do app.
            </p>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <button type="button" onClick={fetchSnapshot} disabled={loading} style={secondaryButtonStyle}>
              <RefreshCw size={16} />
              {loading ? 'Atualizando...' : 'Atualizar snapshot'}
            </button>

            <a href={OPS_SURFACE_URL} target="_blank" rel="noopener noreferrer" style={primaryButtonStyle}>
              <ExternalLink size={16} />
              Abrir ops surface
            </a>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 16, marginBottom: 20 }}>
        {loading ? (
          <StatusBanner
            tone="neutral"
            title="Carregando snapshot operacional"
            description="Buscando o resumo interno da aquisição com histórico e comparação entre snapshots."
          />
        ) : error === 'missing_session' ? (
          <StatusBanner
            tone="warning"
            title="Sessão do app ausente"
            description="Esta tela precisa da sessão autenticada do app para consultar o endpoint interno protegido da aquisição."
          />
        ) : error === 'auth' ? (
          <StatusBanner
            tone="warning"
            title="Sem permissão para este resumo"
            description="O endpoint interno da aquisição exige autenticação do app com papel company/admin."
            action={
              <a href={OPS_SURFACE_URL} target="_blank" rel="noopener noreferrer" style={primaryButtonStyle}>
                <ExternalLink size={16} />
                Abrir ops surface protegida
              </a>
            }
          />
        ) : error === 'not_found' ? (
          <StatusBanner
            tone="warning"
            title="Snapshot ainda não disponível"
            description="O endpoint interno está montado, mas o snapshot não foi encontrado no caminho configurado do backend."
          />
        ) : error ? (
          <StatusBanner
            tone="danger"
            title="Não foi possível carregar o snapshot"
            description={`Falha ao buscar o resumo operacional da aquisição do site. Detalhe atual: ${error}.`}
            action={
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                <button type="button" onClick={fetchSnapshot} style={secondaryButtonStyle}>
                  <RefreshCw size={16} />
                  Tentar novamente
                </button>
                <a href={OPS_SURFACE_URL} target="_blank" rel="noopener noreferrer" style={primaryButtonStyle}>
                  <ExternalLink size={16} />
                  Abrir ops surface
                </a>
              </div>
            }
          />
        ) : derived.hasSnapshot ? (
          <StatusBanner
            tone="success"
            title="Snapshot interno carregado com sucesso"
            description={`Janela observada: ${formatNumber(derived.windowDays)} dias. Última geração: ${formatDate(derived.generatedAt)}. Histórico disponível: ${formatNumber(pickFirstNumber(derived.history, ['entries_count']))} snapshots. Comparação pronta: ${derived.comparisonAvailable ? 'sim' : 'ainda não'}.`}
          />
        ) : (
          <StatusBanner
            tone="neutral"
            title="Sem snapshot consolidado no momento"
            description="O endpoint interno respondeu, mas ainda não há um snapshot utilizável nesta camada."
          />
        )}
      </div>

      {executiveSummary.length > 0 ? (
        <div style={{ ...shellCardStyle, padding: '1.2rem 1.25rem', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(34, 197, 94, 0.12)',
                color: '#22c55e'
              }}
            >
              <Sparkles size={18} />
            </div>
            <div>
              <div style={{ ...titleTextStyle, fontSize: 16, fontWeight: 700 }}>Resumo executivo</div>
              <div style={{ ...mutedTextStyle, fontSize: 13 }}>
                Leitura rápida dos sinais mais importantes do snapshot atual.
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
            {executiveSummary.map((item, index) => (
              <ExecutiveHighlight
                key={`executive-summary-${index}`}
                title={item.title}
                description={item.description}
              />
            ))}
          </div>
        </div>
      ) : null}

      <div style={{ ...shellCardStyle, padding: '1.2rem 1.25rem', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <TrendingUp size={18} color="#22c55e" />
          <div>
            <div style={{ ...titleTextStyle, fontSize: 16, fontWeight: 700 }}>Comparação com snapshot anterior</div>
            <div style={{ ...mutedTextStyle, fontSize: 13 }}>
              Leitura de variação entre o snapshot atual e o snapshot histórico imediatamente anterior.
            </div>
          </div>
        </div>

        {derived.comparisonAvailable ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <DeltaCard
              title="Cliques totais"
              delta={sanitizeObject(derived.comparisonMetrics.total_clicks)}
            />
            <DeltaCard
              title="Conversões / leads"
              delta={sanitizeObject(derived.comparisonMetrics.total_conversions)}
            />
            <DeltaCard
              title="Origens mapeadas"
              delta={sanitizeObject(derived.comparisonMetrics.total_sources)}
            />
          </div>
        ) : (
          <div style={{ ...mutedTextStyle, fontSize: 14, lineHeight: 1.75 }}>
            Histórico ainda insuficiente para comparação. Assim que existir pelo menos um snapshot anterior válido além do atual, esta seção passará a mostrar deltas automáticos de cliques, conversões e origens.
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
        <MetricCard
          icon={MousePointerClick}
          label="Cliques totais"
          value={formatNumber(derived.totalClicks)}
          helper="Volume consolidado priorizando metrics.total_clicks do contrato normalizado."
        />
        <MetricCard
          icon={Target}
          label="Conversões / leads"
          value={formatNumber(derived.totalConversions)}
          helper="Conversões priorizando metrics.total_conversions do backend normalizado."
        />
        <MetricCard
          icon={Globe2}
          label="Origens mapeadas"
          value={formatNumber(derived.totalSources)}
          helper="Quantidade de origens priorizando metrics.total_sources do contrato normalizado."
        />
        <MetricCard
          icon={Clock3}
          label="Última geração"
          value={derived.generatedAt ? formatDate(derived.generatedAt) : '—'}
          helper="Referência temporal do snapshot entregue pela API interna."
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 20 }}>
        <SimpleTableCard
          icon={Mouse}
          title="Top sources"
          description="Principais origens priorizando a camada normalizada."
          items={derived.topSources}
          itemFormatter={(item, index) => {
            const name = compactText(getRankLabel(item, `Origem ${index + 1}`));
            const value = formatNumber(getRankValue(item));
            return (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ ...titleTextStyle, fontSize: 14, fontWeight: 600 }}>{name}</span>
                <span style={{ ...mutedTextStyle, fontSize: 14 }}>{value}</span>
              </div>
            );
          }}
        />

        <SimpleTableCard
          icon={FileText}
          title="Top landing pages"
          description="Páginas de entrada priorizando a camada normalizada."
          items={derived.topLandingPages}
          itemFormatter={(item, index) => {
            const name = compactText(getRankLabel(item, `Landing ${index + 1}`), 54);
            const value = formatNumber(getRankValue(item));
            return (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ ...titleTextStyle, fontSize: 14, fontWeight: 600 }}>{name}</span>
                <span style={{ ...mutedTextStyle, fontSize: 14 }}>{value}</span>
              </div>
            );
          }}
        />

        <SimpleTableCard
          icon={Target}
          title="Top campaigns"
          description="Campanhas mais fortes priorizando o contrato normalizado."
          items={derived.topCampaigns}
          itemFormatter={(item, index) => {
            const name = compactText(getRankLabel(item, `Campanha ${index + 1}`));
            const value = formatNumber(getRankValue(item));
            return (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ ...titleTextStyle, fontSize: 14, fontWeight: 600 }}>{name}</span>
                <span style={{ ...mutedTextStyle, fontSize: 14 }}>{value}</span>
              </div>
            );
          }}
        />

        <SimpleTableCard
          icon={Link2}
          title="Top refhosts"
          description="Refhosts priorizando o contrato normalizado."
          items={derived.topRefhosts}
          itemFormatter={(item, index) => {
            const name = compactText(getRankLabel(item, `Refhost ${index + 1}`));
            const value = formatNumber(getRankValue(item));
            return (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ ...titleTextStyle, fontSize: 14, fontWeight: 600 }}>{name}</span>
                <span style={{ ...mutedTextStyle, fontSize: 14 }}>{value}</span>
              </div>
            );
          }}
        />
      </div>

      <div style={{ ...shellCardStyle, padding: '1.2rem 1.25rem', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <TrendingUp size={18} color="#22c55e" />
          <div style={{ ...titleTextStyle, fontSize: 16, fontWeight: 700 }}>Eventos recentes</div>
        </div>
        {derived.recentEvents.length === 0 ? (
          <div style={{ ...mutedTextStyle, fontSize: 14, lineHeight: 1.75 }}>
            Sem eventos recentes disponíveis neste snapshot.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {derived.recentEvents.slice(0, 6).map((item, index) => {
              const label =
                compactText(
                  pickFirstString(item, ['label']) ||
                  pickFirstString(item, ['event', 'name', 'type', 'source']) ||
                  `Evento ${index + 1}`,
                  72
                );
              const when =
                pickFirstString(item, ['occurred_at']) ||
                pickFirstString(item, ['created_at', 'timestamp', 'at']);
              return (
                <div
                  key={`recent-event-${index}`}
                  style={{
                    border: '1px solid rgba(148, 163, 184, 0.14)',
                    borderRadius: 14,
                    padding: '0.85rem 0.95rem',
                    background: 'rgba(255,255,255,0.02)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    alignItems: 'center'
                  }}
                >
                  <span style={{ ...titleTextStyle, fontSize: 14, fontWeight: 600 }}>{label}</span>
                  <span style={{ ...mutedTextStyle, fontSize: 13 }}>{when ? formatDate(when) : '—'}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ ...shellCardStyle, padding: '1.2rem 1.25rem', marginBottom: 16 }}>
        <div style={{ ...titleTextStyle, fontSize: 16, fontWeight: 700, marginBottom: 10 }}>
          Fonte do resumo
        </div>
        <div style={{ ...mutedTextStyle, fontSize: 14, lineHeight: 1.75 }}>
          Fonte declarada: <strong style={{ color: '#e2e8f0' }}>{derived.snapshotSource || '—'}</strong><br />
          Caminho declarado: <strong style={{ color: '#e2e8f0' }}>{derived.snapshotPath || '—'}</strong><br />
          Histórico disponível: <strong style={{ color: '#e2e8f0' }}>{formatNumber(pickFirstNumber(derived.history, ['entries_count']))}</strong> snapshots
        </div>
      </div>

      <div style={{ ...shellCardStyle, padding: '1.2rem 1.25rem', marginBottom: 16 }}>
        <div style={{ ...titleTextStyle, fontSize: 16, fontWeight: 700, marginBottom: 10 }}>
          O que esta tela faz agora
        </div>
        <div style={{ ...mutedTextStyle, fontSize: 14, lineHeight: 1.75 }}>
          Esta superfície já consome o snapshot atual, o anterior e a comparação calculada no backend. Isso transforma a visão de aquisição de uma foto isolada em uma leitura operacional com início de tendência entre períodos.
        </div>
      </div>

      <div style={{ ...shellCardStyle, padding: '1.2rem 1.25rem' }}>
        <div style={{ ...titleTextStyle, fontSize: 16, fontWeight: 700, marginBottom: 10 }}>
          Próxima evolução natural
        </div>
        <div style={{ ...mutedTextStyle, fontSize: 14, lineHeight: 1.75 }}>
          O próximo passo maduro é comparar mais do que dois snapshots: séries temporais, janela configurável e leitura por empresa, para que aquisição do site deixe de ser apenas observabilidade operacional e vire acompanhamento contínuo de crescimento.
        </div>
      </div>
    </div>
  );
}
