import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import type { Role } from "@prisma/client";

const JWT_SECRET = process.env.JWT_SECRET as string;
const COOKIE_NAME = "meal_session";
const TOKEN_TTL = "12h";

if (!JWT_SECRET && process.env.NODE_ENV === "production") {
  // Fail loudly at build/runtime rather than silently signing with "undefined".
  throw new Error("JWT_SECRET environment variable is required.");
}

export interface SessionPayload {
  userId: string;
  role: Role;
  email: string;
  employeeId?: string | null;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function signSession(payload: SessionPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as SessionPayload;
  } catch {
    return null;
  }
}

/** Reads and verifies the session cookie for the current request (Server Component / Route Handler). */
export function getSession(): SessionPayload | null {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export function setSessionCookie(token: string) {
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12
  });
}

export function clearSessionCookie() {
  cookies().set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
}

/** Loads the fresh user record for the current session, re-checking isActive. */
export async function requireUser() {
  const session = getSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { employee: true }
  });
  if (!user || !user.isActive) return null;
  return user;
}
