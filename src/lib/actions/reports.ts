"use server";

import { requireAdmin } from "@/lib/auth/admin-guard";
import { getSalesReportForRangeAdmin } from "@/lib/db/reports";
import type { SalesReport } from "@/types";

// Leitura — qualquer papel autenticado pode consultar (inclusive viewer).
export async function getSalesReportForRange(
  fromDateStr: string,
  toDateStr: string
): Promise<{ error: string } | { report: SalesReport }> {
  await requireAdmin();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDateStr) || !/^\d{4}-\d{2}-\d{2}$/.test(toDateStr)) {
    return { error: "Datas inválidas." };
  }
  if (fromDateStr > toDateStr) {
    return { error: "A data inicial precisa ser antes (ou igual a) da data final." };
  }

  const report = await getSalesReportForRangeAdmin(fromDateStr, toDateStr);
  return { report };
}
