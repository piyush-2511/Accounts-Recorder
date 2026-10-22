# Operations runbook

## Environments
Keep **staging** and **production** as two separate Supabase projects and two deployments. Test every migration on staging first (`Deploy database migrations` workflow, or `supabase db push`).

## Backups
* Database: Supabase Pro daily backups (7 days). Also run `scripts/backup-weekly.sh` weekly to a separate place and keep 90 days.
* Voucher files: not in database dumps. Once a month copy the `vouchers` bucket (Supabase dashboard, or `supabase storage cp -r ss:///vouchers ./vouchers-backup --experimental`).
* Export files: kept in the `exports` bucket forever; also keep the downloaded XML with your Tally backups.
* Practise a restore once, into a staging project.

## Monitoring
* Point an uptime monitor at `/api/health` (returns 200 only when the database is reachable).
* Review *Audit* weekly for unexpected changes. Schedule the `pending-digest` function daily if admins want a nudge.
* Schedule `cleanup-orphan-vouchers` weekly to remove abandoned uploads.

## Routine tasks
* Add a user: Settings > Users. Leaver: untick **Active** (their history stays).
* Lost phone (admin two-factor): in Supabase dashboard > Authentication > Users, remove the user’s factor, then they re-enrol.
* Rotate the service-role key if it is ever exposed; redeploy with the new value.
* Dependencies: run `npm audit` monthly; CI also fails on high severity issues.
* New financial year (1 April): nothing to do; voucher numbers restart automatically at the configured start number.

## Incident: wrong entries exported
See the *Mistakes* section of `tally-import-runbook.md`.
