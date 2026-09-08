import assert from 'node:assert/strict';
import test from 'node:test';
import {
  autoTagKnownHandTraps,
  countRoleCopies,
  getRoleDefinitions,
  normalizeRoleAssignments,
  normalizeCustomRoles,
  removeRole,
  toggleRoleForCards,
} from '../roles.js';

test('known public hand traps receive an initial automatic tag', () => {
  const result = autoTagKnownHandTraps([
    '14558127',
    '14558127',
    '89631139',
    '10045474',
    '42141493',
  ]);
  assert.deepEqual(result.taggedIds, [
    '14558127',
    '10045474',
    '42141493',
  ]);
  assert.deepEqual(result.assignments['14558127'], ['handtrap']);
  assert.equal(result.assignments['89631139'], undefined);
});

test('batch role toggles add or remove a role from every selected card', () => {
  const added = toggleRoleForCards(
    { 1: ['starter'], 2: [] },
    ['1', '2'],
    'extender',
  );
  assert.deepEqual(added, {
    1: ['starter', 'extender'],
    2: ['extender'],
  });
  assert.deepEqual(
    toggleRoleForCards(added, ['1', '2'], 'extender'),
    { 1: ['starter'] },
  );
});

test('one card can retain multiple distinct role assignments', () => {
  assert.deepEqual(normalizeRoleAssignments({
    1: ['starter', 'extender', 'starter', 'handtrap'],
  }), {
    1: ['starter', 'extender', 'handtrap'],
  });
});

test('role copy counts include duplicate cards in the main deck', () => {
  const assignments = normalizeRoleAssignments({
    1: ['starter'],
    2: ['starter', 'brick'],
  });
  assert.equal(countRoleCopies(['1', '1', '2', '3'], assignments, 'starter'), 3);
  assert.equal(countRoleCopies(['1', '1', '2', '3'], assignments, 'brick'), 1);
});

test('custom roles survive normalization, batch toggles and removal', () => {
  const customRoles = normalizeCustomRoles([
    { id: 'custom:one-card', label: '一卡动', color: '#123456' },
  ]);
  const definitions = getRoleDefinitions(customRoles);
  const assignments = toggleRoleForCards(
    {},
    ['1', '2'],
    'custom:one-card',
    definitions,
  );
  assert.deepEqual(assignments, {
    1: ['custom:one-card'],
    2: ['custom:one-card'],
  });
  assert.equal(
    countRoleCopies(
      ['1', '1', '2'],
      assignments,
      'custom:one-card',
      definitions,
    ),
    3,
  );
  assert.deepEqual(
    removeRole(assignments, 'custom:one-card', definitions),
    {},
  );
});
