import { PrismaClient, Role, ResponseStatus, ServingStatus, PaymentMethod } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEPARTMENTS = ["HR & Admin", "IT", "Accounts", "Sales", "Marketing", "Operations"];

const FIRST_NAMES = ["Rahim", "Karim", "Fatema", "Ayesha", "Jahid", "Nasrin", "Tanvir", "Shamim", "Rupa", "Sadia", "Imran", "Farhana", "Mahmud", "Rina", "Kamal", "Shirin", "Habib", "Nazma", "Rafiq", "Lubna"];
const LAST_NAMES = ["Islam", "Ahmed", "Hossain", "Rahman", "Khan", "Akter", "Chowdhury", "Sarkar", "Talukder", "Begum"];

function pad(n: number) {
  return String(n).padStart(4, "0");
}

async function main() {
  console.log("Seeding database...");

  // --- Departments ---
  const departments = await Promise.all(
    DEPARTMENTS.map((name) => prisma.department.upsert({ where: { name }, update: {}, create: { name } }))
  );

  // --- Meal types ---
  const lunch = await prisma.mealType.upsert({
    where: { code: "LUNCH" },
    update: {},
    create: {
      code: "LUNCH",
      name: "Lunch",
      isEnabled: true,
      cutoffTime: "10:30",
      chargeOnServedOnly: true,
      allowModificationBeforeCutoff: true
    }
  });
  await prisma.mealType.upsert({
    where: { code: "BREAKFAST" },
    update: {},
    create: { code: "BREAKFAST", name: "Breakfast", isEnabled: false, cutoffTime: "08:00" }
  });
  await prisma.mealType.upsert({
    where: { code: "DINNER" },
    update: {},
    create: { code: "DINNER", name: "Dinner", isEnabled: false, cutoffTime: "17:00" }
  });

  // --- Working days: Sunday-Thursday (Bangladesh standard office week) ---
  await prisma.orgSetting.upsert({
    where: { key: "WORKING_DAYS" },
    update: {},
    create: { key: "WORKING_DAYS", value: [0, 1, 2, 3, 4] }
  });

  // --- Price history: Sep = 100, Oct = 110 ---
  const priceSep = await prisma.mealPriceHistory.create({
    data: {
      mealTypeId: lunch.id,
      unitPrice: 100,
      effectiveFrom: new Date("2026-09-01T00:00:00.000Z"),
      effectiveTo: new Date("2026-09-30T00:00:00.000Z")
    }
  });
  const priceOct = await prisma.mealPriceHistory.create({
    data: {
      mealTypeId: lunch.id,
      unitPrice: 110,
      effectiveFrom: new Date("2026-10-01T00:00:00.000Z"),
      effectiveTo: null
    }
  });

  // --- Super Admin ---
  const superAdminPass = await bcrypt.hash("SuperAdmin@123", 10);
  await prisma.user.upsert({
    where: { email: "superadmin@company.com" },
    update: {},
    create: { email: "superadmin@company.com", passwordHash: superAdminPass, role: Role.SUPER_ADMIN }
  });

  // --- HR Admin ---
  const hrPass = await bcrypt.hash("HrAdmin@123", 10);
  await prisma.user.upsert({
    where: { email: "hr@company.com" },
    update: {},
    create: { email: "hr@company.com", passwordHash: hrPass, role: Role.HR_ADMIN }
  });

  // --- 20 employees across departments ---
  const employeePass = await bcrypt.hash("Employee@123", 10);
  const employees = [];
  for (let i = 0; i < 20; i++) {
    const first = FIRST_NAMES[i];
    const last = LAST_NAMES[i % LAST_NAMES.length];
    const dept = departments[i % departments.length];
    const email = `${first.toLowerCase()}.${last.toLowerCase()}${i}@company.com`;
    const employeeCode = `EMP-${pad(i + 1)}`;

    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        passwordHash: employeePass,
        role: Role.EMPLOYEE,
        employee: {
          create: {
            employeeCode,
            name: `${first} ${last}`,
            email,
            phone: `+8801${700000000 + i}`,
            designation: i % 5 === 0 ? "Team Lead" : "Executive",
            departmentId: dept.id,
            joiningDate: new Date(2024, i % 12, 1)
          }
        }
      },
      include: { employee: true }
    });
    employees.push(user.employee!);
  }

  console.log(`Created ${employees.length} employees.`);

  // --- Meal responses + consumption + charges for Sep 1 - Sep 25, 2026 (weekdays only) ---
  const start = new Date(Date.UTC(2026, 8, 1));
  const end = new Date(Date.UTC(2026, 8, 25));
  let dayCount = 0;

  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const day = d.getUTCDay();
    if (day === 5 || day === 6) continue; // Fri/Sat weekend in this org
    const date = new Date(d);
    dayCount++;

    for (const emp of employees) {
      // ~85% of the time the employee takes lunch
      const takes = Math.random() < 0.85;
      const status: ResponseStatus = takes ? "TAKING" : "NOT_TAKING";

      await prisma.mealResponse.create({
        data: {
          employeeId: emp.id,
          mealTypeId: lunch.id,
          date,
          status,
          isLocked: true,
          respondedAt: date,
          lastModifiedAt: date
        }
      });

      if (takes) {
        // ~92% actually served, ~8% not served despite requesting
        const served = Math.random() < 0.92;
        const servingStatus: ServingStatus = served ? "SERVED" : "NOT_SERVED";
        await prisma.mealConsumption.create({
          data: {
            employeeId: emp.id,
            mealTypeId: lunch.id,
            date,
            servingStatus,
            servedAt: served ? date : null,
            unitPriceApplied: served ? priceSep.unitPrice : null,
            priceHistoryId: served ? priceSep.id : null,
            isChargeable: served,
            chargeAmount: served ? priceSep.unitPrice : 0,
            settlementMonth: "2026-09"
          }
        });
      }
    }
  }
  console.log(`Created meal history for ${dayCount} working days in September 2026.`);

  // --- Settlements for Sep 2026 + varied payment states ---
  const { computeAndSaveSettlement } = await import("../src/lib/settlement");

  for (let i = 0; i < employees.length; i++) {
    const emp = employees[i];
    await computeAndSaveSettlement(emp.id, "2026-09");
    const settlement = await prisma.settlement.findUnique({
      where: { employeeId_settlementMonth: { employeeId: emp.id, settlementMonth: "2026-09" } }
    });
    if (!settlement) continue;

    const mealCost = Number(settlement.mealCost);
    let paymentAmount = 0;
    const bucket = i % 4;
    if (bucket === 0) paymentAmount = mealCost; // PAID
    else if (bucket === 1) paymentAmount = Math.round(mealCost * 0.5); // PARTIALLY_PAID
    else if (bucket === 2) paymentAmount = 0; // UNPAID
    else paymentAmount = mealCost + 200; // OVERPAID

    if (paymentAmount > 0) {
      await prisma.payment.create({
        data: {
          employeeId: emp.id,
          paymentDate: new Date(Date.UTC(2026, 8, 28)),
          amount: paymentAmount,
          method: [PaymentMethod.CASH, PaymentMethod.BANK_TRANSFER, PaymentMethod.MOBILE_BANKING][i % 3],
          referenceNo: `PMT-2026-09-${pad(i + 1)}`,
          settlementMonth: "2026-09",
          remarks: "September lunch settlement",
          recordedByUserId: (await prisma.user.findUniqueOrThrow({ where: { email: "hr@company.com" } })).id
        }
      });
      await computeAndSaveSettlement(emp.id, "2026-09");
    }
  }

  console.log("Settlements computed for September 2026 with varied payment states.");
  console.log("\nSeed complete. Login credentials:");
  console.log("  Super Admin: superadmin@company.com / SuperAdmin@123");
  console.log("  HR Admin:    hr@company.com / HrAdmin@123");
  console.log("  Employee:    (any generated email, e.g. rahim.islam0@company.com) / Employee@123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
