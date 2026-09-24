

import PDFDocument from "pdfkit";
import {
  getDailyReport,
  getMonthlyReport,
  getDepartmentReport,
  getEmployeeBill,
} from "@/lib/reports";
import { humanDate, formatCurrency } from "@/lib/dates";
import { getLogoBuffer, FOOTER_CREDIT_LINES } from "@/lib/brand";

/* -------------------------------------------------------------------------- */
/* Document Setup                                                             */
/* -------------------------------------------------------------------------- */

function newDoc(): {
  doc: PDFKit.PDFDocument;
  done: Promise<Buffer>;
} {
  const doc = new PDFDocument({
    margin: 40,
    size: "A4",
    bufferPages: true,
    // Disable automatic orphaned blank pages where possible.
    autoFirstPage: true,
  });

  const chunks: Buffer[] = [];

  doc.on("data", (c) => chunks.push(c));

  const done = new Promise<Buffer>((resolve) =>
    doc.on("end", () => resolve(Buffer.concat(chunks)))
  );

  return { doc, done };
}

/* -------------------------------------------------------------------------- */
/* Formatting Helpers                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Converts YYYY-MM into a readable month label.
 *
 * Example:
 * 2026-09 -> September 2026
 */
function formatMonth(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);

  if (!year || !monthNumber || monthNumber < 1 || monthNumber > 12) {
    return month;
  }

  return new Date(year, monthNumber - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

/**
 * Normalizes payment status for clean PDF display.
 *
 * Examples:
 * PARTIALLY_PAID -> PARTIALLY PAID
 * PARTIALLY PAID -> PARTIALLY PAID
 * OVERPAID -> OVERPAID
 */
function formatPaymentStatus(status: string | null | undefined): string {
  if (!status) return "-";

  return String(status)
    .trim()
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .toUpperCase();
}

/* -------------------------------------------------------------------------- */
/* Header                                                                     */
/* -------------------------------------------------------------------------- */

function header(
  doc: PDFKit.PDFDocument,
  title: string,
  subtitle?: string
) {
  const startY = doc.y;

  try {
    doc.image(getLogoBuffer(), 40, startY, {
      width: 34,
    });
  } catch {
    // Logo is optional — never let a missing/corrupt asset break report generation.
  }

  const textX = 84;
  const textY = startY;

  doc
    .fontSize(18)
    .fillColor("#152257")
    .text(title, textX, textY, {
      align: "left",
      lineBreak: false,
    });

  if (subtitle) {
    doc
      .fontSize(10)
      .fillColor("#64708a")
      .text(subtitle, textX, textY + 23, {
        lineBreak: false,
      });
  }

  // Ensure the next content starts below the header.
  doc.y = textY + 40;
  doc.x = 40;

  doc
    .strokeColor("#d5d9e2")
    .lineWidth(0.7)
    .moveTo(40, doc.y)
    .lineTo(555, doc.y)
    .stroke();

  doc.y += 12;
}

/* -------------------------------------------------------------------------- */
/* Footer                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Adds the company credit line and page number to every buffered page.
 *
 * Called once, immediately before doc.end().
 */
/**
 * Adds footer to every page without triggering automatic page creation.
 */
function addFooterToAllPages(doc: PDFKit.PDFDocument) {
  const range = doc.bufferedPageRange();

  for (
    let i = range.start;
    i < range.start + range.count;
    i++
  ) {
    doc.switchToPage(i);

    const footerY = doc.page.height - 48;

    // Save current document state.
    doc.save();

    // Footer company credit.
    doc
      .fontSize(7)
      .fillColor("#8992a3")
      .text(FOOTER_CREDIT_LINES[0], 40, footerY, {
        width: 340,
        height: 10,
        lineBreak: false,
      });

    // Footer page number.
    doc
      .fontSize(7)
      .fillColor("#8992a3")
      .text(`Page ${i + 1} of ${range.count}`, 40, footerY, {
        width: doc.page.width - 80,
        height: 10,
        align: "right",
        lineBreak: false,
      });

    // Restore document state.
    doc.restore();
  }
}

/* -------------------------------------------------------------------------- */
/* Key-Value Table                                                            */
/* -------------------------------------------------------------------------- */

function kvTable(
  doc: PDFKit.PDFDocument,
  rows: [string, string | number][]
) {
  rows.forEach(([key, value]) => {
    const y = doc.y;

    doc
      .fontSize(10)
      .fillColor("#333744")
      .text(key, 40, y, {
        continued: true,
        width: 250,
        lineBreak: false,
      });

    doc
      .fillColor("#20222b")
      .text(`  ${value}`, {
        lineBreak: false,
      });
  });
}

/* -------------------------------------------------------------------------- */
/* Table Helpers                                                              */
/* -------------------------------------------------------------------------- */

type TableColumn = {
  label: string;
  width: number;
};

const PAGE_BOTTOM_LIMIT = 775;
const TABLE_HEADER_HEIGHT = 20;
const TABLE_ROW_HEIGHT = 18;

/**
 * Draws a table header at the current Y position.
 */
function drawTableHeader(
  doc: PDFKit.PDFDocument,
  columns: TableColumn[],
  startX: number,
  y: number
) {
  const tableWidth = columns.reduce((sum, c) => sum + c.width, 0);

  doc
    .rect(startX, y, tableWidth, TABLE_HEADER_HEIGHT)
    .fill("#215BE7");

  let x = startX;

  columns.forEach((column) => {
    doc
      .fontSize(8.5)
      .fillColor("#ffffff")
      .text(column.label, x + 4, y + 6, {
        width: column.width - 8,
        lineBreak: false,
      });

    x += column.width;
  });
}

/**
 * Professional table renderer.
 *
 * Features:
 * - Prevents rows from entering the footer area.
 * - Repeats the table header on new pages.
 * - Prevents text wrapping inside fixed-height rows.
 * - Keeps document Y position synchronized.
 */
function simpleTable(
  doc: PDFKit.PDFDocument,
  columns: TableColumn[],
  rows: (string | number)[][]
) {
  const startX = 40;
  const tableWidth = columns.reduce((sum, c) => sum + c.width, 0);

  let y = doc.y + 6;

  function startNewPage() {
    doc.addPage();
    y = 40;

    drawTableHeader(doc, columns, startX, y);

    y += TABLE_HEADER_HEIGHT;
  }

  // Draw initial header.
  drawTableHeader(doc, columns, startX, y);
  y += TABLE_HEADER_HEIGHT;

  rows.forEach((row, rowIndex) => {
    // Reserve space for the footer.
    if (y + TABLE_ROW_HEIGHT > PAGE_BOTTOM_LIMIT) {
      startNewPage();
    }

    // Alternating row background.
    if (rowIndex % 2 === 0) {
      doc
        .rect(startX, y, tableWidth, TABLE_ROW_HEIGHT)
        .fill("#f7f8fa");
    }

    let x = startX;

    row.forEach((cell, columnIndex) => {
      const column = columns[columnIndex];

      // Slightly smaller font for narrow/status columns.
      const isStatusColumn =
        column.label.toLowerCase() === "status";

      doc
        .fontSize(isStatusColumn ? 7.5 : 8.5)
        .fillColor("#20222b")
        .text(String(cell), x + 4, y + 5, {
          width: column.width - 8,
          lineBreak: false,
        });

      x += column.width;
    });

    y += TABLE_ROW_HEIGHT;
  });

  doc.y = y + 4;
}

/* -------------------------------------------------------------------------- */
/* Monthly Summary                                                            */
/* -------------------------------------------------------------------------- */

function drawMonthlySummary(
  doc: PDFKit.PDFDocument,
  totals: {
    requested: number;
    served: number;
    mealCost: number;
    paid: number;
    outstanding: number;
  }
) {
  const x = 40;
  const width = 515;
  const height = 52;

  let y = doc.y + 8;

  // If insufficient room remains, place summary on a new page.
  if (y + height > PAGE_BOTTOM_LIMIT) {
    doc.addPage();
    y = 40;
  }

  // Background.
  doc
    .roundedRect(x, y, width, height, 4)
    .fill("#f1f5ff");

  // Border.
  doc
    .roundedRect(x, y, width, height, 4)
    .lineWidth(0.5)
    .strokeColor("#cbd5e1")
    .stroke();

  // First summary line.
  doc
    .fontSize(9)
    .fillColor("#152257")
    .text(
      `TOTAL — Requested: ${totals.requested}   |   Served: ${totals.served}`,
      x + 10,
      y + 10,
      {
        width: width - 20,
        lineBreak: false,
      }
    );

  // Second summary line.
  doc
    .fontSize(9)
    .fillColor("#152257")
    .text(
      `Meal Cost: ${formatCurrency(totals.mealCost)}   |   Paid: ${formatCurrency(totals.paid)}   |   Outstanding: ${formatCurrency(totals.outstanding)}`,
      x + 10,
      y + 29,
      {
        width: width - 20,
        lineBreak: false,
      }
    );

  doc.y = y + height + 10;
}

/* -------------------------------------------------------------------------- */
/* Daily Meal Report                                                          */
/* -------------------------------------------------------------------------- */

export async function buildDailyPdf(
  mealTypeId: string,
  date: Date
): Promise<Buffer> {
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
    ["Collected Today", formatCurrency(report.collected)],
  ]);

  addFooterToAllPages(doc);

  doc.end();

  return done;
}

