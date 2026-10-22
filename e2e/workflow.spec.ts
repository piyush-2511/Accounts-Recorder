import { expect, test, type Page } from "@playwright/test";

const env = (k: string) => process.env[k] ?? "";
const configured = ["E2E_RECORDER_EMAIL", "E2E_RECORDER_PASSWORD", "E2E_ADMIN_EMAIL", "E2E_ADMIN_PASSWORD"].every(env);
test.skip(!configured, "E2E credentials not set");

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
}

test("recorder cannot reach admin pages", async ({ page }) => {
  await login(page, env("E2E_RECORDER_EMAIL"), env("E2E_RECORDER_PASSWORD"));
  await expect(page).toHaveURL(/\/record/);
  await page.goto("/admin");
  await expect(page).not.toHaveURL(/\/admin$/);
});

test("entry goes recorder -> pending -> admin approval", async ({ browser }) => {
  const note = `e2e ${Date.now()}`;
  const rec = await (await browser.newContext()).newPage();
  await login(rec, env("E2E_RECORDER_EMAIL"), env("E2E_RECORDER_PASSWORD"));
  await rec.goto("/record/new");
  await rec.getByLabel(/amount/i).fill("123.45");
  await rec.getByLabel(/narration|what was this for/i).fill(note);
  await rec.getByRole("button", { name: /save|submit/i }).first().click();
  await expect(rec.getByText(/pending/i).first()).toBeVisible();

  const adm = await (await browser.newContext()).newPage();
  await login(adm, env("E2E_ADMIN_EMAIL"), env("E2E_ADMIN_PASSWORD"));
  await adm.goto("/admin/review");
  await expect(adm.getByText(note)).toBeVisible();
});

test("unauthenticated visitors are sent to login", async ({ page }) => {
  await page.goto("/admin/export");
  await expect(page).toHaveURL(/\/login/);
});
