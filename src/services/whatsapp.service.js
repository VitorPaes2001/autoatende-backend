const supabase = require("../config/supabase");
const AppError = require("../utils/AppError");
const axios = require("axios");
const { listApprovedTemplatesForCompany } = require("./acquisitionTemplateCatalog.service");

const WHATSAPP_GRAPH_VERSION = String(process.env.WHATSAPP_API_VERSION || "v24.0").trim();
const WHATSAPP_SEND_TIMEOUT_MS = Number(process.env.WHATSAPP_SEND_TIMEOUT_MS || 20000);

const isNonEmptyString = (v) => typeof v === "string" && v.trim().length > 0;
const isLikelyNumericId = (v) => isNonEmptyString(v) && /^[0-9]{12,}$/.test(v.trim());
const normalizeE164 = (v) => {
  if (!isNonEmptyString(v)) return null;
  const s = v.trim();
  if (/^\+[1-9]\d{7,14}$/.test(s)) return s;
  if (/^[1-9]\d{7,14}$/.test(s)) return `+${s}`;
  return null;
};

const pickTenantAccount = async (tenantId) => {
  let { data: account, error } = await supabase
    .from("whatsapp_accounts")
    .select("id, company_id, client_id, waba_id, phone_number_id, phone_number, access_token, created_at, updated_at")
    .eq("company_id", tenantId)
    .maybeSingle();

  if (error) throw new AppError("Failed to load WhatsApp account", 500, { code: "WHATSAPP_ACCOUNT_LOOKUP_FAILED" });
  if (account) return account;

  ({ data: account, error } = await supabase
    .from("whatsapp_accounts")
    .select("id, company_id, client_id, waba_id, phone_number_id, phone_number, access_token, created_at, updated_at")
    .eq("client_id", tenantId)
    .maybeSingle());

  if (error) throw new AppError("Failed to load WhatsApp account", 500, { code: "WHATSAPP_ACCOUNT_LOOKUP_FAILED" });
  return account || null;
};

const connectWhatsApp = async (companyId, userId, data) => {
  if (!data || typeof data !== "object") {
    throw new AppError("Invalid payload", 400, { code: "WHATSAPP_CONNECT_INVALID_PAYLOAD" });
  }

  const waba_id = isNonEmptyString(data.waba_id) ? data.waba_id.trim() : null;
  const access_token = isNonEmptyString(data.access_token) ? data.access_token.trim() : null;

  const rawPhoneNumber = isNonEmptyString(data.phone_number) ? data.phone_number.trim() : null;
  const explicitPhoneNumberId = isNonEmptyString(data.phone_number_id) ? data.phone_number_id.trim() : null;

  const inferredPhoneNumberId =
    explicitPhoneNumberId ||
    (isLikelyNumericId(rawPhoneNumber) ? rawPhoneNumber : null) ||
    (isLikelyNumericId(waba_id) ? waba_id : null);

  const normalizedPhone = normalizeE164(rawPhoneNumber);

  const missing = [];
  if (!waba_id) missing.push("waba_id");
  if (!access_token) missing.push("access_token");
  if (!inferredPhoneNumberId) missing.push("phone_number_id");

  if (missing.length) {
    throw new AppError("Missing required fields", 400, {
      code: "WHATSAPP_CONNECT_MISSING_FIELDS",
      missing
    });
  }

  const { data: conflicts, error: conflictError } = await supabase
    .from("whatsapp_accounts")
    .select("id, company_id, client_id, phone_number_id")
    .eq("phone_number_id", inferredPhoneNumberId);

  if (conflictError) {
    throw new AppError("Failed to validate phone_number_id", 500, { code: "WHATSAPP_ACCOUNT_LOOKUP_FAILED" });
  }

  const hasConflict = (conflicts || []).some((r) => {
    if (r.company_id && r.company_id !== companyId) return true;
    if (!r.company_id && r.client_id && r.client_id !== userId) return true;
    return false;
  });

  if (hasConflict) {
    throw new AppError("Phone number already linked to another account", 409, {
      code: "WHATSAPP_PHONE_NUMBER_ALREADY_LINKED"
    });
  }

  let existingAccount = null;

  {
    const { data: byCompany, error: byCompanyError } = await supabase
      .from("whatsapp_accounts")
      .select("id, phone_number")
      .eq("company_id", companyId)
      .maybeSingle();

    if (byCompanyError) throw new AppError("Failed to load WhatsApp account", 500, { code: "WHATSAPP_ACCOUNT_LOOKUP_FAILED" });
    existingAccount = byCompany || null;
  }

  if (!existingAccount) {
    const { data: byClient, error: byClientError } = await supabase
      .from("whatsapp_accounts")
      .select("id, phone_number")
      .eq("client_id", userId)
      .maybeSingle();

    if (byClientError) throw new AppError("Failed to load WhatsApp account", 500, { code: "WHATSAPP_ACCOUNT_LOOKUP_FAILED" });
    existingAccount = byClient || null;
  }

  const payloadBase = {
    company_id: companyId,
    client_id: userId,
    waba_id,
    phone_number_id: inferredPhoneNumberId,
    access_token,
    updated_at: new Date().toISOString()
  };

  const payloadToSave = { ...payloadBase };
  if (normalizedPhone) payloadToSave.phone_number = normalizedPhone;

  let result;
  if (existingAccount) {
    const { data: updated, error: updateError } = await supabase
      .from("whatsapp_accounts")
      .update(payloadToSave)
      .eq("id", existingAccount.id)
      .select("id")
      .single();

    if (updateError) {
      throw new AppError("Failed to update WhatsApp account", 500, {
        code: "WHATSAPP_ACCOUNT_UPDATE_FAILED",
        details: updateError.message
      });
    }
    result = updated;
  } else {
    const { data: inserted, error: insertError } = await supabase
      .from("whatsapp_accounts")
      .insert({
        ...payloadToSave,
        created_at: new Date().toISOString()
      })
      .select("id")
      .single();

    if (insertError) {
      throw new AppError("Failed to create WhatsApp account", 500, {
        code: "WHATSAPP_ACCOUNT_CREATE_FAILED",
        details: insertError.message
      });
    }
    result = inserted;
  }

  return {
    success: true,
    id: result.id,
    connected: true,
    waba_id,
    phone_number_id: inferredPhoneNumberId,
    phone_number: normalizedPhone || null
  };
};

