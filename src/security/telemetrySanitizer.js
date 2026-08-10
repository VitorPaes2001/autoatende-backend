'use strict';

const crypto = require('crypto');

const REDACTED = '[REDACTED]';
const ACCESSOR_REDACTED = '[ACCESSOR_REDACTED]';
const LIMIT_REACHED = '[SANITIZATION_LIMIT]';
const NON_PRIMITIVE = '[NON_PRIMITIVE_VALUE]';
const SENSITIVE_KEY = /(authorization|cookie|set-cookie|access[-_]?token|token|secret|password|signature|api[-_]?key|body|payload|content|message|text|email|address|name|profile|metadata|raw|data)/i;
const SAFE_HEADERS = new Set(['accept', 'content-length', 'content-type', 'user-agent', 'x-request-id']);
const SAFE_TAGS = new Set(['method', 'route', 'company_ref', 'error_code', 'status_code']);
const SAFE_PUBLIC_DETAIL_KEYS = new Set([
  'code',
  'reason',
  'status',
  'template_required',
  'retry_after',
  'retry_after_seconds',
  'hours_since_last_inbound',
  'window_expires_at',
  'field',
]);
const DEFAULT_LIMITS = Object.freeze({ maxDepth: 5, maxNodes: 256, maxItems: 30, maxBytes: 8192 });
const SENSITIVE_PARAMETER_NAME = '(?:access(?:[_-]|%5f)?token|accesstoken|token|api(?:[_-]|%5f)?key|authorization|bearer|client(?:[_-]|%5f)?secret|app(?:[_-]|%5f)?secret|whatsapp(?:[ _-]|%5f)?token|cookie|set(?:[_-]|%5f)?cookie|password|signature)';
const SENSITIVE_QUERY_PAIR = new RegExp('([?&;]' + SENSITIVE_PARAMETER_NAME + '(?:=|%3d))[^&#\\s,;]*', 'gi');
const SENSITIVE_ASSIGNMENT = new RegExp('\\b(' + SENSITIVE_PARAMETER_NAME + ')\\s*(?:=|:|%3d)\\s*([^\\s,;&]+)', 'gi');
const URL_WITH_QUERY = /((?:https?|wss?):\/\/[^\s?#]+|\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]+)\?[^\s'"<>)]*/gi;

function primitiveText(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value);
  if (typeof value === 'symbol') return 'Symbol(' + (value.description || '') + ')';
  return NON_PRIMITIVE;
}

function safeRead(object, key) {
  try {
    if (object == null || (typeof object !== 'object' && typeof object !== 'function')) return undefined;
    const descriptor = Object.getOwnPropertyDescriptor(object, key);
    if (!descriptor) return undefined;
    if (typeof descriptor.get === 'function' || typeof descriptor.set === 'function') return ACCESSOR_REDACTED;
    return descriptor.value;
  } catch (_) {
    return '[UNREADABLE]';
  }
}

function ownKeys(object) {
  try { return Reflect.ownKeys(object); } catch (_) { return []; }
}

function pseudonymizeIdentifier(value) {
  const text = primitiveText(value).trim();
  if (!text || text === NON_PRIMITIVE) return null;
  return crypto.createHash('sha256').update('autoatende-telemetry-v1:' + text).digest('hex').slice(0, 16);
}

function minimalPhoneSuffix(value) {
  const text = primitiveText(value);
  if (text === NON_PRIMITIVE) return null;
  const digits = text.replace(/\D/g, '');
  return digits ? digits.slice(-4) : null;
}

function sanitizeTechnicalMessage(value) {
  let text = primitiveText(value);
  if (text === NON_PRIMITIVE) return NON_PRIMITIVE;
  text = text.slice(0, 1024);
  // URLs are retained only up to the path. The complete query string is removed.
  text = text.replace(URL_WITH_QUERY, '$1');
  text = text.replace(/Bearer\s+[^\s,;]+/gi, 'Bearer [REDACTED]');
  text = text.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[JWT_REDACTED]');
  text = text.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[EMAIL_REDACTED]');
  text = text.replace(/\+?\d[\d\s().-]{7,}\d/g, '[PHONE_REDACTED]');
  text = text.replace(/\b(?:EAA|EAAG)[A-Za-z0-9_-]{8,}\b/g, '[TOKEN_REDACTED]');
  text = text.replace(SENSITIVE_QUERY_PAIR, '$1[REDACTED]');
  text = text.replace(SENSITIVE_ASSIGNMENT, '$1=[REDACTED]');
  return text.slice(0, 512);
}

function makeState(limits = {}) {
  return {
    depth: 0,
    budget: { nodes: 0, bytes: 0 },
    seen: new WeakSet(),
    limits: { ...DEFAULT_LIMITS, ...limits },
  };
}

function charge(state, value) {
  const text = primitiveText(value);
  state.budget.nodes += 1;
  state.budget.bytes += text === NON_PRIMITIVE ? 16 : text.length;
  return (
    state.budget.nodes <= state.limits.maxNodes &&
    state.budget.bytes <= state.limits.maxBytes
  );
}

function childState(state) {
  return {
    depth: state.depth + 1,
    budget: state.budget,
    seen: state.seen,
    limits: state.limits,
  };
}

function sanitizeHeaders(headers) {
  const out = {};
  if (!headers || (typeof headers !== 'object' && typeof headers !== 'function')) return out;
  for (const key of ownKeys(headers).slice(0, DEFAULT_LIMITS.maxItems)) {
    if (typeof key === 'string' && SAFE_HEADERS.has(key.toLowerCase())) {
      out[key.toLowerCase()] = sanitizeTechnicalMessage(safeRead(headers, key));
    }
  }
  return out;
}

function safeStatus(value) {
  return typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string'
    ? sanitizeUnknown(value)
    : null;
}

function sanitizeTransport(value) {
  if (!value || typeof value !== 'object') return undefined;
  const out = {};
  const method = safeRead(value, 'method');
  const url = safeRead(value, 'url') ?? safeRead(value, 'path') ?? safeRead(value, 'originalUrl');
  const status = safeRead(value, 'status');
  const statusText = safeRead(value, 'statusText');
  if (method != null) out.method = sanitizeTechnicalMessage(method);
  if (url != null) out.url = sanitizeTechnicalMessage(url);
  if (status != null) out.status = safeStatus(status);
  if (statusText != null) out.status_text = sanitizeTechnicalMessage(statusText);
  const headers = safeRead(value, 'headers');
  if (headers && typeof headers === 'object') out.headers = sanitizeHeaders(headers);
  if (safeRead(value, 'data') != null || safeRead(value, 'body') != null) out.body = REDACTED;
  return Object.keys(out).length ? out : undefined;
}

function sanitizeError(error, state) {
  const out = { name: 'ERROR', message: REDACTED };
  const code = safeRead(error, 'code');
  const status = safeRead(error, 'statusCode') ?? safeRead(error, 'status');
  if (code != null) out.code = sanitizeTechnicalMessage(code);
  if (status != null) out.status = safeStatus(status);
  for (const key of ['config', 'request', 'response']) {
    const transport = sanitizeTransport(safeRead(error, key));
    if (transport) out[key] = transport;
  }
  const cause = safeRead(error, 'cause');
  if (cause != null && cause !== ACCESSOR_REDACTED) out.cause = sanitizeUnknown(cause, childState(state));
  return out;
}

function safeMapKey(key) {
  const text = primitiveText(key);
  return text === NON_PRIMITIVE ? '[NON_PRIMITIVE_KEY]' : sanitizeTechnicalMessage(text);
}

function sanitizeUnknown(value, state = makeState()) {
  try {
    if (!charge(state, value)) return LIMIT_REACHED;
    if (value == null || typeof value === 'boolean' || typeof value === 'number') return value;
    if (typeof value === 'string') return sanitizeTechnicalMessage(value);
    if (typeof value === 'bigint' || typeof value === 'symbol' || typeof value === 'function') return primitiveText(value);
    if (state.depth >= state.limits.maxDepth) return '[MAX_DEPTH]';
    if (state.seen.has(value)) return '[CIRCULAR]';
    state.seen.add(value);
    try {
      if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) return '[BUFFER_REDACTED]';
      if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) return '[BINARY_REDACTED]';
    } catch (_) {
      return '[UNREADABLE]';
    }
    if (value instanceof Date) {
      try {
        const timestamp = Date.prototype.getTime.call(value);
        return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : '[INVALID_DATE]';
      } catch (_) {
        return '[INVALID_DATE]';
      }
    }
    if (value instanceof Error) return sanitizeError(value, state);
    if (value instanceof Map) {
      const entries = [];
      let index = 0;
      try {
        for (const entry of value.entries()) {
          if (index >= state.limits.maxItems) break;
          const key = safeMapKey(entry[0]);
          entries.push([
            SENSITIVE_KEY.test(key) ? REDACTED : key,
            sanitizeUnknown(entry[1], childState(state)),
          ]);
          index += 1;
        }
      } catch (_) {
        entries.push(['error', '[UNREADABLE_MAP]']);
      }
      return { type: 'Map', entries };
    }
    if (value instanceof Set) {
      const values = [];
      let index = 0;
      try {
        for (const item of value.values()) {
          if (index >= state.limits.maxItems) break;
          values.push(sanitizeUnknown(item, childState(state)));
          index += 1;
        }
      } catch (_) {
        values.push('[UNREADABLE_SET]');
      }
      return { type: 'Set', values };
    }
    if (Array.isArray(value)) {
      const out = [];
      const length = safeRead(value, 'length');
      for (
        let index = 0;
        index < (typeof length === 'number' ? Math.min(length, state.limits.maxItems) : 0);
        index += 1
      ) {
        out.push(sanitizeUnknown(safeRead(value, index), childState(state)));
      }
      return out;
    }
    const out = {};
    for (const key of ownKeys(value).slice(0, state.limits.maxItems)) {
      if (typeof key !== 'string') continue;
      const safeKey = sanitizeTechnicalMessage(key);
      out[safeKey] = SENSITIVE_KEY.test(safeKey)
        ? REDACTED
        : sanitizeUnknown(safeRead(value, key), childState(state));
    }
    return out;
  } catch (_) {
    return '[SANITIZATION_FAILED]';
  }
}

