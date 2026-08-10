'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const appSource = fs.readFileSync(path.join(root, 'src/app.js'), 'utf8');
const mount = "app.use('/api/admin/provisioning', require('./routes/adminProvisioningQueue.routes'));";
const errorMarker = '// 🔴 ERROR HANDLER GLOBAL (manual, compatível com Express 4/5)';

test('internal provisioning route is registered exactly once before terminal sanitized error handler', () => {
  const mountCount = appSource.split(mount).length - 1;
  assert.equal(mountCount, 1);

  const mountIndex = appSource.indexOf(mount);
  const errorIndex = appSource.indexOf(errorMarker);
  assert.ok(mountIndex >= 0);
  assert.ok(errorIndex >= 0);
  assert.ok(mountIndex < errorIndex);

  const errorTail = appSource.slice(errorIndex);
  assert.match(errorTail, /safeHttpErrorResponse\(err, statusCode\)/);
  assert.doesNotMatch(errorTail, /app\.use\(['"]\/api\/admin\/provisioning['"]/);
});
