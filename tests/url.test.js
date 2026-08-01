import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildExploreUrl } from '../src/url.js';

test('builds an explore URL with encoded timeframe and keywords', () => {
  const url = buildExploreUrl({
    keywords: ['link shortener', 'url shortener'],
    timeframe: 'today 12-m',
  });
  assert.equal(
    url,
    'https://trends.google.com/trends/explore?date=today%2012-m&q=link%20shortener,url%20shortener&hl=en'
  );
});

test('keywords are joined with a literal comma (the compare separator)', () => {
  const url = buildExploreUrl({ keywords: ['a', 'b', 'c'], timeframe: 'now 7-d', hl: 'en' });
  assert.match(url, /q=a,b,c/);
});

test('special characters in keywords are encoded', () => {
  const url = buildExploreUrl({ keywords: ['a/b testing', 'c++'], timeframe: 'today 12-m' });
  assert.match(url, /q=a%2Fb%20testing,c%2B%2B/);
});

test('geo is omitted when empty and included when set', () => {
  const without = buildExploreUrl({ keywords: ['x'], timeframe: 'today 12-m', geo: '' });
  assert.ok(!without.includes('geo='));

  const withGeo = buildExploreUrl({ keywords: ['x'], timeframe: 'today 12-m', geo: 'NO' });
  assert.match(withGeo, /&geo=NO$/);
});

test('hl is encoded', () => {
  const url = buildExploreUrl({ keywords: ['x'], timeframe: 'today 12-m', hl: 'nb' });
  assert.match(url, /&hl=nb/);
});
