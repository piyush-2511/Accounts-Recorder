# Accounts Recorder

Record income and expenses, review them, and export approved entries to **TallyPrime Silver**.

* **Recorders** enter expenses and income through a short form and attach a bill or voucher (50–200 KB).
* Every entry waits in a **review queue**. The **admin** approves or rejects it (with a note).
* Only approved entries can be exported. The export is a pair of XML files plus an Excel copy, ready to import into Tally.
* The admin also gets dashboards, reports, budgets, checks for duplicates and missing vouchers, and an audit trail.

Stack: Next.js 15 (App Router), React 19, TypeScript, Tailwind, Supabase (Postgres, Auth, Storage).

## Set up (about 30 minutes)

1. **Create a Supabase project** (use the Pro plan for daily backups). In *Authentication > Providers*, keep Email on and **turn off “Allow new users to sign up”**. Enable **TOTP multi-factor**.
2. **Run the migrations**: `npx supabase link --project-ref <ref>` then `npx supabase db push` (files in `supabase/migrations`, in order 0001 to 0010).
3. **Invite and reset emails** (Authentication > URL Configuration and Email Templates):
   * *Site URL*: your deployed address (for local testing `http://localhost:3000`).
   * *Redirect URLs*: add `<site>/**` (for example `http://localhost:3000/**` and `https://your-domain/**`). If this is missing, Supabase sends people to the home page instead of the password page.
   * Optional but recommended: in the **Invite user** template change the button link to  
     `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/accept-invite`  
     and in **Reset password** to  
     `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/accept-invite`.  
     The app also works with the default templates, but these links are not used up by email scanners.
   * Use your own SMTP for real use (the built-in sender is limited to a few emails per hour).
   How it works: an invited person opens the link, is signed in, and is held on the “Choose your password” page until they set one. If a link expires, Settings > Users shows “invite pending” with a **Resend invitation** button.
4. `cp .env.example .env.local` and fill in the four values from *Project settings > API*.
5. `npm install`, then create the first admin: `npm run create:admin -- you@example.org "Your Name" "a-long-password"`.
6. `npm run dev`, sign in at `/login`; you will be asked to set up two-factor authentication.
7. In **Settings > General** enter the company name exactly as in Tally. Review **Categories** and **Payment sources**; invite recorders under **Users**.

Deploy on Vercel (or any Node host): set the same four environment variables, deploy `main`.

## Daily use

See `docs/user-guide-recorder.md` and `docs/user-guide-admin.md`. Tally steps: `docs/tally-import-runbook.md`. Backups and monitoring: `docs/operations-runbook.md`.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Run the app |
| `npm run typecheck` / `lint` | Static checks |
| `npm test` | Unit tests (money, dates, Tally XML, vouchers, validation) |
| `npm run test:db` | Database tests: RLS, review gate, validation, export lock, storage, reports (real Postgres engine, no Supabase needed) |
| `npm run test:e2e` | Browser tests against a staging project (`e2e/README.md`) |

## How it is protected

* Row level security on every table; recorders only ever see their own entries.
* A database trigger enforces the workflow: status changes happen only through review/export functions, approved and exported entries are locked, exported ones cannot change without an admin unlocking the batch.
* Vouchers: validated in the browser, again on the server by file signature, and a third time by the storage bucket (200 KB hard limit). Private bucket; files are viewed through short-lived signed links.
* Staff who pay from their own pocket choose “Paid by me (reimburse later)”; the admin reimburses them from the Reimburse page and the settlement voucher is exported to Tally.
* Admins must complete two-factor authentication. Sign-up is disabled; users are invited.
* Strict content security policy and security headers; CSV formula-injection protection; every change is written to an append-only audit log.

## Important: prove the Tally import once

Tally’s XML import is picky. Before you rely on it, follow `docs/tally-import-runbook.md` section 1 and import a few vouchers into a **test company** first. The XML layout is covered by unit tests, but only your Tally version can confirm it.
