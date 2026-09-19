import { requireRole, ApiError } from "@/lib/api";
import { normalizeDate, todayInOrgTz, currentSettlementMonth } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { buildDailyPdf, buildMonthlyPdf, buildDepartmentPdf, buildEmployeeBillPdf } from "@/lib/export/pdf";
import { writeAudit } from "@/lib/audit";

/** GET /api/export/pdf?report=daily|monthly|department|employee-bill&... */
export async function GET(req: Request) {
  try {
    const user = await requireRole("SUPER_ADMIN", "HR_ADMIN", "EMPLOYEE");
    const { searchParams } = new URL(req.url);
    const report = searchParams.get("report");
    const month = searchParams.get("month") || currentSettlementMonth();

    let buffer: Buffer;
    let filename: string;

    if (report === "daily") {
      if (user.role === "EMPLOYEE") throw new ApiError("Not permitted", "FORBIDDEN", 403);
      const date = searchParams.get("date") ? normalizeDate(searchParams.get("date")!) : todayInOrgTz();
      const mealTypeId = searchParams.get("mealTypeId") || (await prisma.mealType.findFirstOrThrow({ where: { code: "LUNCH" } })).id;
      buffer = await buildDailyPdf(mealTypeId, date);
      filename = `daily-report-${date.toISOString().slice(0, 10)}.pdf`;
    } else if (report === "monthly") {
      if (user.role === "EMPLOYEE") throw new ApiError("Not permitted", "FORBIDDEN", 403);
      buffer = await buildMonthlyPdf(month, searchParams.get("departmentId") || undefined);
      filename = `monthly-report-${month}.pdf`;
    } else if (report === "department") {
      if (user.role === "EMPLOYEE") throw new ApiError("Not permitted", "FORBIDDEN", 403);
      buffer = await buildDepartmentPdf(month);
      filename = `department-report-${month}.pdf`;
    } else if (report === "employee-bill") {
      const employeeId = searchParams.get("employeeId") || user.employee?.id;
      if (!employeeId) throw new ApiError("employeeId is required", "VALIDATION_ERROR", 422);
      if (user.role === "EMPLOYEE" && user.employee?.id !== employeeId) {
        throw new ApiError("You can only export your own bill", "FORBIDDEN", 403);
      }
      buffer = await buildEmployeeBillPdf(employeeId, month);
      filename = `bill-${employeeId}-${month}.pdf`;
    } else {
      throw new ApiError("Unknown report type", "VALIDATION_ERROR", 422);
    }

    await writeAudit({ userId: user.id, action: "REPORT_EXPORT", entity: "Report", reason: `${report} (pdf)` });

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`
      }
    });
  } catch (err: any) {
    if (err instanceof ApiError) {
      return Response.json({ success: false, message: err.message, code: err.code }, { status: err.status });
    }
    console.error(err);
    return Response.json({ success: false, message: "Export failed", code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
