import { Alert } from "@/components/ui/alert";
import { firstParam } from "@/lib/utils";

export function Flash({ sp }: { sp: Record<string, string | string[] | undefined> }) {
  const ok = firstParam(sp.ok);
  const err = firstParam(sp.err);
  if (!ok && !err) return null;
  return <Alert tone={err ? "danger" : "success"} className="mb-4">{err ?? ok}</Alert>;
}
