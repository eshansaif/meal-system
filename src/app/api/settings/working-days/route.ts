import { z } from "zod";
import { ok, withRoute, requireRole } from "@/lib/api";
import { getWorkingDays, setWorkingDays } from "@/lib/orgSettings";
import { writeAudit } from "@/lib/audit";

const bodySchema = z.object({
  days: z.array(z.number().int().min(0).max(6)).min(1, "Select at least one working day")
});

export const GET = withRoute(async () => {
  await requireRole("SUPER_ADMIN", "HR_ADMIN", "EMPLOYEE");
  return ok(await getWorkingDays());
});

export const PATCH = withRoute(async (req: Request) => {
  const user = await requireRole("SUPER_ADMIN", "HR_ADMIN");
  const body = bodySchema.parse(await req.json());
  const saved = await setWorkingDays(body.days);
  await writeAudit({ userId: user.id, action: "WORKING_DAYS_UPDATE", entity: "OrgSetting", newValue: saved });
  return ok(saved, "Working days updated");
});
