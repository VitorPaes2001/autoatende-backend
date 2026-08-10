const AppError = require('../utils/AppError');
const { normalizeTemplateUsageCategory } = require('./templateUsageCategories.service');
const { sendTemplateMessage } = require('./whatsapp.service');
const { consumeTemplateUsageByCategory } = require('./usage.service');
const { persistOutboundBotMessage } = require('./inbox.service');


const { resolveTemplateDisplayInput } = require('./templateBodyResolver.service'); // __AUTOATENDE_V4_R13C_R3B_R2_PATCH_REAL_SEND_TEMPLATE_BODY_SCOPE__

const { buildTemplateDisplayText, buildTemplateTechnicalPreview } = require('./templateDisplayText.service'); // __AUTOATENDE_V4_R13C_R2R1_TEMPLATE_DISPLAY_TEXT_NO_SCOPE_COLLISION__
const { buildTemplateInboxContent } = require('./templateInboxContent.service'); // __AUTOATENDE_V4_R13C_R5B_R1_RENDER_TEMPLATE_CONTENT_BEFORE_INBOX_PERSIST_FIXED_PARSER__

function buildAcquisitionTemplatePreview({
  templateName,
  languageCode = 'pt_BR',
  templateCategory = 'utility_auth',
  components = []
}) {
  const safeName = String(templateName || '').trim() || 'template';
  const safeLanguage = String(languageCode || 'pt_BR').trim() || 'pt_BR';
  const safeCategory = String(templateCategory || 'utility_auth').trim() || 'utility_auth';
  const safeComponents = Array.isArray(components) ? components : [];

  const sampleTexts = [];
  for (const component of safeComponents) {
    if (!component || typeof component !== 'object') continue;
    const params = Array.isArray(component.parameters) ? component.parameters : [];
    for (const param of params) {
      const value = String(param?.text || '').trim();
      if (value) sampleTexts.push(value);
      if (sampleTexts.length >= 2) break;
    }
    if (sampleTexts.length >= 2) break;
  }

  const suffix = sampleTexts.length ? ` • ${sampleTexts.join(' | ')}` : '';
  const templateDisplayInput = {
    name: safeName,
    language: safeLanguage,
    category: safeCategory,
    params:
      typeof params !== 'undefined' ? params :
      typeof templateParams !== 'undefined' ? templateParams :
      typeof parameters !== 'undefined' ? parameters :
      [],
    template: typeof template !== 'undefined' ? template : null,
    selectedTemplate: typeof selectedTemplate !== 'undefined' ? selectedTemplate : null,
    payload:
      typeof payload !== 'undefined' ? payload :
      typeof requestPayload !== 'undefined' ? requestPayload :
      typeof data !== 'undefined' ? data :
      null,
    body:
      typeof body !== 'undefined' ? body :
      typeof templateBody !== 'undefined' ? templateBody :
      '',
    body_text:
      typeof body_text !== 'undefined' ? body_text :
      typeof templateBodyText !== 'undefined' ? templateBodyText :
      '',
    template_body:
      typeof template_body !== 'undefined' ? template_body :
      typeof templateBody !== 'undefined' ? templateBody :
      '',
    components:
      typeof components !== 'undefined' ? components :
      typeof templateComponents !== 'undefined' ? templateComponents :
      []
  };

  const displayResult = buildTemplateDisplayText(templateDisplayInput);
  const technicalPreview = buildTemplateTechnicalPreview(templateDisplayInput);
  const preview = displayResult.text || technicalPreview; // __AUTOATENDE_V4_R13C_R2R1_TEMPLATE_DISPLAY_TEXT_NO_SCOPE_COLLISION__
  return preview.slice(0, 1000);
}