/* -------------------------------------------------------------------------- */
/* Monthly Meal & Cost Report                                                 */
/* -------------------------------------------------------------------------- */

export async function buildMonthlyPdf(
  month: string,
  departmentId?: string
): Promise<Buffer> {
  const { rows, totals } = await getMonthlyReport(
    month,
    departmentId
  );

  const { doc, done } = newDoc();

  header(
    doc,
    "Monthly Meal & Cost Report",
    formatMonth(month)
  );

  simpleTable(
    doc,
    [
      { label: "ID", width: 50 },
      { label: "Name", width: 90 },
      { label: "Dept", width: 60 },
      { label: "Req", width: 27 },
      { label: "Served", width: 37 },
      { label: "Cost", width: 50 },
      { label: "Paid", width: 50 },
      { label: "Outstanding", width: 66 },
      { label: "Status", width: 85 },
    ],
    rows.map((r) => [
      r.employeeCode,
      r.name,
      r.department,
      r.requested,
      r.served,
      r.mealCost.toFixed(2),
      r.paid.toFixed(2),
      r.outstanding.toFixed(2),
      formatPaymentStatus(r.paymentStatus),
    ])
  );

  drawMonthlySummary(doc, totals);

  addFooterToAllPages(doc);

  doc.end();

  return done;
}

