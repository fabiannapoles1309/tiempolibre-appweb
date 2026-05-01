import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";

const JWT_SECRET = process.env.SESSION_SECRET ?? process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error(
    "SESSION_SECRET (or JWT_SECRET) must be set for authentication.",
  );
}

const SECRET: string = JWT_SECRET;

export const COOKIE_NAME = "rapidoo_session";
export const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export type Role = "SUPERUSER" | "ADMIN" | "CLIENTE" | "DRIVER" | "MARKETING";

export interface JwtPayload {
  sub: number;
  email: string;
  role: Role;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function signToken(payload: JwtPayload): string {
  const options: SignOptions = { expiresIn: TOKEN_TTL_SECONDS };
  return jwt.sign(payload, SECRET, options);
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, SECRET);
    if (typeof decoded === "object" && decoded !== null && "sub" in decoded) {
      return decoded as unknown as JwtPayload;
    }
    return null;
  } catch {
    return null;
  }
}
