/**
 * Parse a Google Trends "interest over time" CSV export.
 *
 * The export format is:
 *   row 1: metadata (e.g. "Category: All categories")
 *   row 2: blank
 *   row 3: header (Week,<keyword1>,<keyword2>,...)
 *   row 4+: data rows; values are 0-100 integers, or '<1' for sub-1% volume.
 */

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

/**
 * @param {string} text raw CSV file contents
 * @returns {{ header: string[], weeks: string[], series: Record<string, number[]> }}
 *   header: keyword column names (first column "Week"/"Day"/"Month" is dropped)
 *   weeks:  time-bucket label per data row
 *   series: keyword -> array of 0-100 values, aligned with weeks
 */
export function parseTrendsCsv(text) {
  // Keep blank lines in place: the header is defined by position (row 3),
  // and row 2 is blank in the real export format.
  const lines = text.split(/\r?\n/);

  // Header is on row 3 (index 2): rows 1-2 are metadata.
  if (lines.length < 3 || lines[2].trim() === '') {
    throw new Error('Not a Google Trends CSV: expected metadata rows plus a header row');
  }

  const headerFields = splitCsvLine(lines[2]);
  if (headerFields.length < 2) {
    throw new Error('Not a Google Trends CSV: header row has no keyword columns');
  }

  const header = headerFields.slice(1);
  const weeks = [];
  const values = header.map(() => []);

  for (const row of lines.slice(3)) {
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
