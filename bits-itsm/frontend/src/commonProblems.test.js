import { test } from 'node:test';
import assert from 'node:assert/strict';
import { commonProblemCategories, allCommonProblems, standardProblemTitles } from './commonProblems.js';

test('common problem categories are defined accurately without duplicates', () => {
  const expectedCategories = [
    'Payments',
    'Academic Systems',
    'Network',
    'Accounts and Email',
    'Software',
  ];

  assert.deepEqual(commonProblemCategories.map(c => c.category), expectedCategories);

  // Check payments
  const payments = commonProblemCategories.find(c => c.category === 'Payments');
  assert.deepEqual(payments.problems, [
    'SWD Pay not working',
    'SWD Pay transaction failed',
    'Payment successful but status not updated',
  ]);

  // Check Academic Systems
  const academic = commonProblemCategories.find(c => c.category === 'Academic Systems');
  assert.deepEqual(academic.problems, [
    'SLMS not working',
    'LMS not working',
    'ERP not working',
    'Course materials not loading',
  ]);

  // Check Network
  const network = commonProblemCategories.find(c => c.category === 'Network');
  assert.deepEqual(network.problems, [
    'F Block Wi-Fi not working',
    'Hostel LAN/Wi-Fi not working',
    'Campus Wi-Fi not connecting',
    'Wi-Fi connected but no internet',
    'Internet frequently disconnecting',
    'Ethernet/LAN port not working',
  ]);

  // Check Accounts and Email
  const accounts = commonProblemCategories.find(c => c.category === 'Accounts and Email');
  assert.deepEqual(accounts.problems, [
    'BITS institutional email not working',
    'BITS account login failed',
    'Password reset or account locked',
  ]);

  // Check Software
  const software = commonProblemCategories.find(c => c.category === 'Software');
  assert.deepEqual(software.problems, [
    'College software not opening',
    'Other IT problem',
  ]);

  // Ensure no duplicate problem titles across the entire list
  const uniqueProblems = new Set(allCommonProblems);
  assert.equal(uniqueProblems.size, allCommonProblems.length);
  assert.equal(allCommonProblems.length, 18);

  // standardProblemTitles excludes "Other IT problem"
  assert.equal(standardProblemTitles.includes('Other IT problem'), false);
  assert.equal(standardProblemTitles.length, 17);
});

test('template selection transition preserves description and handles custom issues', () => {
  // Simulating state transitions
  let form = { title: '', description: 'My initial description about router offline' };
  let selectedProblem = '';

  function selectProblem(value) {
    selectedProblem = value;
    if (value === 'Other IT problem') {
      form = {
        ...form,
        title: standardProblemTitles.includes(form.title) ? '' : form.title,
      };
    } else if (value) {
      form = { ...form, title: value };
    }
  }

  // 1. Select a common issue
  selectProblem('F Block Wi-Fi not working');
  assert.equal(form.title, 'F Block Wi-Fi not working');
  assert.equal(form.description, 'My initial description about router offline');

  // 2. User edits title
  form.title = 'F Block Wi-Fi not working in room 302';
  assert.equal(form.title, 'F Block Wi-Fi not working in room 302');
  assert.equal(form.description, 'My initial description about router offline');

  // 3. User switches to another template
  selectProblem('Ethernet/LAN port not working');
  assert.equal(form.title, 'Ethernet/LAN port not working');
  assert.equal(form.description, 'My initial description about router offline');

  // 4. User selects "Other IT problem"
  selectProblem('Other IT problem');
  assert.equal(form.title, ''); // cleared standard title for custom entry
  assert.equal(form.description, 'My initial description about router offline'); // preserved description

  // 5. User enters a custom title
  form.title = 'Custom library scanner issue';
  assert.equal(form.title, 'Custom library scanner issue');

  // 6. User re-selects "Other IT problem" while already having a custom title
  selectProblem('Other IT problem');
  assert.equal(form.title, 'Custom library scanner issue'); // custom title is preserved
  assert.equal(form.description, 'My initial description about router offline');
});

