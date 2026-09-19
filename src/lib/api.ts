import { NextResponse } from "next/server";
import type { Role } from "@prisma/client";
import { requireUser } from "./auth";

export function ok(data: unknown, message = "Success", status = 200) {
  return NextResponse.json({ success: true, message, data }, { status });
}

export function fail(message: string, code: string, status = 400) {
  return NextResponse.json({ success: false, message, code }, { status });
}

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(message: string, code: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

/**
 * Loads the current user and throws a 401/403 ApiError if unauthenticated
 * or not in an allowed role. Use inside route handlers wrapped in withRoute.
 */
export async function requireRole(...roles: Role[]) {
  const user = await requireUser();
  if (!user) throw new ApiError("Not authenticated", "UNAUTHENTICATED", 401);
  if (roles.length && !roles.includes(user.role)) {
    throw new ApiError("You do not have permission to perform this action", "FORBIDDEN", 403);
  }
  return user;
}

/** Wraps a route handler, converting ApiError / ZodError into consistent JSON responses. */
export function withRoute(handler: (req: Request, ctx: any) => Promise<NextResponse>) {
  return async (req: Request, ctx: any) => {
    try {
      return await handler(req, ctx);
    } catch (err: any) {
      if (err instanceof ApiError) {
        return fail(err.message, err.code, err.status);
      }
      if (err?.name === "ZodError") {
        return fail(err.errors?.[0]?.message || "Invalid input", "VALIDATION_ERROR", 422);
      }
      console.error("Unhandled API error:", err);
      return fail("Internal server error", "INTERNAL_ERROR", 500);
    }
  };
}
