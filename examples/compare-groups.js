/**
 * Compare two keyword groups and print their summaries side by side.
 *
 * Remember: indexes are normalized 0-100 WITHIN each group. You can rank
 * keywords inside a group, but a "42" in group A does not equal a "42"
 * in group B.
 *
 * Run: node examples/compare-groups.js
 */
import { exportTrends } from '../src/index.js';

const { csvPaths, summary } = await exportTrends({
  keywords: [
    ['link shortener', 'url shortener', 'qr code generator'],
    ['a/b testing', 'split test'],
  ],
  timeframe: 'today 12-m',
  outDir: './trends',
  onProgress: (msg) => console.log(msg),
});

for (const group of summary.groups) {
  console.log(`\nGroup: ${group.keywords.join(', ')}`);
  if (group.error) {
    console.log(`  failed: ${group.error}`);
    continue;
  }
  for (const [keyword, stats] of Object.entries(group.stats)) {
    console.log(`  ${keyword}: mean=${stats.mean} last4wk=${stats.last4wkMean} max=${stats.max}`);
  }
}

console.log(`\nCSVs written: ${csvPaths.length}`);
