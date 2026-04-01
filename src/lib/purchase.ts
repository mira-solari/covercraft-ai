import { createHmac, randomBytes } from "crypto";

// ---------------------------------------------------------------------------
// Purchase token utilities
//
// We store purchase state in a signed, HTTP-only cookie so that:
//   1. The client can't forge it (HMAC-SHA256 signature)
//   2. The server can validate it on every /api/generate call
//   3. No database or user accounts needed
//
// Cookie value format:  base64url(JSON payload).signature
// ---------------------------------------------------------------------------

export const COOKIE_NAME = "af_purchase";

// Free-tier cookie: unsigned, just tracks generation count
export const FREE_COOKIE_NAME = "af_free";

const SIGNING_KEY =
  process.env.PURCHASE_SIGNING_KEY ||
  process.env.STRIPE_SECRET_KEY ||
  "applyfaster-fallback-key";

export type PlanType = "free" | "single" | "pro";

export interface PurchasePayload {
  plan: PlanType;
  /** Unique token for this purchase (maps to Stripe session) */
  token: string;
  /** Stripe checkout session ID */
  sessionId: string;
  /** Stripe subscription ID (pro only) */
  subscriptionId?: string;
  /** ISO timestamp when the purchase was verified */
  purchasedAt: string;
  /** For single: total generations allowed (1 initial + 3 regen = 4) */
  generationsAllowed: number;
  /** For single: how many generations have been used */
  generationsUsed: number;
  /** For pro: subscription period end (ISO timestamp) */
  periodEnd?: string;
}

// ---------------------------------------------------------------------------
// Signing / verification
// ---------------------------------------------------------------------------

function sign(payload: string): string {
  return createHmac("sha256", SIGNING_KEY).update(payload).digest("hex");
}

export function createPurchaseCookie(payload: PurchasePayload): string {
  const json = JSON.stringify(payload);
  const b64 = Buffer.from(json).toString("base64url");
  const sig = sign(b64);
  return `${b64}.${sig}`;
}

export function parsePurchaseCookie(
  cookieValue: string | undefined
): PurchasePayload | null {
  if (!cookieValue) return null;
  try {
    const [b64, sig] = cookieValue.split(".");
    if (!b64 || !sig) return null;
    if (sign(b64) !== sig) {
      console.warn("Purchase cookie signature mismatch — possible tampering");
      return null;
    }
    const json = Buffer.from(b64, "base64url").toString("utf-8");
    return JSON.parse(json) as PurchasePayload;
  } catch {
    return null;
  }
}

export function generateToken(): string {
  return randomBytes(16).toString("hex");
}

// ---------------------------------------------------------------------------
// Cookie header helpers (for Route Handlers)
// ---------------------------------------------------------------------------

export function purchaseCookieHeader(
  payload: PurchasePayload,
  maxAgeDays: number = 365
): string {
  const value = createPurchaseCookie(payload);
  const maxAge = maxAgeDays * 24 * 60 * 60;
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${maxAge}`;
}

export function clearPurchaseCookieHeader(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0`;
}

export function getPurchaseFromRequest(
  cookieHeader: string | null
): PurchasePayload | null {
  if (!cookieHeader) return null;
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE_NAME}=`));
  if (!match) return null;
  const value = match.slice(COOKIE_NAME.length + 1);
  return parsePurchaseCookie(value);
}

/** Read the free-tier generation count from cookies */
export function getFreeCountFromRequest(cookieHeader: string | null): number {
  if (!cookieHeader) return 0;
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${FREE_COOKIE_NAME}=`));
  if (!match) return 0;
  const val = parseInt(match.slice(FREE_COOKIE_NAME.length + 1), 10);
  return isNaN(val) ? 0 : val;
}

export function freeCountCookieHeader(count: number): string {
  // Expires in 1 year. Not HttpOnly so client JS can read it to show UI state.
  const maxAge = 365 * 24 * 60 * 60;
  return `${FREE_COOKIE_NAME}=${count}; Path=/; SameSite=Lax; Secure; Max-Age=${maxAge}`;
}

// ---------------------------------------------------------------------------
// Usage-limit helpers
// ---------------------------------------------------------------------------

/** How many generations does the plan allow? */
export function getGenerationLimit(plan: PlanType): number {
  switch (plan) {
    case "single":
      return 4; // 1 initial + 3 regenerations
    case "pro":
      return Infinity;
    case "free":
    default:
      return 1;
  }
}

/** Is this purchase still valid (not expired, not used up)? */
export function isPurchaseValid(purchase: PurchasePayload): boolean {
  if (purchase.plan === "pro") {
    // Check subscription period hasn't ended
    if (purchase.periodEnd) {
      return new Date(purchase.periodEnd) > new Date();
    }
    // If no periodEnd recorded, trust it for 35 days from purchase
    const purchaseDate = new Date(purchase.purchasedAt);
    const expiryDate = new Date(
      purchaseDate.getTime() + 35 * 24 * 60 * 60 * 1000
    );
    return expiryDate > new Date();
  }

  if (purchase.plan === "single") {
    const used = purchase.generationsUsed ?? 0;
    const allowed = purchase.generationsAllowed ?? 4;
    return used < allowed;
  }

  return false; // "free" is not a paid purchase
}
