import React from 'react';

const PANEL_MARKER = '__AUTOATENDE_C16N_C7C_R1D_FIX1_TEMPLATE_CREATION_PANEL__';
const EXAMPLES_MARKER = '__AUTOATENDE_C16N_C7C_R1D_FIX1_TEMPLATE_EXAMPLES_INPUTS__';

const initialState = {
  name: '',
  language: 'pt_BR',
  category: 'utility_auth',
  headerText: '',
  bodyText: '',
  footerText: '',
  headerExamplesInput: '',
  bodyExamplesInput: ''
};

function FieldLabel({ children }) {
  return (
    <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6, fontWeight: 700 }}>
      {children}
    </div>
  );
}

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

function extractPlaceholderIndexes(text = '') {
  const matches = [...String(text || '').matchAll(/\{\{(\d+)\}\}/g)];
  const indexes = matches.map((item) => Number(item[1])).filter(Number.isFinite);
  return [...new Set(indexes)].sort((a, b) => a - b);
}

function countPlaceholders(text = '') {
  return extractPlaceholderIndexes(text).length;
}

function splitExamplesInput(value = '') {
  return String(value || '')
    .split(/[;\n|]/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function TemplateCreationPanel() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [form, setForm] = React.useState(initialState);
  const [saving, setSaving] = React.useState(false);
  const [result, setResult] = React.useState(null);

  const headerPlaceholderCount = React.useMemo(
    () => countPlaceholders(form.headerText),
    [form.headerText]
  );

  const bodyPlaceholderCount = React.useMemo(
    () => countPlaceholders(form.bodyText),
    [form.bodyText]
  );

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setResult(null);

    try {
      const accessToken = resolveRuntimeAccessToken();

      if (!accessToken) {
        throw new Error('Sessão não encontrada para autenticar a criação do template. Faça login novamente e tente de novo.');
      }

      const response = await fetch('/api/ops-surface/acquisition/templates/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        credentials: 'include',
        body: JSON.stringify({
          name: form.name,
          language: form.language,
          category: form.category,
          headerText: form.headerText,
          bodyText: form.bodyText,
          footerText: form.footerText,
          headerExamples: splitExamplesInput(form.headerExamplesInput),
          bodyExamples: splitExamplesInput(form.bodyExamplesInput)
        })
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok || payload?.ok === false) {
        throw new Error(
          payload?.message ||
          payload?.error ||
          `Request failed with status code ${response.status}`
        );
      }

      setResult({
        ok: true,
        message: 'Template criado e enviado para análise. Clique em Atualizar no catálogo para buscar o status mais recente.'
      });

      setForm(initialState);
      setIsOpen(false);
    } catch (error) {
      setResult({
        ok: false,
        message: error?.message || 'Falha ao criar template.'
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      data-aa-marker={PANEL_MARKER}
      data-aa-examples-marker={EXAMPLES_MARKER}
      style={{
        border: '1px solid rgba(52,211,153,0.18)',
        background: 'linear-gradient(135deg, rgba(3,10,18,0.96), rgba(4,20,28,0.92))',
        padding: 20,
        borderRadius: 18
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          alignItems: 'center',
          flexWrap: 'wrap'
        }}
      >
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.14em', color: '#34d399', marginBottom: 8 }}>
            CRIAÇÃO · TEMPLATE TEXTO
          </div>
          <div style={{ fontSize: 26, color: '#f8fafc', fontWeight: 800, marginBottom: 8 }}>
            Criar template
          </div>
          <div style={{ fontSize: 14, color: '#9fb3c8', maxWidth: 940 }}>
            Primeira fatia segura: criação de template textual com header opcional, body obrigatório e footer opcional. Agora o criador aceita exemplos para variáveis, melhorando a submissão de templates com placeholders.
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen((value) => !value)}
          style={{
            padding: '12px 16px',
            borderRadius: 12,
            border: '1px solid rgba(52,211,153,0.24)',
            background: isOpen ? 'rgba(6,78,59,0.28)' : 'rgba(15,23,42,0.55)',
            color: '#f8fafc',
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          {isOpen ? 'Fechar criação' : 'Novo template'}
        </button>
      </div>

      {result ? (
        <div
          style={{
            marginTop: 14,
            padding: '12px 14px',
            borderRadius: 12,
            border: result.ok ? '1px solid rgba(52,211,153,0.22)' : '1px solid rgba(248,113,113,0.22)',
            background: result.ok ? 'rgba(6,78,59,0.18)' : 'rgba(127,29,29,0.18)',
            color: result.ok ? '#d1fae5' : '#fecaca',
            fontSize: 14
          }}
        >
          {result.message}
        </div>
      ) : null}

      {isOpen ? (
        <form onSubmit={handleSubmit} style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 14
            }}
          >
            <div>
              <FieldLabel>Nome interno</FieldLabel>
              <input
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="ex.: lembrete_pagamento"
                style={{
                  width: '100%',
                  borderRadius: 12,
                  border: '1px solid rgba(148,163,184,0.18)',
                  background: '#03111c',
                  color: '#f8fafc',
                  padding: '12px 14px'
                }}
              />
            </div>

            <div>
              <FieldLabel>Idioma</FieldLabel>
              <input
                value={form.language}
                onChange={(e) => updateField('language', e.target.value)}
                placeholder="pt_BR"
                style={{
                  width: '100%',
                  borderRadius: 12,
                  border: '1px solid rgba(148,163,184,0.18)',
                  background: '#03111c',
                  color: '#f8fafc',
                  padding: '12px 14px'
                }}
              />
            </div>

            <div>
              <FieldLabel>Categoria</FieldLabel>
              <select
                value={form.category}
                onChange={(e) => updateField('category', e.target.value)}
                style={{
                  width: '100%',
                  borderRadius: 12,
                  border: '1px solid rgba(148,163,184,0.18)',
                  background: '#03111c',
                  color: '#f8fafc',
                  padding: '12px 14px'
                }}
              >
                <option value="utility_auth">Utility/Auth</option>
                <option value="marketing">Marketing</option>
              </select>
            </div>
          </div>

          <div>
            <FieldLabel>Header de texto (opcional)</FieldLabel>
            <input
              value={form.headerText}
              onChange={(e) => updateField('headerText', e.target.value)}
              placeholder="ex.: Olá {{1}}"
              style={{
                width: '100%',
                borderRadius: 12,
                border: '1px solid rgba(148,163,184,0.18)',
                background: '#03111c',
                color: '#f8fafc',
                padding: '12px 14px'
              }}
            />
          </div>

          {headerPlaceholderCount > 0 ? (
            <div>
              <FieldLabel>Exemplos do header</FieldLabel>
              <input
                value={form.headerExamplesInput}
                onChange={(e) => updateField('headerExamplesInput', e.target.value)}
                placeholder={`Informe ${headerPlaceholderCount} exemplo(s), separados por ;`}
                style={{
                  width: '100%',
                  borderRadius: 12,
                  border: '1px solid rgba(148,163,184,0.18)',
                  background: '#03111c',
                  color: '#f8fafc',
                  padding: '12px 14px'
                }}
              />
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>
                Exemplo: João
              </div>
            </div>
          ) : null}

          <div>
            <FieldLabel>Body</FieldLabel>
            <textarea
              value={form.bodyText}
              onChange={(e) => updateField('bodyText', e.target.value)}
              placeholder="Escreva o texto principal do template. Variáveis no padrão {{1}}, {{2}}..."
              rows={5}
              style={{
                width: '100%',
                borderRadius: 12,
                border: '1px solid rgba(148,163,184,0.18)',
                background: '#03111c',
                color: '#f8fafc',
                padding: '12px 14px',
                resize: 'vertical'
              }}
            />
          </div>

          {bodyPlaceholderCount > 0 ? (
            <div>
              <FieldLabel>Exemplos do body</FieldLabel>
              <input
                value={form.bodyExamplesInput}
                onChange={(e) => updateField('bodyExamplesInput', e.target.value)}
                placeholder={`Informe ${bodyPlaceholderCount} exemplo(s), separados por ;`}
                style={{
                  width: '100%',
                  borderRadius: 12,
                  border: '1px solid rgba(148,163,184,0.18)',
                  background: '#03111c',
                  color: '#f8fafc',
                  padding: '12px 14px'
                }}
              />
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>
                Exemplo: Vitor
              </div>
            </div>
          ) : null}

          <div>
            <FieldLabel>Footer (opcional)</FieldLabel>
            <input
              value={form.footerText}
              onChange={(e) => updateField('footerText', e.target.value)}
              placeholder="ex.: AutoAtendeAI"
              style={{
                width: '100%',
                borderRadius: 12,
                border: '1px solid rgba(148,163,184,0.18)',
                background: '#03111c',
                color: '#f8fafc',
                padding: '12px 14px'
              }}
            />
          </div>

          <div style={{ fontSize: 12, color: '#94a3b8' }}>
            Dica: para templates com variáveis, informe exemplos coerentes. Se você não preencher, o backend vai gerar exemplos automáticos para completar a submissão.
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: '12px 18px',
                borderRadius: 12,
                border: '1px solid rgba(52,211,153,0.24)',
                background: saving ? 'rgba(15,23,42,0.55)' : 'rgba(6,78,59,0.28)',
                color: '#f8fafc',
                fontWeight: 800,
                cursor: saving ? 'not-allowed' : 'pointer'
              }}
            >
              {saving ? 'Criando...' : 'Criar template'}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
