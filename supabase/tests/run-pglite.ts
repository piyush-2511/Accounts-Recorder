/**
 * Applies every migration to an in-memory Postgres (pglite) with stubbed Supabase objects,
 * then runs each `*.test.sql` file. A test fails when its SQL raises an exception.
 *
 *   npm run test:db
 */
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const read = (p: string) => readFileSync(p, "utf8");

async function main() {
  const db = new PGlite();
  await db.exec(read(join(root, "tests", "stubs.sql")));

  const migrations = readdirSync(join(root, "migrations")).filter((f) => f.endsWith(".sql")).sort();
  for (const file of migrations) {
    try {
      await db.exec(read(join(root, "migrations", file)));
      console.log(`  migrated  ${file}`);
    } catch (err) {
      console.error(`\nMIGRATION FAILED: ${file}\n${(err as Error).message}`);
      process.exit(1);
    }
  }
  await db.exec(read(join(root, "tests", "helpers.sql")));

  const tests = readdirSync(join(root, "tests")).filter((f) => f.endsWith(".test.sql")).sort();
  let failed = 0;
  for (const file of tests) {
    // Each test runs against a snapshot so tests cannot affect one another.
    await db.exec("begin");
    try {
      await db.exec(read(join(root, "tests", file)));
      console.log(`  PASS      ${file}`);
    } catch (err) {
      failed++;
      console.error(`  FAIL      ${file}\n            ${(err as Error).message}`);
    } finally {
      await db.exec("rollback").catch(() => undefined);
      await db.exec("reset role").catch(() => undefined);
    }
  }
  console.log(failed ? `\n${failed} database test file(s) failed` : `\nAll ${tests.length} database test files passed`);
  process.exit(failed ? 1 : 0);
}

main();
