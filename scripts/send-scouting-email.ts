/**
 * Sends a scouting report PDF via email using the Resend API.
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/send-scouting-email.ts --opponent "Babson" --date 2026-03-20 --pdf report.pdf
 *
 * Environment:
 *   RESEND_API_KEY — Resend API key
 *   SCOUTING_RECIPIENTS — Comma-separated email addresses
 */

import * as fs from 'fs';
import { Resend } from 'resend';

function getArg(flag: string): string {
  const idx = process.argv.indexOf(flag);

  return idx !== -1 && idx + 1 < process.argv.length ? process.argv[idx + 1] : '';
}

function parseArgs(): { opponent: string; date: string; pdf: string } {
  const opponent = getArg('--opponent');
  const date = getArg('--date');
  const pdf = getArg('--pdf');

  if (!opponent || !date || !pdf) {
    console.error('Usage: send-scouting-email --opponent <name> --date <YYYY-MM-DD> --pdf <path>');
    process.exit(1);
  }

  return { opponent, date, pdf };
}

function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-');

  return `${parseInt(month)}/${parseInt(day)}/${year}`;
}

async function main(): Promise<void> {
  const { opponent, date, pdf } = parseArgs();

  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.error('RESEND_API_KEY environment variable is required');
    process.exit(1);
  }

  const recipientList = process.env.SCOUTING_RECIPIENTS;

  if (!recipientList) {
    console.error('SCOUTING_RECIPIENTS environment variable is required');
    process.exit(1);
  }

  const recipients = recipientList
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);

  if (recipients.length === 0) {
    console.error('No recipients specified');
    process.exit(1);
  }

  if (!fs.existsSync(pdf)) {
    console.error(`PDF file not found: ${pdf}`);
    process.exit(1);
  }

  const pdfBuffer = fs.readFileSync(pdf);
  const displayDate = formatDate(date);
  const filename = `scouting-report-${opponent.toLowerCase().replace(/\s+/g, '-')}-${date}.pdf`;

  console.log(`Sending scouting report for ${opponent} (${displayDate}) to ${recipients.length} recipients`);

  const resend = new Resend(apiKey);

  const { data, error } = await resend.emails.send({
    from: 'Wellesley Softball Scouting <onboarding@resend.dev>',
    to: recipients,
    subject: `Scouting Report: ${opponent} (${displayDate})`,
    html: `<p>Attached is the scouting report for tomorrow's game against <strong>${opponent}</strong> on ${displayDate}.</p><p>Go Blue!</p>`,
    attachments: [
      {
        filename,
        content: pdfBuffer.toString('base64'),
      },
    ],
  });

  if (error) {
    console.error('Failed to send email:', error);
    process.exit(1);
  }

  console.log(`Email sent successfully! ID: ${data?.id}`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
