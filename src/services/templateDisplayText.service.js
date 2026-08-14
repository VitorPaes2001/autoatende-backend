/**
 * __AUTOATENDE_V4_R13C_R2R1_TEMPLATE_DISPLAY_TEXT_NO_SCOPE_COLLISION__
 *
 * Converte template enviado em texto exibível no Inbox.
 * Não envia mensagem, não consome saldo, não altera banco sozinho.
 */

const MARKER = "__AUTOATENDE_V4_R13C_R2R1_TEMPLATE_DISPLAY_TEXT_NO_SCOPE_COLLISION__";

function asString(value) {
  if (value === undefined || value === null) return "";
  return String(value);
}

function clean(value) {
  return asString(value).trim();
}

function safeJsonParse(value) {
  if (!value) return null;
  if (typeof value === "object") return value;

  try {
    return JSON.parse(value);
  } catch (_) {
    return null;
  }
}

function pick(...values) {
  for (const value of values) {
    const text = clean(value);
    if (text) return text;
  }
  return "";
}

function flatten(value, output = []) {
  if (value === undefined || value === null) return output;

  if (Array.isArray(value)) {
    for (const item of value) flatten(item, output);
    return output;
  }

  if (typeof value === "object") {
    if ("text" in value) flatten(value.text, output);
    else if ("value" in value) flatten(value.value, output);
    else if ("parameter" in value) flatten(value.parameter, output);
    else if ("parameters" in value) flatten(value.parameters, output);
    else {
      for (const [key, item] of Object.entries(value)) {
        const low = String(key).toLowerCase();
        if (["name", "language", "category", "type", "template"].includes(low)) continue;
        flatten(item, output);
      }
    }

    return output;
  }

  const text = clean(value);
  if (text) output.push(text);

  return output;
}

function extractParams(input = {}) {
  const params = [];

  flatten(input.params, params);
  flatten(input.parameters, params);
  flatten(input.templateParams, params);
  flatten(input.template_params, params);
  flatten(input.variables, params);
  flatten(input.bodyParams, params);
  flatten(input.body_params, params);

  const components =
    input.components ||
    input.templateComponents ||
    input.template_components ||
    input.selectedTemplate?.components ||
    input.template?.components ||
    input.payload?.components ||
    input.raw?.components;

  const parsed = safeJsonParse(components);
  const list = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.components)
      ? parsed.components
      : [];

  for (const component of list) {
    flatten(component?.parameters, params);
  }

  return params
    .map(clean)
    .filter(Boolean)
    .filter((item, index, arr) => arr.indexOf(item) === index)
    .slice(0, 20);
}

function extractComponents(input = {}) {
  const raw =
    input.components ||
    input.templateComponents ||
    input.template_components ||
    input.selectedTemplate?.components ||
    input.template?.components ||
    input.payload?.components ||
    input.raw?.components;

  const parsed = safeJsonParse(raw);

  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed?.components)) return parsed.components;

  return [];
}

function extractTemplateTexts(input = {}) {
  const components = extractComponents(input);

  let header = pick(
    input.header,
    input.headerText,
    input.header_text,
    input.templateHeader,
    input.template_header,
    input.selectedTemplate?.header,
    input.selectedTemplate?.header_text,
    input.template?.header,
    input.template?.header_text
  );

  let body = pick(
    input.displayText,
    input.display_text,
    input.renderedText,
    input.rendered_text,
    input.templateBody,
    input.template_body,
    input.bodyText,
    input.body_text,
    input.body,
    input.message,
    input.text,
    input.selectedTemplate?.body,
    input.selectedTemplate?.body_text,
    input.selectedTemplate?.content,
    input.template?.body,
    input.template?.body_text,
    input.template?.content
  );

  let footer = pick(
    input.footer,
    input.footerText,
    input.footer_text,
    input.templateFooter,
    input.template_footer,
    input.selectedTemplate?.footer,
    input.selectedTemplate?.footer_text,
    input.template?.footer,
    input.template?.footer_text
  );

  for (const component of components) {
    const type = clean(component?.type).toLowerCase();
    const text = pick(component?.text, component?.content, component?.body);

    if (!text) continue;

    if (type === "header" && !header) header = text;
    if (type === "body" && !body) body = text;
    if (type === "footer" && !footer) footer = text;
  }

  return { header, body, footer };
}

function applyParams(text, params) {
  let rendered = asString(text);

  params.forEach((param, index) => {
    const n = index + 1;
    rendered = rendered.replace(
      new RegExp(`\\{\\{\\s*${n}\\s*\\}\\}`, "g"),
      asString(param)
    );
  });

  rendered = rendered.replace(/\{\{\s*\d+\s*\}\}/g, "—");

  return rendered.trim();
}

function buildFallback(input = {}) {
  const params = extractParams(input);
  const name = pick(input.name, input.templateName, input.template_name, input.selectedTemplate?.name, input.template?.name);

  if (params.length) return params.join(" ").trim();
  if (name) return `Template ${name} enviado ao cliente.`;

  return "Template enviado ao cliente.";
}

function buildTemplateDisplayText(input = {}) {
  const params = extractParams(input);
  const { header, body, footer } = extractTemplateTexts(input);

  const parts = [];

  if (header) parts.push(applyParams(header, params));
  if (body) parts.push(applyParams(body, params));
  if (footer) parts.push(applyParams(footer, params));

  const text = parts
    .map(clean)
    .filter(Boolean)
    .join("\n\n")
    .trim();

  if (text) {
    return {
      ok: true,
      marker: MARKER,
      source: "template_body",
      text,
      params
    };
  }

  return {
    ok: false,
    marker: MARKER,
    source: "fallback",
    text: buildFallback(input),
    params
  };
}

function buildTemplateTechnicalPreview(input = {}) {
  const name = pick(input.name, input.templateName, input.template_name, input.selectedTemplate?.name, input.template?.name, "template");
  const language = pick(input.language, input.lang, input.templateLanguage, input.template_language, input.selectedTemplate?.language, input.template?.language, "pt_BR");
  const category = pick(input.category, input.templateCategory, input.template_category, input.selectedTemplate?.category, input.template?.category, "template");
  const params = extractParams(input);
  const suffix = params.length ? ` • ${params.join(" • ")}` : "";

  return `[Template enviado] ${name} • ${language} • ${category}${suffix}`;
}

module.exports = {
  MARKER,
  buildTemplateDisplayText,
  buildTemplateTechnicalPreview,
  extractParams
};