function safeFrame(frame) {
  if (!frame || typeof frame !== 'object') return null;
  const filename = sanitizeTechnicalMessage(safeRead(frame, 'filename'));
  const lineno = safeRead(frame, 'lineno');
  const colno = safeRead(frame, 'colno');
  return {
    filename: filename ? filename.split('/').slice(-3).join('/') : null,
    function: sanitizeTechnicalMessage(safeRead(frame, 'function')),
    module: sanitizeTechnicalMessage(safeRead(frame, 'module')),
    lineno: typeof lineno === 'number' ? lineno : null,
    colno: typeof colno === 'number' ? colno : null,
    in_app: safeRead(frame, 'in_app') === true,
  };
}

function sanitizeSentryEvent(event) {
  try {
    const safe = {};
    for (const key of ['event_id', 'timestamp', 'level', 'platform', 'logger', 'transaction', 'release', 'environment']) {
      const value = safeRead(event || {}, key);
      if (value != null) safe[key] = sanitizeTechnicalMessage(value);
    }
    const tags = safeRead(event || {}, 'tags');
    if (tags && typeof tags === 'object') {
      safe.tags = {};
      for (const key of ownKeys(tags).slice(0, DEFAULT_LIMITS.maxItems)) {
        if (typeof key === 'string' && SAFE_TAGS.has(key)) {
          safe.tags[key] = sanitizeTechnicalMessage(safeRead(tags, key));
        }
      }
    }
    const request = safeRead(event || {}, 'request');
    if (request && typeof request === 'object') safe.request = sanitizeTransport(request) || {};
    const values = safeRead(safeRead(event || {}, 'exception') || {}, 'values');
    if (Array.isArray(values)) {
      safe.exception = {
        values: values.slice(0, 5).map((item) => {
          const frames = safeRead(safeRead(item || {}, 'stacktrace') || {}, 'frames');
          const mechanism = safeRead(item || {}, 'mechanism');
          return {
            type: sanitizeTechnicalMessage(safeRead(item || {}, 'type')),
            value: REDACTED,
            stacktrace: Array.isArray(frames)
              ? { frames: frames.slice(-20).map(safeFrame).filter(Boolean) }
              : undefined,
            mechanism: mechanism && typeof mechanism === 'object'
              ? {
                  type: sanitizeTechnicalMessage(safeRead(mechanism, 'type')),
                  handled: safeRead(mechanism, 'handled') === true,
                }
              : undefined,
          };
        }),
      };
    }
    return safe;
  } catch (_) {
    return { sanitizer_error: true };
  }
}

