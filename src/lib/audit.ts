import { prisma } from "./db";

export async function writeAudit(params: {
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string;
  previousValue?: unknown;
  newValue?: unknown;
  reason?: string;
  ipAddress?: string | null;
}) {
  await prisma.auditLog.create({
    data: {
      userId: params.userId ?? null,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      previousValue: params.previousValue as any,
      newValue: params.newValue as any,
      reason: params.reason,
      ipAddress: params.ipAddress ?? undefined
    }
  });
}
