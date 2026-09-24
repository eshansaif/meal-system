import ExcelJS from "exceljs";
import { getDailyReport, getMonthlyReport, getDepartmentReport, getEmployeeBill } from "@/lib/reports";
import { humanDate, formatCurrency } from "@/lib/dates";
import { getLogoBuffer, FOOTER_CREDIT_LINES, COMPANY_NAME } from "@/lib/brand";

function styleHeaderRow(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF215BE7" } };
  row.alignment = { vertical: "middle", horizontal: "center" };
  row.height = 22;
}

function autoWidth(ws: ExcelJS.Worksheet) {
  ws.columns.forEach((col) => {
    let max = 10;
    col.eachCell?.({ includeEmpty: true }, (cell) => {
      const len = cell.value ? String(cell.value).length : 0;
      if (len > max) max = len;
    });
    col.width = Math.min(max + 3, 40);
  });
}

/**
 * Stamps the company logo + name in row 1 and the report title in row 3,
 * leaving row 2 as a spacer. Returns the row number the caller should treat
 * as "row 1" for everything that follows (always 3) — callers add their own
 * spacer row after the title, same as before, so their column-header row
 * lands on row 5.
 */
function addBrandedTitle(wb: ExcelJS.Workbook, ws: ExcelJS.Worksheet, titleText: string, mergeToCol: string): void {
  try {
    const imageId = wb.addImage({
      buffer: getLogoBuffer() as any,
      extension: "png",
    });

    ws.addImage(imageId, {
      tl: { col: 0, row: 0 },
      ext: { width: 30, height: 30 },
    });
  } catch {
    // Logo is optional — never let a missing/corrupt asset break report generation.
  }
  ws.getRow(1).height = 24;
  ws.mergeCells(`B1:${mergeToCol}1`);
  ws.getCell("B1").value = COMPANY_NAME;
  ws.getCell("B1").font = { bold: true, size: 11, color: { argb: "FF565E6D" } };
  ws.getCell("B1").alignment = { vertical: "middle" };
  ws.addRow([]);
  ws.mergeCells(`A3:${mergeToCol}3`);
  ws.getCell("A3").value = titleText;
  ws.getCell("A3").font = { bold: true, size: 14 };
}

/** Adds the credit line as the last row of the sheet, in faint small italic text. */
function addFooter(ws: ExcelJS.Worksheet, mergeToCol: string): void {
  ws.addRow([]);
  const row = ws.addRow([FOOTER_CREDIT_LINES[0]]);
  ws.mergeCells(`A${row.number}:${mergeToCol}${row.number}`);
  row.getCell(1).font = { italic: true, size: 8, color: { argb: "FF8992A3" } };
}

