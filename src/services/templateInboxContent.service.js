'use strict';

/**
 * __AUTOATENDE_V4_R13C_R5B_R1_RENDER_TEMPLATE_CONTENT_BEFORE_INBOX_PERSIST_FIXED_PARSER__
 *
 * Garante que novos templates enviados sejam salvos no Inbox como mensagem final,
 * não como BODY:/HEADER:/FOOTER: técnico nem com placeholders {{1}}.
 */

const MARKER = '__AUTOATENDE_V4_R13C_R5B_R1_RENDER_TEMPLATE_CONTENT_BEFORE_INBOX_PERSIST_FIXED_PARSER__';

function toText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeComponentType(value) {
  const type = String(value || '').trim().toLowerCase();

  if (type === 'header') return 'header';
  if (type === 'body') return 'body';
  if (type === 'footer') return 'footer';

  return type;
}

function extractParamValuesByComponent(components = []) {
  const values = {
    header: [],
    body: [],
    footer: [],
    flat: [],
  };

  for (const component of asArray(components)) {
    const type = normalizeComponentType(component?.type);
    const params = asArray(component?.parameters);

    for (const param of params) {
      const value = toText(
        param?.text ??
        param?.value ??
        param?.payload ??
        param?.parameter ??
        ''
      );

      if (!value) continue;

      values.flat.push(value);

      if (type && values[type]) {
        values[type].push(value);
      }
    }
  }

  return values;
}

function replacePlaceholders(text, params = []) {
  const raw = toText(text);

  if (!raw) return '';

  return raw.replace(/{{\s*(\d+)\s*}}/g, (match, indexText) => {
    const index = Number(indexText);

    if (!Number.isFinite(index) || index <= 0) return match;

    const value = toText(params[index - 1]);

    return value || match;
  }).trim();
}

function isTechnicalLine(line) {
  const value = toText(line);

  if (!value) return true;

  if (/^(nome do template|template name|idioma|language|categoria|category|template aprovado|mensagem aprovada)\s*:?\s*$/i.test(value)) {
    return true;
  }

  if (/^(pt_br|pt-br|en_us|en-us)$/i.test(value)) return true;
  if (/^(utility|utility_auth|marketing|authentication|auth)$/i.test(value)) return true;

  return false;
}

function parseTechnicalPreview(rawText) {
  const raw = toText(rawText);

  const result = {
    foundSections: false,
    header: [],
    body: [],
    footer: [],
    plain: [],
  };

  if (!raw) return result;

  let current = null;

  for (const originalLine of raw.split(/\r?\n/)) {
    const line = toText(originalLine);

    if (!line) continue;

    const labelMatch = line.match(/^(HEADER|BODY|FOOTER)\s*:\s*(.*)$/i);

    if (labelMatch) {
      const type = normalizeComponentType(labelMatch[1]);
      const rest = toText(labelMatch[2]);

      current = type;
      result.foundSections = true;

      if (rest && result[type]) {
        result[type].push(rest);
      }

      continue;
    }

    if (isTechnicalLine(line)) {
      current = null;
      continue;
    }

    if (current && result[current]) {
      result[current].push(line);
    } else {
      result.plain.push(
        line
          .replace(/^HEADER\s*:\s*/i, '')
          .replace(/^BODY\s*:\s*/i, '')
          .replace(/^FOOTER\s*:\s*/i, '')
          .trim()
      );
    }
  }

  return result;
}

function renderParsedPreview(parsed, valuesByComponent) {
  const sections = [];

  if (parsed.foundSections) {
    const headerText = replacePlaceholders(parsed.header.join('\n'), valuesByComponent.header.length ? valuesByComponent.header : valuesByComponent.flat);
    const bodyText = replacePlaceholders(parsed.body.join('\n'), valuesByComponent.body.length ? valuesByComponent.body : valuesByComponent.flat);
    const footerText = replacePlaceholders(parsed.footer.join('\n'), valuesByComponent.footer.length ? valuesByComponent.footer : valuesByComponent.flat);

    if (headerText) sections.push(headerText);
    if (bodyText) sections.push(bodyText);
    if (footerText) sections.push(footerText);

    return sections.join('\n\n').trim();
  }

  const plain = parsed.plain.filter(Boolean).join('\n\n').trim();

  return replacePlaceholders(
    plain,
    valuesByComponent.body.length ? valuesByComponent.body : valuesByComponent.flat
  );
}

