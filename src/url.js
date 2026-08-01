/**
 * Build a trends.google.com explore URL for one keyword group.
 *
 * @param {object} opts
 * @param {string[]} opts.keywords  one group (max 5)
 * @param {string}   opts.timeframe e.g. 'today 12-m', 'today 5-y', 'now 7-d'
 * @param {string}   [opts.geo]     two-letter region code ('' = worldwide)
 * @param {string}   [opts.hl]      UI locale, e.g. 'en'
 * @returns {string}
 */
export function buildExploreUrl({ keywords, timeframe, geo = '', hl = 'en' }) {
  const q = keywords.map(encodeURIComponent).join(',');
  let url = `https://trends.google.com/trends/explore?date=${encodeURIComponent(timeframe)}&q=${q}&hl=${encodeURIComponent(hl)}`;
  if (geo) url += `&geo=${encodeURIComponent(geo)}`;
  return url;
}