export async function buildDailyExcel(mealTypeId: string, date: Date): Promise<Buffer> {
  const report = await getDailyReport(mealTypeId, date);
  const wb = new ExcelJS.Workbook();
  wb.creator = COMPANY_NAME;
  const ws = wb.addWorksheet("Daily Report");

  addBrandedTitle(wb, ws, `Daily Meal Report — ${humanDate(report.date)}`, "B");

  const entries: [string, string | number][] = [
    ["Active Employees", report.activeEmployees],
    ["Requested (Taking)", report.requested],
    ["Not Requested", report.notRequested],
    ["No Response", report.noResponse],
    ["Expected Meals", report.expectedMeals],
    ["Served", report.served],
    ["Not Served", report.notServed],
    ["Extra", report.extra],
    ["Meal Cost", formatCurrency(report.mealCost)],
    ["Collected Today", formatCurrency(report.collected)],
    ["Holiday", report.isHoliday ? "Yes" : "No"]
  ];
  ws.addRow([]);
  const headerRow = ws.addRow(["Metric", "Value"]);
  styleHeaderRow(headerRow);
  entries.forEach(([k, v]) => ws.addRow([k, v]));
  addFooter(ws, "B");
  autoWidth(ws);

  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function buildMonthlyExcel(month: string, departmentId?: string): Promise<Buffer> {
  const { rows, totals } = await getMonthlyReport(month, departmentId);
  const wb = new ExcelJS.Workbook();
  wb.creator = COMPANY_NAME;
  const ws = wb.addWorksheet(`Monthly ${month}`);

  addBrandedTitle(wb, ws, `Monthly Meal & Cost Report — ${month}`, "N");
  ws.addRow([]);

  const header = ws.addRow([
    "Emp ID", "Name", "Department", "Eligible Days", "Requested", "Served",
    "Not Served", "Not Taken", "No Response", "Meal Cost", "Paid", "Outstanding", "Credit", "Status"
  ]);
  styleHeaderRow(header);
  const headerRowNumber = header.number;

  rows.forEach((r) => {
    ws.addRow([
      r.employeeCode, r.name, r.department, r.eligibleDays, r.requested, r.served,
      r.notServed, r.notTaken, r.noResponse, r.mealCost, r.paid, r.outstanding, r.credit, r.paymentStatus
    ]);
  });

  const totalsRow = ws.addRow([
    "", "", "TOTAL", "", totals.requested, totals.served, totals.notServed, "", "",
    totals.mealCost, totals.paid, totals.outstanding, "", ""
  ]);
  totalsRow.font = { bold: true };

  ["J", "K", "L", "M"].forEach((col) => {
    ws.getColumn(col).numFmt = "#,##0.00";
  });
  addFooter(ws, "N");
  autoWidth(ws);
  ws.autoFilter = { from: `A${headerRowNumber}`, to: `N${headerRowNumber}` };

  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function buildDepartmentExcel(month: string): Promise<Buffer> {
  const report = await getDepartmentReport(month);
  const wb = new ExcelJS.Workbook();
  wb.creator = COMPANY_NAME;
  const ws = wb.addWorksheet(`Department ${month}`);

  addBrandedTitle(wb, ws, `Department-wise Meal & Cost Report — ${month}`, "I");
  ws.addRow([]);

  const header = ws.addRow([
    "Department", "Total Employees", "Requested", "Served", "Not Served", "Meal Cost", "Paid", "Outstanding", "Consumption %"
  ]);
  styleHeaderRow(header);
  report.forEach((r) => {
    ws.addRow([r.department, r.totalEmployees, r.requested, r.served, r.notServed, r.mealCost, r.paid, r.outstanding, r.consumptionPercentage]);
  });
  addFooter(ws, "I");
  autoWidth(ws);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function buildEmployeeBillExcel(employeeId: string, month: string): Promise<Buffer> {
  const bill = await getEmployeeBill(employeeId, month);
  const wb = new ExcelJS.Workbook();
  wb.creator = COMPANY_NAME;
  const ws = wb.addWorksheet("Meal History");

  addBrandedTitle(wb, ws, `${bill.employee.name} (${bill.employee.employeeCode}) — ${bill.employee.department.name}`, "E");
  ws.addRow([`Settlement Month: ${month}`]);
  ws.addRow([]);

  const mealHeader = ws.addRow(["Date", "Meal", "Serving Status", "Unit Price", "Charge"]);
  styleHeaderRow(mealHeader);
  bill.consumptions.forEach((c) => {
    ws.addRow([humanDate(c.date), c.mealType.name, c.servingStatus, c.unitPriceApplied ? Number(c.unitPriceApplied) : "", Number(c.chargeAmount)]);
  });

  ws.addRow([]);
  const paymentHeader = ws.addRow(["Payment Date", "Amount", "Method", "Reference", "Remarks"]);
  styleHeaderRow(paymentHeader);
  bill.payments.forEach((p) => {
    ws.addRow([humanDate(p.paymentDate), Number(p.amount), p.method, p.referenceNo || "", p.remarks || ""]);
  });

  ws.addRow([]);
  if (bill.settlement) {
    const s = bill.settlement;
    const summaryHeader = ws.addRow(["Meals Served", "Meal Cost", "Prev. Outstanding", "Paid This Month", "Outstanding", "Credit", "Status"]);
    styleHeaderRow(summaryHeader);
    ws.addRow([s.mealsServed, Number(s.mealCost), Number(s.previousOutstanding), Number(s.paymentsThisMonth), Number(s.outstanding), Number(s.credit), s.paymentStatus]);
  }

  addFooter(ws, "E");
  autoWidth(ws);
  return Buffer.from(await wb.xlsx.writeBuffer());
}
