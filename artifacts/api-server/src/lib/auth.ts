import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
} from "node:crypto";
import { promisify } from "node:util";
import type { NextFunction, Request, Response } from "express";
import { and, eq, gt } from "drizzle-orm";
import { db, classesTable, sessionsTable, usersTable } from "@workspace/db";

const scrypt = promisify(scryptCallback);
const SESSION_COOKIE = "thanwy_session";

declare global {
  namespace Express {
    interface Request {
      thanwyUser?: typeof usersTable.$inferSelect;
    }
  }
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [salt, expected] = stored.split(":");
  if (!salt || !expected) return false;
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return derived.toString("hex") === expected;
}

export function hashQrToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await db.insert(sessionsTable).values({
    token,
    userId,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
  });
  return token;
}

export async function setSessionCookie(
  res: Response,
  userId: string,
): Promise<void> {
  const token = await createSession(userId);
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 60 * 24 * 30,
    path: "/",
  });
}

export async function clearSession(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.[SESSION_COOKIE];
  if (token) {
    await db.delete(sessionsTable).where(eq(sessionsTable.token, token));
  }
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}

export async function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = req.cookies?.[SESSION_COOKIE];
    if (token) {
      const [result] = await db
        .select({ user: usersTable })
        .from(sessionsTable)
        .innerJoin(usersTable, eq(sessionsTable.userId, usersTable.id))
        .where(
          and(
            eq(sessionsTable.token, token),
            gt(sessionsTable.expiresAt, new Date()),
          ),
        )
        .limit(1);
      if (result) req.thanwyUser = result.user;
    }
    next();
  } catch (error) {
    next(error);
  }
}

export function requireAuth(req: Request, res: Response): boolean {
  if (!req.thanwyUser) {
    res.status(401).json({ error: "غير مسموح لك تدخل الصفحة دي." });
    return false;
  }
  return true;
}

export function requireRole(
  req: Request,
  res: Response,
  role: "STUDENT" | "SERVANT",
): boolean {
  if (!requireAuth(req, res)) return false;
  if (req.thanwyUser?.role !== role) {
    res.status(403).json({ error: "مش مسموح لك تدخل الصفحة دي." });
    return false;
  }
  return true;
}

export async function getClassName(classId: string): Promise<string> {
  const [classRecord] = await db
    .select({ name: classesTable.name })
    .from(classesTable)
    .where(eq(classesTable.id, classId))
    .limit(1);
  return classRecord?.name ?? "فصل غير محدد";
}

export async function serializeUser(
  user: typeof usersTable.$inferSelect,
): Promise<{
  id: string;
  name: string;
  email: string;
  role: "STUDENT" | "SERVANT";
  schoolYear: string;
  className: string;
  avatarUrl: null;
}> {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as "STUDENT" | "SERVANT",
    schoolYear: user.schoolYear,
    className: await getClassName(user.classId),
    avatarUrl: null,
  };
}