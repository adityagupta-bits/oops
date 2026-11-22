import test from 'node:test';
import assert from 'node:assert/strict';
import { slaCountdown } from './slaCountdown.js';
const deadline = '2026-11-22T10:00:00Z';
test('counts remaining and overdue duration across time zones', () => {
  assert.equal(slaCountdown({resolutionDeadline:deadline,status:'IN_PROGRESS'},Date.parse('2026-11-22T15:00:00+05:30')).text,'00:30:00 remaining');
  assert.equal(slaCountdown({resolutionDeadline:deadline,status:'IN_PROGRESS'},Date.parse('2026-11-22T10:12:45Z')).text,'OVERDUE by 00:12:45');
});
test('freezes the outcome at resolution and handles missing data', () => {
  const i={resolutionDeadline:deadline,status:'CLOSED',resolvedAt:'2026-11-22T09:55:00Z'};
  assert.deepEqual(slaCountdown(i,0),slaCountdown(i,Date.now()));
  assert.equal(slaCountdown(i).active,false);
  assert.equal(slaCountdown({}).text,'SLA pending');
  assert.equal(slaCountdown({...i,resolvedAt:null}).text,'Final SLA outcome unavailable');
});
