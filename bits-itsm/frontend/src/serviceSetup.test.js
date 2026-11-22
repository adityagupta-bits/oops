import test from 'node:test';
import assert from 'node:assert/strict';
import { eligibleServices } from './serviceSetup.js';
test('review choices follow activation and valid criticality without changing catalog records', () => {
  const service = { kind: 'SERVICE', code: 'LIBRARY_PROXY', label: 'Library Proxy', enabled: false, criticality: null };
  assert.deepEqual(eligibleServices([service]), []);
  service.criticality = 'HIGH';
  assert.deepEqual(eligibleServices([service]), []);
  service.enabled = true;
  assert.deepEqual(eligibleServices([service]), [service]);
  assert.equal(service.code, 'LIBRARY_PROXY');
  service.enabled = false;
  assert.deepEqual(eligibleServices([service]), []);
  assert.deepEqual(eligibleServices([{ ...service, criticality: 'INVALID' }]), []);
});
