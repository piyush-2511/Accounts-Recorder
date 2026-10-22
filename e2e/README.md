# End-to-end tests

These need a real (staging) Supabase project, so they are not run in CI by default.

1. Apply the migrations to a staging project; create a recorder and an admin WITHOUT two-factor (or use a test project where MFA is not enforced).
2. Set `E2E_RECORDER_EMAIL`, `E2E_RECORDER_PASSWORD`, `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD` and the app's Supabase variables.
3. `npm run build && npm run test:e2e`
