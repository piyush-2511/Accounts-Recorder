#!/usr/bin/env bash
# Weekly logical backup. Run from cron on any machine that can reach the database.
#   SUPABASE_DB_URL="postgresql://postgres:...@db.<ref>.supabase.co:5432/postgres" ./scripts/backup-weekly.sh /backups
# Voucher files live in Storage and are NOT in this dump; copy the `vouchers` bucket separately (see docs/operations-runbook.md).
set -euo pipefail
: "${SUPABASE_DB_URL:?Set SUPABASE_DB_URL}"
dir="${1:-./backups}"
mkdir -p "$dir"
file="$dir/accounts-$(date +%Y%m%d-%H%M).sql.gz"
pg_dump --no-owner --no-privileges --schema=public "$SUPABASE_DB_URL" | gzip > "$file"
echo "Backup written: $file"
find "$dir" -name 'accounts-*.sql.gz' -mtime +90 -delete
