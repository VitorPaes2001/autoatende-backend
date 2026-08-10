'use strict';

const { sanitizeTechnicalMessage, sanitizeLogArgument } = require('./telemetrySanitizer');

function emit(level, message, args) {
  try {
    const sink = typeof console?.[level] === 'function' ? console[level] : console.log;
    const safeMessage = sanitizeTechnicalMessage(message);
    const safeArgs = Array.from(args || []).slice(0, 8).map(sanitizeLogArgument);
    Reflect.apply(sink, console, [safeMessage, ...safeArgs]);
  } catch (_) {
    // Logging must never alter application control flow.
  }
}

module.exports = Object.freeze({
  log(message, ...args) { emit('log', message, args); },
  info(message, ...args) { emit('info', message, args); },
  warn(message, ...args) { emit('warn', message, args); },
  error(message, ...args) { emit('error', message, args); },
});
