import test from 'node:test';
import assert from 'node:assert/strict';
import { DESIGN_BUCKET, DESIGN_MAX_BYTES, designObjectPath } from './design-storage.js';

const userId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const uploadId = '11111111-2222-4333-8444-555555555555';

test('private upload path stays inside the authenticated user and print side', () => {
  const file = { type: 'image/png', size: 1024, name: '../secret.png' };
  assert.equal(designObjectPath(userId, 'front', file, uploadId), `${userId}/front/${uploadId}.png`);
  assert.equal(DESIGN_BUCKET, 'customer-designs');
});

test('private uploads reject unsupported files and invalid folders', () => {
  const file = { type: 'image/jpeg', size: 1024 };
  assert.throws(() => designObjectPath('../other-user', 'front', file, uploadId));
  assert.throws(() => designObjectPath(userId, '../back', file, uploadId));
  assert.throws(() => designObjectPath(userId, 'back', { type: 'image/svg+xml', size: 1024 }, uploadId));
  assert.throws(() => designObjectPath(userId, 'back', { type: 'image/png', size: DESIGN_MAX_BYTES + 1 }, uploadId));
});