function getComponentTextFromTemplateComponents(components = [], wantedType) {
  const wanted = normalizeComponentType(wantedType);

  for (const component of asArray(components)) {
    const type = normalizeComponentType(component?.type);

    if (type !== wanted) continue;

    const text = toText(
      component?.text ??
      component?.body ??
      component?.content ??
      ''
    );

    if (text) return text;
  }

  return '';
}

function normalizeTemplateComponents(value) {
  if (Array.isArray(value)) return value;

  if (value && typeof value === 'object') {
    if (Array.isArray(value.components)) return value.components;
    if (Array.isArray(value.template?.components)) return value.template.components;
    if (Array.isArray(value.selectedTemplate?.components)) return value.selectedTemplate.components;
  }

  return [];
}

function buildCandidateFromTemplateComponents(input = {}) {
  const resolved = input.resolvedTemplateDisplayInput || {};

  const components =
    normalizeTemplateComponents(resolved).length
      ? normalizeTemplateComponents(resolved)
      : normalizeTemplateComponents(input);

  const header = getComponentTextFromTemplateComponents(components, 'header');
  const body = getComponentTextFromTemplateComponents(components, 'body');
  const footer = getComponentTextFromTemplateComponents(components, 'footer');

  return [header, body, footer].filter(Boolean).join('\n\n').trim();
}

function looksUseful(text) {
  const value = toText(text);

  if (!value) return false;
  if (/^\[?\s*template enviado\s*\]?$/i.test(value)) return false;
  if (/^template enviado ao cliente\.?$/i.test(value)) return false;
  if (/^[a-z0-9_]+(\s*•\s*[\w-]+)*$/i.test(value)) return false;

  return true;
}

function buildTemplateInboxContent(input = {}) {
  const valuesByComponent = extractParamValuesByComponent(input.components);
  const candidates = [];

  const fromTemplateComponents = buildCandidateFromTemplateComponents(input);
  if (fromTemplateComponents) candidates.push(fromTemplateComponents);

  for (const value of [
    input.resolvedTemplatePreviewText,
    input.templatePreviewText,
    input.displayText,
    input.display_text,
    input.renderedText,
    input.rendered_text,
    input.body,
    input.body_text,
    input.content,
    input.message,
    input.resolvedTemplateDisplayInput?.displayText,
    input.resolvedTemplateDisplayInput?.display_text,
    input.resolvedTemplateDisplayInput?.text,
    input.resolvedTemplateDisplayInput?.body,
    input.resolvedTemplateDisplayInput?.body_text,
    input.resolvedTemplateDisplayInput?.content,
    input.resolvedTemplateDisplayInput?.message,
  ]) {
    const text = toText(value);
    if (text) candidates.push(text);
  }

  for (const candidate of candidates) {
    const parsed = parseTechnicalPreview(candidate);
    const rendered = renderParsedPreview(parsed, valuesByComponent);

    if (looksUseful(rendered)) {
      return rendered.slice(0, 3000);
    }
  }

  const fallbackParams = valuesByComponent.flat.filter(Boolean).join(' | ');

  if (fallbackParams) {
    return fallbackParams.slice(0, 3000);
  }

  const templateName = toText(input.templateName || input.name || 'template');

  return `Template enviado ao cliente: ${templateName}`.slice(0, 3000);
}

module.exports = {
  MARKER,
  buildTemplateInboxContent,
  extractParamValuesByComponent,
  replacePlaceholders,
  parseTechnicalPreview,
  renderParsedPreview,
};
