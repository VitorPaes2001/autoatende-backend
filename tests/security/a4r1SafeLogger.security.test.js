'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

test('safeLogger never throws and never emits a supplied access token', () => {
  const original = console.error;
  const captured = [];
  console.error = (...args) => captured.push(args);
  try {
    const logger = require('../../src/security/safeLogger');
    const secret = 'EAA' + 'q'.repeat(70);
    assert.doesNotThrow(() => logger.error('failed?access_token=' + secret, { api_key: secret }));
    assert.equal(JSON.stringify(captured).includes(secret), false);
  } finally {
    console.error = original;
  }
});

test('safeLogger strips Error, Axios-like, nested-cause and customer-content fields', () => {
  const original = console.error;
  const captured = [];
  console.error = (...args) => captured.push(args);
  try {
    const logger = require('../../src/security/safeLogger');
    const opaque = 'opaque-a4r2-logger-token';
    const error = new Error('customer said hello ' + opaque + ' person@example.test +5511999912345');
    error.config = { url: 'https://host.test/x?token=' + opaque };
    error.response = { status: 401, data: { message: 'customer said hello ' + opaque } };
    error.cause = new Error('https://host.test/y?access%5Ftoken=' + opaque);
    logger.error('provider_failure', { error, message: 'customer said hello ' + opaque });
    const serialized = JSON.stringify(captured);
    assert.equal(serialized.includes(opaque), false);
    assert.equal(serialized.includes('person@example.test'), false);
    assert.equal(serialized.includes('customer said hello'), false);
  } finally {
    console.error = original;
  }
});
