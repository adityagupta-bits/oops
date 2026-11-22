import test from 'node:test';
import assert from 'node:assert/strict';
import { dispositionPayload, resolvedSuccessfully } from './incidentDisposition.js';
import { slaCountdown } from './slaCountdown.js';
test('closure requires a real reason and duplicate target', () => {
  assert.throws(() => dispositionPayload('INVALID', 'abc'));
  assert.throws(() => dispositionPayload('DUPLICATE', 'Same failure', ''));
  assert.deepEqual(dispositionPayload('DUPLICATE', ' Same failure ', '42'), {kind:'DUPLICATE', reason:'Same failure', duplicateOf:42});
  assert.equal(dispositionPayload('INVALID', 'Invalid report', '42').duplicateOf, null);
});
test('unresolved closures are not counted or displayed as resolved', () => {
  const closed = {status:'CLOSED', closedAt:'2026-11-22T10:00:00Z'};
  assert.equal(resolvedSuccessfully(closed), false);
  assert.equal(slaCountdown(closed).text, 'Closed without resolution');
  assert.equal(resolvedSuccessfully({...closed, resolvedAt:'2026-11-22T09:00:00Z'}), true);
});
