# Implementation notes and deliberate differences from the original plan
* Voucher numbers are assigned **at export**, gap-free per financial year (April–March), not at entry time.
* Settings live in an `app_settings` table (editable in the app), not environment variables.
* Tally export is **two XML files** (`ledgers.xml` for masters, `vouchers.xml` for transactions) plus an Excel copy.
* PDF reports use the browser print dialog rather than a server-side PDF library.
* Database tests are SQL assertion files run in an in-process Postgres (pglite) with small stubs for Supabase auth/storage; they check the real migrations.
* Browser end-to-end tests are provided but need a staging Supabase project.
* Roles are never read from user metadata; invited admins are promoted server-side after the invite.
