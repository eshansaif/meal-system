import ExcelJS from "exceljs";
import { getDailyReport, getMonthlyReport, getDepartmentReport, getEmployeeBill } from "@/lib/reports";
import { humanDate, formatCurrency } from "@/lib/dates";

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

export async function buildDailyExcel(mealTypeId: string, date: Date): Promise<Buffer> {
  const report = await getDailyReport(mealTypeId, date);
  const wb = new ExcelJS.Workbook();
  wb.creator = "Meal Management System";
  const ws = wb.addWorksheet("Daily Report");

  ws.mergeCells("A1:B1");
  ws.getCell("A1").value = `Daily Meal Report — ${humanDate(report.date)}`;
  ws.getCell("A1").font = { bold: true, size: 14 };

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
  autoWidth(ws);

  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function buildMonthlyExcel(month: string, departmentId?: string): Promise<Buffer> {
  const { rows, totals } = await getMonthlyReport(month, departmentId);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(`Monthly ${month}`);

  ws.mergeCells("A1:L1");
  ws.getCell("A1").value = `Monthly Meal & Cost Report — ${month}`;
  ws.getCell("A1").font = { bold: true, size: 14 };
  ws.addRow([]);

  const header = ws.addRow([
    "Emp ID", "Name", "Department", "Eligible Days", "Requested", "Served",
    "Not Served", "Not Taken", "No Response", "Meal Cost", "Paid", "Outstanding", "Credit", "Status"
  ]);
  styleHeaderRow(header);

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
  autoWidth(ws);
  ws.autoFilter = { from: "A3", to: "N3" };

  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function buildDepartmentExcel(month: string): Promise<Buffer> {
  const report = await getDepartmentReport(month);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(`Department ${month}`);

  ws.mergeCells("A1:H1");
  ws.getCell("A1").value = `Department-wise Meal & Cost Report — ${month}`;
  ws.getCell("A1").font = { bold: true, size: 14 };
  ws.addRow([]);

  const header = ws.addRow([
    "Department", "Total Employees", "Requested", "Served", "Not Served", "Meal Cost", "Paid", "Outstanding", "Consumption %"
  ]);
  styleHeaderRow(header);
  report.forEach((r) => {
    ws.addRow([r.department, r.totalEmployees, r.requested, r.served, r.notServed, r.mealCost, r.paid, r.outstanding, r.consumptionPercentage]);
  });
  autoWidth(ws);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function buildEmployeeBillExcel(employeeId: string, month: string): Promise<Buffer> {
  const bill = await getEmployeeBill(employeeId, month);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Meal History");

  ws.mergeCells("A1:E1");
  ws.getCell("A1").value = `${bill.employee.name} (${bill.employee.employeeCode}) — ${bill.employee.department.name}`;
  ws.getCell("A1").font = { bold: true, size: 14 };
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

  autoWidth(ws);
  return Buffer.from(await wb.xlsx.writeBuffer());
}