function sanitizeBreadcrumb(breadcrumb) {
  if (!breadcrumb || typeof breadcrumb !== 'object') return null;
  return {
    category: sanitizeTechnicalMessage(safeRead(breadcrumb, 'category')),
    type: sanitizeTechnicalMessage(safeRead(breadcrumb, 'type')),
    level: sanitizeTechnicalMessage(safeRead(breadcrumb, 'level')),
    timestamp: safeRead(breadcrumb, 'timestamp'),
  };
}

function safeErrorFields(error, extra = {}) {
  const code = safeRead(error || {}, 'code') ?? safeRead(error || {}, 'name') ?? 'UNKNOWN_ERROR';
  const status = safeRead(error || {}, 'statusCode') ?? safeRead(error || {}, 'status') ?? null;
  return sanitizeUnknown({
    error_code: sanitizeTechnicalMessage(code),
    status_code: safeStatus(status),
    error_message: REDACTED,
    ...extra,
  });
}

function safeLogFields(fields = {}) {
  const out = {};
  if (!fields || typeof fields !== 'object') return out;
  for (const key of ownKeys(fields).slice(0, DEFAULT_LIMITS.maxItems)) {
    if (typeof key !== 'string') continue;
    const value = safeRead(fields, key);
    if (/^(company_?id|tenant_?id)$/i.test(key)) {
      out.company_ref = pseudonymizeIdentifier(value);
    } else if (/^(from|to|contact|phone|phone_number|phoneNumber)$/i.test(key)) {
      out.contact_suffix = minimalPhoneSuffix(value);
    } else if (/^(method|route|reason|type|status|status_code|error_code|count|messages|statuses|duration_ms|ms|company_ref|contact_suffix|technical_detail|source|identities|matched|updated|error_message)$/i.test(key)) {
      out[key] = sanitizeUnknown(value);
    }
  }
  return out;
}

