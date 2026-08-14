/* __AUTOATENDE_V4_R6C_DISPAROS_COMMERCIAL_COPY_ALIGNMENT__ */
import React from 'react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// __AUTOATENDE_C16N_C10H_R2B_INLINE_PILOT_EXECUTION__
function AutoAtendeInlinePilotExecution({ manifest, pilot, template, onPromotePilotResult = null, onPilotExecutionResult = null }) {
  const buildInitialRunState = () => ({
    phase: 'idle',
    total: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    startedAt: null,
    finishedAt: null,
    lastError: '',
    sample: [],
  });

  const [runState, setRunState] = useState(buildInitialRunState());
  const [promoteState, setPromoteState] = useState({
    phase: 'idle',
    lastMessage: '',
    lastError: '',
  });


  // __AUTOATENDE_C16N_C11B_R2B_FIX1_INLINE_PROMOTION_BRIDGE__
  useEffect(() => {
    setRunState(buildInitialRunState());
    setPromoteState({
      phase: 'idle',
      lastMessage: '',
      lastError: '',
    });
  }, [
    pilot?.blockIndex,
    pilot?.fromLine,
    pilot?.toLine,
    manifest?.preparedAt,
    manifest?.chunkCount,
  ]);

  const canPromotePilot =
    runState.phase !== 'running' &&
    Number(runState?.sent ?? 0) > 0 &&
    Number(runState?.failed ?? 0) === 0 &&
    promoteState.phase !== 'loading';

  const handlePromotePilot = async () => {
    const resolvedTokenRaw =
      typeof resolveAccessToken === 'function'
        ? await resolveAccessToken()
        : '';

    const accessToken =
      typeof resolvedTokenRaw === 'string'
        ? resolvedTokenRaw.trim()
        : String(resolvedTokenRaw || '').trim();

    if (!accessToken) {
      setPromoteState({
        phase: 'error',
        lastMessage: '',
        lastError: 'Token de autenticação não encontrado para promover o próximo bloco.',
      });
      window.alert('Token de autenticação não encontrado para promover o próximo bloco.');
      return;
    }

    setPromoteState({
      phase: 'loading',
      lastMessage: '',
      lastError: '',
    });

    try {
      const response = await fetch('/api/ops-surface/acquisition/lot/promote-pilot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          manifest,
          currentPilot: pilot,
          execution: {
            sent: Number(runState?.sent ?? 0),
            failed: Number(runState?.failed ?? 0),
            skipped: Number(runState?.skipped ?? 0),
          },
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload?.ok) {
        const message =
          payload?.message ||
          payload?.error ||
          'Falha ao promover o piloto e preparar o próximo bloco.';
        throw new Error(String(message));
      }

      const data = payload?.data || null;

      if (typeof onPromotePilotResult === 'function') {
        onPromotePilotResult(data);
      }

      setRunState(buildInitialRunState());
      setPromoteState({
        phase: 'success',
        lastMessage: data?.finished
          ? `Bloco ${data?.currentBlockIndex ?? '?'} aprovado. Manifesto concluído.`
          : `Bloco ${data?.currentBlockIndex ?? '?'} aprovado. Próximo bloco preparado: ${data?.nextBlockIndex ?? '?'}.`,
        lastError: '',
      });

      if (data?.finished) {
        window.alert(`Bloco ${data?.currentBlockIndex ?? '?'} aprovado. Não há próximo bloco pendente neste manifesto.`);
      } else {
        window.alert(`Bloco ${data?.currentBlockIndex ?? '?'} aprovado. Próximo bloco preparado: ${data?.nextBlockIndex ?? '?'}.`);
      }
    } catch (error) {
      const message = error?.message || 'Falha ao promover o piloto e preparar o próximo bloco.';
      setPromoteState({
        phase: 'error',
        lastMessage: '',
        lastError: String(message),
      });
      window.alert(String(message));
    }
  };


  const resolvePilotItems = () => {
    const rawItems =
      (Array.isArray(pilot?.items) && pilot.items) ||
      (Array.isArray(pilot?.rows) && pilot.rows) ||
      (Array.isArray(pilot?.entries) && pilot.entries) ||
      (Array.isArray(pilot?.validRows) && pilot.validRows) ||
      (Array.isArray(pilot?.block) && pilot.block) ||
      (Array.isArray(pilot?.contacts) && pilot.contacts) ||
      (Array.isArray(pilot?.contactRows) && pilot.contactRows) ||
      // __AUTOATENDE_C16N_C10H_R2I_ROW_PREVIEW_READER__
      (Array.isArray(pilot?.rowPreview) && pilot.rowPreview) ||
      (Array.isArray(pilot?.previewRows) && pilot.previewRows) ||
      (Array.isArray(manifest?.frozenPilotCandidate?.rowPreview) && manifest.frozenPilotCandidate.rowPreview) ||
      (Array.isArray(manifest?.frozenPilotCandidate?.previewRows) && manifest.frozenPilotCandidate.previewRows) ||
      (Array.isArray(manifest?.rowPreview) && manifest.rowPreview) ||
      (Array.isArray(manifest?.previewRows) && manifest.previewRows) ||
      // __AUTOATENDE_C16N_C10H_R2E_FIX3_FROZEN_PILOT_READER__
      (Array.isArray(manifest?.frozenPilotCandidate?.items) && manifest.frozenPilotCandidate.items) ||
      (Array.isArray(manifest?.frozenPilotCandidate?.rows) && manifest.frozenPilotCandidate.rows) ||
      (Array.isArray(manifest?.frozenPilotCandidate?.contacts) && manifest.frozenPilotCandidate.contacts) ||
      (Array.isArray(manifest?.frozenPilotCandidate?.contactRows) && manifest.frozenPilotCandidate.contactRows) ||
      (Array.isArray(manifest?.pilot?.items) && manifest.pilot.items) ||
      (Array.isArray(manifest?.pilot?.rows) && manifest.pilot.rows) ||
      (Array.isArray(manifest?.pilot?.rowPreview) && manifest.pilot.rowPreview) ||
      (Array.isArray(manifest?.pilot?.previewRows) && manifest.pilot.previewRows) ||
      [];
    return rawItems;
  };

  const normalizePhone = (raw) => String(raw ?? '').replace(/\D+/g, '');

  // __AUTOATENDE_C16N_C10M_R2D_TEMPLATE_COMPONENT_FALLBACK__
  const normalizeComponents = (raw) => {
    if (Array.isArray(raw)) {
      if (raw.length === 0) return [];
      const first = raw[0];

      if (first && typeof first === 'object' && ('type' in first || 'parameters' in first)) {
        return raw;
      }

      const values = raw
        .map((value) => String(value ?? '').trim())
        .filter(Boolean);

      if (!values.length) return [];

      return [
        {
          type: 'body',
          parameters: values.map((text) => ({ type: 'text', text }))
        }
      ];
    }

    if (raw == null) return [];

    if (Array.isArray(raw?.components)) return normalizeComponents(raw.components);
    if (Array.isArray(raw?.params)) return normalizeComponents(raw.params);
    if (Array.isArray(raw?.parameters)) return normalizeComponents(raw.parameters);
    if (Array.isArray(raw?.templateParams)) return normalizeComponents(raw.templateParams);

    if (typeof raw === 'string' && raw.trim()) {
      const values = raw
        .split(/[|;,]/)
        .map((item) => item.trim())
        .filter(Boolean);

      if (!values.length) return [];

      return [
        {
          type: 'body',
          parameters: values.map((text) => ({ type: 'text', text }))
        }
      ];
    }

    if (typeof raw === 'object' && Array.isArray(raw?.parameters)) {
      return [
        {
          type: raw?.type || 'body',
          parameters: raw.parameters.map((entry) => {
            if (entry && typeof entry === 'object' && entry.type && ('text' in entry || 'payload' in entry || 'currency' in entry || 'date_time' in entry)) {
              return entry;
            }
            const text = String(entry ?? '').trim();
            return text ? { type: 'text', text } : null;
          }).filter(Boolean)
        }
      ];
    }

    return [];
  };

  const countTemplatePlaceholders = (source) => {
    const text = String(source ?? '');
    const matches = text.match(/\{\{\d+\}\}/g);
    return matches ? matches.length : 0;
  };

  const extractFallbackValuesFromItem = (item) => {
    const values = [];

    const push = (value) => {
      const normalized = String(value ?? '').trim();
      if (!normalized) return;
      if (/^\d{10,15}$/.test(normalized.replace(/\D+/g, ''))) return;
      if (!values.includes(normalized)) values.push(normalized);
    };

    // __AUTOATENDE_C16N_C10M_R2M_RAW_OBJECT_READER__
    const collectFromUnknown = (source, depth = 0, visited = new WeakSet()) => {
      if (source == null || depth > 4) return;

      if (typeof source === 'string') {
        push(source);
        return;
      }

      if (typeof source === 'number') {
        push(String(source));
        return;
      }

      if (Array.isArray(source)) {
        source.forEach((entry) => collectFromUnknown(entry, depth + 1, visited));
        return;
      }

      if (typeof source === 'object') {
        if (visited.has(source)) return;
        visited.add(source);

        const skipKeys = new Set([
          'lineNumber',
          'index',
          'chunkIndex',
          'phone',
          'phoneRaw',
          'phoneNumber',
          'phone_number',
          'to',
          'id',
          'key',
          'status',
          'language',
          'languageCode',
          'language_code',
          'category',
          'categoryLabel',
          'previewText',
          'headerPreview',
          'bodyPreview',
          'footerPreview',
          'defaultSendComponents',
          'default_send_components',
          'selectedTemplate',
          'template',
          'manifest'
        ]);

        Object.entries(source).forEach(([key, value]) => {
          if (skipKeys.has(String(key))) return;

          if (
            key === 'name' ||
            key === 'contactName' ||
            key === 'customerName' ||
            key === 'firstName' ||
            key === 'label' ||
            key === 'value' ||
            key === 'param' ||
            key === 'parameter'
          ) {
            push(value);
            return;
          }

          collectFromUnknown(value, depth + 1, visited);
        });
      }
    };

    push(item?.name);
    push(item?.contactName);
    push(item?.customerName);
    push(item?.firstName);
    push(item?.label);
    push(item?.parameter);
    push(item?.param);
    push(item?.value);

    if (Array.isArray(item?.rowPreview)) item.rowPreview.forEach(push);
    if (typeof item?.rowPreview === 'string') item.rowPreview.split(/[|;,]/).forEach(push);

    if (Array.isArray(item?.values)) item.values.forEach(push);
    if (Array.isArray(item?.rowValues)) item.rowValues.forEach(push);

    // __AUTOATENDE_C16N_C10M_R2H_ITEM_RAW_FALLBACK__
    if (typeof item?.raw === 'string' && item.raw.trim()) {
      const rawParts = item.raw
        .split(/[|;]/)
        .map((part) => String(part ?? '').trim())
        .filter(Boolean);

      if (rawParts.length > 1) {
        const [first, ...rest] = rawParts;
        const firstDigits = String(first ?? '').replace(/\D+/g, '');

        if (firstDigits && firstDigits.length >= 10) {
          rest.forEach(push);
        } else {
          rawParts.forEach(push);
        }
      } else {
        rawParts.forEach(push);
      }
    }

    if (item?.raw && typeof item.raw === 'object') {
      collectFromUnknown(item.raw);
    }

    return values;
  };

  // __AUTOATENDE_C16N_C10M_R2K_TEMPLATE_STRUCTURE_WITH_ITEM_VALUES__
  const applyValuesToTemplateComponents = (components, values) => {
    if (!Array.isArray(components) || !components.length) return [];
    if (!Array.isArray(values) || !values.length) return components;

    let valueIndex = 0;

    return components.map((component) => {
      if (!component || typeof component !== 'object') return component;
      if (!Array.isArray(component.parameters)) return component;

      return {
        ...component,
        parameters: component.parameters.map((parameter) => {
          if (!parameter || typeof parameter !== 'object') return parameter;

          if (parameter.type === 'text') {
            const nextValue = values[valueIndex];
            if (nextValue) {
              valueIndex += 1;
              return {
                ...parameter,
                text: nextValue
              };
            }
          }

          return parameter;
        })
      };
    });
  };

  const resolvePayloadComponentsForItem = (item) => {
    const explicit = normalizeComponents(
      item?.components ??
      item?.params ??
      item?.parameters ??
      item?.templateParams
    );

    if (Array.isArray(explicit) && explicit.length > 0) return explicit;

    const itemValues = extractFallbackValuesFromItem(item);

    // __AUTOATENDE_C16N_C10M_R2I_DEFAULT_SEND_COMPONENTS_AUTHORITY__
    const defaultSendComponents = normalizeComponents(
      template?.defaultSendComponents ??
      template?.default_send_components
    );

    if (Array.isArray(defaultSendComponents) && defaultSendComponents.length > 0) {
      if (itemValues.length > 0) {
        return applyValuesToTemplateComponents(defaultSendComponents, itemValues);
      }
      return defaultSendComponents;
    }

    // __AUTOATENDE_C16N_C10M_R2E_TEMPLATE_COMPONENT_BODY_COUNT__
    const templateComponentText = Array.isArray(template?.components)
      ? template.components
          .map((entry) =>
            String(
              entry?.text ??
              entry?.content ??
              entry?.example ??
              ''
            ).trim()
          )
          .filter(Boolean)
          .join(' ')
      : '';

    const requiredCount = Math.max(
      countTemplatePlaceholders(template?.body),
      countTemplatePlaceholders(template?.body_text),
      countTemplatePlaceholders(template?.preview),
      countTemplatePlaceholders(template?.previewText),
      countTemplatePlaceholders(template?.content),
      countTemplatePlaceholders(template?.text),
      countTemplatePlaceholders(templateComponentText)
    );

    if (requiredCount <= 0) return [];

    const fallbackValues = itemValues.slice(0, requiredCount);
    if (!fallbackValues.length) return [];

    return [
      {
        type: 'body',
        parameters: fallbackValues.map((text) => ({ type: 'text', text }))
      }
    ];
  };

  const resolveTemplateName = () => {
    if (typeof template === 'string') return template;
    return (
      template?.name ||
      template?.templateName ||
      template?.template_name ||
      template?.id ||
      pilot?.templateName ||
      pilot?.template_name ||
      manifest?.templateName ||
      manifest?.template_name ||
      manifest?.template?.name ||
      manifest?.selectedTemplate?.name ||
      ''
    );
  };

  const resolveTemplateLanguage = () => {
    if (typeof template === 'string') return 'pt_BR';
    return (
      template?.language ||
      template?.languageCode ||
      template?.language_code ||
      pilot?.language ||
      manifest?.language ||
      manifest?.template?.language ||
      'pt_BR'
    );
  };

  const resolveAccessToken = async () => {
    const direct =
      window?.__AUTOATENDE_SESSION__?.access_token ||
      window?.__AUTOATENDE_SESSION__?.accessToken ||
      window?.__AUTOATENDE_USER__?.access_token ||
      null;
    if (direct) return direct;

    const candidates = ['auth_user', 'autoatende_user', 'supabase.auth.token'];

    for (const key of candidates) {
      try {
        const raw = window.localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (parsed?.access_token) return parsed.access_token;
        if (parsed?.currentSession?.access_token) return parsed.currentSession.access_token;
        if (parsed?.session?.access_token) return parsed.session.access_token;
      } catch (error) {
        // noop
      }
    }

    return null;
  };

  const rawItems = resolvePilotItems();
  const pilotItems = rawItems.map((item, index) => ({
    index,
    raw: item,
    phone: normalizePhone(
      item?.phone ||
      item?.phoneNumber ||
      item?.phone_number ||
      item?.to ||
      item?.number ||
      item?.msisdn ||
      item?.contact ||
      ''
    ),
    components: normalizeComponents(
      item?.components ??
      item?.params ??
      item?.parameters ??
      item?.templateParams ??
      item?.variables ??
      []
    ),
  }));

  const templateName = resolveTemplateName();
  const templateLanguage = resolveTemplateLanguage();

// __AUTOATENDE_C16N_C10H_R2H_FIX2_RUNTIME_EXPORT__
if (typeof window !== 'undefined') {
  window.__AUTOATENDE_BATCH_PILOT_RUNTIME__ = {
    phase: 'r2h_fix2',
    pilotTruthy: Boolean(pilot),
    pilotType: Array.isArray(pilot) ? 'array' : typeof pilot,
    manifestTruthy: Boolean(manifest),
    manifestType: Array.isArray(manifest) ? 'array' : typeof manifest,
    templateTruthy: Boolean(template),
    templateType: Array.isArray(template) ? 'array' : typeof template,
    templateName,
    templateLanguage,
    manifestKeys:
      manifest && typeof manifest === 'object' && !Array.isArray(manifest)
        ? Object.keys(manifest).slice(0, 50)
        : [],
    pilotKeys:
      pilot && typeof pilot === 'object' && !Array.isArray(pilot)
        ? Object.keys(pilot).slice(0, 50)
        : [],
    frozenPilotCandidateKeys:
      manifest?.frozenPilotCandidate &&
      typeof manifest.frozenPilotCandidate === 'object' &&
      !Array.isArray(manifest.frozenPilotCandidate)
        ? Object.keys(manifest.frozenPilotCandidate).slice(0, 50)
        : [],
    lengths: {
      rawItems: Array.isArray(rawItems) ? rawItems.length : null,
      pilotItems: Array.isArray(pilotItems) ? pilotItems.length : null,
      pilot_items: Array.isArray(pilot?.items) ? pilot.items.length : null,
      pilot_rows: Array.isArray(pilot?.rows) ? pilot.rows.length : null,
      pilot_entries: Array.isArray(pilot?.entries) ? pilot.entries.length : null,
      pilot_validRows: Array.isArray(pilot?.validRows) ? pilot.validRows.length : null,
      pilot_block: Array.isArray(pilot?.block) ? pilot.block.length : null,
      pilot_contacts: Array.isArray(pilot?.contacts) ? pilot.contacts.length : null,
      pilot_contactRows: Array.isArray(pilot?.contactRows) ? pilot.contactRows.length : null,
      frozen_items: Array.isArray(manifest?.frozenPilotCandidate?.items) ? manifest.frozenPilotCandidate.items.length : null,
      frozen_rows: Array.isArray(manifest?.frozenPilotCandidate?.rows) ? manifest.frozenPilotCandidate.rows.length : null,
      frozen_entries: Array.isArray(manifest?.frozenPilotCandidate?.entries) ? manifest.frozenPilotCandidate.entries.length : null,
      frozen_contacts: Array.isArray(manifest?.frozenPilotCandidate?.contacts) ? manifest.frozenPilotCandidate.contacts.length : null,
      frozen_contactRows: Array.isArray(manifest?.frozenPilotCandidate?.contactRows) ? manifest.frozenPilotCandidate.contactRows.length : null,
      manifest_pilot_items: Array.isArray(manifest?.pilot?.items) ? manifest.pilot.items.length : null,
      manifest_pilot_rows: Array.isArray(manifest?.pilot?.rows) ? manifest.pilot.rows.length : null,
      manifest_pilot_entries: Array.isArray(manifest?.pilot?.entries) ? manifest.pilot.entries.length : null,
      manifest_pilot_contacts: Array.isArray(manifest?.pilot?.contacts) ? manifest.pilot.contacts.length : null,
    },
    pilotPreview: pilot,
    frozenPilotCandidatePreview: manifest?.frozenPilotCandidate || null,
    manifestPilotPreview: manifest?.pilot || null,
  };
}

  const isReady = pilotItems.length > 0 && Boolean(templateName);
  const isRunning = runState.phase === 'running';

  const disabledReason = !pilot
    ? 'Prepare a próxima etapa para congelar manifesto e bloco piloto.'
    : !pilotItems.length
    ? 'O bloco piloto congelado não possui itens elegíveis.'
    : !templateName
    ? 'O template do piloto não pôde ser resolvido.'
    : '';

  const executePilot = async () => {
    if (!isReady || isRunning) return;

    const confirmed = window.confirm(
      `Executar somente o bloco piloto congelado?\n\nTemplate: ${templateName}\nItens do piloto: ${pilotItems.length}\n\nO lote inteiro permanecerá intocado.`
    );
    if (!confirmed) return;

    const accessToken = await resolveAccessToken();
    const startedAt = new Date().toISOString();

    setRunState({
      phase: 'running',
      total: pilotItems.length,
      sent: 0,
      failed: 0,
      skipped: 0,
      startedAt,
      finishedAt: null,
      lastError: '',
      sample: [],
    });

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    const sample = [];

    for (const item of pilotItems) {
      if (!item.phone) {
        skipped += 1;
        if (sample.length < 6) {
          sample.push({ phone: '', status: 'skipped', reason: 'phone_missing' });
        }
        setRunState((prev) => ({ ...prev, sent, failed, skipped, sample: [...sample] }));
        continue;
      }

      const payload = {
        source: 'batch_pilot_inline',
        lotMode: 'pilot',
        batchMode: 'pilot',
        pilot: true,
        phone: item.phone,
        phoneNumber: item.phone,
        phone_number: item.phone,
        to: item.phone,
        template: template,
        selectedTemplate: template,
        templateName,
        template_name: templateName,
        name: templateName,
        language: templateLanguage,
        languageCode: templateLanguage,
        language_code: templateLanguage,
        components: resolvePayloadComponentsForItem(item),
        params: resolvePayloadComponentsForItem(item),
        parameters: resolvePayloadComponentsForItem(item),
        templateParams: resolvePayloadComponentsForItem(item),
        // __AUTOATENDE_C16N_C10M_R2N_FINAL_CLEANUP__
        // __AUTOATENDE_C16N_C10M_R2J_CLEANUP_KEEP_PAYLOAD_LEAN__
        manifest: manifest
          ? {
              chunkSize: manifest?.chunkSize || manifest?.chunk_size || null,
              preparedAt: manifest?.preparedAt || manifest?.frozenAt || null,
            }
          : undefined,
      };

      try {
        const response = await fetch('/api/ops-surface/acquisition/send-template', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify(payload),
        });

        let data = null;
        try {
          data = await response.json();
        } catch (error) {
          data = null;
        }

        if (!response.ok) {
            // __AUTOATENDE_C16N_C10M_R1C_FRONT_META_REASON__
            const providerReason =
              data?.meta?.error?.error_user_msg ||
              data?.meta?.error?.message ||
              data?.meta?.message ||
              data?.message ||
              data?.error ||
              data?.details ||
              `HTTP ${response.status}`;

            throw new Error(providerReason);
          }

        sent += 1;
        if (sample.length < 6) {
          sample.push({ phone: item.phone, status: 'sent' });
        }
      } catch (error) {
        failed += 1;
        if (sample.length < 6) {
          sample.push({
            phone: item.phone,
            status: 'failed',
            reason: String(error?.message || error || 'unknown_error').slice(0, 140),
          });
        }
      }

      setRunState((prev) => ({ ...prev, sent, failed, skipped, sample: [...sample] }));
    }

    const finished = {
      phase: failed > 0 ? 'done_with_failures' : 'done',
      total: pilotItems.length,
      sent,
      failed,
      skipped,
      startedAt,
      finishedAt: new Date().toISOString(),
      lastError: failed > 0 ? 'Piloto concluído com falhas parciais.' : '',
      sample: [...sample],
    };

    setRunState(finished);

    window.__AUTOATENDE_BATCH_PILOT_LAST__ = {
      templateName,
      templateLanguage,
      ...finished,
    };

    try {
      window.localStorage.setItem(
        'autoatende_batch_pilot_last',
        JSON.stringify(window.__AUTOATENDE_BATCH_PILOT_LAST__)
      );
    } catch (error) {
      // noop
    }

    if (typeof onPilotExecutionResult === 'function') {
      onPilotExecutionResult({
        blockIndex: Number(
          pilot?.blockIndex ??
          pilot?.chunkIndex ??
          manifest?.currentBlockIndex ??
          manifest?.frozenPilotCandidate?.blockIndex ??
          manifest?.frozenPilotCandidate?.chunkIndex ??
          0
        ) || null,
        fromLine: pilot?.fromLine ?? manifest?.frozenPilotCandidate?.fromLine ?? null,
        toLine: pilot?.toLine ?? manifest?.frozenPilotCandidate?.toLine ?? null,
        total: pilotItems.length,
        sent,
        failed,
        skipped,
        finishedAt: new Date().toISOString(),
        phase: failed > 0 ? 'done_with_failures' : 'done',
      });
    }

    console.info('[AUTOATENDE][C16N-C10H-R2B] pilot_finished', window.__AUTOATENDE_BATCH_PILOT_LAST__);
  };

  const statusLabel =
    runState.phase === 'running'
      ? 'Executando bloco piloto...'
      : runState.phase === 'done'
      ? 'Piloto concluído sem falhas.'
      : runState.phase === 'done_with_failures'
      ? 'Piloto concluído com falhas parciais.'
      : isReady
      ? 'Piloto congelado pronto para execução.'
      : disabledReason;

  // __AUTOATENDE_C16N_C11B_R2H_EXECUTION_TRACEABILITY__
  const currentPilotBlockIndex = Number(
    pilot?.blockIndex ??
    pilot?.chunkIndex ??
    manifest?.currentBlockIndex ??
    manifest?.frozenPilotCandidate?.blockIndex ??
    manifest?.frozenPilotCandidate?.chunkIndex ??
    0
  ) || null;

  const currentPilotFromLine =
    pilot?.fromLine ??
    manifest?.frozenPilotCandidate?.fromLine ??
    null;

  const currentPilotToLine =
    pilot?.toLine ??
    manifest?.frozenPilotCandidate?.toLine ??
    null;

  const currentPilotRangeLabel =
    currentPilotFromLine != null && currentPilotToLine != null
      ? `${currentPilotFromLine}–${currentPilotToLine}`
      : '—';

  const currentPilotLabel =
    currentPilotBlockIndex != null
      ? `Bloco ${currentPilotBlockIndex}`
      : '—';

  const lastExecutionSummary =
    manifest?.lastExecutionSummary && typeof manifest.lastExecutionSummary === 'object'
      ? manifest.lastExecutionSummary
      : null;

  const lastPromotionSummary =
    manifest?.lastPromotionSummary && typeof manifest.lastPromotionSummary === 'object'
      ? manifest.lastPromotionSummary
      : null;

  const manifestStatusLabel =
    manifest?.finished || manifest?.promotionFinished
      ? 'Manifesto concluído'
      : 'Em validação operacional';

  const nextPendingBlockLabel =
    manifest?.finished || manifest?.promotionFinished
      ? 'Nenhum'
      : (
          currentPilotBlockIndex != null &&
          Number(manifest?.chunkCount ?? 0) > currentPilotBlockIndex
        )
      ? `Bloco ${currentPilotBlockIndex + 1}`
      : 'A validar';

  const lastExecutionLabel = lastExecutionSummary
    ? `Bloco ${lastExecutionSummary.blockIndex ?? '—'} · enviados ${lastExecutionSummary.sent ?? 0}/${lastExecutionSummary.total ?? 0}`
    : '—';

  const lastApprovalLabel = lastPromotionSummary
    ? lastPromotionSummary.finished
      ? `Bloco ${lastPromotionSummary.currentBlockIndex ?? '—'} · manifesto concluído`
      : `Bloco ${lastPromotionSummary.currentBlockIndex ?? '—'} aprovado → próximo ${lastPromotionSummary.nextBlockIndex ?? '—'}`
    : '—';

  return (
    <div
      style={{
        marginTop: '14px',
        border: '1px solid rgba(245, 158, 11, 0.22)',
        borderRadius: '12px',
        padding: '14px',
        background: 'rgba(15, 23, 42, 0.35)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
          marginBottom: '10px',
        }}
      >
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '4px' }}>
            Execução controlada do bloco piloto
          </div>

          <div style={{ fontSize: '12px', opacity: 0.86, lineHeight: 1.45 }}>
            {statusLabel}
          </div>
        </div>

        <button
          type="button"
          onClick={executePilot}
          disabled={!isReady || isRunning}
          style={{
            border: 0,
            borderRadius: '10px',
            padding: '10px 14px',
            fontSize: '12px',
            fontWeight: 700,
            cursor: !isReady || isRunning ? 'not-allowed' : 'pointer',
            opacity: !isReady || isRunning ? 0.65 : 1,
            background: '#F59E0B',
            color: '#111827',
            minWidth: '180px',
          }}
        >
          {isRunning ? 'Executando piloto...' : 'Executar bloco piloto'}
        </button>
                        {canPromotePilot ? (
                          <div className="mt-2 flex flex-col gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm('Promover o piloto aprovado e preparar o próximo bloco do lote?')) {
                                  handlePromotePilot();
                                }
                              }}
                              className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                              disabled={promoteState.phase === 'loading'}
                            >
                              {promoteState.phase === 'loading'
                                ? 'Promovendo piloto...'
                                : 'Promover piloto e preparar próximo bloco'}
                            </button>

                            {promoteState.lastMessage ? (
                              <div className="text-[11px] text-emerald-300">
                                {promoteState.lastMessage}
                              </div>
                            ) : null}

                            {promoteState.lastError ? (
                              <div className="text-[11px] text-rose-300">
                                {promoteState.lastError}
                              </div>
                            ) : null}
                          </div>
                        ) : null}


      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '10px',
          marginBottom: '10px',
        }}
      >
        <div style={{ border: '1px solid rgba(148, 163, 184, 0.18)', borderRadius: '10px', padding: '10px' }}>
          <div style={{ fontSize: '11px', opacity: 0.72, marginBottom: '4px' }}>Template</div>
          <div style={{ fontSize: '12px', fontWeight: 700, wordBreak: 'break-word' }}>{templateName || '—'}</div>
        </div>
        <div style={{ border: '1px solid rgba(148, 163, 184, 0.18)', borderRadius: '10px', padding: '10px' }}>
          <div style={{ fontSize: '11px', opacity: 0.72, marginBottom: '4px' }}>Itens do piloto</div>
          <div style={{ fontSize: '22px', fontWeight: 700 }}>{pilotItems.length}</div>
        </div>
        <div style={{ border: '1px solid rgba(148, 163, 184, 0.18)', borderRadius: '10px', padding: '10px' }}>
          <div style={{ fontSize: '11px', opacity: 0.72, marginBottom: '4px' }}>Enviados</div>
          <div style={{ fontSize: '22px', fontWeight: 700 }}>{runState.sent}</div>
        </div>
        <div style={{ border: '1px solid rgba(148, 163, 184, 0.18)', borderRadius: '10px', padding: '10px' }}>
          <div style={{ fontSize: '11px', opacity: 0.72, marginBottom: '4px' }}>Falhas</div>
          <div style={{ fontSize: '22px', fontWeight: 700 }}>{runState.failed}</div>
        </div>
        <div style={{ border: '1px solid rgba(148, 163, 184, 0.18)', borderRadius: '10px', padding: '10px' }}>
          <div style={{ fontSize: '11px', opacity: 0.72, marginBottom: '4px' }}>Ignorados</div>
          <div style={{ fontSize: '22px', fontWeight: 700 }}>{runState.skipped}</div>
        </div>
      </div>

      <div
        style={{
          border: '1px solid rgba(59, 130, 246, 0.18)',
          borderRadius: '10px',
          padding: '10px',
          background: 'rgba(15, 23, 42, 0.28)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '10px',
          marginBottom: '10px'
        }}
      >
        <div style={{ border: '1px solid rgba(148, 163, 184, 0.18)', borderRadius: '10px', padding: '10px' }}>
          <div style={{ fontSize: '11px', opacity: 0.72, marginBottom: '4px' }}>Status do manifesto</div>
          <div style={{ fontSize: '12px', fontWeight: 700 }}>{manifestStatusLabel}</div>
        </div>

        <div style={{ border: '1px solid rgba(148, 163, 184, 0.18)', borderRadius: '10px', padding: '10px' }}>
          <div style={{ fontSize: '11px', opacity: 0.72, marginBottom: '4px' }}>Bloco congelado atual</div>
          <div style={{ fontSize: '12px', fontWeight: 700 }}>{currentPilotLabel}</div>
        </div>

        <div style={{ border: '1px solid rgba(148, 163, 184, 0.18)', borderRadius: '10px', padding: '10px' }}>
          <div style={{ fontSize: '11px', opacity: 0.72, marginBottom: '4px' }}>Faixa atual</div>
          <div style={{ fontSize: '12px', fontWeight: 700 }}>{currentPilotRangeLabel}</div>
        </div>

        <div style={{ border: '1px solid rgba(148, 163, 184, 0.18)', borderRadius: '10px', padding: '10px' }}>
          <div style={{ fontSize: '11px', opacity: 0.72, marginBottom: '4px' }}>Último bloco executado</div>
          <div style={{ fontSize: '12px', fontWeight: 700 }}>{lastExecutionLabel}</div>
        </div>

        <div style={{ border: '1px solid rgba(148, 163, 184, 0.18)', borderRadius: '10px', padding: '10px' }}>
          <div style={{ fontSize: '11px', opacity: 0.72, marginBottom: '4px' }}>Último bloco aprovado</div>
          <div style={{ fontSize: '12px', fontWeight: 700 }}>{lastApprovalLabel}</div>
        </div>

        <div style={{ border: '1px solid rgba(148, 163, 184, 0.18)', borderRadius: '10px', padding: '10px' }}>
          <div style={{ fontSize: '11px', opacity: 0.72, marginBottom: '4px' }}>Próximo bloco pendente</div>
          <div style={{ fontSize: '12px', fontWeight: 700 }}>{nextPendingBlockLabel}</div>
        </div>
      </div>

      {Array.isArray(runState.sample) && runState.sample.length > 0 && (
        <div
          style={{
            borderTop: '1px solid rgba(148, 163, 184, 0.18)',
            paddingTop: '10px',
            display: 'grid',
            gap: '6px',
          }}
        >
          {runState.sample.slice(0, 6).map((item, index) => (
            <div
              key={`${item.phone || 'empty'}-${index}`}
              style={{
                fontSize: '11px',
                lineHeight: 1.45,
                wordBreak: 'break-word',
                color:
                  item.status === 'failed'
                    ? '#FCA5A5'
                    : item.status === 'skipped'
                    ? '#FDE68A'
                    : '#BBF7D0',
              }}
            >
              {(item.status || 'info').toUpperCase()} • {item.phone || 'sem telefone'}
              {item.reason ? ` • ${item.reason}` : ''}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


const PAGE_MARKER = '__AUTOATENDE_C16N_C10B_R1_BATCH_SOURCE_PARSING_REVIEW__';
const PREFERRED_TEMPLATE_NAME = 'retorno_solicitacao_autoatende_v3';
const FALLBACK_TEMPLATE_NAME = 'autoatende_probe_full_01';

function tryParseJson(value) {
  if (!value || typeof value !== 'string') return null;
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

  const storageKeys = ['auth_user', 'autoatende_user', 'supabase.auth.token', 'sb-access-token'];

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

function normalizeCategory(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'utility' || raw === 'utility_auth' || raw === 'authentication') return 'utility_auth';
  if (raw === 'marketing') return 'marketing';
  return raw || 'utility_auth';
}

function normalizeTemplateStatus(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'approved') return 'approved';
  if (raw === 'rejected') return 'rejected';
  if (raw === 'pending' || raw === 'in_review') return 'pending';
  return raw || 'unknown';
}

function getComponentText(components = [], type, fallback = '') {
  const component = components.find((entry) => String(entry?.type || '').trim().toUpperCase() === type);
  return String(component?.text || component?.content || fallback || '').trim();
}

function extractStructuredPreviewSections(raw = '') {
  const normalized = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return { header: '', body: '', footer: '' };
  }

  const header = (normalized.match(/HEADER:\s*(.*?)(?=\s+BODY:|\s+FOOTER:|$)/i) || [])[1] || '';
  const body = (normalized.match(/BODY:\s*(.*?)(?=\s+FOOTER:|$)/i) || [])[1] || '';
  const footer = (normalized.match(/FOOTER:\s*(.*)$/i) || [])[1] || '';

  return {
    header: String(header || '').trim(),
    body: String(body || '').trim(),
    footer: String(footer || '').trim()
  };
}

function normalizeTemplateItem(item = {}) {
  const name = String(item?.name || item?.template_name || '').trim() || 'template';
  const language = String(item?.language || 'pt_BR').trim() || 'pt_BR';
  const categoryLabel = normalizeCategory(item?.categoryLabel || item?.category || item?.category_key);
  const status = normalizeTemplateStatus(item?.status || item?.template_status);
  const components = Array.isArray(item?.components) ? item.components : [];
  const defaultSendComponents = Array.isArray(item?.defaultSendComponents) ? item.defaultSendComponents : [];
  const key = String(item?.key || item?.id || `${name}:${language}:${categoryLabel}`).trim();

  const previewText = String(item?.previewText || item?.preview_text || '').trim();

  const headerPreview = String(
    item?.headerPreview ||
    item?.headerText ||
    item?.header_text ||
    item?.preview?.header ||
    item?.header ||
    ''
  ).trim();

  const bodyPreview = String(
    item?.bodyPreview ||
    item?.bodyText ||
    item?.body_text ||
    item?.preview?.body ||
    item?.body ||
    item?.content ||
    ''
  ).trim();

  const footerPreview = String(
    item?.footerPreview ||
    item?.footerText ||
    item?.footer_text ||
    item?.preview?.footer ||
    item?.footer ||
    ''
  ).trim();

  return {
    key,
    id: item?.id || '',
    name,
    language,
    categoryLabel,
    status,
    components,
    defaultSendComponents,
    previewText,
    headerPreview,
    bodyPreview,
    footerPreview
  };
}

function getTemplatePriority(item = {}) {
  const name = String(item?.name || '').trim().toLowerCase();
  if (name === PREFERRED_TEMPLATE_NAME) return 1;
  if (name === FALLBACK_TEMPLATE_NAME) return 2;
  return 20;
}

function sortTemplatesForBatch(items = []) {
  return [...items].sort((a, b) => {
    const byPriority = getTemplatePriority(a) - getTemplatePriority(b);
    if (byPriority !== 0) return byPriority;
    return String(a?.name || '').localeCompare(String(b?.name || ''));
  });
}

function getPreferredBatchTemplateKey(items = []) {
  const preferred = items.find((item) => String(item?.name || '').trim().toLowerCase() === PREFERRED_TEMPLATE_NAME);
  if (preferred?.key) return preferred.key;

  const fallback = items.find((item) => String(item?.name || '').trim().toLowerCase() === FALLBACK_TEMPLATE_NAME);
  if (fallback?.key) return fallback.key;

  return items[0]?.key || '';
}

function getTemplatePreviewText(template = {}, type, fallback = '') {
  const fromDefaultSend = getComponentText(template?.defaultSendComponents || [], type, '');
  if (fromDefaultSend) return fromDefaultSend;

  const fromComponents = getComponentText(template?.components || [], type, '');
  if (fromComponents) return fromComponents;

  const structured = extractStructuredPreviewSections(template?.previewText || '');

  if (type === 'HEADER') {
    return String(structured.header || template?.headerPreview || fallback || '').trim();
  }

  if (type === 'BODY') {
    return String(structured.body || template?.bodyPreview || template?.previewText || fallback || '').trim();
  }

  if (type === 'FOOTER') {
    return String(structured.footer || template?.footerPreview || fallback || '').trim();
  }

  return String(fallback || '').trim();
}

function extractPlaceholderIndexes(text = '') {
  const regex = /\{\{\s*(\d+)\s*\}\}/g;
  const found = new Set();
  let match;

  while ((match = regex.exec(String(text || ''))) !== null) {
    found.add(Number(match[1]));
  }

  return [...found].sort((a, b) => a - b);
}

function getTemplateRequiredParamCount(template = {}) {
  const parts = [
    template?.previewText || '',
    template?.headerPreview || '',
    template?.bodyPreview || '',
    template?.footerPreview || '',
    ...(Array.isArray(template?.defaultSendComponents) ? template.defaultSendComponents.map((item) => item?.text || item?.content || '') : []),
    ...(Array.isArray(template?.components) ? template.components.map((item) => item?.text || item?.content || '') : [])
  ];

  const indexes = extractPlaceholderIndexes(parts.join(' '));
  return indexes.length;
}

function normalizePhoneValue(raw = '') {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';

  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) return '';

  return digits;
}

function splitLineColumns(line = '') {
  const raw = String(line || '').trim();
  if (!raw) return { phoneRaw: '', params: [] };

  const delimiter = raw.includes(';') ? ';' : raw.includes(',') ? ',' : null;
  if (!delimiter) {
    return { phoneRaw: raw, params: [] };
  }

  const [first, ...rest] = raw.split(delimiter).map((item) => String(item || '').trim());
  return {
    phoneRaw: first,
    params: rest
  };
}

function getExpectedFormatText(requiredParamCount = 0) {
  if (requiredParamCount <= 0) {
    return 'Formato esperado: telefone. Ex.: 5511999999999';
  }

  if (requiredParamCount === 1) {
    return 'Formato esperado: telefone;nome. Ex.: 5511999999999;João';
  }

  const fields = ['telefone'];
  const sample = ['5511999999999'];

  for (let index = 1; index <= requiredParamCount; index += 1) {
    fields.push(`valor${index}`);
    sample.push(index === 1 ? 'João' : `campo${index}`);
  }

  return `Formato esperado: ${fields.join(';')}. Ex.: ${sample.join(';')}`;
}

function getRowStateMeta(state) {
  switch (state) {
    case 'valid':
      return {
        label: 'válido',
        badgeStyle: {
          background: 'rgba(6,78,59,0.28)',
          color: '#d1fae5',
          border: '1px solid rgba(52,211,153,0.22)'
        }
      };
    case 'duplicate':
      return {
        label: 'duplicado',
        badgeStyle: {
          background: 'rgba(120,53,15,0.22)',
          color: '#fde68a',
          border: '1px solid rgba(250,204,21,0.18)'
        }
      };
    case 'missing_param':
      return {
        label: 'sem parâmetro',
        badgeStyle: {
          background: 'rgba(55,48,163,0.22)',
          color: '#c7d2fe',
          border: '1px solid rgba(129,140,248,0.2)'
        }
      };
    default:
      return {
        label: 'inválido',
        badgeStyle: {
          background: 'rgba(127,29,29,0.24)',
          color: '#fecaca',
          border: '1px solid rgba(248,113,113,0.2)'
        }
      };
  }
}

function buildBatchReview(sourceText = '', requiredParamCount = 0) {
  const rawLines = String(sourceText || '').split(/\r?\n/);
  const nonEmptyLines = rawLines
    .map((line, index) => ({ lineNumber: index + 1, raw: String(line || '').trim() }))
    .filter((entry) => entry.raw);

  const seenPhones = new Set();
  const rows = [];

  const summary = {
    total: nonEmptyLines.length,
    valid: 0,
    duplicate: 0,
    invalid: 0,
    missingParam: 0
  };

  for (const entry of nonEmptyLines) {
    const parsed = splitLineColumns(entry.raw);
    const normalizedPhone = normalizePhoneValue(parsed.phoneRaw);
    const filledParams = parsed.params.map((item) => String(item || '').trim()).filter(Boolean);

    let state = 'valid';
    let issue = '';

    if (!normalizedPhone) {
      state = 'invalid';
      issue = 'Telefone fora do padrão esperado.';
      summary.invalid += 1;
    } else if (seenPhones.has(normalizedPhone)) {
      state = 'duplicate';
      issue = 'Contato duplicado na fonte atual.';
      summary.duplicate += 1;
    } else if (filledParams.length < requiredParamCount) {
      state = 'missing_param';
      issue =
        requiredParamCount === 1
          ? 'A linha precisa trazer 1 parâmetro além do telefone.'
          : `A linha precisa trazer ${requiredParamCount} parâmetro(s) além do telefone.`;
      summary.missingParam += 1;
      seenPhones.add(normalizedPhone);
    } else {
      state = 'valid';
      summary.valid += 1;
      seenPhones.add(normalizedPhone);
    }

    rows.push({
      lineNumber: entry.lineNumber,
      raw: entry.raw,
      normalizedPhone,
      params: filledParams,
      state,
      issue
    });
  }

  return { rows, summary };
}

function buildChunkPlan(validRows = [], chunkSize = 50) {
  const safeChunkSize = Math.max(1, Number(chunkSize) || 1);
  const chunks = [];

  for (let start = 0; start < validRows.length; start += safeChunkSize) {
    const slice = validRows.slice(start, start + safeChunkSize);
    if (!slice.length) continue;

    chunks.push({
      index: chunks.length + 1,
      size: slice.length,
      fromLine: slice[0]?.lineNumber || 0,
      toLine: slice[slice.length - 1]?.lineNumber || 0,
      firstPhone: slice[0]?.normalizedPhone || '',
      lastPhone: slice[slice.length - 1]?.normalizedPhone || ''
    });
  }

  return chunks;
}

function SmallStatCard({ label, value, hint }) {
  return (
    <div
      style={{
        border: '1px solid rgba(52,211,153,0.14)',
        background: 'linear-gradient(180deg, rgba(2,6,23,0.72), rgba(2,12,27,0.92))',
        borderRadius: 18,
        padding: 16
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.12em', color: '#60a5fa', marginBottom: 8 }}>{label}</div>
      <div style={{ color: '#f8fafc', fontSize: 32, fontWeight: 800, lineHeight: 1 }}>{value}</div>
      <div style={{ color: '#94a3b8', marginTop: 8, lineHeight: 1.45, fontSize: 13 }}>{hint}</div>
    </div>
  );
}

function ActionButton({ children, style, ...props }) {
  return (
    <button
      {...props}
      style={{
        padding: '10px 14px',
        borderRadius: 12,
        border: '1px solid rgba(52,211,153,0.18)',
        background: 'rgba(15,23,42,0.4)',
        color: '#f8fafc',
        fontWeight: 700,
        cursor: props.disabled ? 'not-allowed' : 'pointer',
        opacity: props.disabled ? 0.6 : 1,
        ...(style || {})
      }}
    >
      {children}
    </button>
  );
}

function SectionCard({ title, right, children }) {
  return (
    <section
      style={{
        border: '1px solid rgba(52,211,153,0.14)',
        background: 'linear-gradient(180deg, rgba(2,6,23,0.72), rgba(2,12,27,0.92))',
        borderRadius: 18,
        padding: 16
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          marginBottom: 12,
          flexWrap: 'wrap'
        }}
      >
        <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 700, letterSpacing: '0.08em' }}>{title}</div>
        {right}
      </div>
      {children}
    </section>
  );
}

const BATCH_SOURCE_REVIEW_MARKER = '__AUTOATENDE_C16N_C10B_R1_BATCH_SOURCE_PARSING_REVIEW__';
const BATCH_CHUNKING_SIMULATION_MARKER = '__AUTOATENDE_C16N_C10C_R1_BATCH_CHUNKING_SIMULATION_GATE__';
const BATCH_PLAN_CONFIRMATION_MARKER = '__AUTOATENDE_C16N_C10C_R2_BATCH_PLAN_AND_CONFIRMATION_GATE__';
const BATCH_FOCUSED_CHUNK_MARKER = '__AUTOATENDE_C16N_C10D_R1_BATCH_FOCUSED_CHUNK_REVIEW__';
const BATCH_PREPARED_MANIFEST_MARKER = '__AUTOATENDE_C16N_C10E_R1_BATCH_PREPARED_MANIFEST_SNAPSHOT__';
const BATCH_PILOT_CANDIDATE_MARKER = '__AUTOATENDE_C16N_C10F_R2_BATCH_PILOT_CANDIDATE_READONLY__';
const BATCH_FROZEN_PILOT_MARKER = '__AUTOATENDE_C16N_C10F_R3_FREEZE_PILOT_ON_PREPARE__';
const BATCH_PREPARE_INVALIDATION_MARKER = '__AUTOATENDE_C16N_C10G_R1_INVALIDATE_PREPARED_LOT_ON_INPUT_CHANGE__';


function buildFrozenPilotCandidateSnapshot(selectedChunkMeta = null, selectedChunkRows = []) {
  // __AUTOATENDE_C16N_C11B_R2G_FROZEN_SNAPSHOT_ITEMS__
  if (!selectedChunkMeta || !Array.isArray(selectedChunkRows) || selectedChunkRows.length === 0) {
    return null;
  }

  const normalizedItems = selectedChunkRows.map((row) => ({
    lineNumber: row.lineNumber,
    phone: row.normalizedPhone || '',
    normalizedPhone: row.normalizedPhone || '',
    params: Array.isArray(row.params) ? row.params : [],
    paramPreview: Array.isArray(row.params) && row.params.length > 0 ? row.params.join(' | ') : '',
    raw: row.raw ?? '',
    state: row.state || '',
    issue: row.issue || ''
  }));

  return {
    blockIndex: selectedChunkMeta.index,
    chunkIndex: selectedChunkMeta.index,
    index: selectedChunkMeta.index,
    contactCount: selectedChunkMeta.size,
    count: selectedChunkMeta.size,
    size: selectedChunkMeta.size,
    fromLine: selectedChunkMeta.fromLine,
    toLine: selectedChunkMeta.toLine,
    firstPhone: selectedChunkMeta.firstPhone || '',
    lastPhone: selectedChunkMeta.lastPhone || '',
    items: normalizedItems,
    contacts: normalizedItems,
    rowPreview: normalizedItems.slice(0, 5).map((item) => ({
      lineNumber: item.lineNumber,
      phone: item.phone,
      paramPreview: item.paramPreview,
      params: item.params,
      raw: item.raw
    }))
  };
}

export default function AcquisitionBatchPage() {
  const navigate = useNavigate();
  const fileInputRef = React.useRef(null);

  const [loadingTemplates, setLoadingTemplates] = React.useState(false);
  const [templateError, setTemplateError] = React.useState('');
  const [templates, setTemplates] = React.useState([]);
  const [selectedTemplateKey, setSelectedTemplateKey] = React.useState('');
  const [sourceText, setSourceText] = React.useState('');
  const [sourceNotice, setSourceNotice] = React.useState('');

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
      const approvedItems = items.filter((item) => item.status === 'approved');
      const sortedItems = sortTemplatesForBatch(approvedItems);

      setTemplates(sortedItems);
      setSelectedTemplateKey((current) => {
        if (current && sortedItems.some((item) => item.key === current)) return current;
        return getPreferredBatchTemplateKey(sortedItems);
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

  const selectedTemplate = React.useMemo(
    () => templates.find((item) => item.key === selectedTemplateKey) || null,
    [templates, selectedTemplateKey]
  );

  const headerText = React.useMemo(
    () => getTemplatePreviewText(selectedTemplate, 'HEADER', 'Sem header textual'),
    [selectedTemplate]
  );

  const bodyText = React.useMemo(
    () => getTemplatePreviewText(selectedTemplate, 'BODY', 'Sem body textual'),
    [selectedTemplate]
  );

  const footerText = React.useMemo(
    () => getTemplatePreviewText(selectedTemplate, 'FOOTER', ''),
    [selectedTemplate]
  );

  const requiredParamCount = React.useMemo(
    () => getTemplateRequiredParamCount(selectedTemplate),
    [selectedTemplate]
  );

  const expectedFormatText = React.useMemo(
    () => getExpectedFormatText(requiredParamCount),
    [requiredParamCount]
  );

  const review = React.useMemo(
    () => buildBatchReview(sourceText, requiredParamCount),
    [sourceText, requiredParamCount]
  );

  const previewRows = React.useMemo(() => review.rows.slice(0, 8), [review.rows]);

  const [chunkSize, setChunkSize] = React.useState(50);

  const chunkSimulation = React.useMemo(() => {
    const validRows = review.rows.filter((row) => row.state === 'valid');
    const safeChunkSize = Math.max(1, Number(chunkSize) || 1);
    const chunkCount = validRows.length > 0 ? Math.ceil(validRows.length / safeChunkSize) : 0;
    const lastChunkSize =
      validRows.length > 0
        ? validRows.length % safeChunkSize === 0
          ? safeChunkSize
          : validRows.length % safeChunkSize
        : 0;

    return {
      validCount: validRows.length,
      chunkSize: safeChunkSize,
      chunkCount,
      lastChunkSize
    };
  }, [review.rows, chunkSize]);


  const chunkPlan = React.useMemo(
    () => buildChunkPlan(review.rows.filter((row) => row.state === 'valid'), chunkSimulation.chunkSize),
    [review.rows, chunkSimulation.chunkSize]
  );

  const [selectedChunkIndex, setSelectedChunkIndex] = React.useState(1);

  const selectedChunkMeta = React.useMemo(
    () => chunkPlan.find((chunk) => chunk.index === selectedChunkIndex) || null,
    [chunkPlan, selectedChunkIndex]
  );

  const selectedChunkRows = React.useMemo(() => {
    const validRows = review.rows.filter((row) => row.state === 'valid');
    const safeChunkIndex = Math.max(1, Number(selectedChunkIndex) || 1);
    const start = (safeChunkIndex - 1) * chunkSimulation.chunkSize;
    return validRows.slice(start, start + chunkSimulation.chunkSize);
  }, [review.rows, selectedChunkIndex, chunkSimulation.chunkSize]);

  React.useEffect(() => {
    if (chunkPlan.length === 0) {
      setSelectedChunkIndex(1);
      return;
    }

    if (selectedChunkIndex < 1) {
      setSelectedChunkIndex(1);
      return;
    }

    if (selectedChunkIndex > chunkPlan.length) {
      setSelectedChunkIndex(chunkPlan.length);
    }
  }, [chunkPlan.length, selectedChunkIndex]);

  const [operatorConfirmed, setOperatorConfirmed] = React.useState(false);
  const [lotPreparationSummary, setLotPreparationSummary] = React.useState(null);
  const [preparedLotManifest, setPreparedLotManifest] = React.useState(null);
  const lastPreparedFingerprintRef = React.useRef('');

  React.useEffect(() => {
    setOperatorConfirmed(false);
    setLotPreparationSummary(null);
    setPreparedLotManifest(null);
    setSelectedChunkIndex(1);
  }, [sourceText, selectedTemplateKey, chunkSize]);


  const preparationFingerprint = React.useMemo(
    () =>
      JSON.stringify({
        sourceText: String(sourceText || '').trim(),
        selectedTemplateKey: String(selectedTemplateKey || ''),
        chunkSize: Number(chunkSize || 0)
      }),
    [sourceText, selectedTemplateKey, chunkSize]
  );

  React.useEffect(() => {
    if (!preparedLotManifest) return;
    if (!lastPreparedFingerprintRef.current) return;
    if (preparationFingerprint === lastPreparedFingerprintRef.current) return;

    setPreparedLotManifest(null);
    setOperatorConfirmed(false);
    setSelectedChunkIndex(1);
    lastPreparedFingerprintRef.current = '';
  }, [preparedLotManifest, preparationFingerprint]);

  function handlePrepareLotForNextStep() {
    const confirmationMessage = [
      'Preparar lote para a próxima etapa?',
      `Template: ${selectedTemplate?.name || 'template'}`,
      `Válidos prontos: ${chunkSimulation.validCount}`,
      `Blocos estimados: ${chunkSimulation.chunkCount}`,
      `Tamanho do bloco: ${chunkSimulation.chunkSize}`
    ].join('\n');

    if (typeof window !== 'undefined' && !window.confirm(confirmationMessage)) {
      setPreparedLotManifest(null);
      setLotPreparationSummary({
        status: 'cancelled',
        message: 'Preparação do lote cancelada pelo operador antes da próxima etapa.'
      });
      return;
    }

    const frozenPilotCandidate = buildFrozenPilotCandidateSnapshot(selectedChunkMeta, selectedChunkRows);

    const manifest = {
      preparedAt: new Date().toLocaleString('pt-BR'),
      templateName: selectedTemplate?.name || '',
      templateLanguage: selectedTemplate?.language || '',
      categoryLabel: selectedTemplate?.categoryLabel || '',
      validCount: chunkSimulation.validCount,
      chunkCount: chunkSimulation.chunkCount,
      chunkSize: chunkSimulation.chunkSize,
      firstPhone: chunkPlan[0]?.firstPhone || '',
      lastPhone: chunkPlan[chunkPlan.length - 1]?.lastPhone || '',
      chunkPreview: chunkPlan.slice(0, 5)
    };

    if (frozenPilotCandidate) {
      manifest.frozenPilotCandidate = frozenPilotCandidate;
    }

    lastPreparedFingerprintRef.current = preparationFingerprint;
    setPreparedLotManifest(manifest);
    setLotPreparationSummary({
      status: 'ready',
      message: `Lote preparado para a próxima etapa: ${chunkSimulation.validCount} contato(s) válidos em ${chunkSimulation.chunkCount} bloco(s).`,
      templateName: selectedTemplate?.name || '',
      validCount: chunkSimulation.validCount,
      chunkCount: chunkSimulation.chunkCount,
      chunkSize: chunkSimulation.chunkSize
    });
  }

  // __AUTOATENDE_C16N_C10H_R2B_BATCH_LOCKED_REASON_NODE__
const batchLockedReason = (
  <>
    <span>
      Após preparar a próxima etapa, execute somente o bloco piloto congelado nesta própria seção.
      O lote inteiro permanece bloqueado até a validação operacional do piloto.
    </span>

    
{/* __AUTOATENDE_C16N_C10H_R2G_MOUNT_AUTHORITY_FIX__ */}
<AutoAtendeInlinePilotExecution
  manifest={preparedLotManifest}
  pilot={
    preparedLotManifest?.frozenPilotCandidate ||
    preparedLotManifest?.pilot ||
    null
  }
  template={selectedTemplate}

      onPromotePilotResult={(result) => {
      // __AUTOATENDE_C16N_C11B_R2G_REAL_SOURCE_ALIGNMENT__
      const nextBlockIndex = Number(
        result?.nextBlockIndex ??
        result?.nextPilotCandidate?.blockIndex ??
        result?.nextPilotCandidate?.chunkIndex ??
        result?.nextPilot?.blockIndex ??
        result?.nextPilot?.chunkIndex ??
        NaN
      );

      const currentApprovedBlockIndex = Number(
        result?.currentBlockIndex ??
        result?.currentPilotBlockIndex ??
        result?.currentPilot?.blockIndex ??
        selectedChunkIndex ??
        preparedLotManifest?.currentBlockIndex ??
        preparedLotManifest?.frozenPilotCandidate?.blockIndex ??
        preparedLotManifest?.frozenPilotCandidate?.chunkIndex ??
        NaN
      );

      if (!Number.isFinite(nextBlockIndex) || nextBlockIndex < 1) {
        // __AUTOATENDE_C16N_C11B_R2I_FINAL_APPROVAL_SUMMARY__
        if (result?.finished) {
          const finalApprovedBlockIndex =
            Number.isFinite(currentApprovedBlockIndex) && currentApprovedBlockIndex > 0
              ? currentApprovedBlockIndex
              : null;

          if (finalApprovedBlockIndex && typeof setSelectedChunkIndex === 'function') {
            setSelectedChunkIndex(finalApprovedBlockIndex);
          }

          if (typeof setPreparedLotManifest === 'function') {
            setPreparedLotManifest((prev) => (
              prev && typeof prev === 'object'
                ? {
                    ...prev,
                    currentBlockIndex:
                      finalApprovedBlockIndex ??
                      prev?.currentBlockIndex ??
                      null,
                    promotedBlockIndex:
                      finalApprovedBlockIndex ??
                      prev?.promotedBlockIndex ??
                      null,
                    finished: true,
                    promotionFinished: true,
                    lastPromotionSummary: {
                      currentBlockIndex: finalApprovedBlockIndex,
                      nextBlockIndex: null,
                      finished: true,
                      promotedAt: new Date().toISOString(),
                    },
                  }
                : prev
            ));
          }
        }
        return;
      }

      const nextChunkMeta =
        Array.isArray(chunkPlan)
          ? (chunkPlan.find((chunk) => Number(chunk?.index) === nextBlockIndex) || null)
          : null;

      const validRows =
        Array.isArray(review?.rows)
          ? review.rows.filter((row) => row?.state === 'valid')
          : [];

      const safeChunkSize = Math.max(1, Number(chunkSimulation?.chunkSize) || 1);
      const start = (nextBlockIndex - 1) * safeChunkSize;
      const nextChunkRows = validRows.slice(start, start + safeChunkSize);

      const nextFrozenPilotCandidate = buildFrozenPilotCandidateSnapshot(nextChunkMeta, nextChunkRows);

      if (!nextFrozenPilotCandidate) {
        return;
      }

      if (typeof setSelectedChunkIndex === 'function') {
        setSelectedChunkIndex(nextBlockIndex);
      }

      if (typeof setPreparedLotManifest === 'function') {
        setPreparedLotManifest((prev) => {
          const base =
            prev && typeof prev === 'object'
              ? prev
              : {};

          return {
            ...base,
            frozenPilotCandidate: nextFrozenPilotCandidate,
            currentBlockIndex: nextBlockIndex,
            promotedBlockIndex: nextBlockIndex,
            finished: Boolean(result?.finished),
            lastPromotionSummary: {
              currentBlockIndex: Number(
                result?.currentBlockIndex ??
                result?.currentPilotBlockIndex ??
                nextBlockIndex - 1 ??
                0
              ) || null,
              nextBlockIndex: Number(result?.nextBlockIndex ?? 0) || null,
              finished: Boolean(result?.finished),
              promotedAt: new Date().toISOString(),
            },
          };
        });
      }
    }}
      onPilotExecutionResult={(result) => {
        if (result && typeof setPreparedLotManifest === 'function') {
          setPreparedLotManifest((prev) => (
            prev && typeof prev === 'object'
              ? {
                  ...prev,
                  lastExecutionSummary: result,
                }
              : prev
          ));
        }
      }}
 />
  </>
);

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleImportFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      setSourceText(content);
      setSourceNotice(`Arquivo carregado: ${file.name}`);
    } catch {
      setSourceNotice('Não foi possível ler o arquivo selecionado.');
    } finally {
      event.target.value = '';
    }
  }

  function handleClearSource() {
    setSourceText('');
    setSourceNotice('');
  }

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
          DISPAROS · LOTE
        </div>

        <h1 style={{ margin: 0, fontSize: 34, lineHeight: 1.05, color: '#f8fafc' }}>
          Lote de disparos
        </h1>

        <p style={{ marginTop: 12, marginBottom: 0, color: '#9fb3c8', maxWidth: 920 }}>
          Importe uma lista, escolha um template aprovado e valide a simulação antes de liberar qualquer execução em lote.
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
        <ActionButton type="button" onClick={() => navigate('/configuracoes/aquisicao')}>
          Disparos
        </ActionButton>

        <ActionButton type="button" onClick={() => navigate('/configuracoes/aquisicao/templates')}>
          Templates
        </ActionButton>

        <ActionButton type="button" onClick={() => navigate('/configuracoes/aquisicao/lista')}>
          Lista
        </ActionButton>

        <button
          type="button"
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
        <SmallStatCard label="TOTAL LIDO" value={review.summary.total} hint="Quantidade bruta de linhas não vazias identificadas na fonte." />
        <SmallStatCard label="VÁLIDOS" value={review.summary.valid} hint="Linhas prontas para entrar na revisão final do lote." />
        <SmallStatCard label="DUPLICADOS" value={review.summary.duplicate} hint="Contatos repetidos detectados dentro da própria fonte atual." />
        <SmallStatCard label="INVÁLIDOS" value={review.summary.invalid} hint="Linhas com telefone fora do padrão esperado." />
        <SmallStatCard
          label="SEM PARÂMETRO"
          value={review.summary.missingParam}
          hint="Linhas com telefone válido, mas sem dados suficientes para o template selecionado."
        />
      </section>

      <SectionCard
        title="1. LISTA DE CONTATOS"
        right={
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.csv"
              style={{ display: 'none' }}
              onChange={handleImportFile}
            />

            <ActionButton type="button" onClick={handleImportClick}>
              Importar TXT/CSV
            </ActionButton>

            <ActionButton type="button" onClick={handleClearSource} disabled={!sourceText}>
              Limpar fonte
            </ActionButton>
          </div>
        }
      >
        <textarea
          value={sourceText}
          onChange={(e) => setSourceText(e.target.value)}
          rows={7}
          placeholder={expectedFormatText}
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
          {expectedFormatText}
        </div>

        <div
          style={{
            marginTop: 12,
            borderRadius: 12,
            border: '1px solid rgba(59,130,246,0.18)',
            background: 'rgba(15,23,42,0.42)',
            color: '#dbeafe',
            padding: '10px 12px',
            fontSize: 13,
            fontWeight: 600
          }}
        >
          O template selecionado exige {requiredParamCount} parâmetro(s) por linha, além do telefone.
        </div>

        {sourceNotice ? (
          <div
            style={{
              marginTop: 12,
              borderRadius: 12,
              border: '1px solid rgba(96,165,250,0.18)',
              background: 'rgba(30,41,59,0.5)',
              color: '#dbeafe',
              padding: '10px 12px',
              fontSize: 13,
              fontWeight: 600
            }}
          >
            {sourceNotice}
          </div>
        ) : null}
      </SectionCard>

      <SectionCard
        title="2. TEMPLATE"
        right={
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 12,
                border: '1px solid rgba(52,211,153,0.16)',
                background: 'rgba(2,6,23,0.42)',
                color: '#d1fae5',
                fontSize: 13,
                fontWeight: 700
              }}
            >
              Aprovados: {templates.length}
            </div>

            <ActionButton type="button" onClick={loadTemplates} disabled={loadingTemplates}>
              {loadingTemplates ? 'Atualizando...' : 'Atualizar templates'}
            </ActionButton>

            <ActionButton type="button" onClick={() => navigate('/configuracoes/aquisicao/lista')}>
              Abrir Lista
            </ActionButton>
          </div>
        }
      >
        <select
          value={selectedTemplateKey}
          onChange={(e) => setSelectedTemplateKey(e.target.value)}
          disabled={loadingTemplates || templates.length === 0}
          style={{
            width: '100%',
            borderRadius: 14,
            border: '1px solid rgba(148,163,184,0.18)',
            background: '#03111c',
            color: '#f8fafc',
            padding: '12px 14px'
          }}
        >
          {templates.length === 0 ? (
            <option value="">Nenhum template aprovado disponível</option>
          ) : null}

          {templates.map((item) => {
            const suffix =
              item.name === PREFERRED_TEMPLATE_NAME
                ? ' · recomendado'
                : item.name === FALLBACK_TEMPLATE_NAME
                ? ' · fallback'
                : '';

            return (
              <option key={item.key} value={item.key}>
                {`${item.name} • ${item.language} • ${item.categoryLabel}${suffix}`}
              </option>
            );
          })}
        </select>

        {templateError ? (
          <div
            style={{
              marginTop: 12,
              borderRadius: 12,
              border: '1px solid rgba(248,113,113,0.22)',
              background: 'rgba(69,10,10,0.35)',
              color: '#fecaca',
              padding: '10px 12px',
              fontSize: 13,
              fontWeight: 600
            }}
          >
            {templateError}
          </div>
        ) : null}

        <div
          style={{
            marginTop: 12,
            borderRadius: 12,
            border: '1px solid rgba(52,211,153,0.14)',
            background: 'rgba(2,6,23,0.55)',
            padding: 14
          }}
        >
          <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700, marginBottom: 10 }}>PRÉVIA DO TEMPLATE</div>

          <div style={{ color: '#f8fafc', fontSize: 14, lineHeight: 1.7 }}>
            <div><strong>HEADER:</strong> {headerText || '—'}</div>
            <div style={{ marginTop: 10 }}><strong>BODY:</strong> {bodyText || '—'}</div>
            {footerText ? <div style={{ marginTop: 10 }}><strong>FOOTER:</strong> {footerText}</div> : null}
          </div>
        </div>
      </SectionCard>

      <SectionCard title="REVISÃO OPERACIONAL DA FONTE">
        {previewRows.length === 0 ? (
          <div style={{ color: '#94a3b8', lineHeight: 1.6 }}>
            Nenhuma linha informada até o momento.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {previewRows.map((row) => {
              const meta = getRowStateMeta(row.state);


              return (
                <div
                  key={`${row.lineNumber}-${row.raw}`}
                  style={{
                    borderRadius: 14,
                    border: '1px solid rgba(148,163,184,0.14)',
                    background: 'rgba(2,6,23,0.5)',
                    padding: 12
                  }}
                >
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(80px, 110px) minmax(180px, 1fr) minmax(140px, 180px) auto',
                      gap: 12,
                      alignItems: 'center'
                    }}
                  >
                    <div style={{ color: '#94a3b8', fontSize: 13, fontWeight: 700 }}>
                      Linha {row.lineNumber}
                    </div>

                    <div style={{ color: '#f8fafc', fontSize: 13, wordBreak: 'break-word' }}>
                      {row.normalizedPhone || row.raw}
                    </div>

                    <div style={{ color: '#93c5fd', fontSize: 13, wordBreak: 'break-word' }}>
                      {row.params.length > 0 ? row.params.join(' | ') : '—'}
                    </div>

                    <div
                      style={{
                        justifySelf: 'end',
                        padding: '6px 10px',
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 700,
                        ...meta.badgeStyle
                      }}
                    >
                      {meta.label}
                    </div>
                  </div>

                  {row.issue ? (
                    <div style={{ marginTop: 8, color: '#94a3b8', fontSize: 12 }}>
                      {row.issue}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>


      <SectionCard title="3. VALIDAÇÃO E SIMULAÇÃO">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 12,
            alignItems: 'end'
          }}
        >
          <div>
            <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700, marginBottom: 8 }}>TAMANHO DO BLOCO</div>
            <input
              type="number"
              min="1"
              step="1"
              value={chunkSize}
              onChange={(e) => setChunkSize(e.target.value)}
              style={{
                width: '100%',
                borderRadius: 12,
                border: '1px solid rgba(148,163,184,0.18)',
                background: '#03111c',
                color: '#f8fafc',
                padding: '10px 12px'
              }}
            />
          </div>

          <div
            style={{
              borderRadius: 12,
              border: '1px solid rgba(52,211,153,0.14)',
              background: 'rgba(2,6,23,0.5)',
              padding: 12
            }}
          >
            <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700 }}>VÁLIDOS PRONTOS</div>
            <div style={{ color: '#f8fafc', fontSize: 26, fontWeight: 800, marginTop: 6 }}>
              {chunkSimulation.validCount}
            </div>
          </div>

          <div
            style={{
              borderRadius: 12,
              border: '1px solid rgba(52,211,153,0.14)',
              background: 'rgba(2,6,23,0.5)',
              padding: 12
            }}
          >
            <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700 }}>BLOCOS ESTIMADOS</div>
            <div style={{ color: '#f8fafc', fontSize: 26, fontWeight: 800, marginTop: 6 }}>
              {chunkSimulation.chunkCount}
            </div>
          </div>

          <div
            style={{
              borderRadius: 12,
              border: '1px solid rgba(52,211,153,0.14)',
              background: 'rgba(2,6,23,0.5)',
              padding: 12
            }}
          >
            <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700 }}>ÚLTIMO BLOCO</div>
            <div style={{ color: '#f8fafc', fontSize: 26, fontWeight: 800, marginTop: 6 }}>
              {chunkSimulation.lastChunkSize}
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: 14,
            borderRadius: 12,
            border: '1px solid rgba(59,130,246,0.18)',
            background: 'rgba(15,23,42,0.42)',
            color: '#dbeafe',
            padding: '12px 14px',
            fontSize: 13,
            lineHeight: 1.6,
            fontWeight: 600
          }}
        >
          Validação operacional apenas. O lote não será enviado aqui; esta etapa mostra volume, blocos previstos e segurança antes do preparo.
        </div>
      </SectionCard>

      {chunkPlan.length === 0 ? (
        <SectionCard title="PRÓXIMO PASSO">
          <div style={{
            color: '#bfdbfe',
            lineHeight: 1.6,
            fontSize: 14
          }}>
            Preencha ou importe a lista, confirme o template e valide os contatos. Quando houver linhas válidas,
            o painel libera plano do lote, revisão do bloco e gate de preparo.
          </div>
        </SectionCard>
      ) : null} {/* __AUTOATENDE_V4_R6E_BATCH_CLEAN_HIERARCHY__:empty_guidance */}



      {chunkPlan.length > 0 ? (
<SectionCard title="PLANO DO LOTE">
        {chunkPlan.length === 0 ? (
          <div style={{ color: '#94a3b8', lineHeight: 1.6 }}>
            Nenhum bloco estimado até o momento.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {chunkPlan.slice(0, 6).map((chunk) => (
              <div
                key={`chunk-${chunk.index}`}
                style={{
                  borderRadius: 14,
                  border: '1px solid rgba(148,163,184,0.14)',
                  background: 'rgba(2,6,23,0.5)',
                  padding: 12
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(100px, 130px) minmax(120px, 160px) minmax(120px, 180px) minmax(120px, 1fr)',
                    gap: 12,
                    alignItems: 'center'
                  }}
                >
                  <div style={{ color: '#f8fafc', fontSize: 13, fontWeight: 700 }}>
                    Bloco {chunk.index}
                  </div>

                  <div style={{ color: '#93c5fd', fontSize: 13 }}>
                    {chunk.size} contato(s)
                  </div>

                  <div style={{ color: '#94a3b8', fontSize: 13 }}>
                    Linhas {chunk.fromLine}–{chunk.toLine}
                  </div>

                  <div style={{ color: '#94a3b8', fontSize: 13, wordBreak: 'break-word' }}>
                    {chunk.firstPhone}
                    {chunk.lastPhone && chunk.lastPhone !== chunk.firstPhone ? ` → ${chunk.lastPhone}` : ''}
                  </div>
                </div>
              </div>
            ))}

            {chunkPlan.length > 6 ? (
              <div style={{ color: '#94a3b8', fontSize: 12 }}>
                Mostrando os 6 primeiros blocos de {chunkPlan.length}.
              </div>
            ) : null}
          </div>
        )}
      </SectionCard>
) : null} {/* __AUTOATENDE_V4_R6E_BATCH_CLEAN_HIERARCHY__:PLANO DO LOTE */}

      {chunkPlan.length > 0 ? (
<SectionCard title="REVISÃO DO BLOCO EM FOCO">
        {chunkPlan.length === 0 ? (
          <div style={{ color: '#94a3b8', lineHeight: 1.6 }}>
            Nenhum bloco disponível para revisão.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(180px, 220px) 1fr 1fr 1fr',
                gap: 12,
                alignItems: 'end'
              }}
            >
              <div>
                <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700, marginBottom: 8 }}>BLOCO EM FOCO</div>
                <input
                  type="number"
                  min="1"
                  max={Math.max(1, chunkPlan.length)}
                  step="1"
                  value={selectedChunkIndex}
                  onChange={(e) => setSelectedChunkIndex(Number(e.target.value || 1))}
                  style={{
                    width: '100%',
                    borderRadius: 12,
                    border: '1px solid rgba(148,163,184,0.18)',
                    background: '#03111c',
                    color: '#f8fafc',
                    padding: '10px 12px'
                  }}
                />
              </div>

              <div
                style={{
                  borderRadius: 12,
                  border: '1px solid rgba(52,211,153,0.14)',
                  background: 'rgba(2,6,23,0.5)',
                  padding: 12
                }}
              >
                <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700 }}>CONTATOS NO BLOCO</div>
                <div style={{ color: '#f8fafc', fontSize: 24, fontWeight: 800, marginTop: 6 }}>
                  {selectedChunkMeta?.size || 0}
                </div>
              </div>

              <div
                style={{
                  borderRadius: 12,
                  border: '1px solid rgba(52,211,153,0.14)',
                  background: 'rgba(2,6,23,0.5)',
                  padding: 12
                }}
              >
                <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700 }}>FAIXA DE LINHAS</div>
                <div style={{ color: '#f8fafc', fontSize: 18, fontWeight: 800, marginTop: 8 }}>
                  {selectedChunkMeta ? `${selectedChunkMeta.fromLine}–${selectedChunkMeta.toLine}` : '—'}
                </div>
              </div>

              <div
                style={{
                  borderRadius: 12,
                  border: '1px solid rgba(52,211,153,0.14)',
                  background: 'rgba(2,6,23,0.5)',
                  padding: 12
                }}
              >
                <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700 }}>RANGE DE TELEFONES</div>
                <div style={{ color: '#f8fafc', fontSize: 13, fontWeight: 700, marginTop: 8, wordBreak: 'break-word' }}>
                  {selectedChunkMeta
                    ? `${selectedChunkMeta.firstPhone}${selectedChunkMeta.lastPhone && selectedChunkMeta.lastPhone !== selectedChunkMeta.firstPhone ? ` → ${selectedChunkMeta.lastPhone}` : ''}`
                    : '—'}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              {selectedChunkRows.slice(0, 10).map((row) => (
                <div
                  key={`focused-${row.lineNumber}-${row.raw}`}
                  style={{
                    borderRadius: 14,
                    border: '1px solid rgba(148,163,184,0.14)',
                    background: 'rgba(2,6,23,0.5)',
                    padding: 12
                  }}
                >
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(90px, 110px) minmax(180px, 1fr) minmax(140px, 220px)',
                      gap: 12,
                      alignItems: 'center'
                    }}
                  >
                    <div style={{ color: '#94a3b8', fontSize: 13, fontWeight: 700 }}>
                      Linha {row.lineNumber}
                    </div>

                    <div style={{ color: '#f8fafc', fontSize: 13, wordBreak: 'break-word' }}>
                      {row.normalizedPhone || '—'}
                    </div>

                    <div style={{ color: '#93c5fd', fontSize: 13, wordBreak: 'break-word' }}>
                      {row.params.length > 0 ? row.params.join(' | ') : '—'}
                    </div>
                  </div>
                </div>
              ))}

              {selectedChunkRows.length > 10 ? (
                <div style={{ color: '#94a3b8', fontSize: 12 }}>
                  Mostrando os 10 primeiros contatos do bloco {selectedChunkIndex}.
                </div>
              ) : null}
            </div>
          </div>
        )}
      </SectionCard>
) : null} {/* __AUTOATENDE_V4_R6E_BATCH_CLEAN_HIERARCHY__:REVISÃO DO BLOCO EM FOCO */}

      {chunkPlan.length > 0 ? (
<SectionCard
        title="GATE DE CONFIRMAÇÃO DO LOTE"
        right={
          <ActionButton
            type="button"
            disabled={!selectedTemplate || chunkSimulation.validCount === 0 || !operatorConfirmed}
            onClick={handlePrepareLotForNextStep}
          >
            Preparar lote
          </ActionButton>
        }
      >
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            color: '#e2e8f0',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          <input
            type="checkbox"
            checked={operatorConfirmed}
            onChange={(e) => setOperatorConfirmed(e.target.checked)}
          />
          Confirmo que revisei lista, template e simulação antes de preparar o lote.
        </label>

        {lotPreparationSummary ? (
          <div
            style={{
              marginTop: 14,
              borderRadius: 12,
              border:
                lotPreparationSummary.status === 'ready'
                  ? '1px solid rgba(52,211,153,0.22)'
                  : '1px solid rgba(250,204,21,0.18)',
              background:
                lotPreparationSummary.status === 'ready'
                  ? 'rgba(6,78,59,0.22)'
                  : 'rgba(120,53,15,0.18)',
              color:
                lotPreparationSummary.status === 'ready'
                  ? '#d1fae5'
                  : '#fde68a',
              padding: '12px 14px',
              fontSize: 13,
              fontWeight: 600,
              lineHeight: 1.6
            }}
          >
            {lotPreparationSummary.message}
          </div>
        ) : (
          <div
            style={{
              marginTop: 14,
              borderRadius: 12,
              border: '1px solid rgba(59,130,246,0.18)',
              background: 'rgba(15,23,42,0.42)',
              color: '#dbeafe',
              padding: '12px 14px',
              fontSize: 13,
              lineHeight: 1.6,
              fontWeight: 600
            }}
          >
            Este gate ainda não envia o lote. Ele apenas registra a revisão operacional do operador antes da futura etapa de execução real.
          </div>
        )}
      </SectionCard>
) : null} {/* __AUTOATENDE_V4_R6F_BATCH_HIDE_ADVANCED_EMPTY_STATE_NOISE__:gate_confirmacao */}

      {preparedLotManifest ? (
<SectionCard title="MANIFESTO DA PRÓXIMA ETAPA">
        {!preparedLotManifest ? (
          <div style={{ color: '#94a3b8', lineHeight: 1.6 }}>
            Nenhum manifesto congelado até o momento.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 12
              }}
            >
              <div
                style={{
                  borderRadius: 12,
                  border: '1px solid rgba(52,211,153,0.14)',
                  background: 'rgba(2,6,23,0.5)',
                  padding: 12
                }}
              >
                <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700 }}>PREPARADO EM</div>
                <div style={{ color: '#f8fafc', fontSize: 14, fontWeight: 700, marginTop: 8 }}>
                  {preparedLotManifest.preparedAt}
                </div>
              </div>

              <div
                style={{
                  borderRadius: 12,
                  border: '1px solid rgba(52,211,153,0.14)',
                  background: 'rgba(2,6,23,0.5)',
                  padding: 12
                }}
              >
                <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700 }}>TEMPLATE</div>
                <div style={{ color: '#f8fafc', fontSize: 14, fontWeight: 700, marginTop: 8 }}>
                  {preparedLotManifest.templateName || '—'}
                </div>
                <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 6 }}>
                  {preparedLotManifest.templateLanguage} • {preparedLotManifest.categoryLabel}
                </div>
              </div>

              <div
                style={{
                  borderRadius: 12,
                  border: '1px solid rgba(52,211,153,0.14)',
                  background: 'rgba(2,6,23,0.5)',
                  padding: 12
                }}
              >
                <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700 }}>VOLUME CONGELADO</div>
                <div style={{ color: '#f8fafc', fontSize: 14, fontWeight: 700, marginTop: 8 }}>
                  {preparedLotManifest.validCount} contato(s) • {preparedLotManifest.chunkCount} bloco(s)
                </div>
                <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 6 }}>
                  Tamanho do bloco: {preparedLotManifest.chunkSize}
                </div>
              </div>

              <div
                style={{
                  borderRadius: 12,
                  border: '1px solid rgba(52,211,153,0.14)',
                  background: 'rgba(2,6,23,0.5)',
                  padding: 12
                }}
              >
                <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700 }}>RANGE OPERACIONAL</div>
                <div style={{ color: '#f8fafc', fontSize: 13, fontWeight: 700, marginTop: 8, wordBreak: 'break-word' }}>
                  {preparedLotManifest.firstPhone || '—'}
                  {preparedLotManifest.lastPhone && preparedLotManifest.lastPhone !== preparedLotManifest.firstPhone
                    ? ` → ${preparedLotManifest.lastPhone}`
                    : ''}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              {(preparedLotManifest.chunkPreview || []).map((chunk) => (
                <div
                  key={`manifest-chunk-${chunk.index}`}
                  style={{
                    borderRadius: 14,
                    border: '1px solid rgba(148,163,184,0.14)',
                    background: 'rgba(2,6,23,0.5)',
                    padding: 12
                  }}
                >
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(100px, 130px) minmax(120px, 160px) minmax(120px, 180px) minmax(120px, 1fr)',
                      gap: 12,
                      alignItems: 'center'
                    }}
                  >
                    <div style={{ color: '#f8fafc', fontSize: 13, fontWeight: 700 }}>
                      Bloco {chunk.index}
                    </div>

                    <div style={{ color: '#93c5fd', fontSize: 13 }}>
                      {chunk.size} contato(s)
                    </div>

                    <div style={{ color: '#94a3b8', fontSize: 13 }}>
                      Linhas {chunk.fromLine}–{chunk.toLine}
                    </div>

                    <div style={{ color: '#94a3b8', fontSize: 13, wordBreak: 'break-word' }}>
                      {chunk.firstPhone}
                      {chunk.lastPhone && chunk.lastPhone !== chunk.firstPhone ? ` → ${chunk.lastPhone}` : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </SectionCard>
) : null} {/* __AUTOATENDE_V4_R6E_BATCH_CLEAN_HIERARCHY__:MANIFESTO DA PRÓXIMA ETAPA */}


      {preparedLotManifest ? (
<SectionCard title="PILOTO CONGELADO NO PREPARO">
        {!preparedLotManifest?.frozenPilotCandidate ? (
          <div
            style={{
              borderRadius: 12,
              border: '1px solid rgba(59,130,246,0.18)',
              background: 'rgba(15,23,42,0.42)',
              color: '#dbeafe',
              padding: '12px 14px',
              fontSize: 13,
              lineHeight: 1.6,
              fontWeight: 600
            }}
          >
            O bloco piloto só é congelado quando o operador confirma o preparo do lote. Até lá, o painel acima mostra apenas o candidato dinâmico em foco.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            <div
              style={{
                borderRadius: 12,
                border: '1px solid rgba(59,130,246,0.18)',
                background: 'rgba(15,23,42,0.42)',
                color: '#dbeafe',
                padding: '12px 14px',
                fontSize: 13,
                lineHeight: 1.6,
                fontWeight: 600
              }}
            >
              Snapshot congelado no momento do preparo do lote. A partir daqui, o operador sabe exatamente qual bloco estava em foco quando aprovou a próxima etapa.
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 12
              }}
            >
              <div
                style={{
                  borderRadius: 12,
                  border: '1px solid rgba(52,211,153,0.14)',
                  background: 'rgba(2,6,23,0.5)',
                  padding: 12
                }}
              >
                <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700 }}>BLOCO CONGELADO</div>
                <div style={{ color: '#f8fafc', fontSize: 14, fontWeight: 700, marginTop: 8 }}>
                  Bloco {preparedLotManifest.frozenPilotCandidate.chunkIndex}
                </div>
              </div>

              <div
                style={{
                  borderRadius: 12,
                  border: '1px solid rgba(52,211,153,0.14)',
                  background: 'rgba(2,6,23,0.5)',
                  padding: 12
                }}
              >
                <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700 }}>CONTATOS NO PILOTO</div>
                <div style={{ color: '#f8fafc', fontSize: 14, fontWeight: 700, marginTop: 8 }}>
                  {preparedLotManifest.frozenPilotCandidate.contactCount}
                </div>
              </div>

              <div
                style={{
                  borderRadius: 12,
                  border: '1px solid rgba(52,211,153,0.14)',
                  background: 'rgba(2,6,23,0.5)',
                  padding: 12
                }}
              >
                <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700 }}>FAIXA DE LINHAS</div>
                <div style={{ color: '#f8fafc', fontSize: 14, fontWeight: 700, marginTop: 8 }}>
                  {preparedLotManifest.frozenPilotCandidate.fromLine}–{preparedLotManifest.frozenPilotCandidate.toLine}
                </div>
              </div>

              <div
                style={{
                  borderRadius: 12,
                  border: '1px solid rgba(52,211,153,0.14)',
                  background: 'rgba(2,6,23,0.5)',
                  padding: 12
                }}
              >
                <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700 }}>RANGE OPERACIONAL</div>
                <div style={{ color: '#f8fafc', fontSize: 13, fontWeight: 700, marginTop: 8, wordBreak: 'break-word' }}>
                  {preparedLotManifest.frozenPilotCandidate.firstPhone}
                  {preparedLotManifest.frozenPilotCandidate.lastPhone &&
                  preparedLotManifest.frozenPilotCandidate.lastPhone !== preparedLotManifest.frozenPilotCandidate.firstPhone
                    ? ` → ${preparedLotManifest.frozenPilotCandidate.lastPhone}`
                    : ''}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              {(preparedLotManifest.frozenPilotCandidate.rowPreview || []).map((row) => (
                <div
                  key={`frozen-pilot-${row.lineNumber}-${row.phone}-${row.paramPreview}`}
                  style={{
                    borderRadius: 14,
                    border: '1px solid rgba(148,163,184,0.14)',
                    background: 'rgba(2,6,23,0.5)',
                    padding: 12
                  }}
                >
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(90px, 110px) minmax(180px, 1fr) minmax(140px, 220px)',
                      gap: 12,
                      alignItems: 'center'
                    }}
                  >
                    <div style={{ color: '#94a3b8', fontSize: 13, fontWeight: 700 }}>
                      Linha {row.lineNumber}
                    </div>

                    <div style={{ color: '#f8fafc', fontSize: 13, wordBreak: 'break-word' }}>
                      {row.phone || '—'}
                    </div>

                    <div style={{ color: '#93c5fd', fontSize: 13, wordBreak: 'break-word' }}>
                      {row.paramPreview || '—'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </SectionCard>
) : null} {/* __AUTOATENDE_V4_R6E_BATCH_CLEAN_HIERARCHY__:PILOTO CONGELADO NO PREPARO */}


      {chunkPlan.length > 0 ? (
<SectionCard title="CANDIDATO A BLOCO PILOTO">
        {!preparedLotManifest ? (
          <div
            style={{
              borderRadius: 12,
              border: '1px solid rgba(59,130,246,0.18)',
              background: 'rgba(15,23,42,0.42)',
              color: '#dbeafe',
              padding: '12px 14px',
              fontSize: 13,
              lineHeight: 1.6,
              fontWeight: 600
            }}
          >
            Prepare primeiro o lote para a próxima etapa. Depois disso, este painel mostra qual bloco em foco é o candidato natural a piloto.
          </div>
        ) : !selectedChunkMeta || selectedChunkRows.length === 0 ? (
          <div
            style={{
              borderRadius: 12,
              border: '1px solid rgba(59,130,246,0.18)',
              background: 'rgba(15,23,42,0.42)',
              color: '#dbeafe',
              padding: '12px 14px',
              fontSize: 13,
              lineHeight: 1.6,
              fontWeight: 600
            }}
          >
            Nenhum bloco válido está selecionado no foco atual.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            <div
              style={{
                borderRadius: 12,
                border: '1px solid rgba(59,130,246,0.18)',
                background: 'rgba(15,23,42,0.42)',
                color: '#dbeafe',
                padding: '12px 14px',
                fontSize: 13,
                lineHeight: 1.6,
                fontWeight: 600
              }}
            >
              Painel somente leitura. Esta etapa ainda não congela nem envia o piloto; ela apenas evidencia o bloco em foco que seria o candidato operacional da próxima etapa.
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 12
              }}
            >
              <div
                style={{
                  borderRadius: 12,
                  border: '1px solid rgba(52,211,153,0.14)',
                  background: 'rgba(2,6,23,0.5)',
                  padding: 12
                }}
              >
                <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700 }}>BLOCO CANDIDATO</div>
                <div style={{ color: '#f8fafc', fontSize: 14, fontWeight: 700, marginTop: 8 }}>
                  Bloco {selectedChunkMeta.index}
                </div>
              </div>

              <div
                style={{
                  borderRadius: 12,
                  border: '1px solid rgba(52,211,153,0.14)',
                  background: 'rgba(2,6,23,0.5)',
                  padding: 12
                }}
              >
                <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700 }}>CONTATOS NO BLOCO</div>
                <div style={{ color: '#f8fafc', fontSize: 14, fontWeight: 700, marginTop: 8 }}>
                  {selectedChunkMeta.size}
                </div>
              </div>

              <div
                style={{
                  borderRadius: 12,
                  border: '1px solid rgba(52,211,153,0.14)',
                  background: 'rgba(2,6,23,0.5)',
                  padding: 12
                }}
              >
                <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700 }}>FAIXA DE LINHAS</div>
                <div style={{ color: '#f8fafc', fontSize: 14, fontWeight: 700, marginTop: 8 }}>
                  {selectedChunkMeta.fromLine}–{selectedChunkMeta.toLine}
                </div>
              </div>

              <div
                style={{
                  borderRadius: 12,
                  border: '1px solid rgba(52,211,153,0.14)',
                  background: 'rgba(2,6,23,0.5)',
                  padding: 12
                }}
              >
                <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700 }}>RANGE OPERACIONAL</div>
                <div style={{ color: '#f8fafc', fontSize: 13, fontWeight: 700, marginTop: 8, wordBreak: 'break-word' }}>
                  {selectedChunkMeta.firstPhone}
                  {selectedChunkMeta.lastPhone && selectedChunkMeta.lastPhone !== selectedChunkMeta.firstPhone
                    ? ` → ${selectedChunkMeta.lastPhone}`
                    : ''}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              {selectedChunkRows.slice(0, 5).map((row) => (
                <div
                  key={`pilot-candidate-${row.lineNumber}-${row.raw}`}
                  style={{
                    borderRadius: 14,
                    border: '1px solid rgba(148,163,184,0.14)',
                    background: 'rgba(2,6,23,0.5)',
                    padding: 12
                  }}
                >
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(90px, 110px) minmax(180px, 1fr) minmax(140px, 220px)',
                      gap: 12,
                      alignItems: 'center'
                    }}
                  >
                    <div style={{ color: '#94a3b8', fontSize: 13, fontWeight: 700 }}>
                      Linha {row.lineNumber}
                    </div>

                    <div style={{ color: '#f8fafc', fontSize: 13, wordBreak: 'break-word' }}>
                      {row.normalizedPhone || '—'}
                    </div>

                    <div style={{ color: '#93c5fd', fontSize: 13, wordBreak: 'break-word' }}>
                      {Array.isArray(row.params) && row.params.length > 0 ? row.params.join(' | ') : '—'}
                    </div>
                  </div>
                </div>
              ))}

              {selectedChunkRows.length > 5 ? (
                <div style={{ color: '#94a3b8', fontSize: 12 }}>
                  Mostrando os 5 primeiros contatos do bloco candidato.
                </div>
              ) : null}
            </div>
          </div>
        )}
      </SectionCard>
) : null} {/* __AUTOATENDE_V4_R6E_BATCH_CLEAN_HIERARCHY__:CANDIDATO A BLOCO PILOTO */}

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 14
        }}
      >
        {chunkPlan.length > 0 ? (
<SectionCard title="ESTADO DA SUPERFÍCIE">
          <div style={{ color: '#d1fae5', fontWeight: 700 }}>Alpha segura</div>
          <div style={{ color: '#94a3b8', marginTop: 8, lineHeight: 1.6 }}>
            Já prepara fonte e template reais, mas ainda segura o lote antes da camada de revisão/execução.
          </div>
        </SectionCard>
) : null} {/* __AUTOATENDE_V4_R6F_BATCH_HIDE_ADVANCED_EMPTY_STATE_NOISE__:estado_superficie */}

        {chunkPlan.length > 0 ? (
<SectionCard title="RISCO OPERACIONAL EVITADO">
          <div style={{ color: '#f8fafc', fontWeight: 700 }}>Sem disparo massivo prematuro</div>
          <div style={{ color: '#94a3b8', marginTop: 8, lineHeight: 1.6 }}>
            O envio real continua bloqueado nesta etapa para não queimar operação sem chunking, confirmação forte e observabilidade.
          </div>
        </SectionCard>
) : null} {/* __AUTOATENDE_V4_R6G_BATCH_HIDE_REMAINING_EMPTY_ADVISORY__:RISCO OPERACIONAL EVITADO */}

        {chunkPlan.length > 0 ? (
<SectionCard title="PRÓXIMO BLOCO">
          <div style={{ color: '#f8fafc', fontWeight: 700 }}>Chunking + gate forte do lote</div>
          <div style={{ color: '#94a3b8', marginTop: 8, lineHeight: 1.6 }}>
            O próximo endurecimento correto vem depois da revisão da fonte: confirmação forte, lote segmentado e só então preparação do envio real.
          </div>
        </SectionCard>
) : null} {/* __AUTOATENDE_V4_R6G_BATCH_HIDE_REMAINING_EMPTY_ADVISORY__:PRÓXIMO BLOCO */}
      </section>

      {preparedLotManifest ? (
<SectionCard
        title="EXECUÇÃO DO LOTE"
        right={
          <ActionButton
            type="button"
            disabled
            title={batchLockedReason}
            aria-disabled="true"
            style={{
              background: 'rgba(15,23,42,0.3)'
            }}
          >
            Piloto inline abaixo
          </ActionButton>
        }
      >
        <div
          style={{
            borderRadius: 14,
            border: '1px solid rgba(250,204,21,0.16)',
            background: 'rgba(120,53,15,0.18)',
            padding: '12px 14px',
            color: '#fde68a',
            fontWeight: 600,
            lineHeight: 1.6
          }}
        >
          {batchLockedReason}
        </div>
      </SectionCard>
) : null} {/* __AUTOATENDE_V4_R6F_BATCH_HIDE_ADVANCED_EMPTY_STATE_NOISE__:execucao_lote */}
    </div>
  );
}
