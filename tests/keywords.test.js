import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupKeywords, groupSlug, MAX_GROUP_SIZE } from '../src/keywords.js';

test('flat list of <=5 becomes a single group', () => {
  assert.deepEqual(groupKeywords(['a', 'b']), [['a', 'b']]);
});

test('flat list of 7 chunks into groups of 5 + 2', () => {
  const groups = groupKeywords(['a', 'b', 'c', 'd', 'e', 'f', 'g']);
  assert.deepEqual(groups, [['a', 'b', 'c', 'd', 'e'], ['f', 'g']]);
});

test('nested groups are used as-is', () => {
  const input = [['a', 'b'], ['c']];
  assert.deepEqual(groupKeywords(input), input);
});

test('rejects a group larger than MAX_GROUP_SIZE', () => {
  assert.throws(() => groupKeywords([['a', 'b', 'c', 'd', 'e', 'f']]), /exceeds 5/);
  assert.equal(MAX_GROUP_SIZE, 5);
});

test('rejects empty, mixed, or blank input', () => {
  assert.throws(() => groupKeywords([]), /non-empty/);
  assert.throws(() => groupKeywords(['a', ['b']]), /no mixing/);
  assert.throws(() => groupKeywords(['  ']), /invalid keyword/);
});

test('trims keywords', () => {
  assert.deepEqual(groupKeywords(['  link shortener ']), [['link shortener']]);
});

test('groupSlug derives a filesystem-safe name from the first keyword', () => {
  assert.equal(groupSlug(['a/b testing']), 'a_b_testing');
  assert.equal(groupSlug(['Link Shortener!']), 'link_shortener');
});
