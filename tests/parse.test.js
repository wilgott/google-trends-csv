import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseTrendsCsv, summarizeTrends, splitCsvLine, decodeTrendsCsv } from '../src/parse.js';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

test('parses header from row 3 and per-keyword weekly series', () => {
  const text = readFileSync(join(fixtures, 'sample.csv'), 'utf8');
  const { header, weeks, series } = parseTrendsCsv(text);

  assert.deepEqual(header, ['link shortener', 'url shortener', 'qr code generator']);
  assert.equal(weeks.length, 6);
  assert.equal(weeks[0], '2025-06-01 - 2025-06-07');
  assert.deepEqual(series['link shortener'], [42, 45, 44, 50, 48, 55]);
  assert.deepEqual(series['qr code generator'], [100, 97, 95, 93, 90, 88]);
});

test('maps "<1" values to 0', () => {
  const text = readFileSync(join(fixtures, 'sample.csv'), 'utf8');
  const { series } = parseTrendsCsv(text);
  assert.equal(series['url shortener'][1], 0); // was '<1' in the fixture
});

test('handles quoted header fields containing commas', () => {
  const text = readFileSync(join(fixtures, 'quoted-low-volume.csv'), 'utf8');
  const { header, series } = parseTrendsCsv(text);
  assert.deepEqual(header, ['a/b testing, tool', 'split test']);
  assert.deepEqual(series['a/b testing, tool'], [0, 0]);
  assert.deepEqual(series['split test'], [100, 98]);
});

test('parses new export format with query description row before header', () => {
  const text = readFileSync(join(fixtures, 'new-format.csv'), 'utf8');
  const { header, weeks, series } = parseTrendsCsv(text);

  assert.deepEqual(header, ['diy kitchen renovation']);
  assert.equal(weeks.length, 3);
  assert.equal(weeks[0], '2021-08-08 - 2021-08-14');
  assert.deepEqual(series['diy kitchen renovation'], [55, 52, 0]);
});

test('parses UTF-16LE encoded exports with BOM', () => {
  const text = readFileSync(join(fixtures, 'sample.csv'), 'utf8');
  const buf = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, 'utf16le')]);
  const { header, weeks, series } = parseTrendsCsv(decodeTrendsCsv(buf));

  assert.deepEqual(header, ['link shortener', 'url shortener', 'qr code generator']);
  assert.equal(weeks.length, 6);
  assert.equal(series['link shortener'][0], 42);
});

test('parses exports with UTF-8 BOM', () => {
  const text = readFileSync(join(fixtures, 'sample.csv'), 'utf8');
  const buf = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(text, 'utf8')]);
  const { weeks } = parseTrendsCsv(decodeTrendsCsv(buf));
  assert.equal(weeks.length, 6);
});

test('parses exports with CR-only line endings', () => {
  const text = readFileSync(join(fixtures, 'sample.csv'), 'utf8').replace(/\n/g, '\r');
  const { weeks } = parseTrendsCsv(text);
  assert.equal(weeks.length, 6);
});

test('splitCsvLine handles escaped quotes', () => {
  assert.deepEqual(splitCsvLine('a,"say ""hi""",c'), ['a', 'say "hi"', 'c']);
});

test('rejects files without a header row', () => {
  assert.throws(() => parseTrendsCsv('Category: All\n'), /Not a Google Trends CSV/);
});

test('summarizeTrends computes mean, last4wkMean and max', () => {
  const text = readFileSync(join(fixtures, 'sample.csv'), 'utf8');
  const stats = summarizeTrends(parseTrendsCsv(text));

  // link shortener: [42,45,44,50,48,55] -> mean 47.3, last4 (44,50,48,55) -> 49.3, max 55
  assert.deepEqual(stats['link shortener'], { mean: 47.3, last4wkMean: 49.3, max: 55 });
  assert.equal(stats['qr code generator'].max, 100);
  assert.equal(stats['url shortener'].mean, 33.3); // (38+0+40+41+39+42)/6
});
