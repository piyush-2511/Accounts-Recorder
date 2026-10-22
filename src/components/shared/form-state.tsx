import { Alert } from "@/components/ui/alert";
import type { ActionState } from "@/lib/validation/common";

/** Renders the outcome of a server action (error or success) above/below a form. */
export function FormMessage({ state }: { state: ActionState<unknown> }) {
  if (state.status === "error") return <Alert tone="danger">{state.message}</Alert>;
  if (state.status === "success" && state.message) return <Alert tone="success">{state.message}</Alert>;
  return null;
}

export function fieldError(state: ActionState<unknown>, name: string): string | undefined {
  return state.status === "error" ? state.fieldErrors?.[name] : undefined;
}
