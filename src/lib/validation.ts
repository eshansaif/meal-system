import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required")
});

export const employeeCreateSchema = z.object({
  name: z.string().min(2, "Name is too short"),
  email: z.string().email(),
  phone: z.string().optional(),
  designation: z.string().optional(),
  departmentId: z.string().min(1, "Department is required"),
  joiningDate: z.coerce.date(),
  role: z.enum(["EMPLOYEE", "HR_ADMIN", "SUPER_ADMIN", "CATERING"]).default("EMPLOYEE"),
  initialPassword: z.string().min(6, "Password must be at least 6 characters")
});

export const employeeUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
  designation: z.string().optional(),
  departmentId: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional()
});

export const departmentSchema = z.object({
  name: z.string().min(2, "Department name is too short")
});

export const mealPriceSchema = z.object({
  mealTypeId: z.string().min(1),
  unitPrice: z.coerce.number().positive("Price must be greater than zero"),
  effectiveFrom: z.coerce.date()
});

export const mealResponseSchema = z.object({
  mealTypeId: z.string().min(1),
  date: z.coerce.date().optional(), // defaults to today
  status: z.enum(["TAKING", "NOT_TAKING"])
});

export const servingUpdateSchema = z.object({
  mealTypeId: z.string().min(1),
  date: z.coerce.date(),
  employeeIds: z.array(z.string().min(1)).min(1, "Select at least one employee"),
  servingStatus: z.enum(["PENDING", "SERVED", "NOT_SERVED", "CANCELLED", "EXTRA"]),
  remarks: z.string().optional()
});

export const paymentCreateSchema = z.object({
  employeeId: z.string().min(1),
  paymentDate: z.coerce.date(),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  method: z.enum(["CASH", "BANK_TRANSFER", "MOBILE_BANKING", "OTHER"]),
  referenceNo: z.string().optional(),
  settlementMonth: z.string().regex(/^\d{4}-\d{2}$/, "Use YYYY-MM format"),
  remarks: z.string().optional()
});

export const paymentVoidSchema = z.object({
  reason: z.string().min(5, "A reason of at least 5 characters is required")
});

export const holidaySchema = z.object({
  date: z.coerce.date(),
  type: z.enum(["HOLIDAY", "SPECIAL_WORKING_DAY"]),
  label: z.string().min(2)
});

export const mealTypeSettingsSchema = z.object({
  isEnabled: z.boolean().optional(),
  cutoffTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Use HH:mm 24-hour format")
    .optional(),
  chargeOnServedOnly: z.boolean().optional(),
  allowModificationBeforeCutoff: z.boolean().optional()
});
