import { prisma } from "@/lib/db";
import { ok, withRoute, requireRole } from "@/lib/api";
import { Prisma } from "@prisma/client";

/** GET /api/audit?search=&action=&entity=&page=&pageSize= — Super Admin only. */
export const GET = withRoute(async (req: Request) => {
  await requireRole("SUPER_ADMIN");
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim();
  const action = searchParams.get("action") || undefined;
  const entity = searchParams.get("entity") || undefined;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = Math.min(100, Math.max(10, parseInt(searchParams.get("pageSize") || "25", 10)));

  const where: Prisma.AuditLogWhereInput = {
    ...(action ? { action } : {}),
    ...(entity ? { entity } : {}),
    ...(search ? { OR: [{ entityId: { contains: search, mode: "insensitive" } }, { user: { email: { contains: search, mode: "insensitive" } } }] } : {})
  };

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { email: true, role: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize
    })
  ]);

  return ok({ logs, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
});
