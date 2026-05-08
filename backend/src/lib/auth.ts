import { createHmac, randomBytes } from "crypto";

const JWT_SECRET = process.env.JWT_SECRET || "ro-marketplace-dev-secret";

function b64url(s: string) { return Buffer.from(s).toString("base64url"); }
function b64dec(s: string) { return Buffer.from(s, "base64url").toString("utf-8"); }

export function signJwt(payload: Record<string, unknown>): string {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000) }));
  const sig = createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}

export function verifyJwt(token: string): Record<string, unknown> | null {
  try {
    const [header, body, sig] = token.split(".");
    if (!header || !body || !sig) return null;
    const expected = createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
    if (sig !== expected) return null;
    return JSON.parse(b64dec(body));
  } catch { return null; }
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = createHmac("sha256", salt).update(password).digest("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  return createHmac("sha256", salt).update(password).digest("hex") === hash;
}
