import PDFDocument from "pdfkit";
import { getDailyReport, getMonthlyReport, getDepartmentReport, getEmployeeBill } from "@/lib/reports";
import { humanDate, formatCurrency } from "@/lib/dates";

function newDoc(): { doc: PDFKit.PDFDocument; done: Promise<Buffer> } {
  const doc = new PDFDocument({ margin: 40, size: "A4" });
  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));
  return { doc, done };
}

function header(doc: PDFKit.PDFDocument, title: string, subtitle?: string) {
  doc.fontSize(18).fillColor("#152257").text(title, { align: "left" });
  if (subtitle) doc.fontSize(10).fillColor("#64708a").text(subtitle);
  doc.moveDown(1);
  doc.strokeColor("#d5d9e2").moveTo(40, doc.y).lineTo(555, doc.y).stroke();
  doc.moveDown(0.5);
}

function kvTable(doc: PDFKit.PDFDocument, rows: [string, string | number][]) {
  rows.forEach(([k, v]) => {
    doc.fontSize(10).fillColor("#333744").text(k, 40, doc.y, { continued: true, width: 250 });
    doc.fillColor("#20222b").text(`  ${v}`);
  });
}

function simpleTable(doc: PDFKit.PDFDocument, columns: { label: string; width: number }[], rows: (string | number)[][]) {
  const startX = 40;
  let y = doc.y + 6;
  doc.fontSize(9).fillColor("#ffffff");
  doc.rect(startX, y, columns.reduce((s, c) => s + c.width, 0), 20).fill("#215BE7");
  let x = startX;
  columns.forEach((c) => {
    doc.fillColor("#ffffff").text(c.label, x + 4, y + 6, { width: c.width - 8 });
    x += c.width;
  });
  y += 20;
  doc.fillColor("#20222b");

  rows.forEach((row, i) => {
    if (y > 760) {
      doc.addPage();
      y = 40;
    }
    if (i % 2 === 0) {
      doc.rect(startX, y, columns.reduce((s, c) => s + c.width, 0), 18).fill("#f7f8fa");
      doc.fillColor("#20222b");
    }
    let cx = startX;
    row.forEach((cell, ci) => {
      doc.fontSize(8.5).text(String(cell), cx + 4, y + 5, { width: columns[ci].width - 8 });
      cx += columns[ci].width;
    });
    y += 18;
  });
  doc.y = y + 10;
}

export async function buildDailyPdf(mealTypeId: string, date: Date): Promise<Buffer> {
  const report = await getDailyReport(mealTypeId, date);
  const { doc, done } = newDoc();
  header(doc, "Daily Meal Report", humanDate(report.date));
  kvTable(doc, [
    ["Active Employees", report.activeEmployees],
    ["Requested (Taking)", report.requested],
    ["Not Requested", report.notRequested],
    ["No Response", report.noResponse],
    ["Expected Meals", report.expectedMeals],
    ["Served", report.served],
    ["Not Served", report.notServed],
    ["Extra", report.extra],
    ["Meal Cost", formatCurrency(report.mealCost)],
    ["Collected Today", formatCurrency(report.collected)]
  ]);
  doc.end();
  return done;
}

export async function buildMonthlyPdf(month: string, departmentId?: string): Promise<Buffer> {
  const { rows, totals } = await getMonthlyReport(month, departmentId);
  const { doc, done } = newDoc();
  header(doc, "Monthly Meal & Cost Report", month);
  simpleTable(
    doc,
    [
      { label: "ID", width: 55 },
      { label: "Name", width: 100 },
      { label: "Dept", width: 70 },
      { label: "Req", width: 30 },
      { label: "Served", width: 40 },
      { label: "Cost", width: 55 },
      { label: "Paid", width: 55 },
      { label: "Outstanding", width: 65 },
      { label: "Status", width: 45 }
    ],
    rows.map((r) => [r.employeeCode, r.name, r.department, r.requested, r.served, r.mealCost.toFixed(2), r.paid.toFixed(2), r.outstanding.toFixed(2), r.paymentStatus])
  );
  doc.moveDown(0.5);
  doc.fontSize(10).fillColor("#152257").text(
    `TOTAL — Requested: ${totals.requested}  Served: ${totals.served}  Meal Cost: ${formatCurrency(totals.mealCost)}  Paid: ${formatCurrency(totals.paid)}  Outstanding: ${formatCurrency(totals.outstanding)}`
  );
  doc.end();
  return done;
}

export async function buildDepartmentPdf(month: string): Promise<Buffer> {
  const report = await getDepartmentReport(month);
  const { doc, done } = newDoc();
  header(doc, "Department-wise Meal & Cost Report", month);
  simpleTable(
    doc,
    [
      { label: "Department", width: 100 },
      { label: "Employees", width: 55 },
      { label: "Requested", width: 55 },
      { label: "Served", width: 45 },
      { label: "Not Served", width: 60 },
      { label: "Meal Cost", width: 60 },
      { label: "Paid", width: 55 },
      { label: "Outstanding", width: 65 }
    ],
    report.map((r) => [r.department, r.totalEmployees, r.requested, r.served, r.notServed, r.mealCost.toFixed(2), r.paid.toFixed(2), r.outstanding.toFixed(2)])
  );
  doc.end();
  return done;
}

export async function buildEmployeeBillPdf(employeeId: string, month: string): Promise<Buffer> {
  const bill = await getEmployeeBill(employeeId, month);
  const { doc, done } = newDoc();
  header(doc, `${bill.employee.name} — Meal & Payment Statement`, `${bill.employee.employeeCode} · ${bill.employee.department.name} · ${month}`);

  doc.fontSize(11).fillColor("#152257").text("Meal History", 40, doc.y + 4);
  simpleTable(
    doc,
    [
      { label: "Date", width: 80 },
      { label: "Meal", width: 70 },
      { label: "Status", width: 80 },
      { label: "Unit Price", width: 80 },
      { label: "Charge", width: 80 }
    ],
    bill.consumptions.map((c) => [humanDate(c.date), c.mealType.name, c.servingStatus, c.unitPriceApplied ? Number(c.unitPriceApplied).toFixed(2) : "-", Number(c.chargeAmount).toFixed(2)])
  );

  doc.moveDown(0.5);
  doc.fontSize(11).fillColor("#152257").text("Payment History", 40, doc.y + 4);
  simpleTable(
    doc,
    [
      { label: "Date", width: 80 },
      { label: "Amount", width: 70 },
      { label: "Method", width: 100 },
      { label: "Reference", width: 90 },
      { label: "Remarks", width: 100 }
    ],
    bill.payments.map((p) => [humanDate(p.paymentDate), Number(p.amount).toFixed(2), p.method, p.referenceNo || "-", p.remarks || "-"])
  );

  if (bill.settlement) {
    const s = bill.settlement;
    doc.moveDown(0.8);
    doc.fontSize(11).fillColor("#152257").text("Summary", 40, doc.y + 4);
    kvTable(doc, [
      ["Meals Served", s.mealsServed],
      ["Meal Cost", formatCurrency(s.mealCost)],
      ["Previous Outstanding", formatCurrency(s.previousOutstanding)],
      ["Paid This Month", formatCurrency(s.paymentsThisMonth)],
      ["Outstanding", formatCurrency(s.outstanding)],
      ["Credit", formatCurrency(s.credit)],
      ["Status", s.paymentStatus]
    ]);
  }

  doc.end();
  return done;
}
