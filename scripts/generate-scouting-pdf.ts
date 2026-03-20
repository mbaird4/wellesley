/**
 * Generates a scouting report PDF by navigating Puppeteer to the report route.
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/generate-scouting-pdf.ts --slug babson --output report.pdf [--base-url http://localhost:4200]
 */

import * as fs from 'fs';
import puppeteer from 'puppeteer';

function getArg(flag: string, fallback = ''): string {
  const idx = process.argv.indexOf(flag);

  return idx !== -1 && idx + 1 < process.argv.length ? process.argv[idx + 1] : fallback;
}

function parseArgs(): { slug: string; output: string; baseUrl: string } {
  const slug = getArg('--slug');
  const output = getArg('--output', 'scouting-report.pdf');
  const baseUrl = getArg('--base-url', 'http://localhost:4200');

  if (!slug) {
    console.error('Usage: generate-scouting-pdf --slug <opponent-slug> [--output <path>] [--base-url <url>]');
    process.exit(1);
  }

  return { slug, output, baseUrl };
}

async function main(): Promise<void> {
  const { slug, output, baseUrl } = parseArgs();
  const url = `${baseUrl}/opponents/${slug}/report`;

  console.log(`Generating PDF for: ${url}`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });

    // Wait for the report component to signal it's ready
    await page.waitForSelector('#report-ready', { timeout: 30000 });

    // Small delay to ensure all print views have rendered
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const pdf = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: { top: '0.25in', right: '0.25in', bottom: '0.25in', left: '0.25in' },
    });

    fs.writeFileSync(output, pdf);
    console.log(`PDF written to: ${output}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
