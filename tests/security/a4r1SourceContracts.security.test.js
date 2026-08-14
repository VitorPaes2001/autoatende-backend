'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('Meta credential transport uses Authorization header and generic responses', () => {
  const source = read('src/controllers/whatsapp.controller.js');
  assert.match(source, /headers: \{ Authorization: 'Bearer ' \+ accessToken \}/);
  assert.doesNotMatch(source, /searchParams\.set\('access_token'/);
  assert.doesNotMatch(source, /details: error(?:\?\.)?\.message/);
  assert.doesNotMatch(source, /Timeout após.*\$\{url\}/);
});

test('contact identity consumes only branded authoritative scope', () => {
  const source = read('src/services/contactIdentity.service.js');
  assert.match(source, /requireAuthoritativeCompanyScope\(options\.authoritativeCompanyScope\)/);
  assert.doesNotMatch(source, /resolveCompanyIdFromPhoneNumberId|waba_id|maybeSingle/);
});

test('billing outward errors are generic and null-detail', () => {
  const source = read('src/routes/customerBillingPlanStatusTenantAware.routes.js');
  assert.doesNotMatch(source, /details = error\?\.message|details: error\.details|message: error\.message/);
  assert.match(source, /safeLogger\.error/);
});

test('migration and rollback enforce definition plus ownership', () => {
  const up = read('supabase/migrations/20260804000000_whatsapp_phone_number_id_global_uniqueness.sql');
  const down = read('supabase/migrations/rollback/20260804000000_whatsapp_phone_number_id_global_uniqueness.down.sql');
  assert.doesNotMatch(up, /create unique index if not exists/i);
  assert.match(up, /noncanonical_rows/);
  assert.match(up, /same-name index exists with incompatible definition/);
  assert.match(up, /autoatende:a4r1:owns:/);
  assert.match(down, /target\.indrelid is distinct from 'public\.whatsapp_accounts'::regclass/);
  assert.match(down, /rollback refused: index target is not public\.whatsapp_accounts/);
  assert.match(down, /rollback refused: index is not owned by A4R1/);
});

test('WhatsApp handler uses central safeLogger and has no direct raw-error log path', () => {
  const source = read('src/services/whatsappMessageHandler.js');
  assert.match(source, /require\(['"]\.\.\/security\/safeLogger['"]\)/);
  assert.doesNotMatch(source, /console\.(log|info|warn|error)\s*\(/);
  assert.doesNotMatch(source, /message:\s*(?:err|error|exception|cause)\??\.message/);
  assert.doesNotMatch(source, /String\((?:err|error|exception|cause)\)/);
  assert.match(source, /safeErrorFields\(err\)/);
});

test('global error handler sanitizes outward message and details', () => {
  const source = read('src/app.js');
  assert.match(source, /safeHttpErrorResponse\(err, statusCode\)/);
  assert.doesNotMatch(source, /statusCode === 500 \? ["']Internal server error["'] : err\.message/);
  assert.doesNotMatch(source, /\.\.\.\(err\.details && \{ details: err\.details \}\)/);
});
