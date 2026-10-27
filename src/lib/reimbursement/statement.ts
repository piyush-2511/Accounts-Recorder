import { fromPaise, toPaise } from "../format/money";

export interface StatementEntry {
  id: string;
  entry_date: string;
  amount: number | string;
  narration: string;
  status: "pending" | "approved" | "exported" | "rejected";
  reimbursement_id: string | null;
  category: string | null;
  review_note: string | null;
}

export interface StatementPayment {
  id: string;
  paid_on: string;
  amount: number | string;
  reference: string | null;
  source: string | null;
  status: "recorded" | "exported" | "voided";
}

export interface StatementRow {
  key: string;
  type: "spent" | "paid";
  date: string;
  description: string;
  detail: string | null;
  /** Expense paid personally (increases what the organisation owes). */
  spent: number | null;
  /** Money the organisation paid back. */
  paidBack: number | null;
  /** What the organisation still owes after this row. Null for rows that do not count yet. */
  balance: number | null;
  status: "counted" | "pending" | "rejected";
  entryId?: string;
  paymentId?: string;
}

export interface Statement {
  rows: StatementRow[];
  totalSpent: number;
  totalPaidBack: number;
  owed: number;
  pending: number;
  rejected: number;
}

/**
 * A staff member's account with the organisation: money they spent personally (approved expenses),
 * money paid back to them, and the running balance still owed. Pending and rejected expenses are listed
 * but never counted. Voided reimbursements are ignored. Works in paise to avoid rounding drift.
 */
export function buildStatement(entries: StatementEntry[], payments: StatementPayment[]): Statement {
  type Raw = { date: string; order: number; row: Omit<StatementRow, "balance">; delta: number };
  const raws: Raw[] = [];

  for (const e of entries) {
    const paise = toPaise(e.amount);
    const counted = e.status === "approved" || e.status === "exported";
    raws.push({
      date: e.entry_date,
      order: 0,
      delta: counted ? paise : 0,
      row: {
        key: `e-${e.id}`, type: "spent", date: e.entry_date,
        description: e.narration, detail: [e.category, e.status === "rejected" && e.review_note ? `Rejected: ${e.review_note}` : null].filter(Boolean).join(" · ") || null,
        spent: fromPaise(paise), paidBack: null,
        status: counted ? "counted" : e.status === "rejected" ? "rejected" : "pending",
        entryId: e.id,
      },
    });
  }
  for (const p of payments) {
    if (p.status === "voided") continue;
    const paise = toPaise(p.amount);
    raws.push({
      date: p.paid_on,
      order: 1,
      delta: -paise,
      row: {
        key: `p-${p.id}`, type: "paid", date: p.paid_on,
        description: "Reimbursement received", detail: [p.source, p.reference ? `Ref ${p.reference}` : null].filter(Boolean).join(" · ") || null,
        spent: null, paidBack: fromPaise(paise), status: "counted", paymentId: p.id,
      },
    });
  }

  raws.sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order || a.row.key.localeCompare(b.row.key));

  let running = 0;
  let spent = 0;
  let paid = 0;
  let pending = 0;
  let rejected = 0;
  const rows: StatementRow[] = raws.map((r) => {
    running += r.delta;
    if (r.row.type === "spent") {
      if (r.row.status === "counted") spent += toPaise(r.row.spent ?? 0);
      else if (r.row.status === "pending") pending += toPaise(r.row.spent ?? 0);
      else rejected += toPaise(r.row.spent ?? 0);
    } else {
      paid += toPaise(r.row.paidBack ?? 0);
    }
    return { ...r.row, balance: r.row.status === "counted" ? fromPaise(running) : null };
  });

  return { rows, totalSpent: fromPaise(spent), totalPaidBack: fromPaise(paid), owed: fromPaise(spent - paid), pending: fromPaise(pending), rejected: fromPaise(rejected) };
}
