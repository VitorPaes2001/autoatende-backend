// __AUTOATENDE_V4_R23B_R3_CAPTURE_WHATSAPP_PROFILE_NAME_CONTACT_IDENTITY__
'use strict';

const supabase = require('../config/supabase');
const safeLogger = require('../security/safeLogger');
const { safeErrorFields, safeLogFields } = require('../security/telemetrySanitizer');
const { requireAuthoritativeCompanyScope } = require('../security/authoritativeTenant');

const MARKER = '__AUTOATENDE_V4_R23B_R3_CAPTURE_WHATSAPP_PROFILE_NAME_CONTACT_IDENTITY__';

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizeProfileName(value, phone) {
  const raw = String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!raw || raw.length < 2) return null;
  const phoneDigits = onlyDigits(phone);
  const rawDigits = onlyDigits(raw);
  if (phoneDigits && rawDigits && rawDigits === phoneDigits) return null;
  if (/^(undefined|null|unknown|unsupported|sem nome|contato|\[unsupported\])$/i.test(raw)) return null;
  return raw.slice(0, 120);
}

function brazilMobileAliases(phone) {
  const digits = onlyDigits(phone);
  const out = new Set();
  if (digits) out.add(digits);
  if (digits.length === 13 && digits.startsWith('55') && digits[4] === '9') out.add(digits.slice(0, 4) + digits.slice(5));
  if (digits.length === 12 && digits.startsWith('55')) out.add(digits.slice(0, 4) + '9' + digits.slice(4));
  return Array.from(out).filter(Boolean);
}

function getWebhookChanges(payload) {
  const entries = Array.isArray(payload?.entry) ? payload.entry : [];
  const changes = [];
  for (const entry of entries) {
    for (const change of (Array.isArray(entry?.changes) ? entry.changes : [])) changes.push(change);
  }
  return changes;
}

function extractContactIdentitiesFromWebhookPayload(payload) {
  const identities = [];
  for (const change of getWebhookChanges(payload)) {
    const value = change?.value || {};
    const contacts = Array.isArray(value?.contacts) ? value.contacts : [];
    const messages = Array.isArray(value?.messages) ? value.messages : [];
    const messageFroms = messages.map((message) => onlyDigits(message?.from)).filter(Boolean);

    for (let index = 0; index < contacts.length; index += 1) {
      const contact = contacts[index] || {};
      const waId = onlyDigits(contact.wa_id || contact.phone || contact.input || messageFroms[index] || messageFroms[0]);
      const profileName = normalizeProfileName(contact?.profile?.name || contact?.profile_name || contact?.name, waId);
      if (!waId || !profileName) continue;
      identities.push({
        phone: waId,
        aliases: brazilMobileAliases(waId),
        profile_name: profileName,
        source: 'whatsapp_contacts_profile',
      });
    }
  }

  const deduped = new Map();
  for (const item of identities) {
    const key = item.phone + ':' + item.profile_name.toLowerCase();
    if (!deduped.has(key)) deduped.set(key, item);
  }
  return Array.from(deduped.values());
}

function shouldUpdateContactName(row, nextName) {
  const current = String(row?.contact_name || '').trim();
  if (!current) return true;
  const currentDigits = onlyDigits(current);
  const phones = [onlyDigits(row?.contact_phone), onlyDigits(row?.contact_number)].filter(Boolean);
  if (currentDigits && phones.includes(currentDigits)) return true;
  if (/^(undefined|null|unknown|unsupported|\[unsupported\])$/i.test(current)) return true;
  if (current.toLowerCase() === String(nextName || '').toLowerCase()) return false;
  return false;
}

async function applyIdentityToConversation(companyId, identity) {
  if (!companyId || !identity?.profile_name || !identity?.aliases?.length) return { updated: 0, matched: 0 };
  const phoneFilters = [];
  for (const alias of identity.aliases) {
    phoneFilters.push(`contact_phone.eq.${alias}`);
    phoneFilters.push(`contact_number.eq.${alias}`);
  }

  const { data: rows, error } = await supabase
    .from('inbox_conversations')
    .select('id, company_id, contact_phone, contact_number, contact_name')
    .eq('company_id', companyId)
    .or(phoneFilters.join(','))
    .limit(30);

  if (error) {
    safeLogger.warn('[ContactIdentity] select_failed', safeErrorFields(error, { company_id: companyId }));
    return { updated: 0, matched: 0, error: true };
  }

  let updated = 0;
  for (const row of rows || []) {
    if (String(row?.company_id) !== String(companyId)) continue;
    if (!shouldUpdateContactName(row, identity.profile_name)) continue;
    const { error: updateError } = await supabase
      .from('inbox_conversations')
      .update({ contact_name: identity.profile_name })
      .eq('id', row.id)
      .eq('company_id', companyId);
    if (updateError) {
      safeLogger.warn('[ContactIdentity] update_failed', safeErrorFields(updateError, { company_id: companyId }));
      continue;
    }
    updated += 1;
  }
  return { updated, matched: Array.isArray(rows) ? rows.length : 0 };
}

async function captureFromWebhookPayload(payload, options = {}) {
  const companyId = requireAuthoritativeCompanyScope(options.authoritativeCompanyScope);
  const identities = extractContactIdentitiesFromWebhookPayload(payload);
  if (!identities.length) {
    return { marker: MARKER, identities: 0, matched: 0, updated: 0, source: options.source || 'unknown' };
  }

  let totalUpdated = 0;
  let totalMatched = 0;
  for (const identity of identities) {
    const result = await applyIdentityToConversation(companyId, identity);
    totalUpdated += result.updated || 0;
    totalMatched += result.matched || 0;
  }

  safeLogger.log('[ContactIdentity] capture_result', safeLogFields({
    company_id: companyId,
    source: options.source || 'unknown',
    identities: identities.length,
    matched: totalMatched,
    updated: totalUpdated,
  }));
  return {
    marker: MARKER,
    identities: identities.length,
    matched: totalMatched,
    updated: totalUpdated,
    source: options.source || 'unknown',
  };
}

module.exports = {
  MARKER,
  extractContactIdentitiesFromWebhookPayload,
  captureFromWebhookPayload,
};
