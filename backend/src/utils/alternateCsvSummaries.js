/**
 * Shared CSV parsing + UPI/utility summaries (used by user upload + admin verified upload).
 */

export function toNum(value) {
  const n = Number(String(value || "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function parseCsv(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cols = line.split(",").map((c) => c.trim());
    const row = {};
    headers.forEach((h, i) => {
      row[h] = cols[i] ?? "";
    });
    return row;
  });
}

export function monthKeyFromDate(raw) {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function buildUpiSummary(rows) {
  let inflow = 0;
  let outflow = 0;
  let txCount = 0;
  const months = new Set();

  for (const row of rows) {
    const amount = toNum(
      row.amount || row.amt || row.value || row.transaction_amount
    );
    if (!amount) continue;
    txCount += 1;

    const direction = String(
      row.type || row.direction || row.crdr || row.transaction_type || ""
    ).toLowerCase();
    if (
      direction.includes("credit") ||
      direction.includes("cr") ||
      direction.includes("in")
    ) {
      inflow += Math.abs(amount);
    } else if (
      direction.includes("debit") ||
      direction.includes("dr") ||
      direction.includes("out")
    ) {
      outflow += Math.abs(amount);
    } else {
      if (amount >= 0) inflow += Math.abs(amount);
      else outflow += Math.abs(amount);
    }

    const mk = monthKeyFromDate(row.date || row.txn_date || row.transaction_date);
    if (mk) months.add(mk);
  }

  const monthCount = Math.max(1, months.size);
  return {
    monthlyInflow: Math.round(inflow / monthCount),
    monthlyOutflow: Math.round(outflow / monthCount),
    avgMonthlyTransactionCount: Math.max(1, Math.round(txCount / monthCount)),
    transactionRegularity: monthCount >= 6 ? 0.72 : monthCount >= 3 ? 0.58 : 0.48,
    monthsHistory: monthCount,
  };
}

export function buildUtilitySummary(rows) {
  const months = new Set();
  let paid = 0;
  let total = 0;
  for (const row of rows) {
    total += 1;
    const status = String(row.status || row.payment_status || "").toLowerCase();
    if (
      status.includes("paid") ||
      status.includes("on_time") ||
      status.includes("success")
    ) {
      paid += 1;
    }
    const mk = monthKeyFromDate(row.date || row.bill_date || row.payment_date);
    if (mk) months.add(mk);
  }
  const ratio = total > 0 ? paid / total : 0.5;
  return {
    utilityPaymentRegularity: Number(Math.max(0, Math.min(1, ratio)).toFixed(2)),
    monthsHistory: Math.max(1, months.size),
  };
}
