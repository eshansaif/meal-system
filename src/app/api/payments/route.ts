import { prisma } from "@/lib/db";
import { ok, withRoute, requireRole, ApiError } from "@/lib/api";
import { paymentCreateSchema } from "@/lib/validation";
import { computeAndSaveSettlement } from "@/lib/settlement";
import { writeAudit } from "@/lib/audit";
import { Prisma } from "@prisma/client";

/** GET /api/payments?search=&employeeId=&settlementMonth=&method=&status=&from=&to=&page=&pageSize= */
export const GET = withRoute(async (req: Request) => {
  const user = await requireRole("SUPER_ADMIN", "HR_ADMIN", "EMPLOYEE");
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim();
  let employeeId = searchParams.get("employeeId") || undefined;
  const settlementMonth = searchParams.get("settlementMonth") || undefined;
  const method = searchParams.get("method") || undefined;
  const status = searchParams.get("status") || undefined;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = Math.min(100, Math.max(10, parseInt(searchParams.get("pageSize") || "25", 10)));

  // Employees may only ever see their own payments, regardless of query params.
  if (user.role === "EMPLOYEE") {
    if (!user.employee) throw new ApiError("Not an employee account", "NOT_AN_EMPLOYEE", 400);
    employeeId = user.employee.id;
  }

  const where: Prisma.PaymentWhereInput = {
    ...(employeeId ? { employeeId } : {}),
    ...(settlementMonth ? { settlementMonth } : {}),
    ...(method ? { method: method as any } : {}),
    ...(status ? { status: status as any } : { status: undefined }),
    ...(search
      ? {
          OR: [
            { referenceNo: { contains: search, mode: "insensitive" } },
            { employee: { name: { contains: search, mode: "insensitive" } } },
            { employee: { employeeCode: { contains: search, mode: "insensitive" } } }
          ]
        }
      : {})
  };

  const [total, payments] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      include: { employee: { select: { name: true, employeeCode: true, department: { select: { name: true } } } } },
      orderBy: { paymentDate: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize
    })
  ]);

  return ok({ payments, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
});

export const POST = withRoute(async (req: Request) => {
  const user = await requireRole("SUPER_ADMIN", "HR_ADMIN");
  const body = paymentCreateSchema.parse(await req.json());

  const employee = await prisma.employee.findUnique({ where: { id: body.employeeId } });
  if (!employee) throw new ApiError("Employee not found", "NOT_FOUND", 404);

  const payment = await prisma.payment.create({
    data: {
      employeeId: body.employeeId,
      paymentDate: body.paymentDate,
      amount: body.amount,
      method: body.method,
      referenceNo: body.referenceNo,
      settlementMonth: body.settlementMonth,
      remarks: body.remarks,
      recordedByUserId: user.id
    }
  });

  await writeAudit({
    userId: user.id,
    action: "PAYMENT_CREATE",
    entity: "Payment",
    entityId: payment.id,
    newValue: payment
  });

  await computeAndSaveSettlement(body.employeeId, body.settlementMonth);

  return ok(payment, "Payment recorded", 201);
});