function safePublicErrorDetails(details) {
  if (!details || typeof details !== 'object') return undefined;
  const out = {};
  for (const key of ownKeys(details).slice(0, DEFAULT_LIMITS.maxItems)) {
    if (typeof key !== 'string' || !SAFE_PUBLIC_DETAIL_KEYS.has(key)) continue;
    const value = safeRead(details, key);
    if (value == null) continue;
    if (typeof value === 'boolean' || typeof value === 'number') {
      out[key] = value;
    } else if (typeof value === 'string') {
      out[key] = sanitizeTechnicalMessage(value);
    }
  }
  return Object.keys(out).length ? out : undefined;
}

function safeHttpErrorResponse(error, statusCode = 500) {
  const numericStatus = Number.isInteger(statusCode) ? statusCode : 500;
  const internal = numericStatus >= 500;
  const rawMessage = safeRead(error || {}, 'message');
  const safeMessage = internal
    ? 'Internal server error'
    : (sanitizeTechnicalMessage(rawMessage) || 'Request failed');
  const response = { error: true, message: safeMessage };
  const code = safeRead(error || {}, 'code');
  if (typeof code === 'string' && code) response.code = sanitizeTechnicalMessage(code);
  const details = safePublicErrorDetails(safeRead(error || {}, 'details'));
  if (!internal && details) response.details = details;
  return response;
}

function sanitizeLogArgument(value) {
  return typeof value === 'string' ? sanitizeTechnicalMessage(value) : sanitizeUnknown(value);
}

module.exports = {
  REDACTED,
  ACCESSOR_REDACTED,
  LIMIT_REACHED,
  DEFAULT_LIMITS,
  pseudonymizeIdentifier,
  minimalPhoneSuffix,
  sanitizeTechnicalMessage,
  sanitizeHeaders,
  sanitizeUnknown,
  sanitizeSentryEvent,
  sanitizeBreadcrumb,
  safeErrorFields,
  safeLogFields,
  safePublicErrorDetails,
  safeHttpErrorResponse,
  sanitizeLogArgument,
};
