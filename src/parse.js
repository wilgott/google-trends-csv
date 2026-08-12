/**
 * Parse a Google Trends "interest over time" CSV export.
 *
 * Classic export format:
 *   row 1: metadata (e.g. "Category: All categories")
 *   row 2: blank
 *   row 3: header (Week,<keyword1>,<keyword2>,...)
 *   row 4+: data rows; values are 0-100 integers, or '<1' for sub-1% volume.
 *
 * Real-world variations handled here:
 *   - a query description row ("kw: (range, geo)") before the header
 *   - UTF-8 / UTF-16LE / UTF-16BE encodings (see decodeTrendsCsv)
 *   - \n, \r\n and \r line endings
 *   - a UTF-8 BOM at the start of the text
 * The header row is located by its time column, not by position.
 */

/**
 * Decode a Trends CSV file buffer, handling UTF-8 (with or without BOM) and
 * UTF-16 LE/BE (with BOM). Google's export encoding varies over time.
 * @param {Buffer} buf raw file bytes
 * @returns {string} decoded CSV text
 */
export function decodeTrendsCsv(buf) {
  if (buf.length >= 2) {
    if (buf[0] === 0xff && buf[1] === 0xfe) return new TextDecoder('utf-16le').decode(buf.subarray(2));
    if (buf[0] === 0xfe && buf[1] === 0xff) return new TextDecoder('utf-16be').decode(buf.subarray(2));
    if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
      return new TextDecoder('utf-8').decode(buf.subarray(3));
    }
  }
  return new TextDecoder('utf-8').decode(buf);
}

/** Split one CSV line into fields, honoring double-quoted fields. */
export function splitCsvLine(line) {
  const fields = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(field);
      field = '';
    } else {
      field += ch;
    }
  }
  fields.push(field);
  return fields;
}

/** '<1' means "below 1%" — treat as 0. Empty also maps to 0. */
function toValue(raw) {
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed === '<1') return 0;
  const n = Number(trimmed);
  if (Number.isNaN(n)) throw new Error(`Unexpected CSV value: "${raw}"`);
  return n;
}

/** Matches the first column of a Trends time-series header row. */
const TIME_HEADER_RE = /^\s*"?(Week|Day|Month|Date|Time)"?\s*(,|$)/i;

/**
 * @param {string} text raw CSV file contents
 * @returns {{ header: string[], weeks: string[], series: Record<string, number[]> }}
 *   header: keyword column names (first column "Week"/"Day"/"Month" is dropped)
 *   weeks:  time-bucket label per data row
 *   series: keyword -> array of 0-100 values, aligned with weeks
 */
export function parseTrendsCsv(text) {
  const lines = text.replace(/^﻿/, '').split(/\r\n|\r|\n/);

  // The metadata block varies in length (category row, optional quoted
  // query/geo/range description row, blanks). Locate the header row by its
  // leading time column instead of assuming a fixed position.
  const headerIdx = lines.findIndex((line, i) => i < 40 && TIME_HEADER_RE.test(line));

  if (headerIdx === -1) {
    throw new Error('Not a Google Trends CSV: expected metadata rows plus a header row');
  }

  const headerFields = splitCsvLine(lines[headerIdx]);
  if (headerFields.length < 2) {
    throw new Error('Not a Google Trends CSV: header row has no keyword columns');
  }

  const header = headerFields.slice(1);
  const weeks = [];
  const values = header.map(() => []);

  for (const row of lines.slice(headerIdx + 1)) {
    if (row.trim() === '') continue;
    const fields = splitCsvLine(row);
    if (fields.length < 2) continue;
    weeks.push(fields[0].trim());
    for (let i = 0; i < header.length; i++) {
      values[i].push(toValue(fields[i + 1] ?? ''));
    }
  }

  const series = {};
  header.forEach((keyword, i) => { series[keyword] = values[i]; });

  return { header, weeks, series };
}

/**
 * Summary statistics per keyword.
 * @param {{ header: string[], series: Record<string, number[]> }} parsed output of parseTrendsCsv
 * @returns {Record<string, { mean: number, last4wkMean: number, max: number }>}
 */
export function summarizeTrends(parsed) {
  const stats = {};
  for (const keyword of parsed.header) {
    const values = parsed.series[keyword];
    const sum = values.reduce((a, b) => a + b, 0);
    const last4 = values.slice(-4);
    const last4Sum = last4.reduce((a, b) => a + b, 0);
    stats[keyword] = {
      mean: values.length ? round1(sum / values.length) : 0,
      last4wkMean: last4.length ? round1(last4Sum / last4.length) : 0,
      max: values.length ? Math.max(...values) : 0,
    };
  }
  return stats;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}
