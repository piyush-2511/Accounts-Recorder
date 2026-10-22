"use client";

import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormMessage, fieldError } from "@/components/shared/form-state";
import { VoucherUploader } from "./voucher-uploader";
import { cn } from "@/lib/utils";
import { defaultNarration } from "@/lib/validation/entry";
import { formatINR } from "@/lib/format/money";
import { idle, type ActionState } from "@/lib/validation/common";
import { useDraft } from "@/hooks/use-draft-entry";
import type { Category, EntryWithRefs, PaymentSource } from "@/types/db";
import type { EntryKind } from "@/lib/constants/entry-status";

export interface EntryFormProps {
  mode: "create" | "edit" | "admin";
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  categories: Category[];
  sources: PaymentSource[];
  limits: { today: string; minDate: string; maxAmount: number; voucherRequiredAbove: number | null };
  suggestions: { parties: string[]; programmes: string[] };
  entry?: EntryWithRefs;
  canApprove?: boolean;
  backHref?: string;
  hidden?: Record<string, string>;
}

interface Values {
  kind: EntryKind;
  entry_date: string;
  category_id: string;
  source_id: string;
  amount: string;
  party: string;
  programme: string;
  narration: string;
}

const DRAFT_KEY = "ar:draft:new";

export function EntryForm({ mode, action, categories, sources, limits, suggestions, entry, canApprove, backHref, hidden }: EntryFormProps) {
  const [state, formAction] = useActionState(action, idle);
  const formRef = useRef<HTMLFormElement>(null);
  const draft = useDraft(DRAFT_KEY, mode === "create");

  const initial: Values = {
    kind: entry?.kind ?? "expense",
    entry_date: entry?.entry_date ?? limits.today,
    category_id: entry ? String(entry.category_id) : "",
    source_id: entry ? String(entry.source_id) : (sources[0] ? String(sources[0].id) : ""),
    amount: entry ? String(entry.amount) : "",
    party: entry?.party ?? "",
    programme: entry?.programme ?? "",
    narration: entry?.narration ?? "",
  };
  const [v, setV] = useState<Values>(initial);
  const [narrationTouched, setNarrationTouched] = useState(mode !== "create");
  const [blocked, setBlocked] = useState(false);
  const [uploaderKey, setUploaderKey] = useState(0);
  const set = <K extends keyof Values>(k: K, value: Values[K]) => setV((prev) => ({ ...prev, [k]: value }));

  const visibleCategories = useMemo(() => categories.filter((c) => c.kind === v.kind && (c.is_active || String(c.id) === v.category_id)), [categories, v.kind, v.category_id]);
  const category = categories.find((c) => String(c.id) === v.category_id);
  const amountNumber = Number(v.amount);
  const voucherRequired = limits.voucherRequiredAbove !== null && Number.isFinite(amountNumber) && amountNumber > limits.voucherRequiredAbove;

  // Restore the last unsaved draft (create mode), including the sticky date / source / programme.
  useEffect(() => {
    const saved = draft.load();
    if (saved) {
      setV((prev) => ({
        ...prev,
        ...(saved.kind === "income" || saved.kind === "expense" ? { kind: saved.kind } : {}),
        ...(saved.entry_date && saved.entry_date <= limits.today && saved.entry_date >= limits.minDate ? { entry_date: saved.entry_date } : {}),
        ...(saved.source_id && sources.some((s) => String(s.id) === saved.source_id) ? { source_id: saved.source_id } : {}),
        ...(saved.category_id && categories.some((c) => String(c.id) === saved.category_id) ? { category_id: saved.category_id } : {}),
        amount: saved.amount ?? "",
        party: saved.party ?? "",
        programme: saved.programme ?? "",
        narration: saved.narration ?? "",
      }));
      if (saved.narration) setNarrationTouched(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mode === "create") draft.save({ ...v });
  }, [v, mode, draft]);

  // Keep the narration in step with the fields until the user types their own.
  useEffect(() => {
    if (narrationTouched || !category) return;
    setV((prev) => ({ ...prev, narration: defaultNarration({ kind: prev.kind, categoryLabel: category.label, party: prev.party, programme: prev.programme }) }));
  }, [narrationTouched, category, v.party, v.programme, v.kind]);

  // After a successful create: clear the per-entry fields, keep date / source / programme for the next one.
  useEffect(() => {
    if (mode !== "create" || state.status !== "success") return;
    const keep = { kind: v.kind, entry_date: v.entry_date, source_id: v.source_id, programme: v.programme };
    setV((prev) => ({ ...prev, category_id: "", amount: "", party: "", narration: "" }));
    setNarrationTouched(false);
    setUploaderKey((k) => k + 1);
    draft.clear(keep);
    window.scrollTo({ top: 0, behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const onBlockedChange = useCallback((b: boolean) => setBlocked(b), []);

  function onAmount(raw: string) {
    let s = raw.replace(/[^\d.]/g, "");
    const dot = s.indexOf(".");
    if (dot >= 0) s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, "").slice(0, 2);
    set("amount", s);
  }

  const err = (name: string) => fieldError(state, name);

  return (
    <form ref={formRef} action={formAction} className="space-y-5" noValidate>
      {entry ? <input type="hidden" name="id" value={entry.id} /> : null}
      {Object.entries(hidden ?? {}).map(([k, val]) => <input key={k} type="hidden" name={k} value={val} />)}
      {mode === "create" && state.status === "success" ? (
        <Alert tone="success">
          {state.message} <Link href="/record/entries" className="font-medium underline">View my entries</Link>
        </Alert>
      ) : null}
      {mode !== "create" || state.status === "error" ? <FormMessage state={state} /> : null}
      {entry?.status === "rejected" && entry.review_note ? (
        <Alert tone="danger">
          <p className="font-medium">Rejected by the admin</p>
          <p>{entry.review_note}</p>
          <p className="mt-1 text-xs text-muted-foreground">Correct the entry and save it to send it for review again.</p>
        </Alert>
      ) : null}

      <div role="radiogroup" aria-label="Entry type" className="grid grid-cols-2 gap-2">
        {(["expense", "income"] as const).map((k) => (
          <label key={k} className="cursor-pointer">
            <input
              type="radio"
              name="kind"
              value={k}
              checked={v.kind === k}
              onChange={() => setV((p) => ({ ...p, kind: k, category_id: "" }))}
              className="peer sr-only"
            />
            <span className="flex h-11 items-center justify-center rounded-md border border-input bg-card text-sm font-semibold peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
              {k === "expense" ? "Expense" : "Income"}
            </span>
          </label>
        ))}
      </div>

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Category</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {visibleCategories.map((c) => (
            <label key={c.id} className="cursor-pointer">
              <input type="radio" name="category_id" value={c.id} checked={v.category_id === String(c.id)} onChange={() => set("category_id", String(c.id))} className="peer sr-only" />
              <span className="flex min-h-12 items-center justify-center rounded-md border border-input bg-card px-2 py-2 text-center text-sm font-medium peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
                {c.label}
              </span>
            </label>
          ))}
        </div>
        {err("category_id") ? <p role="alert" className="mt-1 text-xs font-medium text-danger">{err("category_id")}</p> : null}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Amount (₹)" htmlFor="amount" error={err("amount")} hint={v.amount && Number(v.amount) > 0 ? formatINR(v.amount) : undefined}>
          <Input id="amount" name="amount" inputMode="decimal" autoComplete="off" placeholder="0.00" value={v.amount} onChange={(e) => onAmount(e.target.value)} aria-invalid={!!err("amount")} aria-describedby={err("amount") ? "amount-error" : undefined} className="text-lg font-semibold" />
        </Field>
        <Field label="Date" htmlFor="entry_date" error={err("entry_date")}>
          <Input id="entry_date" name="entry_date" type="date" min={limits.minDate} max={limits.today} value={v.entry_date} onChange={(e) => set("entry_date", e.target.value)} aria-invalid={!!err("entry_date")} />
        </Field>
        <Field label={v.kind === "expense" ? "Paid from" : "Received in"} htmlFor="source_id" error={err("source_id")}>
          <Select id="source_id" name="source_id" value={v.source_id} onChange={(e) => set("source_id", e.target.value)}>
            {sources.filter((s) => s.is_active || String(s.id) === v.source_id).map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </Select>
        </Field>
        <Field label={v.kind === "expense" ? "Paid to (optional)" : "Received from (optional)"} htmlFor="party" error={err("party")}>
          <Input id="party" name="party" list="party-list" autoComplete="off" maxLength={120} value={v.party} onChange={(e) => set("party", e.target.value)} />
          <datalist id="party-list">{suggestions.parties.map((p) => <option key={p} value={p} />)}</datalist>
        </Field>
        <Field label="Programme (optional)" htmlFor="programme" error={err("programme")} className="sm:col-span-2">
          <Input id="programme" name="programme" list="programme-list" autoComplete="off" maxLength={120} value={v.programme} onChange={(e) => set("programme", e.target.value)} />
          <datalist id="programme-list">{suggestions.programmes.map((p) => <option key={p} value={p} />)}</datalist>
        </Field>
      </div>

      <Field label="Narration" htmlFor="narration" error={err("narration")} hint="Appears on the Tally voucher. It fills itself in; edit it if you like.">
        <Textarea id="narration" name="narration" rows={2} maxLength={500} value={v.narration} onChange={(e) => { setNarrationTouched(true); set("narration", e.target.value); }} aria-invalid={!!err("narration")} />
      </Field>

      <VoucherUploader
        key={uploaderKey}
        existing={entry?.receipt_path ? { entryId: entry.id, mime: entry.receipt_mime, size: entry.receipt_size } : null}
        error={err("voucher")}
        required={voucherRequired}
        onBlockedChange={onBlockedChange}
      />

      {state.status === "duplicate" ? (
        <Alert tone="warning">
          <p>{state.message}</p>
          <SubmitButton name="confirm_duplicate" value="1" variant="secondary" size="sm" className="mt-2" pendingText="Saving...">
            Save anyway
          </SubmitButton>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-t pt-4">
        <SubmitButton size="lg" disabled={blocked} pendingText="Saving..." className="min-w-40">
          {mode === "create" ? "Save entry" : entry?.status === "rejected" ? "Save and resubmit" : "Save changes"}
        </SubmitButton>
        {canApprove ? (
          <SubmitButton name="then" value="approve" variant="success" size="lg" disabled={blocked} pendingText="Saving...">
            Save and approve
          </SubmitButton>
        ) : null}
        {backHref ? (
          <Link href={backHref} className="inline-flex h-12 items-center rounded-md px-4 text-sm font-medium hover:bg-muted">
            Cancel
          </Link>
        ) : null}
        {mode === "create" ? (
          <Button
            variant="ghost"
            onClick={() => {
              setV({ ...initial, entry_date: limits.today });
              setNarrationTouched(false);
              setUploaderKey((k) => k + 1);
              draft.clear();
            }}
          >
            Clear form
          </Button>
        ) : null}
      </div>
      <span className={cn("sr-only")} aria-live="polite">{state.status === "success" ? state.message : ""}</span>
    </form>
  );
}
