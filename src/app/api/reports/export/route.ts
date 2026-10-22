import ExcelJS from "exceljs";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/get-session";
import { createClient } from "@/lib/supabase/server";
import { getGroup, type Dimension } from "@/lib/data/reports";
import { toCsv } from "@/lib/reports/csv";
import { isValidISODate } from "@/lib/format/dates";

export const dynamic = "force-dynamic";

const DIMS: Record<string, { dim: Dimension; title: string }> = {
  category: { dim: "category", title: "Category" },
  programme: { dim: "programme", title: "Programme" },
  payee: { dim: "payee", title: "Payee" },
  sources: { dim: "source", title: "Payment source" },
  recorders: { dim: "recorder", title: "Recorder" },
};

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sp = request.nextUrl.searchParams;
  const spec = DIMS[sp.get("kind") ?? ""];
  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";
  const format = sp.get("format") === "xlsx" ? "xlsx" : "csv";
  if (!spec || !isValidISODate(from) || !isValidISODate(to) || to < from) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const supabase = await createClient();
  const rows = await getGroup(supabase, spec.dim, from, to, sp.get("pending") === "1");
  const header = [spec.title, "Income", "Expense", "Entries"];
  const body = rows.map((r) => [r.label, r.income, r.expense, r.entry_count]);
  const name = `report_${sp.get("kind")}_${from}_to_${to}`;
  const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

  if (format === "csv") {
    return new NextResponse("﻿" + toCsv([header, ...body]), {
      headers: { ...headers, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}.csv"` },
    });
  }
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Report");
  ws.addRow(header).font = { bold: true };
  for (const r of body) ws.addRow(r);
  ws.columns = [{ width: 32 }, { width: 16, style: { numFmt: "#,##0.00" } }, { width: 16, style: { numFmt: "#,##0.00" } }, { width: 10 }];
  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(new Uint8Array(buf as ArrayBuffer), {
    headers: { ...headers, "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${name}.xlsx"` },
  });
}
