// import { prisma } from "@/lib/db";
// import { ok, withRoute, requireRole, ApiError } from "@/lib/api";
// import { employeeCreateSchema } from "@/lib/validation";
// import { hashPassword } from "@/lib/auth";
// import { writeAudit } from "@/lib/audit";
// import { Prisma } from "@prisma/client";

// /** GET /api/employees?search=&departmentId=&status=&page=&pageSize= */
// export const GET = withRoute(async (req: Request) => {
//   await requireRole("SUPER_ADMIN", "HR_ADMIN");
//   const { searchParams } = new URL(req.url);
//   const search = searchParams.get("search")?.trim();
//   const departmentId = searchParams.get("departmentId") || undefined;
//   const status = searchParams.get("status") || undefined;
//   const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
//   const pageSize = Math.min(100, Math.max(10, parseInt(searchParams.get("pageSize") || "25", 10)));

//   const where: Prisma.EmployeeWhereInput = {
//     ...(departmentId ? { departmentId } : {}),
//     ...(status ? { status: status as any } : {}),
//     ...(search
//       ? {
//           OR: [
//             { name: { contains: search, mode: "insensitive" } },
//             { email: { contains: search, mode: "insensitive" } },
//             { employeeCode: { contains: search, mode: "insensitive" } }
//           ]
//         }
//       : {})
//   };

//   const [total, employees] = await Promise.all([
//     prisma.employee.count({ where }),
//     prisma.employee.findMany({
//       where,
//       include: { department: true, user: { select: { email: true, role: true, isActive: true } } },
//       orderBy: { name: "asc" },
//       skip: (page - 1) * pageSize,
//       take: pageSize
//     })
//   ]);

//   return ok({ employees, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
// });

// /** Generates the next sequential employee code, e.g. EMP-0001. */
// async function nextEmployeeCode() {
//   const last = await prisma.employee.findFirst({ orderBy: { createdAt: "desc" }, select: { employeeCode: true } });
//   const lastNum = last ? parseInt(last.employeeCode.replace(/\D/g, ""), 10) || 0 : 0;
//   return `EMP-${String(lastNum + 1).padStart(4, "0")}`;
// }

// export const POST = withRoute(async (req: Request) => {
//   const actingUser = await requireRole("SUPER_ADMIN", "HR_ADMIN");
//   const body = employeeCreateSchema.parse(await req.json());

//   const existing = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
//   if (existing) throw new ApiError("An account with this email already exists", "DUPLICATE_EMAIL", 409);

//   // Only Super Admin can create Admin/HR/Catering accounts; HR can only create Employee accounts.
//   if (body.role !== "EMPLOYEE" && actingUser.role !== "SUPER_ADMIN") {
//     throw new ApiError("Only a Super Admin can create non-employee accounts", "FORBIDDEN", 403);
//   }

//   const passwordHash = await hashPassword(body.initialPassword);
//   const employeeCode = await nextEmployeeCode();

//   const created = await prisma.user.create({
//     data: {
//       email: body.email.toLowerCase(),
//       passwordHash,
//       role: body.role,
//       employee: {
//         create: {
//           employeeCode,
//           name: body.name,
//           email: body.email.toLowerCase(),
//           phone: body.phone,
//           designation: body.designation,
//           departmentId: body.departmentId,
//           joiningDate: body.joiningDate
//         }
//       }
//     },
//     include: { employee: { include: { department: true } } }
//   });

//   await writeAudit({
//     userId: actingUser.id,
//     action: "EMPLOYEE_CREATE",
//     entity: "Employee",
//     entityId: created.employee?.id,
//     newValue: { employeeCode, name: body.name, email: body.email, role: body.role }
//   });

//   return ok(created.employee, "Employee created", 201);
// });



import { prisma } from "@/lib/db";
import { ok, withRoute, requireRole, ApiError } from "@/lib/api";
import { employeeCreateSchema } from "@/lib/validation";
import { hashPassword } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { getCurrentDueByEmployee } from "@/lib/settlement";
import { Prisma } from "@prisma/client";

/** GET /api/employees?search=&departmentId=&status=&page=&pageSize=&includeDue= */
export const GET = withRoute(async (req: Request) => {
  await requireRole("SUPER_ADMIN", "HR_ADMIN");
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim();
  const departmentId = searchParams.get("departmentId") || undefined;
  const status = searchParams.get("status") || undefined;
  // Opt-in only — computing every employee's current due involves an extra
  // query, and most callers (e.g. the plain Employees list) don't need it.
  const includeDue = searchParams.get("includeDue") === "true";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = Math.min(100, Math.max(10, parseInt(searchParams.get("pageSize") || "25", 10)));

  const where: Prisma.EmployeeWhereInput = {
    ...(departmentId ? { departmentId } : {}),
    ...(status ? { status: status as any } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { employeeCode: { contains: search, mode: "insensitive" } }
          ]
        }
      : {})
  };

  const [total, employeesRaw, dueMap] = await Promise.all([
    prisma.employee.count({ where }),
    prisma.employee.findMany({
      where,
      include: { department: true, user: { select: { email: true, role: true, isActive: true } } },
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    includeDue ? getCurrentDueByEmployee() : Promise.resolve(null)
  ]);

  const employees = dueMap
    ? employeesRaw.map((e) => {
        const due = dueMap.get(e.id);
        return { ...e, currentOutstanding: due?.outstanding ?? 0, currentCredit: due?.credit ?? 0 };
      })
    : employeesRaw;

  return ok({ employees, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
});

/** Generates the next sequential employee code, e.g. EMP-0001. */
async function nextEmployeeCode() {
  const last = await prisma.employee.findFirst({ orderBy: { createdAt: "desc" }, select: { employeeCode: true } });
  const lastNum = last ? parseInt(last.employeeCode.replace(/\D/g, ""), 10) || 0 : 0;
  return `EMP-${String(lastNum + 1).padStart(4, "0")}`;
}

export const POST = withRoute(async (req: Request) => {
  const actingUser = await requireRole("SUPER_ADMIN", "HR_ADMIN");
  const body = employeeCreateSchema.parse(await req.json());

  const existing = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
  if (existing) throw new ApiError("An account with this email already exists", "DUPLICATE_EMAIL", 409);

  // Only Super Admin can create Admin/HR/Catering accounts; HR can only create Employee accounts.
  if (body.role !== "EMPLOYEE" && actingUser.role !== "SUPER_ADMIN") {
    throw new ApiError("Only a Super Admin can create non-employee accounts", "FORBIDDEN", 403);
  }

  const passwordHash = await hashPassword(body.initialPassword);
  const employeeCode = await nextEmployeeCode();

  const created = await prisma.user.create({
    data: {
      email: body.email.toLowerCase(),
      passwordHash,
      role: body.role,
      employee: {
        create: {
          employeeCode,
          name: body.name,
          email: body.email.toLowerCase(),
          phone: body.phone,
          designation: body.designation,
          departmentId: body.departmentId,
          joiningDate: body.joiningDate
        }
      }
    },
    include: { employee: { include: { department: true } } }
  });

  await writeAudit({
    userId: actingUser.id,
    action: "EMPLOYEE_CREATE",
    entity: "Employee",
    entityId: created.employee?.id,
    newValue: { employeeCode, name: body.name, email: body.email, role: body.role }
  });

  return ok(created.employee, "Employee created", 201);
});
