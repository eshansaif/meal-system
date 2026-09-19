-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'HR_ADMIN', 'EMPLOYEE', 'CATERING');

-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "MealTypeCode" AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER');

-- CreateEnum
CREATE TYPE "DayType" AS ENUM ('HOLIDAY', 'SPECIAL_WORKING_DAY');

-- CreateEnum
CREATE TYPE "ResponseStatus" AS ENUM ('NO_RESPONSE', 'TAKING', 'NOT_TAKING');

-- CreateEnum
CREATE TYPE "ServingStatus" AS ENUM ('PENDING', 'SERVED', 'NOT_SERVED', 'CANCELLED', 'EXTRA');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'MOBILE_BANKING', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentStatusFlag" AS ENUM ('ACTIVE', 'VOIDED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PAID', 'PARTIALLY_PAID', 'UNPAID', 'OVERPAID');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "employeeCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "designation" TEXT,
    "departmentId" TEXT NOT NULL,
    "joiningDate" TIMESTAMP(3) NOT NULL,
    "leavingDate" TIMESTAMP(3),
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealType" (
    "id" TEXT NOT NULL,
    "code" "MealTypeCode" NOT NULL,
    "name" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "cutoffTime" TEXT NOT NULL,
    "chargeOnServedOnly" BOOLEAN NOT NULL DEFAULT true,
    "allowModificationBeforeCutoff" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealPriceHistory" (
    "id" TEXT NOT NULL,
    "mealTypeId" TEXT NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MealPriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarException" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" "DayType" NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalendarException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealResponse" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "mealTypeId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" "ResponseStatus" NOT NULL DEFAULT 'NO_RESPONSE',
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "respondedAt" TIMESTAMP(3),
    "lastModifiedAt" TIMESTAMP(3),
    "isOverride" BOOLEAN NOT NULL DEFAULT false,
    "overriddenByUserId" TEXT,
    "isMonthlyDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealConsumption" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "mealTypeId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "servingStatus" "ServingStatus" NOT NULL DEFAULT 'PENDING',
    "servedAt" TIMESTAMP(3),
    "unitPriceApplied" DECIMAL(10,2),
    "priceHistoryId" TEXT,
    "isChargeable" BOOLEAN NOT NULL DEFAULT false,
    "chargeAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "settlementMonth" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealConsumption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "referenceNo" TEXT,
    "settlementMonth" TEXT NOT NULL,
    "remarks" TEXT,
    "status" "PaymentStatusFlag" NOT NULL DEFAULT 'ACTIVE',
    "voidReason" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidedByUserId" TEXT,
    "recordedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settlement" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "settlementMonth" TEXT NOT NULL,
    "mealsServed" INTEGER NOT NULL DEFAULT 0,
    "mealCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "previousOutstanding" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "paymentsThisMonth" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalPaid" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "outstanding" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "isFinalized" BOOLEAN NOT NULL DEFAULT false,
    "finalizedAt" TIMESTAMP(3),
    "finalizedByUserId" TEXT,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "previousValue" JSONB,
    "newValue" JSONB,
    "reason" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_employeeCode_key" ON "Employee"("employeeCode");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_email_key" ON "Employee"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_userId_key" ON "Employee"("userId");

-- CreateIndex
CREATE INDEX "Employee_departmentId_idx" ON "Employee"("departmentId");

-- CreateIndex
CREATE INDEX "Employee_status_idx" ON "Employee"("status");

-- CreateIndex
CREATE INDEX "Employee_name_idx" ON "Employee"("name");

-- CreateIndex
CREATE UNIQUE INDEX "MealType_code_key" ON "MealType"("code");

-- CreateIndex
CREATE INDEX "MealPriceHistory_mealTypeId_effectiveFrom_idx" ON "MealPriceHistory"("mealTypeId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarException_date_key" ON "CalendarException"("date");

-- CreateIndex
CREATE UNIQUE INDEX "OrgSetting_key_key" ON "OrgSetting"("key");

-- CreateIndex
CREATE INDEX "MealResponse_date_idx" ON "MealResponse"("date");

-- CreateIndex
CREATE INDEX "MealResponse_mealTypeId_date_idx" ON "MealResponse"("mealTypeId", "date");

-- CreateIndex
CREATE INDEX "MealResponse_status_idx" ON "MealResponse"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MealResponse_employeeId_mealTypeId_date_key" ON "MealResponse"("employeeId", "mealTypeId", "date");

-- CreateIndex
CREATE INDEX "MealConsumption_date_idx" ON "MealConsumption"("date");

-- CreateIndex
CREATE INDEX "MealConsumption_mealTypeId_date_idx" ON "MealConsumption"("mealTypeId", "date");

-- CreateIndex
CREATE INDEX "MealConsumption_servingStatus_idx" ON "MealConsumption"("servingStatus");

-- CreateIndex
CREATE INDEX "MealConsumption_settlementMonth_idx" ON "MealConsumption"("settlementMonth");

-- CreateIndex
CREATE INDEX "MealConsumption_employeeId_settlementMonth_idx" ON "MealConsumption"("employeeId", "settlementMonth");

-- CreateIndex
CREATE UNIQUE INDEX "MealConsumption_employeeId_mealTypeId_date_key" ON "MealConsumption"("employeeId", "mealTypeId", "date");

-- CreateIndex
CREATE INDEX "Payment_employeeId_settlementMonth_idx" ON "Payment"("employeeId", "settlementMonth");

-- CreateIndex
CREATE INDEX "Payment_settlementMonth_idx" ON "Payment"("settlementMonth");

-- CreateIndex
CREATE INDEX "Payment_paymentDate_idx" ON "Payment"("paymentDate");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Payment_referenceNo_idx" ON "Payment"("referenceNo");

-- CreateIndex
CREATE INDEX "Settlement_settlementMonth_idx" ON "Settlement"("settlementMonth");

-- CreateIndex
CREATE INDEX "Settlement_paymentStatus_idx" ON "Settlement"("paymentStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Settlement_employeeId_settlementMonth_key" ON "Settlement"("employeeId", "settlementMonth");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPriceHistory" ADD CONSTRAINT "MealPriceHistory_mealTypeId_fkey" FOREIGN KEY ("mealTypeId") REFERENCES "MealType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealResponse" ADD CONSTRAINT "MealResponse_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealResponse" ADD CONSTRAINT "MealResponse_mealTypeId_fkey" FOREIGN KEY ("mealTypeId") REFERENCES "MealType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealConsumption" ADD CONSTRAINT "MealConsumption_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealConsumption" ADD CONSTRAINT "MealConsumption_mealTypeId_fkey" FOREIGN KEY ("mealTypeId") REFERENCES "MealType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealConsumption" ADD CONSTRAINT "MealConsumption_priceHistoryId_fkey" FOREIGN KEY ("priceHistoryId") REFERENCES "MealPriceHistory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