const getWhatsAppStatus = async (companyId) => {
  const account = await pickTenantAccount(companyId);
  if (!account) return { connected: false };

  return {
    connected: true,
    waba_id: account.waba_id,
    phone_number_id: account.phone_number_id || null,
    phone_number: account.phone_number || null,
    connected_at: account.created_at,
    last_updated: account.updated_at
  };
};

const getAccessToken = async (companyId) => {
  const account = await pickTenantAccount(companyId);
  if (!account || !account.access_token) return null;
  return account.access_token;
};


const createTemplateAuthorizationError = ({ unavailable = false, code = null } = {}) => new AppError(
  unavailable
    ? "Não foi possível confirmar a autorização do template agora."
    : "Template não autorizado para esta conta operacional.",
  unavailable ? 503 : 403,
  {
    code: code || (
      unavailable
        ? "ACQUISITION_TEMPLATE_AUTHORIZATION_UNAVAILABLE"
        : "ACQUISITION_TEMPLATE_NOT_AUTHORIZED"
    ),
    meta: {
      template_authorization: unavailable ? "unavailable" : "denied"
    }
  }
);

const resolveApprovedTemplateAtSendBoundary = async ({
  companyId,
  templateName,
  languageCode
}) => {
  let catalog;

  try {
    catalog = await listApprovedTemplatesForCompany(companyId);
  } catch (_error) {
    throw createTemplateAuthorizationError({ unavailable: true });
  }

  if (
    !Array.isArray(catalog?.items) ||
    catalog?.meta?.approved_only !== true ||
    !isNonEmptyString(catalog?.meta?.waba_id)
  ) {
    throw createTemplateAuthorizationError({ unavailable: true });
  }

  const approvedTemplate = catalog.items.find((item) => (
    isNonEmptyString(item?.name) &&
    item.name.trim() === templateName &&
    isNonEmptyString(item?.language) &&
    item.language.trim() === languageCode &&
    item?.isSendable === true &&
    String(item?.rawStatus || "").trim().toUpperCase() === "APPROVED" &&
    String(item?.status || "").trim().toLowerCase() === "approved"
  ));

  if (!approvedTemplate) {
    throw createTemplateAuthorizationError();
  }

  return {
    wabaId: catalog.meta.waba_id.trim(),
    phoneNumberId: isNonEmptyString(catalog?.meta?.phone_number_id)
      ? catalog.meta.phone_number_id.trim()
      : null
  };
};

