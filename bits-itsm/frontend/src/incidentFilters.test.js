import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterAndSortIncidents, optionsForStatuses, priorityValue } from './incidentFilters.js';

const incidents = [
  { id: 12, title: 'Wi-Fi trouble', description: 'Drops during evening lectures', status: 'IN_PROGRESS', priority: null, createdAt: '2026-11-20T10:00:00Z' },
  { id: 13, title: 'Portal sign-in', description: 'Wi-Fi login page loops', status: 'CLOSED', priority: 'P2', createdAt: '2026-11-18T10:00:00Z' },
  { id: 14, title: 'Projector issue', description: 'No image in room 2', status: 'NEW', priority: 'P4', createdAt: '2026-11-21T10:00:00Z' },
];
const filters = overrides => ({ search: '', status: '', priority: '', category: '', service: '', fromDate: '', sort: 'NEWEST', ...overrides });

test('search matches incident ID, title, and description without case sensitivity', () => {
  assert.deepEqual(filterAndSortIncidents(incidents, filters({ search: '12' })).map(item => item.id), [12]);
  assert.deepEqual(filterAndSortIncidents(incidents, filters({ search: 'PORTAL' })).map(item => item.id), [13]);
  assert.deepEqual(filterAndSortIncidents(incidents, filters({ search: 'evening lectures' })).map(item => item.id), [12]);
});

test('filters by actual status and treats null priority as awaiting classification', () => {
  assert.deepEqual(filterAndSortIncidents(incidents, filters({ status: 'CLOSED' })).map(item => item.id), [13]);
  assert.deepEqual(filterAndSortIncidents(incidents, filters({ priority: 'PENDING' })).map(item => item.id), [12]);
  assert.equal(priorityValue(null), 'PENDING');
  assert.ok(optionsForStatuses(incidents).some(([value, label]) => value === 'CLOSED' && label === 'Closed'));
});

test('sorts newest or oldest and composes sorting with filters', () => {
  assert.deepEqual(filterAndSortIncidents(incidents, filters()).map(item => item.id), [14, 12, 13]);
  assert.deepEqual(filterAndSortIncidents(incidents, filters({ sort: 'OLDEST' })).map(item => item.id), [13, 12, 14]);
  assert.deepEqual(filterAndSortIncidents(incidents, filters({ priority: 'P2', sort: 'OLDEST' })).map(item => item.id), [13]);
});
