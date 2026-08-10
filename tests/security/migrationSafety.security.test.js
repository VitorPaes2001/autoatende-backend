'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const up = fs.readFileSync(path.join(root, 'supabase/migrations/20260804000000_whatsapp_phone_number_id_global_uniqueness.sql'), 'utf8');
const down = fs.readFileSync(path.join(root, 'supabase/migrations/rollback/20260804000000_whatsapp_phone_number_id_global_uniqueness.down.sql'), 'utf8');

test('I-04 migration preflights duplicates and makes no destructive data correction', () => {
  assert.match(up, /having count\(\*\) > 1/i);
  assert.match(up, /if duplicate_groups > 0 then/i);
  assert.ok(up.indexOf('duplicate_groups > 0') < up.indexOf('create unique index'));
  assert.doesNotMatch(up, /^[\\t ]*(delete|update|truncate|merge|insert)[\\t ]/im);
});

test('I-04 migration fails closed on same-name catalog objects instead of trusting IF NOT EXISTS', () => {
  assert.doesNotMatch(up, /create unique index if not exists/i);
  assert.match(up, /join pg_index i on i\.indexrelid = c\.oid/i);
  assert.match(up, /existing_index\.indrelid is distinct from 'public\.whatsapp_accounts'::regclass/i);
  assert.match(up, /same-name index exists with incompatible definition/i);
  assert.match(up, /pg_get_expr\(i\.indexprs, i\.indrelid\)/i);
  assert.match(up, /expected_expressions constant text\[\]/i);
  assert.match(up, /expected_predicates constant text\[\]/i);
  assert.match(up, /btrim\(phone_number_id\)/i);
  assert.match(up, /existing_index\.expression <> all \(expected_expressions\)/i);
  assert.match(up, /existing_index\.predicate <> all \(expected_predicates\)/i);
  assert.match(up, /i\.indnkeyatts/i);
  assert.match(up, /i\.indnatts/i);
  assert.match(up, /i\.indkey::text as indkey/i);
  assert.match(up, /i\.indislive/i);
  assert.match(up, /i\.indimmediate/i);
  assert.match(up, /join pg_am am on am\.oid = c\.relam/i);
  assert.match(up, /pg_opclass selected_opclass/i);
  assert.match(up, /existing_index\.indnkeyatts is distinct from 1/i);
  assert.match(up, /existing_index\.indnatts is distinct from 1/i);
  assert.match(up, /existing_index\.indkey is distinct from '0'/i);
  assert.match(up, /existing_index\.access_method is distinct from 'btree'/i);
  assert.match(up, /existing_index\.opclass_default is not true/i);
  assert.match(up, /existing_index\.opclass_input_type is distinct from 'text'::regtype/i);
  assert.match(up, /existing_index\.index_collation_oid is distinct from existing_index\.phone_collation_oid/i);
  assert.match(up, /A4R1 preflight: same-name non-index relation exists/i);
});

test('I-04 rollback proves ownership and target table before drop', () => {
  assert.match(down, /i\.indrelid,/i);
  assert.match(down, /target\.indrelid is distinct from 'public\.whatsapp_accounts'::regclass/i);
  assert.match(down, /rollback refused: index target is not public\.whatsapp_accounts/i);
  assert.match(down, /rollback refused: index is not owned by A4R1/i);
  assert.match(down, /expected_expressions constant text\[\]/i);
  assert.match(down, /expected_predicates constant text\[\]/i);
  assert.match(down, /target\.expression <> all \(expected_expressions\)/i);
  assert.match(down, /target\.predicate <> all \(expected_predicates\)/i);
  assert.match(down, /i\.indnkeyatts/i);
  assert.match(down, /i\.indnatts/i);
  assert.match(down, /i\.indkey::text as indkey/i);
  assert.match(down, /i\.indisready/i);
  assert.match(down, /i\.indislive/i);
  assert.match(down, /i\.indimmediate/i);
  assert.match(down, /target\.indnkeyatts is distinct from 1/i);
  assert.match(down, /target\.indnatts is distinct from 1/i);
  assert.match(down, /target\.indkey is distinct from '0'/i);
  assert.match(down, /target\.access_method is distinct from 'btree'/i);
  assert.match(down, /target\.opclass_default is not true/i);
  assert.match(down, /target\.opclass_input_type is distinct from 'text'::regtype/i);
  assert.match(down, /target\.index_collation_oid is distinct from target\.phone_collation_oid/i);
  assert.match(down, /owned index definition drifted/i);
});