/* -------------------------------------------------------------------------- */
/* Department-wise Meal & Cost Report                                         */
/* -------------------------------------------------------------------------- */

export async function buildDepartmentPdf(
  month: string
): Promise<Buffer> {
  const report = await getDepartmentReport(month);

  const { doc, done } = newDoc();

  header(
    doc,
    "Department-wise Meal & Cost Report",
    formatMonth(month)
  );

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
      { label: "Outstanding", width: 65 },
    ],
    report.map((r) => [
      r.department,
      r.totalEmployees,
      r.requested,
      r.served,
      r.notServed,
      r.mealCost.toFixed(2),
      r.paid.toFixed(2),
      r.outstanding.toFixed(2),
    ])
  );

  addFooterToAllPages(doc);

  doc.end();

  return done;
}

/* -------------------------------------------------------------------------- */
/* Employee Meal & Payment Statement                                          */
/* -------------------------------------------------------------------------- */

export async function buildEmployeeBillPdf(
  employeeId: string,
  month: string
): Promise<Buffer> {
  const bill = await getEmployeeBill(employeeId, month);

  const { doc, done } = newDoc();

  header(
    doc,
    `${bill.employee.name} — Meal & Payment Statement`,
    `${bill.employee.employeeCode} · ${bill.employee.department.name} · ${formatMonth(month)}`
  );

  /* ------------------------------ Meal History ---------------------------- */

  doc
    .fontSize(11)
    .fillColor("#152257")
    .text("Meal History", 40, doc.y + 4, {
      lineBreak: false,
    });

  simpleTable(
    doc,
    [
      { label: "Date", width: 80 },
      { label: "Meal", width: 70 },
      { label: "Status", width: 80 },
      { label: "Unit Price", width: 80 },
      { label: "Charge", width: 80 },
    ],
    bill.consumptions.map((c) => [
      humanDate(c.date),
      c.mealType.name,
      c.servingStatus,
      c.unitPriceApplied
        ? Number(c.unitPriceApplied).toFixed(2)
        : "-",
      Number(c.chargeAmount).toFixed(2),
    ])
  );

  /* ----------------------------- Payment History -------------------------- */

  doc
    .fontSize(11)
    .fillColor("#152257")
    .text("Payment History", 40, doc.y + 4, {
      lineBreak: false,
    });

  simpleTable(
    doc,
    [
      { label: "Date", width: 80 },
      { label: "Amount", width: 70 },
      { label: "Method", width: 100 },
      { label: "Reference", width: 90 },
      { label: "Remarks", width: 100 },
    ],
    bill.payments.map((p) => [
      humanDate(p.paymentDate),
      Number(p.amount).toFixed(2),
      p.method,
      p.referenceNo || "-",
      p.remarks || "-",
    ])
  );

  /* -------------------------------- Summary ------------------------------- */

  if (bill.settlement) {
    const s = bill.settlement;

    doc
      .fontSize(11)
      .fillColor("#152257")
      .text("Summary", 40, doc.y + 4, {
        lineBreak: false,
      });

    kvTable(doc, [
      ["Meals Served", s.mealsServed],
      ["Meal Cost", formatCurrency(s.mealCost)],
      [
        "Previous Outstanding",
        formatCurrency(s.previousOutstanding),
      ],
      [
        "Paid This Month",
        formatCurrency(s.paymentsThisMonth),
      ],
      ["Outstanding", formatCurrency(s.outstanding)],
      ["Credit", formatCurrency(s.credit)],
      ["Status", formatPaymentStatus(s.paymentStatus)],
    ]);
  }

  addFooterToAllPages(doc);

  doc.end();

  return done;
}