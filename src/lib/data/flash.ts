import { redirect } from "next/navigation";

/** Settings forms are plain server-action forms; result messages travel as ?ok= / ?err= on the redirect. */
export function back(path: string, kind: "ok" | "err", message: string): never {
  redirect(`${path}?${kind}=${encodeURIComponent(message.slice(0, 200))}`);
}
