import { formatCompactIN, formatINR } from "@/lib/format/money";
import { formatMonth } from "@/lib/format/dates";
import { cn } from "@/lib/utils";
import type { MonthRow } from "@/lib/data/reports";

const INCOME = "hsl(var(--income))";
const EXPENSE = "hsl(var(--expense))";

function niceMax(v: number): number {
  if (v <= 0) return 1000;
  const pow = 10 ** Math.floor(Math.log10(v));
  const f = v / pow;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow;
}

/** Grouped income / expense bars per month. Pure SVG: renders on the server, prints cleanly. */
export function TrendChart({ data }: { data: MonthRow[] }) {
  const W = 720;
  const H = 260;
  const m = { top: 12, right: 8, bottom: 30, left: 52 };
  const iw = W - m.left - m.right;
  const ih = H - m.top - m.bottom;
  const max = niceMax(Math.max(0, ...data.flatMap((d) => [d.income, d.expense])));
  const band = iw / Math.max(data.length, 1);
  const bw = Math.min(26, band * 0.36);
  const y = (v: number) => m.top + ih - (v / max) * ih;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const summary = `Monthly income and expense. ${data.map((d) => `${formatMonth(d.month)}: income ${formatINR(d.income)}, expense ${formatINR(d.expense)}`).join("; ")}`;

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary} className="h-auto w-full">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.left} x2={W - m.right} y1={y(t)} y2={y(t)} stroke="currentColor" strokeOpacity={0.12} />
            <text x={m.left - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill="currentColor" fillOpacity={0.65}>{formatCompactIN(t)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = m.left + band * i + band / 2;
          return (
            <g key={d.month}>
              <title>{`${formatMonth(d.month)}: income ${formatINR(d.income)}, expense ${formatINR(d.expense)}`}</title>
              <rect x={cx - bw - 1} y={y(d.income)} width={bw} height={Math.max(0, m.top + ih - y(d.income))} style={{ fill: INCOME }} rx={2} />
              <rect x={cx + 1} y={y(d.expense)} width={bw} height={Math.max(0, m.top + ih - y(d.expense))} style={{ fill: EXPENSE }} rx={2} />
              <text x={cx} y={H - 10} textAnchor="middle" fontSize={11} fill="currentColor" fillOpacity={0.7}>{formatMonth(d.month).slice(0, 3)}</text>
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-1 flex gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: INCOME }} /> Income</span>
        <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: EXPENSE }} /> Expense</span>
      </figcaption>
    </figure>
  );
}

/** Horizontal bar list: label, bar, value and share. */
export function BarList({ rows, tone = "expense", empty = "No data for this period." }: { rows: { label: string; value: number }[]; tone?: "income" | "expense" | "neutral"; empty?: string }) {
  const total = rows.reduce((s, r) => s + r.value, 0);
  const max = Math.max(0, ...rows.map((r) => r.value));
  if (rows.length === 0 || total === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  const color = tone === "income" ? INCOME : tone === "expense" ? EXPENSE : "hsl(var(--neutral-bar))";
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate">{r.label}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">{formatINR(r.value)} · {((r.value / total) * 100).toFixed(0)}%</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-muted" role="presentation">
            <div className="h-2 rounded-full" style={{ width: `${max ? (r.value / max) * 100 : 0}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: React.ReactNode; tone?: "income" | "expense" | "neutral" }) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm print-card">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold tabular-nums", tone === "income" && "text-success", tone === "expense" && "text-danger")}>{value}</p>
      {sub ? <p className="mt-1 text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

export function Delta({ current, previous, goodWhenUp }: { current: number; previous: number; goodWhenUp: boolean }) {
  if (previous === 0) return <span>no data last month</span>;
  const pct = ((current - previous) / previous) * 100;
  const up = pct >= 0;
  const good = up === goodWhenUp;
  return (
    <span className={good ? "text-success" : "text-danger"}>
      {up ? "▲" : "▼"} {Math.abs(pct).toFixed(0)}% vs last month
    </span>
  );
}