const sendTemplateMessage = async (
  companyId,
  to,
  templateName,
  languageCode = "pt_BR",
  components = []
) => {
  const normalizedTemplateName = isNonEmptyString(templateName) ? templateName.trim() : null;
  if (!normalizedTemplateName) {
    throw new AppError("Template name missing", 400, { code: "WHATSAPP_TEMPLATE_NAME_MISSING" });
  }

  const normalizedLanguageCode = isNonEmptyString(languageCode) ? languageCode.trim() : "pt_BR";
  const approvedProviderAccount = await resolveApprovedTemplateAtSendBoundary({
    companyId,
    templateName: normalizedTemplateName,
    languageCode: normalizedLanguageCode
  });

  const account = await pickTenantAccount(companyId);
  if (!account) throw new AppError("WhatsApp account not connected", 400, { code: "WHATSAPP_NOT_CONNECTED" });

  const accountWabaId = isNonEmptyString(account.waba_id) ? account.waba_id.trim() : null;
  const phoneNumberId =
    (isNonEmptyString(account.phone_number_id) ? account.phone_number_id.trim() : null) ||
    (isLikelyNumericId(account.phone_number) ? account.phone_number.trim() : null) ||
    (isLikelyNumericId(account.waba_id) ? account.waba_id.trim() : null);

  if (!phoneNumberId) {
    throw new AppError("WhatsApp phone_number_id missing", 400, { code: "WHATSAPP_PHONE_NUMBER_ID_MISSING" });
  }

  if (
    accountWabaId !== approvedProviderAccount.wabaId ||
    (
      approvedProviderAccount.phoneNumberId &&
      phoneNumberId !== approvedProviderAccount.phoneNumberId
    )
  ) {
    throw createTemplateAuthorizationError({
      code: "WHATSAPP_TEMPLATE_AUTHORIZATION_ACCOUNT_MISMATCH"
    });
  }

  const accessToken = isNonEmptyString(account.access_token) ? account.access_token.trim() : null;
  if (!accessToken) throw new AppError("WhatsApp access token missing", 400, { code: "WHATSAPP_TOKEN_MISSING" });

  const safeComponents = Array.isArray(components) ? components : [];

  const url = `https://graph.facebook.com/${WHATSAPP_GRAPH_VERSION}/${phoneNumberId}/messages`;

  try {
    const response = await axios.post(
      url,
      {
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: normalizedTemplateName,
          language: { code: normalizedLanguageCode },
          components: safeComponents
        }
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        timeout: WHATSAPP_SEND_TIMEOUT_MS
      }
    );

    return {
      success: true,
      provider_message_id: response?.data?.messages?.[0]?.id || null,
      raw: response?.data || null
    };
  } catch (err) {
    const status = err?.response?.status || 500;
    const meta = err?.response?.data || null;
      // __AUTOATENDE_C16N_C10M_R1C_WA_META_LOG__
      console.error("[C10M_R1C] whatsapp_template_send_failed", {
        companyId,
        to,
        templateName: normalizedTemplateName,
        languageCode: normalizedLanguageCode,
        componentsCount: Array.isArray(safeComponents) ? safeComponents.length : null,
        phoneNumberId,
        status,
        meta
      });
    throw new AppError("Failed to send WhatsApp template message", status >= 400 && status < 600 ? status : 500, {
      code: "WHATSAPP_TEMPLATE_SEND_FAILED",
      meta
    });
  }
};

const sendMessage = async (companyId, to, body) => {
  const accessToken = await getAccessToken(companyId);
  if (!accessToken) throw new AppError("WhatsApp access token missing", 400, { code: "WHATSAPP_TOKEN_MISSING" });

  const account = await pickTenantAccount(companyId);
  if (!account) throw new AppError("WhatsApp account not connected", 400, { code: "WHATSAPP_NOT_CONNECTED" });

  const phoneNumberId =
    (isNonEmptyString(account.phone_number_id) ? account.phone_number_id.trim() : null) ||
    (isLikelyNumericId(account.phone_number) ? account.phone_number.trim() : null) ||
    (isLikelyNumericId(account.waba_id) ? account.waba_id.trim() : null);

  if (!phoneNumberId) {
    throw new AppError("WhatsApp phone_number_id missing", 400, { code: "WHATSAPP_PHONE_NUMBER_ID_MISSING" });
  }

  const url = `https://graph.facebook.com/${WHATSAPP_GRAPH_VERSION}/${phoneNumberId}/messages`;

  try {
    const response = await axios.post(
      url,
      {
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body }
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        timeout: WHATSAPP_SEND_TIMEOUT_MS
      }
    );

    return {
      success: true,
      provider_message_id: response?.data?.messages?.[0]?.id || null,
      raw: response?.data || null
    };
  } catch (err) {
    const status = err?.response?.status || 500;
    const meta = err?.response?.data || null;
    throw new AppError("Failed to send WhatsApp message", status >= 400 && status < 600 ? status : 500, {
      code: "WHATSAPP_SEND_FAILED",
      meta
    });
  }
};

module.exports = {
  connectWhatsApp,
  getWhatsAppStatus,
  getAccessToken,
  sendMessage,
  sendTemplateMessage
};
