import test from 'node:test';
import assert from 'node:assert/strict';
import { urgencyHint } from './urgencyHint.js';
test('requires contextual time pressure and cites actual evidence', () => {
 assert.equal(urgencyHint('Portal issue', 'Assignment submission deadline today. Cannot submit coursework.').value, 'HIGH');
 assert.match(urgencyHint('Exam tomorrow', '').reason, /exam tomorrow/);
 assert.equal(urgencyHint('Portal issue', 'Cannot submit coursework right now.').value, 'HIGH');
 assert.equal(urgencyHint('Exam resources', 'Please help with portal access.'), null);
});
test('respects explicit negation and no signal', () => {
 assert.equal(urgencyHint('Exam tomorrow', 'Not urgent.'), null);
 assert.equal(urgencyHint('No exam today', 'Routine library problem.'), null);
 assert.equal(urgencyHint('Printer', 'Paper tray needs replacement.'), null);
});