async function sendAcquisitionTemplate({
  companyId,
  to,
  templateName,
  languageCode = 'pt_BR',
  components = [],
  templateCategory = 'utility_auth',
  templatePreviewText = null
}) {
  const normalizedTo = String(to || '').trim();
  const normalizedTemplateName = String(templateName || '').trim();
  const normalizedLanguageCode = String(languageCode || 'pt_BR').trim() || 'pt_BR';
  const normalizedCategory = normalizeTemplateUsageCategory(templateCategory);
  const safeComponents = Array.isArray(components) ? components : [];

  let resolvedTemplatePreviewText = String(templatePreviewText || '').trim();
  let templateBodyResolverMeta = null;

  if (!resolvedTemplatePreviewText) {
    const resolvedTemplateDisplayInput = await resolveTemplateDisplayInput({
      companyId,
      templateName: normalizedTemplateName,
      languageCode: normalizedLanguageCode,
      templateCategory: normalizedCategory,
      components: safeComponents,
      params: safeComponents
    }); // __AUTOATENDE_V4_R13C_R3B_R2_PATCH_REAL_SEND_TEMPLATE_BODY_SCOPE__

    templateBodyResolverMeta = resolvedTemplateDisplayInput?.__templateBodyResolver || null;

    const resolvedDisplayResult = buildTemplateDisplayText(resolvedTemplateDisplayInput);
    resolvedTemplatePreviewText = String(resolvedDisplayResult?.text || '').trim();
  }


  if (!companyId) {
    throw new AppError('Company not resolved', 400, { code: 'ACQUISITION_SEND_COMPANY_MISSING' });
  }

  if (!normalizedTo) {
    throw new AppError('Destination phone missing', 400, { code: 'ACQUISITION_SEND_TO_MISSING' });
  }

  if (!normalizedTemplateName) {
    throw new AppError('Template name missing', 400, { code: 'ACQUISITION_SEND_TEMPLATE_MISSING' });
  }

  try {
    const sendResult = await sendTemplateMessage(
      companyId,
      normalizedTo,
      normalizedTemplateName,
      normalizedLanguageCode,
      safeComponents
    );

    let inboxPersistResult = null;
    try {

      const r13cR5bComponents =
        typeof safeComponents !== 'undefined'
          ? safeComponents
          : (typeof components !== 'undefined' && Array.isArray(components) ? components : []);

      const finalInboxTemplateContent = buildTemplateInboxContent({
        templateName: typeof normalizedTemplateName !== 'undefined' ? normalizedTemplateName : templateName,
        languageCode: typeof normalizedLanguageCode !== 'undefined' ? normalizedLanguageCode : languageCode,
        templateCategory: typeof normalizedCategory !== 'undefined' ? normalizedCategory : templateCategory,
        components: r13cR5bComponents,
        templatePreviewText: typeof templatePreviewText !== 'undefined' ? templatePreviewText : null,
        resolvedTemplatePreviewText: typeof resolvedTemplatePreviewText !== 'undefined' ? resolvedTemplatePreviewText : null,
        resolvedTemplateDisplayInput: typeof resolvedTemplateDisplayInput !== 'undefined' ? resolvedTemplateDisplayInput : null,
      }); // __AUTOATENDE_V4_R13C_R5B_R1_RENDER_TEMPLATE_CONTENT_BEFORE_INBOX_PERSIST_FIXED_PARSER__

      inboxPersistResult = await persistOutboundBotMessage({
        companyId,
        to: normalizedTo,
        content: finalInboxTemplateContent,
        metadata: {
          source: 'acquisition_template_send',
          template_name: normalizedTemplateName,
          language_code: normalizedLanguageCode,
          template_category: normalizedCategory,
          components_count: safeComponents.length,
          template_display_resolver: templateBodyResolverMeta || null,
          template_display_source: resolvedTemplatePreviewText ? 'resolved_or_provided' : 'fallback_preview',
          template_display_marker: '__AUTOATENDE_V4_R13C_R3B_R2_PATCH_REAL_SEND_TEMPLATE_BODY_SCOPE__'
        }
      });
    } catch (persistError) {
      console.error('[C16N_C6A_R1] acquisition_inbox_persist_failed', {
        message: persistError?.message || String(persistError),
        companyId,
        to: normalizedTo,
        templateName: normalizedTemplateName,
        provider_message_id: sendResult?.provider_message_id || null
      });
    }

    const usageResult = await consumeTemplateUsageByCategory({
      companyId,
      templateCategory: normalizedCategory,
      quantity: 1,
      timestamp: new Date()
    });

    return {
      success: true,
      to: normalizedTo,
      template_name: normalizedTemplateName,
      language_code: normalizedLanguageCode,
      template_category: normalizedCategory,
      provider_message_id: sendResult?.provider_message_id || null,
      usage: usageResult?.usage || null,
      usage_reason: usageResult?.reason || null,
      usage_degraded: Boolean(usageResult?.degraded),
      inbox_persisted: Boolean(inboxPersistResult?.success),
      inbox_conversation_id: inboxPersistResult?.conversation_id || null,
      inbox_message_id: inboxPersistResult?.message_id || null,
      send_marker: '__AUTOATENDE_C16N_B5_ACQUISITION_SEND_TEMPLATE__',
      inbox_write_through_marker: '__AUTOATENDE_C16N_C6A_R1_ACQUISITION_INBOX_WRITE_THROUGH__',
      provider_observability_marker: '__AUTOATENDE_C16N_C3D_PROVIDER_ERROR_OBSERVABILITY__'
    };
  } catch (error) {
    const upstreamResponseData = error?.response?.data || null;
    const upstreamResponseHeaders = error?.response?.headers || null;
    const upstreamStatus = error?.response?.status || error?.statusCode || 500;
    const upstreamUrl = error?.config?.url || null;
    const upstreamMethod = error?.config?.method || null;

    const providerMeta =
      error?.meta ||
      upstreamResponseData ||
      (error?.response
        ? {
            status: error?.response?.status || null,
            headers: upstreamResponseHeaders,
            data: upstreamResponseData
          }
        : null);

    const providerError =
      providerMeta?.error ||
      providerMeta?.meta?.error ||
      providerMeta?.data?.error ||
      upstreamResponseData?.error ||
      null;

    throw new AppError(
      error?.message || 'Failed to send WhatsApp template message',
      upstreamStatus,
      {
        code: error?.code || 'ACQUISITION_PROVIDER_SEND_FAILED',
        provider_meta: providerMeta,
        provider_error: providerError,
        provider_observability_marker: '__AUTOATENDE_C16N_C3D_PROVIDER_ERROR_OBSERVABILITY__',
        upstream_status: upstreamStatus,
        upstream_method: upstreamMethod,
        upstream_url: upstreamUrl,
        debug_context: {
          to: normalizedTo,
          template_name: normalizedTemplateName,
          language_code: normalizedLanguageCode,
          template_category: normalizedCategory
        }
      }
    );
  }
}


