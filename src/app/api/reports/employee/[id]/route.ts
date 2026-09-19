import { ok, withRoute, requireRole, ApiError } from "@/lib/api";
import { getEmployeeBill } from "@/lib/reports";
import { currentSettlementMonth } from "@/lib/dates";

export const GET = withRoute(async (req: Request, { params }: { params: { id: string } }) => {
  const user = await requireRole("SUPER_ADMIN", "HR_ADMIN", "EMPLOYEE");
  if (user.role === "EMPLOYEE" && user.employee?.id !== params.id) {
    throw new ApiError("You can only view your own bill", "FORBIDDEN", 403);
  }
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month") || currentSettlementMonth();
  const bill = await getEmployeeBill(params.id, month);
  return ok(bill);
});
