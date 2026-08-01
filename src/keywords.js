/**
 * Keyword grouping. Google Trends compares at most 5 keywords per request,
 * so anything larger must be split into groups. Indexes are normalized
 * 0-100 *within* a group, so groups are never comparable to each other.
 */

export const MAX_GROUP_SIZE = 5;

/**
 * Normalize user input into an array of keyword groups (each <= 5).
 * - flat string[]  -> chunked into groups of 5 ([7 kws] -> [5, 2])
 * - string[][]     -> used as-is, each group validated
 * @param {string[] | string[][]} keywords
 * @returns {string[][]}
 */
export function groupKeywords(keywords) {
  if (!Array.isArray(keywords) || keywords.length === 0) {
    throw new Error('keywords must be a non-empty array of strings or arrays of strings');
  }

  const isNested = keywords.every((k) => Array.isArray(k));
  const isFlat = keywords.every((k) => typeof k === 'string');
  if (!isNested && !isFlat) {
    throw new Error('keywords must be either all strings or all arrays of strings (no mixing)');
  }

  const groups = isNested ? keywords : chunk(keywords, MAX_GROUP_SIZE);

  for (const group of groups) {
    if (group.length === 0) throw new Error('keyword groups must not be empty');
    if (group.length > MAX_GROUP_SIZE) {
      throw new Error(`keyword group exceeds ${MAX_GROUP_SIZE} keywords: ${JSON.stringify(group)}`);
    }
    for (const kw of group) {
      if (typeof kw !== 'string' || kw.trim() === '') {
        throw new Error(`invalid keyword: ${JSON.stringify(kw)}`);
      }
    }
  }

  return groups.map((g) => g.map((kw) => kw.trim()));
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Filesystem-safe slug for a group's output CSV, derived from its first keyword. */
export function groupSlug(group) {
  const slug = group[0].toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return slug || 'group';
}