// __AUTOATENDE_C16N_C11B_R2A_PROMOTE_PILOT_SERVICE__
function resolveAcquisitionBlockIndex(block, fallback = 0) {
  const raw =
    block?.blockIndex ??
    block?.index ??
    block?.chunkIndex ??
    block?.block ??
    fallback;

  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function resolveAcquisitionBlockItems(block) {
  const rawItems =
    (Array.isArray(block?.items) && block.items) ||
    (Array.isArray(block?.rows) && block.rows) ||
    (Array.isArray(block?.entries) && block.entries) ||
    (Array.isArray(block?.validRows) && block.validRows) ||
    (Array.isArray(block?.rowPreview) && block.rowPreview) ||
    (Array.isArray(block?.previewRows) && block.previewRows) ||
    (Array.isArray(block?.contacts) && block.contacts) ||
    (Array.isArray(block?.contactRows) && block.contactRows) ||
    [];

  return rawItems.map((entry, idx) => {
    const raw = entry?.raw && typeof entry.raw === 'object' ? entry.raw : null;

    const phone = String(
      entry?.phone ??
      entry?.phoneNumber ??
      entry?.phone_number ??
      entry?.to ??
      raw?.phone ??
      raw?.phoneNumber ??
      raw?.phone_number ??
      raw?.to ??
      ''
    ).trim();

    const lineNumberRaw =
      entry?.lineNumber ??
      entry?.rowNumber ??
      entry?.line ??
      raw?.lineNumber ??
      raw?.rowNumber ??
      raw?.line ??
      idx + 1;

    const lineNumber = Number(lineNumberRaw);
    const safeLineNumber = Number.isFinite(lineNumber) && lineNumber > 0 ? lineNumber : idx + 1;

    return {
      ...entry,
      raw: raw || entry?.raw || null,
      phone,
      lineNumber: safeLineNumber
    };
  }).filter((entry) => String(entry?.phone || '').trim());
}

function normalizeAcquisitionPilotBlock(block, fallbackIndex = 1) {
  const blockIndex = resolveAcquisitionBlockIndex(block, fallbackIndex);
  const items = resolveAcquisitionBlockItems(block);

  const firstPhone = String(items[0]?.phone || '').trim();
  const lastPhone = String(items[items.length - 1]?.phone || '').trim();

  const fromLineRaw =
    block?.fromLine ??
    block?.startLine ??
    block?.lineStart ??
    items[0]?.lineNumber ??
    1;

  const toLineRaw =
    block?.toLine ??
    block?.endLine ??
    block?.lineEnd ??
    items[items.length - 1]?.lineNumber ??
    fromLineRaw;

  const fromLine = Number(fromLineRaw);
  const toLine = Number(toLineRaw);

  return {
    ...block,
    blockIndex,
    items,
    rowPreview:
      (Array.isArray(block?.rowPreview) && block.rowPreview.length ? block.rowPreview : items),
    contactsCount:
      Number(block?.contactsCount ?? block?.contactCount ?? items.length) || items.length,
    fromLine: Number.isFinite(fromLine) ? fromLine : 1,
    toLine: Number.isFinite(toLine) ? toLine : (Number.isFinite(fromLine) ? fromLine : 1),
    firstPhone,
    lastPhone,
    phoneRange:
      block?.phoneRange ||
      block?.rangeOperational ||
      block?.rangeLabel ||
      (firstPhone && lastPhone ? `${firstPhone} – ${lastPhone}` : '')
  };
}

function resolveAcquisitionManifestBlocks(manifest) {
  const rawBlocks =
    (Array.isArray(manifest?.blocks) && manifest.blocks) ||
    (Array.isArray(manifest?.plan?.blocks) && manifest.plan.blocks) ||
    (Array.isArray(manifest?.chunkPlan) && manifest.chunkPlan) ||
    (Array.isArray(manifest?.chunkPreview) && manifest.chunkPreview) ||
    (Array.isArray(manifest?.manifestBlocks) && manifest.manifestBlocks) ||
    [];

  return rawBlocks
    .map((block, idx) => normalizeAcquisitionPilotBlock(block, idx + 1))
    .sort((a, b) => resolveAcquisitionBlockIndex(a, 0) - resolveAcquisitionBlockIndex(b, 0));
}

function promoteAcquisitionPilotBlock({
  manifest,
  currentPilot,
  execution
}) {
  const safeManifest = manifest && typeof manifest === 'object' ? manifest : {};
  const safeExecution = execution && typeof execution === 'object' ? execution : {};

  const manifestBlocks = resolveAcquisitionManifestBlocks(safeManifest);

  if (!manifestBlocks.length) {
    throw new AppError('Manifest blocks missing', 400, {
      code: 'ACQUISITION_PILOT_PROMOTION_MANIFEST_MISSING'
    });
  }

  const sent = Number(safeExecution?.sent ?? 0);
  const failed = Number(safeExecution?.failed ?? 0);
  const skipped = Number(safeExecution?.skipped ?? safeExecution?.ignored ?? 0);

  if (!(sent > 0) || failed > 0) {
    throw new AppError('Pilot block is not approved for promotion', 400, {
      code: 'ACQUISITION_PILOT_PROMOTION_NOT_APPROVED',
      meta: { sent, failed, skipped }
    });
  }

  const current =
    normalizeAcquisitionPilotBlock(
      currentPilot ||
      safeManifest?.frozenPilotCandidate ||
      manifestBlocks[0],
      1
    );

  const currentBlockIndex = resolveAcquisitionBlockIndex(current, 1);

  const nextBlock = manifestBlocks.find(
    (block) => resolveAcquisitionBlockIndex(block, 0) > currentBlockIndex
  );

  if (!nextBlock) {
    return {
      finished: true,
      currentBlockIndex,
      nextBlockIndex: null,
      nextPilotCandidate: null,
      manifestSummary: {
        chunkCount: Number(safeManifest?.chunkCount ?? manifestBlocks.length) || manifestBlocks.length,
        validCount:
          Number(
            safeManifest?.validCount ??
            manifestBlocks.reduce((acc, block) => acc + Number(block?.contactsCount || 0), 0)
          ) || 0,
        chunkSize: Number(safeManifest?.chunkSize ?? 0) || null
      }
    };
  }

  const nextBlockIndex = resolveAcquisitionBlockIndex(nextBlock, currentBlockIndex + 1);
  const nextPilotCandidate = normalizeAcquisitionPilotBlock(nextBlock, nextBlockIndex);

  return {
    finished: false,
    currentBlockIndex,
    nextBlockIndex,
    nextPilotCandidate,
    manifestSummary: {
      chunkCount: Number(safeManifest?.chunkCount ?? manifestBlocks.length) || manifestBlocks.length,
      validCount:
        Number(
          safeManifest?.validCount ??
          manifestBlocks.reduce((acc, block) => acc + Number(block?.contactsCount || 0), 0)
        ) || 0,
      chunkSize: Number(safeManifest?.chunkSize ?? 0) || null
    }
  };
}


module.exports = {
  sendAcquisitionTemplate,
  promoteAcquisitionPilotBlock
};
