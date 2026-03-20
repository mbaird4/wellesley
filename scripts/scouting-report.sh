#!/usr/bin/env bash
set -euo pipefail

# Usage: npm run scouting-report -- --slug babson --opponent "Babson" --date 2026-03-20

# Load .env if present
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

SLUG=""
OPPONENT=""
DATE=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --slug) SLUG="$2"; shift 2 ;;
    --opponent) OPPONENT="$2"; shift 2 ;;
    --date) DATE="$2"; shift 2 ;;
    *) shift ;;
  esac
done

if [ -z "$SLUG" ]; then
  echo "Usage: npm run scouting-report -- --slug <slug> --opponent <name> --date <YYYY-MM-DD>"
  echo "Example: npm run scouting-report -- --slug babson --opponent Babson --date 2026-03-20"
  exit 1
fi

OPPONENT="${OPPONENT:-$SLUG}"
DATE="${DATE:-$(date +%Y-%m-%d)}"
PDF="/tmp/scouting-report-${SLUG}.pdf"

echo "=== Scouting Report: ${OPPONENT} (${DATE}) ==="

echo -e "\n1. Building app..."
npx nx run wellesley:tailwind:build
npx nx build wellesley

echo -e "\n2. Starting server..."
npx serve dist/wellesley/browser -s &
SERVER_PID=$!
sleep 3
PORT=$(lsof -iTCP -sTCP:LISTEN -P -p $SERVER_PID 2>/dev/null | grep LISTEN | awk '{print $9}' | sed 's/.*://')
echo "   Server on port ${PORT}"

echo -e "\n3. Generating PDF..."
npx ts-node --project tsconfig.scripts.json scripts/generate-scouting-pdf.ts \
  --slug "$SLUG" --output "$PDF" --base-url "http://localhost:${PORT}"

kill $SERVER_PID 2>/dev/null || true

echo -e "\n4. Sending email..."
npx ts-node --project tsconfig.scripts.json scripts/send-scouting-email.ts \
  --opponent "$OPPONENT" --date "$DATE" --pdf "$PDF"

echo -e "\nDone! PDF saved to ${PDF}"
